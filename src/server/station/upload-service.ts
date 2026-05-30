/**
 * Station document upload: Cloudinary with local fallback.
 * Validates file type (image/*, application/pdf) and size (max 10MB) before upload.
 * In production, configure UPLOAD_LOCAL_PATH to a directory outside the webroot so
 * local files are never served directly over HTTP.
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
  process.env.UPLOAD_LOCAL_PATH ?? '.uploads/station-docs';

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
  if (file.size <= 0) {
    throw new ValidationError('File is empty. Please upload a valid document.');
  }
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
  validateMagicBytes(buffer, file.type);
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
        // v2 API: upload_stream(options, callback) - options must come first.
        const uploadStream = cloudinary.uploader.upload_stream(
          opts,
          (err: Error | undefined, res: { secure_url?: string } | undefined) => {
            if (err) reject(err);
            else resolve(res);
          }
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

function validateMagicBytes(buffer: Buffer, mimeType: string): void {
  if (buffer.length < 4) {
    throw new ValidationError('File is too small or corrupted.');
  }

  const header = buffer.subarray(0, 8);

  if (mimeType === 'application/pdf') {
    // %PDF
    if (!(header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46)) {
      throw new ValidationError('File content does not match a valid PDF document.');
    }
    return;
  }

  // JPEG: FF D8 FF
  if (mimeType === 'image/jpeg') {
    if (!(header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff)) {
      throw new ValidationError('File content does not match a valid JPEG image.');
    }
    return;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimeType === 'image/png') {
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!pngSig.every((b, i) => header[i] === b)) {
      throw new ValidationError('File content does not match a valid PNG image.');
    }
    return;
  }

  // WebP: "RIFF"...."WEBP"
  if (mimeType === 'image/webp') {
    if (
      !(header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) ||
      !(header[8 - 4] === 0x57 && header[8 - 3] === 0x45 && header[8 - 2] === 0x42 && header[8 - 1] === 0x50)
    ) {
      throw new ValidationError('File content does not match a valid WebP image.');
    }
    return;
  }

  // GIF: "GIF87a" or "GIF89a"
  if (mimeType === 'image/gif') {
    const sig = String.fromCharCode(
      header[0],
      header[1],
      header[2],
      header[3],
      header[4],
      header[5]
    );
    if (sig !== 'GIF87a' && sig !== 'GIF89a') {
      throw new ValidationError('File content does not match a valid GIF image.');
    }
  }
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
