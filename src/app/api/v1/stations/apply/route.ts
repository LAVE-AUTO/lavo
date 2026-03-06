import { headers } from 'next/headers';
import { submitStationApplication } from '@/server/station/station-service';
import { validateStationDocumentFile } from '@/server/station/upload-service';
import {
  stationApplyFieldsSchema,
  mapZodErrors,
} from '@/validators/station';
import { checkRateLimit, recordFailedAttempt, resetOnSuccess } from '@/lib/rate-limiter';
import {
  successResponse,
  error400,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ValidationError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';

const DOCUMENT_FIELD_PREFIX = 'document_';
/** document_type from field name: alphanumeric, underscore, hyphen only, 1–50 chars */
const DOCUMENT_TYPE_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;

/**
 * POST /api/v1/stations/apply
 * Accepts multipart/form-data: station fields (name, legal_name, registration_number,
 * address, city, wash_type, wash_post_count, description, terms_accepted) and document
 * files. Field names for files: document_<type> (e.g. document_license, document_insurance);
 * each value is a file. Uploads to Cloudinary with local fallback, creates station with
 * status pending_admin_validation, sends admin notification email.
 *
 * Responses:
 *   201 { data: { station_id, message } }
 *   400 VALIDATION_FAILED
 *   429 TOO_MANY_REQUESTS
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';

  const { blocked } = await checkRateLimit(ip);
  if (blocked) return error429();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error400('Invalid multipart body', ApiCode.VALIDATION_FAILED);
  }

  const fieldsRecord: Record<string, string> = {};
  const files: { document_type: string; file: File }[] = [];

  for (const [key, value] of formData.entries()) {
    const isFilePart =
      value instanceof File || (value instanceof Blob && value.size > 0);
    if (isFilePart && key.startsWith(DOCUMENT_FIELD_PREFIX)) {
      const document_type = key.slice(DOCUMENT_FIELD_PREFIX.length).trim();
      if (DOCUMENT_TYPE_REGEX.test(document_type)) {
        files.push({
          document_type,
          file: value as File,
        });
      }
    } else if (typeof value === 'string') {
      fieldsRecord[key] = value;
    }
  }

  const parsed = stationApplyFieldsSchema.safeParse(fieldsRecord);
  if (!parsed.success) {
    await recordFailedAttempt(ip);
    return error400(
      'Validation failed',
      ApiCode.VALIDATION_FAILED,
      mapZodErrors(parsed.error)
    );
  }

  if (files.length === 0) {
    await recordFailedAttempt(ip);
    return error400(
      'At least one document is required',
      ApiCode.VALIDATION_FAILED,
      [{ field: 'documents', message: 'At least one document file is required' }]
    );
  }

  const fileErrors: { field: string; message: string }[] = [];
  for (const { document_type, file } of files) {
    try {
      validateStationDocumentFile(file);
    } catch (e) {
      if (e instanceof ValidationError) {
        fileErrors.push({
          field: `${DOCUMENT_FIELD_PREFIX}${document_type}`,
          message: e.message,
        });
      } else {
        throw e;
      }
    }
  }
  if (fileErrors.length > 0) {
    await recordFailedAttempt(ip);
    return error400(
      'Invalid document file(s). Allowed: images (JPEG, PNG, WebP, GIF) and PDF; max 10MB per file.',
      ApiCode.VALIDATION_FAILED,
      fileErrors
    );
  }

  try {
    const result = await submitStationApplication(parsed.data, files);
    await resetOnSuccess(ip);
    return successResponse(result, undefined, HTTP_STATUS.CREATED);
  } catch (e) {
    if (e instanceof ValidationError) {
      return error400(e.message, ApiCode.VALIDATION_FAILED);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
