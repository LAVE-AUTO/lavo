import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors, updateTicketStatusSchema, supportTicketIdSchema } from '@/validators/support';
import { getTicketDetails, updateSupportTicketStatus } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * GET /api/v1/support/[id]
 * Retrieves ticket details and message thread.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const idResult = supportTicketIdSchema.safeParse(id);
  if (!idResult.success) {
    return error400('Invalid ticket ID format');
  }

  try {
    const ticket = await getTicketDetails(auth.sub, auth.role, idResult.data);
    return successResponse(ticket);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

/**
 * PATCH /api/v1/support/[id]
 * Updates ticket status or category (Admin only).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const idResult = supportTicketIdSchema.safeParse(id);
  if (!idResult.success) {
    return error400('Invalid ticket ID format');
  }

  try {
    const body = await request.json();
    const parsed = updateTicketStatusSchema.safeParse(body);
    if (!parsed.success) {
      return error400('Validation failed', undefined, mapZodErrors(parsed.error));
    }

    const ticket = await updateSupportTicketStatus(idResult.data, parsed.data.status);
    return successResponse(ticket, 'Ticket status updated');
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
