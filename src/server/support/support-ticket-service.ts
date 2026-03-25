import * as repo from "./support-ticket-repository";
import { notifyEntry } from "@/server/notifications/notification-service";
import { AppError } from "@/lib/errors";
import { HTTP_STATUS } from "@/helpers/constants";
import { z } from "zod";
import { createTicketSchema } from "@/validators/support";

/** Inferred input type from the create ticket Zod schema. */
type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Max attempts to generate a unique ticket number before giving up. */
const TICKET_NUMBER_MAX_RETRIES = 5;

/**
 * Generates a random ticket number in the format SUP-XXXXXX (uppercase base36).
 */
function generateTicketNumber(): string {
  return `SUP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Creates a new support ticket with a unique ticket number and initial message.
 * Enforces the `max_open_tickets_per_user` setting if configured.
 * Retries ticket number generation up to 5 times on unique constraint collision.
 */
export async function createSupportTicket(
  userId: string,
  data: CreateTicketInput
) {
  // Enforce max open tickets per user if the setting is configured.
  const settings = await repo.getSettings();
  const maxOpenRaw = settings["max_open_tickets_per_user"];
  if (maxOpenRaw !== undefined) {
    const maxOpen = parseInt(maxOpenRaw, 10);
    if (!isNaN(maxOpen) && maxOpen > 0) {
      const openCount = await repo.countOpenTicketsByUser(userId);
      if (openCount >= maxOpen) {
        throw new AppError(
          "Ticket limit reached",
          HTTP_STATUS.UNPROCESSABLE_ENTITY
        );
      }
    }
  }

  // Attempt ticket creation with retry loop to handle rare unique number collisions.
  let lastError: unknown;
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
        data.message
      );

      await notifyEntry({
        userId,
        entryId: ticket.id,
        type: "support_ticket_created",
      });

      return ticket;
    } catch (err: unknown) {
      // Postgres unique_violation code is 23505. Retry only on that error.
      const code =
        err &&
        typeof err === "object" &&
        "code" in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === "23505") {
        lastError = err;
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
  status?: string
) {
  const filters: { userId?: string; status?: string } = {};
  if (role !== "admin") {
    filters.userId = userId;
  }
  if (status) {
    filters.status = status;
  }

  return await repo.listTickets(filters);
}

/**
 * Updates a ticket status (Admin only).
 */
export async function updateSupportTicketStatus(
  ticketId: string,
  status: string
) {
  return await repo.updateTicketStatus(ticketId, status);
}

/**
 * Retrieves global support settings with .env fallback for support email.
 */
export async function getSupportSettings() {
  const dbSettings = await repo.getSettings();
  return {
    support_email:
      dbSettings.support_email ||
      process.env.SUPPORT_EMAIL ||
      "support@lavo.ca",
    ...dbSettings,
  };
}

/**
 * Updates batch settings in the database.
 */
export async function updateSupportSettings(settings: Record<string, string>) {
  for (const [key, value] of Object.entries(settings)) {
    await repo.updateSetting(key, value);
  }
}
