/**
 * Station document upload: Cloudinary with local fallback.
 * Validates file type (image/*, application/pdf) and size (max 10MB) before upload.
 */
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  ALLOWED_DOCUMENT_TYPES,
  STATION_DOC_MAX_SIZE,
} from '@/helpers/constants';
import { ValidationError } from '@/lib/errors';

const UPLOAD_LOCAL_PATH =
  process.env.UPLOAD_LOCAL_PATH ?? 'public/uploads';

export type UploadResult = {
  file_url: string;
  storage: 'cloudinary' | 'local';
};

/**
 * Validates file type and size. Throws ValidationError if invalid.
 */
export function validateStationDocumentFile(
  file: { type: string; size: number }
): void {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    throw new ValidationError(
      `Invalid file type. Allowed: images (JPEG, PNG, WebP, GIF) and PDF.`
    );
  }
  if (file.size > STATION_DOC_MAX_SIZE) {
    throw new ValidationError(
      `File too large. Maximum size is ${STATION_DOC_MAX_SIZE / 1024 / 1024}MB.`
    );
  }
}

/**
 * Uploads one file: tries Cloudinary first; on failure (network/config) writes to
 * local disk and returns storage 'local'. File must be validated (type, size) before calling.
 * Returns file_url usable for storage (Cloudinary URL or path for job to read).
 */
export async function uploadStationDocument(
  file: { arrayBuffer: () => Promise<ArrayBuffer>; type: string; name: string }
): Promise<UploadResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const cloudResult = await tryCloudinaryUpload(buffer, file.type, file.name);
  if (cloudResult) return cloudResult;
  const localResult = await writeToLocal(buffer, file.type, file.name);
  return localResult;
}

/**
 * Uploads a buffer to Cloudinary only (for cron sync). Returns secure_url or null on failure.
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  const result = await tryCloudinaryUpload(buffer, mimeType, filename);
  return result?.file_url ?? null;
}

async function tryCloudinaryUpload(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<UploadResult | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;

  try {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const ext = path.extname(originalName) || getExtensionFromMime(mimeType);
    const publicId = `station-docs/${randomUUID()}${ext.replace(/^\./, '')}`;
    const resourceType = mimeType === 'application/pdf' ? 'raw' : 'image';

    const result = await new Promise<{ secure_url?: string } | undefined>(
      (resolve, reject) => {
        const opts = {
          resource_type: resourceType as 'image' | 'raw',
          public_id: publicId.replace(/\.[^.]+$/, '') || publicId,
          filename: originalName || `file${ext}`,
        };
        const uploadStream = cloudinary.uploader.upload_stream(
          (err: Error | undefined, res: { secure_url?: string } | undefined) => {
            if (err) reject(err);
            else resolve(res);
          },
          opts
        );
        uploadStream.end(buffer);
      }
    );

    if (result?.secure_url) {
      return { file_url: result.secure_url, storage: 'cloudinary' };
    }
  } catch {
    return null;
  }
  return null;
}

function getExtensionFromMime(mime: string): string {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '';
}

async function writeToLocal(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<UploadResult> {
  const ext = path.extname(originalName) || getExtensionFromMime(mimeType);
  const filename = `${randomUUID()}${ext}`;
  const dir = path.isAbsolute(UPLOAD_LOCAL_PATH)
    ? UPLOAD_LOCAL_PATH
    : path.join(process.cwd(), UPLOAD_LOCAL_PATH);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  await writeFile(filePath, buffer);
  const file_url = path.isAbsolute(UPLOAD_LOCAL_PATH)
    ? filePath
    : path.join(UPLOAD_LOCAL_PATH, filename);
  return { file_url, storage: 'local' };
}
