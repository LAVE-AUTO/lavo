import { requireAuth } from '@/lib/require-auth';
import {
  uploadStationDocument,
  validateStationDocumentFile,
} from '@/server/station/upload-service';
import { successResponse, error400, error413, error500, fromAppError } from '@/lib/responses';
import { STATION_DOC_MAX_SIZE } from '@/helpers/constants';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/upload
 * Upload a document file (image or PDF) to Cloudinary.
 * Falls back to local disk if Cloudinary is unreachable.
 * Requires authentication (any role).
 *
 * Body: multipart/form-data — field: "file"
 * Accepted types: image/jpeg, image/png, image/webp, image/gif, application/pdf
 * Max size: 10 MB
 *
 * Responses:
 *   201 { data: { url, storage } }
 *   400 VALIDATION_FAILED — missing file or unsupported type
 *   413 VALIDATION_FAILED — file exceeds size limit
 *   401 UNAUTHORIZED
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth as NextResponse;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error400('Expected multipart/form-data body', ApiCode.VALIDATION_FAILED);
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return error400('Missing required field: file', ApiCode.VALIDATION_FAILED);
  }

  if (file.size > STATION_DOC_MAX_SIZE) {
    return error413(`File exceeds the maximum allowed size of ${STATION_DOC_MAX_SIZE / 1024 / 1024} MB`);
  }

  try {
    validateStationDocumentFile(file);
    const result = await uploadStationDocument(file);
    return successResponse({ url: result.file_url, storage: result.storage }, 'File uploaded successfully.', 201);
  } catch (e) {
    if (e instanceof ValidationError) {
      return error400(e.message, ApiCode.VALIDATION_FAILED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
