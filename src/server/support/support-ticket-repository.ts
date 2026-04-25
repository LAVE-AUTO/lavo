import { db } from "@/lib/db";
import {
  supportMessages,
  supportSettings,
  supportTickets,
  users,
} from "@/lib/db/schema";
import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { AppError } from "@/lib/errors";
import { HTTP_STATUS } from "@/helpers/constants";
import type { z } from "zod";
import type { supportStatusSchema } from "@/validators/support";

/** Preview of the most recent message on a ticket — content truncated to 200 chars. */
export type LastMessagePreview = {
  content: string;
  created_at: Date;
} | null;

/** Status type derived from the canonical Zod schema — single source of truth. */
type TicketStatus = z.infer<typeof supportStatusSchema>;

export type Ticket = typeof supportTickets.$inferSelect;
export type NewTicket = typeof supportTickets.$inferInsert;
export type Message = typeof supportMessages.$inferSelect;
export type NewMessage = typeof supportMessages.$inferInsert;
export type Setting = typeof supportSettings.$inferSelect;

/**
 * Creates a new support ticket and its initial message in a single transaction.
 *
 * When `maxOpen` is provided (>= 0), the open-ticket count for the user is
 * checked **inside** the same transaction that inserts the ticket.  This
 * eliminates the TOCTOU race where two concurrent requests could both pass
 * an external count check and exceed the limit.
 *
 * @throws {AppError} 422 if the user already has `maxOpen` (or more) open tickets.
 */
export async function createTicket(
  ticketData: NewTicket,
  initialMessage: string,
  maxOpen?: number
) {
  return await db.transaction(async (tx) => {
    // Atomic open-ticket limit enforcement inside the same transaction.
    if (maxOpen !== undefined && maxOpen >= 0) {
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(supportTickets)
        .where(
          and(
            eq(supportTickets.created_by, ticketData.created_by),
            inArray(supportTickets.status, ["ouvert", "en_cours"] as const)
          )
        );
      const openCount = countResult[0]?.count ?? 0;
      if (openCount >= maxOpen) {
        throw new AppError(
          "Ticket limit reached",
          HTTP_STATUS.UNPROCESSABLE_ENTITY
        );
      }
    }

    const [ticket] = await tx
      .insert(supportTickets)
      .values(ticketData)
      .returning();

    await tx.insert(supportMessages).values({
      ticket_id: ticket.id,
      sender_id: ticket.created_by,
      content: initialMessage,
      is_from_admin: false,
    });

    return ticket;
  });
}

/**
 * Adds a message to an existing ticket and updates its last activity timestamp.
 */
export async function addMessage(messageData: NewMessage) {
  return await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(supportMessages)
      .values(messageData)
      .returning();

    await tx
      .update(supportTickets)
      .set({ updated_at: new Date() })
      .where(eq(supportTickets.id, messageData.ticket_id));

    return message;
  });
}

/**
 * Assigns or unassigns a ticket to a user (intended to be an admin).
 * Pass `null` for `assignedTo` to clear the current assignment.
 * Returns the updated ticket row, or null if the ticket was not found.
 */
export async function assignTicket(ticketId: string, assignedTo: string | null) {
  const [ticket] = await db
    .update(supportTickets)
    .set({ assigned_to: assignedTo, updated_at: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning();
  return ticket ?? null;
}

/**
 * Safe subset of user columns exposed in support ticket responses.
 * Never include password_hash, stripe_customer_id, or other sensitive fields.
 */
const SAFE_USER_COLUMNS = {
  id: true,
  first_name: true,
  last_name: true,
  email: true,
  role: true,
} as const;

/** Finds a ticket by ID, including its message thread (ordered ASC) and safe user info. */
export async function findTicketById(id: string) {
  return await db.query.supportTickets.findFirst({
    where: eq(supportTickets.id, id),
    with: {
      messages: {
        orderBy: [asc(supportMessages.created_at)],
      },
      createdByUser: {
        columns: SAFE_USER_COLUMNS,
      },
      assignedToAdmin: {
        columns: SAFE_USER_COLUMNS,
      },
    },
  });
}

/** Safe user columns projected into each ticket row. */
const SAFE_USER_SELECT = {
  id: users.id,
  first_name: users.first_name,
  last_name: users.last_name,
  email: users.email,
  role: users.role,
} as const;

/**
 * Lists tickets with optional user, status, and pagination filters.
 *
 * Uses a single SQL query with a LEFT JOIN LATERAL to fetch the most recent
 * message per ticket in one round-trip, eliminating the N+1 pattern that
 * `findMany({ with: { messages: { limit: 1 } } })` produces.
 *
 * Defaults: page=1, perPage=500 — backward-compatible with callers that pass no
 * pagination params. A COUNT query runs in parallel for the total row count.
 */
export async function listTickets(
  filters: {
    userId?: string;
    status?: TicketStatus;
    page?: number;
    perPage?: number;
  } = {}
) {
  const { userId, status, page = 1, perPage = 500 } = filters;
  const limit = Math.min(Math.floor(perPage), 500);
  const offset = (Math.max(1, Math.floor(page)) - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (userId) conditions.push(eq(supportTickets.created_by, userId));
  if (status) conditions.push(eq(supportTickets.status, status));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const ticketCols = getTableColumns(supportTickets);

  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(supportTickets)
      .where(whereClause),
    db
      .select({
        ...ticketCols,
        createdByUser: SAFE_USER_SELECT,
        lm_content: sql<string | null>`lm.content`,
        // Drizzle does not hydrate Date objects from lateral sub-select columns;
        // the raw value is an ISO string. We type it as string and convert below.
        lm_created_at: sql<string | null>`lm.created_at`,
      })
      .from(supportTickets)
      .leftJoin(users, eq(supportTickets.created_by, users.id))
      .leftJoin(
        sql`LATERAL (
          SELECT content, created_at
          FROM support_messages
          WHERE ticket_id = ${supportTickets.id}
          ORDER BY created_at DESC
          LIMIT 1
        ) lm`,
        sql`true`
      )
      .where(whereClause)
      .orderBy(desc(supportTickets.updated_at))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countRows[0]?.count ?? 0;

  const data = rows.map((row) => {
    const { lm_content, lm_created_at, ...ticket } = row;
    const lastMessage: LastMessagePreview =
      lm_content != null && lm_created_at != null
        ? {
            content:
              lm_content.length > 200
                ? lm_content.slice(0, 200) + "…"
                : lm_content,
            // lm_created_at comes from the lateral sub-select as a raw ISO string;
            // convert explicitly to avoid passing a string where Date is expected.
            created_at: new Date(lm_created_at),
          }
        : null;
    return { ...ticket, lastMessage };
  });

  return { data, total };
}

/**
 * Updates a ticket status and sets resolved_at if status is 'resolu'.
 * When transitioning away from 'resolu' (e.g. back to 'en_cours'), resolved_at
 * is cleared to null — this is intentional, not a default.
 */
export async function updateTicketStatus(
  id: string,
  status: TicketStatus
) {
  const [ticket] = await db
    .update(supportTickets)
    .set({
      status,
      updated_at: new Date(),
      resolved_at: status === "resolu" ? new Date() : null,
    })
    .where(eq(supportTickets.id, id))
    .returning();
  return ticket;
}

/**
 * Retrieves all global support settings.
 */
export async function getSettings() {
  const settings = await db.select().from(supportSettings);
  return settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Updates or creates multiple support settings in a single transaction.
 * All upserts succeed or none do.
 */
export async function updateSettings(settings: Record<string, string>) {
  const now = new Date();
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(settings)) {
      await tx
        .insert(supportSettings)
        .values({ key, value, updated_at: now })
        .onConflictDoUpdate({
          target: supportSettings.key,
          set: { value, updated_at: now },
        });
    }
  });
}
