import * as repo from "./support-ticket-repository";
import { notifyEntry } from "@/server/notifications/notification-service";
import { AppError } from "@/lib/errors";
import { HTTP_STATUS } from "@/helpers/constants";
import { z } from "zod";
import { createTicketSchema, supportStatusSchema } from "@/validators/support";
import { randomBytes } from "crypto";

type SupportStatus = z.infer<typeof supportStatusSchema>;

/** Inferred input type from the create ticket Zod schema. */
type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Max attempts to generate a unique ticket number before giving up. */
const TICKET_NUMBER_MAX_RETRIES = 5;

/**
 * Generates a cryptographically random ticket number in the format SUP-XXXXXXXX
 * (8 uppercase hex chars = 32 bits of entropy, non-predictable).
 */
function generateTicketNumber(): string {
  return `SUP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Creates a new support ticket with a unique ticket number and initial message.
 * Enforces the `max_open_tickets_per_user` setting if configured.
 * Retries ticket number generation up to 5 times on unique constraint collision.
 *
 * The open-ticket limit is enforced **inside** the same database transaction
 * that inserts the ticket (via `repo.createTicket`), eliminating the TOCTOU
 * race condition where two concurrent requests could both pass an external
 * count check and exceed the configured limit.
 */
export async function createSupportTicket(
  userId: string,
  data: CreateTicketInput
) {
  // Resolve the open-ticket limit from settings. The actual enforcement
  // happens atomically inside `repo.createTicket`.
  const settings = await repo.getSettings();
  const maxOpenRaw = settings["max_open_tickets_per_user"];
  let maxOpen: number | undefined;
  if (maxOpenRaw !== undefined) {
    const parsed = parseInt(maxOpenRaw, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      maxOpen = parsed;
    }
  }

  // Attempt ticket creation with retry loop to handle rare unique number collisions.
  for (let attempt = 0; attempt < TICKET_NUMBER_MAX_RETRIES; attempt++) {
    const ticketNumber = generateTicketNumber();
    try {
      const ticket = await repo.createTicket(
        {
          ticket_number: ticketNumber,
          created_by: userId,
          subject: data.subject,
          message: data.message,
          priority: data.priority,
          category: data.category,
          status: "ouvert",
        },
        data.message,
        maxOpen
      );

      await notifyEntry({
        userId,
        entryId: ticket.id,
        type: "support_ticket_created",
      });

      return ticket;
    } catch (err: unknown) {
      // Re-throw AppError (e.g. ticket limit reached) without retrying.
      if (err instanceof AppError) {
        throw err;
      }
      // Postgres unique_violation code is 23505. Retry only on that error.
      const code =
        err &&
        typeof err === "object" &&
        "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "23505") {
        continue;
      }
      throw err;
    }
  }

  throw new AppError(
    "Failed to generate a unique ticket number. Please try again.",
    HTTP_STATUS.SERVER_ERROR
  );
}

/**
 * Adds a message to a ticket thread. Restricts non-admins to their own tickets.
 */
export async function addSupportMessage(
  userId: string,
  ticketId: string,
  content: string,
  isAdmin: boolean
) {
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket) throw new AppError("Ticket not found", HTTP_STATUS.NOT_FOUND);

  // Prevent adding messages to closed tickets.
  if (ticket.status === "ferme") {
    throw new AppError(
      "Cannot add messages to a closed ticket",
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  // RBAC: Non-admins can only message their own tickets.
  if (!isAdmin && ticket.created_by !== userId) {
    throw new AppError("Forbidden", HTTP_STATUS.FORBIDDEN);
  }

  const message = await repo.addMessage({
    ticket_id: ticketId,
    sender_id: userId,
    content,
    is_from_admin: isAdmin,
  });

  const recipientId = isAdmin ? ticket.created_by : ticket.assigned_to;
  if (recipientId) {
    await notifyEntry({
      userId: recipientId,
      entryId: ticket.id,
      type: "support_message_received",
    });
  }
  // TODO: When ticket.assigned_to is null and a client sends a message, no admin
  // receives a notification. A future improvement should query for users with the
  // 'admin' role and notify them all (or use a dedicated admin notification channel).

  return message;
}

/**
 * Retrieves ticket details and messages. Restricts non-admins to their own tickets.
 */
export async function getTicketDetails(
  userId: string,
  role: string,
  ticketId: string
) {
  const ticket = await repo.findTicketById(ticketId);
  if (!ticket) throw new AppError("Ticket not found", HTTP_STATUS.NOT_FOUND);

  // RBAC: non-admins can only view their own tickets.
  if (role !== "admin" && ticket.created_by !== userId) {
    throw new AppError("Forbidden", HTTP_STATUS.FORBIDDEN);
  }

  return ticket;
}

/**
 * Lists tickets based on user role and optional status filter.
 */
export async function getSupportTickets(
  userId: string,
  role: string,
  status?: SupportStatus
) {
  const filters: { userId?: string; status?: SupportStatus } = {};
  if (role !== "admin") {
    filters.userId = userId;
  }
  if (status) {
    filters.status = status;
  }

  return await repo.listTickets(filters);
}

/**
 * Valid status transitions for support tickets.
 * A closed ticket cannot be re-opened or moved to any other state.
 */
const ALLOWED_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  ouvert:   ["en_cours", "resolu", "ferme"],
  en_cours: ["ouvert", "resolu", "ferme"],
  resolu:   ["ouvert", "en_cours", "ferme"],
  ferme:    [],
};

/**
 * Updates a ticket status (Admin only).
 * Enforces allowed transitions — a closed (ferme) ticket cannot be re-opened.
 */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: SupportStatus
) {
  const current = await repo.findTicketById(ticketId);
  if (!current) throw new AppError("Ticket not found", HTTP_STATUS.NOT_FOUND);

  const allowed = ALLOWED_TRANSITIONS[current.status as SupportStatus] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot transition ticket from '${current.status}' to '${status}'`,
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  const ticket = await repo.updateTicketStatus(ticketId, status);
  if (!ticket) throw new AppError("Ticket not found", HTTP_STATUS.NOT_FOUND);
  return ticket;
}

/**
 * Retrieves global support settings with .env fallback for support email.
 * `...dbSettings` is spread first so that the explicit `support_email` key
 * always wins — it applies the fallback chain even when the DB value is an
 * empty string (which would otherwise be returned as-is via the spread).
 */
export async function getSupportSettings(): Promise<Record<string, string>> {
  const dbSettings = await repo.getSettings();
  return {
    ...dbSettings,
    support_email:
      dbSettings.support_email ||
      process.env.SUPPORT_EMAIL ||
      "support@lavo.ca",
  };
}

/**
 * Updates batch settings in the database atomically.
 * All upserts succeed or none do (single transaction via repo.updateSettings).
 */
export async function updateSupportSettings(settings: Record<string, string>) {
  await repo.updateSettings(settings);
}
