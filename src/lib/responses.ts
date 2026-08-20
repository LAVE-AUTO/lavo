import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';
import type { ApiSuccessBody, ApiErrorBody } from '@/types/api';
import { ApiCode } from '@/types/api-codes';

/**
 * Build success response body (status-first contract: 2xx means success; no `success` in body).
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = HTTP_STATUS.OK
): NextResponse {
  const body: ApiSuccessBody<T> = message ? { message, data } : { data };
  return NextResponse.json(body, { status });
}

/**
 * Build error response body (status-first: 4xx/5xx means error; optional code and field errors).
 *
 * @param message - User-facing error message
 * @param status - HTTP status code
 * @param options - Optional code (ApiCode) and field-level errors
 * @param devError - Optional internal error for server-side logging only (never serialized in the response).
 */
export function errorResponse(
  message: string,
  status: number = HTTP_STATUS.BAD_REQUEST,
  options: { code?: ApiCode; errors?: ApiErrorBody['errors']; meta?: Record<string, unknown> } = {},
  devError: unknown = null
): NextResponse {
  const body: ApiErrorBody & Record<string, unknown> = {
    message,
    ...(options.code && { code: options.code }),
    ...(options.errors && options.errors.length > 0 && { errors: options.errors }),
    ...(options.meta ?? {}),
  };
  if (devError) {
    // Server-side log only. Never include internal error details in the response payload —
    // status code + message + ApiCode are the public contract per dev_prompt.md.
    console.error('[errorResponse]', {
      status,
      code: options.code,
      message,
      error: serializeErrorForLog(devError),
    });
  }
  return NextResponse.json(body, { status });
}

/**
 * Serializes an error for server-side logs, walking `.cause` (drizzle/postgres wrap the real
 * DB/network reason there, e.g. connection reset or statement timeout — the top-level message
 * is often just "Failed query: <sql>", which is useless without the cause).
 */
export function serializeErrorForLog(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause !== undefined && { cause: serializeErrorForLog(error.cause) }),
  };
}

function defaultCodeForStatus(status: number): ApiCode | undefined {
  if (status === HTTP_STATUS.BAD_REQUEST) return ApiCode.VALIDATION_FAILED;
  if (status === HTTP_STATUS.UNAUTHORIZED) return ApiCode.UNAUTHORIZED;
  if (status === HTTP_STATUS.FORBIDDEN) return ApiCode.FORBIDDEN;
  if (status === HTTP_STATUS.NOT_FOUND) return ApiCode.NOT_FOUND;
  if (status === HTTP_STATUS.CONFLICT) return ApiCode.CONFLICT;
  if (status === HTTP_STATUS.TOO_MANY_REQUESTS) return ApiCode.TOO_MANY_REQUESTS;
  if (status === HTTP_STATUS.NOT_IMPLEMENTED) return ApiCode.NOT_IMPLEMENTED;
  if (status >= 500) return ApiCode.INTERNAL_ERROR;
  return undefined;
}

/**
 * Map AppError to NextResponse with optional ApiCode.
 * Use in route handlers: catch (e) { if (e instanceof AppError) return fromAppError(e); throw e; }
 */
export function fromAppError(e: AppError, code?: ApiCode): NextResponse {
  const resolved = code ?? defaultCodeForStatus(e.statusCode);
  return errorResponse(e.message, e.statusCode, resolved ? { code: resolved } : {});
}

/**
 * Standard 400 Bad Request response.
 * Defaults to `VALIDATION_FAILED` code and optionally includes field-level errors.
 */
export const error400 = (
  message: string,
  code?: ApiCode,
  errors?: ApiErrorBody['errors']
) =>
  errorResponse(message, HTTP_STATUS.BAD_REQUEST, {
    code: code ?? ApiCode.VALIDATION_FAILED,
    errors,
  });

/**
 * Standard 401 Unauthorized response.
 * Defaults to `UNAUTHORIZED` code.
 */
export const error401 = (message = 'Unauthorized', code?: ApiCode) =>
  errorResponse(message, HTTP_STATUS.UNAUTHORIZED, {
    code: code ?? ApiCode.UNAUTHORIZED,
  });

/**
 * Standard 403 Forbidden response.
 * Defaults to `FORBIDDEN` code.
 */
export const error403 = (message = 'Forbidden', code?: ApiCode, meta?: Record<string, unknown>) =>
  errorResponse(message, HTTP_STATUS.FORBIDDEN, {
    code: code ?? ApiCode.FORBIDDEN,
    meta,
  });

/**
 * Standard 404 Not Found response.
 * Defaults to `NOT_FOUND` code.
 */
export const error404 = (message = 'Not found', code?: ApiCode) =>
  errorResponse(message, HTTP_STATUS.NOT_FOUND, {
    code: code ?? ApiCode.NOT_FOUND,
  });

/**
 * Standard 409 Conflict response.
 * Defaults to `CONFLICT` code.
 */
export const error409 = (message = 'Conflict', code?: ApiCode) =>
  errorResponse(message, HTTP_STATUS.CONFLICT, {
    code: code ?? ApiCode.CONFLICT,
  });

/**
 * Standard 413 Payload Too Large response.
 * Defaults to `VALIDATION_FAILED` code.
 */
export const error413 = (message = 'File too large') =>
  errorResponse(message, 413, { code: ApiCode.VALIDATION_FAILED });

/**
 * Standard 500 Internal Server Error response.
 * Logs the underlying error server-side (via errorResponse) so production issues are diagnosable;
 * the response body itself never carries internal error details.
 */
export const error500 = (devError?: unknown) =>
  errorResponse(
    'Internal server error',
    HTTP_STATUS.SERVER_ERROR,
    { code: ApiCode.INTERNAL_ERROR },
    devError
  );

/**
 * Standard 429 Too Many Requests response.
 */
export const error429 = () =>
  errorResponse(
    'Too many requests. Please try again later.',
    HTTP_STATUS.TOO_MANY_REQUESTS,
    { code: ApiCode.TOO_MANY_REQUESTS }
  );

/**
 * Standard 501 Not Implemented response (status-first error body with code).
 */
export function notImplementedResponse(message: string): NextResponse {
  return errorResponse(message, 501, { code: ApiCode.NOT_IMPLEMENTED });
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof AppError) return fromAppError(error);

  if (isZodError(error)) {
    return error400(
      'Validation failed',
      ApiCode.VALIDATION_FAILED,
      error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
    );
  }

  // error500 logs via errorResponse so unhandled errors are visible in prod log streams.
  return error500(error);
}

function isZodError(
  error: unknown
): error is { errors: Array<{ path: (string | number)[]; message: string }> } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: unknown }).name === 'ZodError'
  );
}
