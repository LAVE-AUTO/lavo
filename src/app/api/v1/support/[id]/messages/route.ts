/**
 * Support ticket messaging API.
 *
 * POST /api/v1/support/:id/messages - Add a message to a support ticket thread.
 *   - Auth: client, station, or admin
 *   - Param: ticket ID (UUID)
 *   - Body: { content: string }
 *   - Max message length: configurable via platform settings (default 5000)
 *   - Rate limit: 30 messages per hour per authenticated user (sliding window)
 *
 * Responses:
 *   - 201 { data: message } - success
 *   - 400 Invalid ticket ID or JSON
 *   - 400 VALIDATION_FAILED - content exceeds max length or is empty
 *   - 401 UNAUTHORIZED - auth required
 *   - 404 NOT_FOUND - ticket not found
 *   - 429 TOO_MANY_REQUESTS - rate limited (30 msg/hour)
 *   - 500 INTERNAL_ERROR - database or service error
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error429, error500, fromAppError } from '@/lib/responses';
import { mapZodErrors, createSupportMessageSchema, supportTicketIdSchema } from '@/validators/support';
import { addSupportMessage } from '@/server/support/support-ticket-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';
import { checkSlidingWindowRateLimit, normalizeRateLimitKey } from '@/lib/rate-limiter';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import { applyNoStoreHeaders } from '@/lib/response-headers';


// %%%%% Rate limiting %%%%%
// Per-user message sending throttling

const MESSAGE_SEND_LIMIT = 30;
const MESSAGE_SEND_WINDOW_SECS = 3600;


// %%%%% POST handler %%%%%
// Add message to support ticket thread

/**
 * POST /api/v1/support/:id/messages
 *
 * Adds a message to an existing support ticket thread.
 * Rate limited to prevent spam: 30 messages per hour per user (sliding window).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate as client, station, or admin
  const auth = await requireRole(request, 'client', 'station', 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Parse and validate ticket ID
  const { id } = await params;
  const idResult = supportTicketIdSchema.safeParse(id);
  if (!idResult.success) {
    return applyNoStoreHeaders(error400('Invalid ticket ID format'));
  }

  // Check sliding window rate limit (30 messages per hour per user)
  const rateLimitKey = normalizeRateLimitKey(`support:message:user:${auth.sub}`);
  const { allowed } = await checkSlidingWindowRateLimit(
    rateLimitKey,
    MESSAGE_SEND_LIMIT,
    MESSAGE_SEND_WINDOW_SECS
  );
  if (!allowed) return applyNoStoreHeaders(error429());

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body'));
  }

  // Build validation schema with platform-configured max message length
  const maxMsgLength = parseInt(
    await getPlatformSettingWithFallback('max_support_message_length', 'PLATFORM_MAX_SUPPORT_MESSAGE_LENGTH', '5000'),
    10
  );
  const addSupportMessageSchema = createSupportMessageSchema(
    Number.isFinite(maxMsgLength) && maxMsgLength > 0 ? maxMsgLength : 5000
  );

  // Validate request body
  const parsed = addSupportMessageSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', undefined, mapZodErrors(parsed.error)));
  }

  // Add message and handle errors
  try {
    const message = await addSupportMessage(
      auth.sub,
      idResult.data,
      parsed.data.content,
      auth.role === 'admin'
    );
    return applyNoStoreHeaders(successResponse(message, 'Message added successfully', 201));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
