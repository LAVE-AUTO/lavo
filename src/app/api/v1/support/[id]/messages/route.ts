import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors, addSupportMessageSchema, supportTicketIdSchema } from '@/validators/support';
import { addSupportMessage } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';
import { checkSlidingWindowRateLimit, normalizeRateLimitKey } from '@/lib/rate-limiter';

/** Maximum number of messages a user may send per hour across all tickets. */
const MESSAGE_SEND_LIMIT = 30;
/** Sliding window size for message sending rate limit: 1 hour. */
const MESSAGE_SEND_WINDOW_SECS = 3600;

/**
 * POST /api/v1/support/[id]/messages
 * Adds a message to the ticket thread.
 * Rate limited: 30 messages per hour per authenticated user.
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

  const rateLimitKey = normalizeRateLimitKey(`support:message:user:${auth.sub}`);
  const { allowed } = await checkSlidingWindowRateLimit(
    rateLimitKey,
    MESSAGE_SEND_LIMIT,
    MESSAGE_SEND_WINDOW_SECS
  );
  if (!allowed) return error429();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body');
  }

  const parsed = addSupportMessageSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', undefined, mapZodErrors(parsed.error));
  }

  try {
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
