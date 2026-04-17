import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pendingUploads, stationDocuments } from '@/lib/db/schema';

export type StationDocument = typeof stationDocuments.$inferSelect;
export type PendingUpload = typeof pendingUploads.$inferSelect;

type DocumentInput = {
  document_type: string;
  file_url: string;
  storage?: 'local' | 'cloudinary';
};

/**
 * Inserts station document rows. storage defaults to 'cloudinary'.
 */
export async function createDocuments(
  stationId: string,
  docs: DocumentInput[],
  termsAccepted: boolean
): Promise<StationDocument[]> {
  const rows = docs.map((d) => ({
    station_id: stationId,
    document_type: d.document_type,
    file_url: d.file_url,
    storage: d.storage ?? 'cloudinary',
    terms_accepted: termsAccepted,
  }));

  return db.insert(stationDocuments).values(rows).returning();
}

export async function findDocumentsByStationId(stationId: string): Promise<StationDocument[]> {
  return db.query.stationDocuments.findMany({
    where: eq(stationDocuments.station_id, stationId),
  });
}

/**
 * Returns a single station document by id, or undefined.
 */
export async function findDocumentById(
  id: string
): Promise<StationDocument | undefined> {
  return db.query.stationDocuments.findFirst({
    where: eq(stationDocuments.id, id),
  });
}

/**
 * Returns station documents by ids (batch fetch for sync job).
 */
export async function findDocumentsByIds(
  ids: string[]
): Promise<StationDocument[]> {
  if (ids.length === 0) return [];
  return db.query.stationDocuments.findMany({
    where: inArray(stationDocuments.id, ids),
  });
}

/**
 * Inserts a row into pending_uploads for the cron job to sync local file to Cloudinary.
 */
export async function insertPendingUpload(stationDocumentId: string): Promise<void> {
  await db.insert(pendingUploads).values({
    station_document_id: stationDocumentId,
  });
}

/**
 * Returns a batch of pending_uploads ordered by created_at for the sync job.
 */
export async function getPendingUploadsBatch(limit: number): Promise<PendingUpload[]> {
  return db.query.pendingUploads.findMany({
    orderBy: asc(pendingUploads.created_at),
    limit,
  });
}

/**
 * Updates file_url and storage for a station document (after successful Cloudinary upload).
 */
export async function updateDocumentStorage(
  id: string,
  fileUrl: string,
  storage: 'cloudinary'
): Promise<void> {
  await db
    .update(stationDocuments)
    .set({ file_url: fileUrl, storage })
    .where(eq(stationDocuments.id, id));
}

/**
 * Deletes a pending_uploads row by id after sync.
 */
export async function deletePendingUploadById(id: string): Promise<void> {
  await db.delete(pendingUploads).where(eq(pendingUploads.id, id));
}
