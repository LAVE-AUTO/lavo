import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors, addSupportMessageSchema, supportTicketIdSchema } from '@/validators/support';
import { addSupportMessage } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import { NextResponse } from 'next/server';

/**
 * POST /api/v1/support/[id]/messages
 * Adds a message to the ticket thread.
 */
export async function POST(
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
    const body = await request.json();
    const parsed = addSupportMessageSchema.safeParse(body);
    if (!parsed.success) {
      return error400('Validation failed', undefined, mapZodErrors(parsed.error));
    }

    const message = await addSupportMessage(
      auth.sub,
      idResult.data,
      parsed.data.content,
      auth.role === 'admin'
    );
    return successResponse(message, 'Message added successfully', 201);
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
