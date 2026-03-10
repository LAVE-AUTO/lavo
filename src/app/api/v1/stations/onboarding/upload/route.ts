import { headers } from 'next/headers';
import {
  uploadStationDocument,
  validateStationDocumentFile,
} from '@/server/station/upload-service';
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';
import { getClientRateLimitKey } from '@/lib/request-ip';
import {
  successResponse,
  error400,
  error413,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';

/**
 * POST /api/v1/stations/onboarding/upload
 * Public upload for station onboarding (no auth). Rate-limited by IP.
 * Accepts one file per request; client sends a series of requests then submits
 * documents with the returned URLs and storage in the final onboarding submit.
 *
 * Body: multipart/form-data — field: "file"
 * Uses same validation and upload pipeline as POST /api/v1/upload (Cloudinary with local fallback).
 *
 * Responses:
 *   201 { data: { url, storage } }
 *   400 VALIDATION_FAILED — missing file or unsupported type
 *   413 VALIDATION_FAILED — file too large
 *   429 TOO_MANY_REQUESTS
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = getClientRateLimitKey(headersList as unknown as Headers);

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    await recordFailedAttempt(ip);
    return error400('Invalid multipart body', ApiCode.VALIDATION_FAILED);
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    await recordFailedAttempt(ip);
    return error400('Missing required field: file', ApiCode.VALIDATION_FAILED);
  }

  try {
    validateStationDocumentFile(file);
    const result = await uploadStationDocument(file);
    await resetOnSuccess(ip);
    return successResponse(
      { url: result.file_url, storage: result.storage },
      undefined,
      HTTP_STATUS.CREATED
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      await recordFailedAttempt(ip);
      const msg = e.message.toLowerCase();
      if (msg.includes('too large') || msg.includes('file too large')) {
        return error413(e.message);
      }
      return error400(e.message, ApiCode.VALIDATION_FAILED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
