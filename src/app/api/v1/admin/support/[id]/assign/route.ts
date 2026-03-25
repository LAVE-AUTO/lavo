import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { assignTicketSchema, mapZodErrors, supportTicketIdSchema } from '@/validators/support';
import { assignSupportTicket } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * PATCH /api/v1/admin/support/[id]/assign
 * Assigns or unassigns a support ticket to an admin user.
 *
 * Body: { assigned_to: string (UUID) | null }
 *
 * Rules:
 *   - Caller must have role `admin`.
 *   - `[id]` must be a valid UUID.
 *   - `assigned_to` must be a valid UUID or null.
 *   - When not null, the target user must have role `admin`.
 *
 * Responses:
 *   200 { data: ticket }                   — assignment updated
 *   400 VALIDATION_FAILED                  — invalid UUID param or body
 *   401 UNAUTHORIZED                       — not authenticated
 *   403 FORBIDDEN                          — insufficient role
 *   404 NOT_FOUND                          — ticket does not exist
 *   422 UNPROCESSABLE_ENTITY               — target user is not an admin
 *   500 INTERNAL_ERROR
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body');
  }

  const parsed = assignTicketSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', undefined, mapZodErrors(parsed.error));
  }

  try {
    const ticket = await assignSupportTicket(idResult.data, parsed.data.assigned_to);
    return successResponse(ticket, 'Ticket assignment updated');
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
