/**
 * Sync job: read batch from pending_uploads, upload local files to Cloudinary,
 * update station_documents and delete local file and pending row on success.
 * Invoked by GET /api/cron/sync-pending-uploads (with CRON_SECRET header).
 */
import path from 'path';
import { readFile, unlink } from 'fs/promises';
import {
  deletePendingUploadById,
  findDocumentsByIds,
  getPendingUploadsBatch,
  updateDocumentStorage,
} from '@/server/station/document-repository';
import { uploadBufferToCloudinary } from '@/server/station/upload-service';

const BATCH_SIZE = 100;
const UPLOAD_LOCAL_PATH =
  process.env.UPLOAD_LOCAL_PATH ?? 'public/uploads';

function getMimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return mime[ext] ?? 'application/octet-stream';
}

function isPathUnderBase(resolvedPath: string, baseDir: string): boolean {
  const normalized = path.normalize(resolvedPath);
  const base = path.normalize(baseDir);
  return normalized === base || normalized.startsWith(base + path.sep);
}

export async function runSyncPendingUploads(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const batch = await getPendingUploadsBatch(BATCH_SIZE);
  const docIds = batch.map((p) => p.station_document_id);
  const docs = await findDocumentsByIds(docIds);
  const docMap = new Map(docs.map((d) => [d.id, d]));

  const baseDir = path.isAbsolute(UPLOAD_LOCAL_PATH)
    ? UPLOAD_LOCAL_PATH
    : path.join(process.cwd(), UPLOAD_LOCAL_PATH);

  let succeeded = 0;
  let failed = 0;

  for (const pending of batch) {
    const doc = docMap.get(pending.station_document_id);
    if (!doc) {
      await deletePendingUploadById(pending.id);
      continue;
    }
    if (doc.storage !== 'local') {
      await deletePendingUploadById(pending.id);
      succeeded++;
      continue;
    }

    const filePath = path.isAbsolute(doc.file_url)
      ? doc.file_url
      : path.join(process.cwd(), doc.file_url);

    if (!isPathUnderBase(path.resolve(filePath), baseDir)) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          `sync-pending-uploads: path traversal rejected for document ${doc.id}`
        );
      }
      failed++;
      continue;
    }

    try {
      const buffer = await readFile(filePath);
      const mime = getMimeFromPath(filePath);
      const filename = path.basename(filePath);
      const url = await uploadBufferToCloudinary(buffer, mime, filename);
      if (!url) {
        failed++;
        continue;
      }
      await updateDocumentStorage(doc.id, url, 'cloudinary');
      await unlink(filePath).catch(() => {});
      await deletePendingUploadById(pending.id);
      succeeded++;
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          `sync-pending-uploads: failed document ${doc.id}:`,
          err instanceof Error ? err.message : err
        );
      }
      failed++;
    }
  }

  return { processed: batch.length, succeeded, failed };
}
