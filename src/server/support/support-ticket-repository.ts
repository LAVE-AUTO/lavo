import { db } from "@/lib/db";
import {
  supportMessages,
  supportSettings,
  supportTickets,
} from "@/lib/db/schema";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

export type Ticket = typeof supportTickets.$inferSelect;
export type NewTicket = typeof supportTickets.$inferInsert;
export type Message = typeof supportMessages.$inferSelect;
export type NewMessage = typeof supportMessages.$inferInsert;
export type Setting = typeof supportSettings.$inferSelect;

/**
 * Creates a new support ticket and its initial message in a single transaction.
 */
export async function createTicket(
  ticketData: NewTicket,
  initialMessage: string
) {
  return await db.transaction(async (tx) => {
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
 * Finds a ticket by ID, including its message thread (ordered by creation).
 */
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

/**
 * Lists tickets with optional user and status filters.
 */
export async function listTickets(
  filters: { userId?: string; status?: string } = {}
) {
  const conditions = [];
  if (filters.userId) conditions.push(eq(supportTickets.created_by, filters.userId));
  if (filters.status) conditions.push(eq(supportTickets.status, filters.status));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  return await db.query.supportTickets.findMany({
    where: whereClause,
    orderBy: [desc(supportTickets.updated_at)],
    with: {
      createdByUser: {
        columns: SAFE_USER_COLUMNS,
      },
    },
  });
}

/**
 * Counts the open tickets (status 'ouvert' or 'en_cours') for a given user.
 */
export async function countOpenTicketsByUser(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.created_by, userId),
        inArray(supportTickets.status, ["ouvert", "en_cours"])
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Updates a ticket status and sets resolved_at if status is 'resolu'.
 */
export async function updateTicketStatus(id: string, status: string) {
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
 * Updates or creates a global support setting.
 */
export async function updateSetting(key: string, value: string) {
  await db
    .insert(supportSettings)
    .values({ key, value, updated_at: new Date() })
    .onConflictDoUpdate({
      target: supportSettings.key,
      set: { value, updated_at: new Date() },
    });
}
