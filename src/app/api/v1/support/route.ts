import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500, fromAppError } from '@/lib/responses';
import { createTicketSchema, mapZodErrors, supportStatusFilterSchema } from '@/validators/support';
import { createSupportTicket, getSupportTickets } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';
import { checkSlidingWindowRateLimit, normalizeRateLimitKey } from '@/lib/rate-limiter';
import { z } from 'zod';

/** Maximum number of tickets a user may create per hour. */
const TICKET_CREATE_LIMIT = 5;
/** Sliding window size for ticket creation rate limit: 1 hour. */
const TICKET_CREATE_WINDOW_SECS = 3600;
const listQuerySchema = z.object({
  status: supportStatusFilterSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().optional(),
});

/**
 * GET /api/v1/support
 * List tickets based on user role (Client/Station see their own, Admin sees all).
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { searchParams } = new URL(request.url);
  const queryParsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!queryParsed.success) {
    return error400('Validation failed');
  }

  try {
    const result = await getSupportTickets(
      auth.sub,
      auth.role,
      queryParsed.data.status,
      { limit: queryParsed.data.limit, cursor: queryParsed.data.cursor }
    );
    return successResponse({
      items: result.items,
      next_cursor: result.next_cursor,
      has_more: Boolean(result.next_cursor),
    });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

/**
 * POST /api/v1/support
 * Creates a new support ticket with initial message.
 * Rate limited: 5 tickets per hour per authenticated user.
 */
export async function POST(request: Request) {
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const rateLimitKey = normalizeRateLimitKey(`support:ticket:user:${auth.sub}`);
  const { allowed } = await checkSlidingWindowRateLimit(
    rateLimitKey,
    TICKET_CREATE_LIMIT,
    TICKET_CREATE_WINDOW_SECS
  );
  if (!allowed) return error429();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body');
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', undefined, mapZodErrors(parsed.error));
  }

  try {
    const ticket = await createSupportTicket(auth.sub, parsed.data);
    return successResponse(ticket, 'Ticket created successfully', 201);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
