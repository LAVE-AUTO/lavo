import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors } from '@/validators/auth';
import { createTicketSchema, supportStatusFilterSchema } from '@/validators/support';
import { createSupportTicket, getSupportTickets } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/support
 * List tickets based on user role (Client/Station see their own, Admin sees all).
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status') ?? undefined;

  // Validate the optional status filter against the allowed enum values.
  const statusResult = supportStatusFilterSchema.safeParse(rawStatus);
  if (!statusResult.success) {
    return error400('Invalid status filter. Allowed: ouvert, en_cours, resolu, ferme');
  }

  try {
    const tickets = await getSupportTickets(auth.sub, auth.role, statusResult.data);
    return successResponse(tickets);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

/**
 * POST /api/v1/support
 * Creates a new support ticket with initial message.
 */
export async function POST(request: Request) {
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);
    if (!parsed.success) {
      return error400('Validation failed', undefined, mapZodErrors(parsed.error));
    }

    const ticket = await createSupportTicket(auth.sub, parsed.data);
    return successResponse(ticket, 'Ticket created successfully', 201);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

