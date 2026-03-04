import type { ApiCode } from './api-codes';

/**
 * Success response body (used when status is 2xx).
 * No `success` field; status code defines success.
 */
export interface ApiSuccessBody<T> {
  message?: string;
  data: T;
}

/**
 * Error response body (used when status is 4xx or 5xx).
 */
export interface ApiErrorBody {
  message: string;
  code?: ApiCode;
  errors?: Array<{ field?: string; message: string }>;
}
