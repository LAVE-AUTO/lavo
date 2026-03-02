import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * Standard success response format (Leroi pattern).
 *
 * @param data - Response payload
 * @param message - Success message
 * @param status - HTTP status code
 */
export function successResponse<T>(
  data: T,
  message = 'Success',
  status: number = HTTP_STATUS.OK
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Standard error response format (Leroi pattern).
 *
 * @param message - User-facing error message
 * @param status - HTTP status code
 * @param error - Internal error details (only in development)
 */
export function errorResponse(
  message: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  error: unknown = null
): NextResponse {
  const body: Record<string, unknown> = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV === 'development' && error) {
    body.error =
      error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(body, { status });
}

/**
 * Map AppError to NextResponse (Leroi pattern).
 * Use in route handlers: catch (e) { if (e instanceof AppError) return fromAppError(e); throw e; }
 */
export function fromAppError(e: AppError): NextResponse {
  return errorResponse(e.message, e.statusCode);
}

export const error400 = (message: string) =>
  errorResponse(message, HTTP_STATUS.BAD_REQUEST);
export const error401 = (message = 'Unauthorized') =>
  errorResponse(message, HTTP_STATUS.UNAUTHORIZED);
export const error403 = (message = 'Forbidden') =>
  errorResponse(message, HTTP_STATUS.FORBIDDEN);
export const error404 = (message = 'Not found') =>
  errorResponse(message, HTTP_STATUS.NOT_FOUND);
export const error409 = (message = 'Conflict') =>
  errorResponse(message, HTTP_STATUS.CONFLICT);
export const error500 = (error?: unknown) =>
  errorResponse('Internal server error', HTTP_STATUS.SERVER_ERROR, error);
