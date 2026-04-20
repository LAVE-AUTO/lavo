// %%%%% Imports %%%%%

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { pendingUploads, stationDocuments, stations, users } from '@/lib/db/schema';


// %%%%% END - Imports %%%%%


// %%%%% Types %%%%%

export type StationDocument = typeof stationDocuments.$inferSelect;
export type PendingUpload   = typeof pendingUploads.$inferSelect;

type DocumentInput = {
  document_type: string;
  file_url:      string;
  storage?:      'local' | 'cloudinary';
};

// Reminder field names and their corresponding reminder-sent timestamp columns.
type ReminderField = 'first' | 'second';

export type DocumentReminderRow = {
  document:          StationDocument;
  stationUserId:     string;
  stationOwnerEmail: string;
  stationName:       string;
};


// %%%%% END - Types %%%%%


// %%%%% Helpers %%%%%

/**
 * Maps a reminder field name to its Drizzle column reference.
 * Centralises the first/second branch so callers never repeat the ternary.
 */
function reminderColumn(field: ReminderField) {
  return field === 'first'
    ? stationDocuments.reminder_first_sent_at
    : stationDocuments.reminder_second_sent_at;
}

/**
 * Maps a reminder field name to its update payload.
 * Used by setReminderSent to avoid duplicating the ternary assignment.
 */
function reminderUpdatePayload(field: ReminderField) {
  const now = new Date();
  return field === 'first'
    ? { reminder_first_sent_at: now }
    : { reminder_second_sent_at: now };
}


// %%%%% END - Helpers %%%%%


// %%%%% Document CRUD %%%%%

/**
 * Inserts station document rows. storage defaults to 'cloudinary'.
 */
export async function createDocuments(
  stationId:     string,
  docs:          DocumentInput[],
  termsAccepted: boolean
): Promise<StationDocument[]> {
  const rows = docs.map((d) => ({
    station_id:     stationId,
    document_type:  d.document_type,
    file_url:       d.file_url,
    storage:        d.storage ?? 'cloudinary',
    terms_accepted: termsAccepted,
  }));

  return db.insert(stationDocuments).values(rows).returning();
}


/**
 * Returns all documents for a given station id.
 */
export async function findDocumentsByStationId(stationId: string): Promise<StationDocument[]> {
  return db.query.stationDocuments.findMany({
    where: eq(stationDocuments.station_id, stationId),
  });
}


/**
 * Returns a single station document by id, or undefined.
 */
export async function findDocumentById(id: string): Promise<StationDocument | undefined> {
  return db.query.stationDocuments.findFirst({
    where: eq(stationDocuments.id, id),
  });
}


/**
 * Returns station documents by ids (batch fetch for sync job).
 * Returns an empty array immediately when ids is empty to avoid an invalid query.
 */
export async function findDocumentsByIds(ids: string[]): Promise<StationDocument[]> {
  if (ids.length === 0) return [];

  return db.query.stationDocuments.findMany({
    where: inArray(stationDocuments.id, ids),
  });
}


/**
 * Updates file_url and storage for a station document (after successful Cloudinary upload).
 */
export async function updateDocumentStorage(
  id:      string,
  fileUrl: string,
  storage: 'cloudinary'
): Promise<void> {
  await db
    .update(stationDocuments)
    .set({ file_url: fileUrl, storage })
    .where(eq(stationDocuments.id, id));
}


// %%%%% END - Document CRUD %%%%%


// %%%%% Pending uploads %%%%%

/**
 * Inserts a row into pending_uploads for the cron job to sync a local file to Cloudinary.
 */
export async function insertPendingUpload(stationDocumentId: string): Promise<void> {
  await db.insert(pendingUploads).values({ station_document_id: stationDocumentId });
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
 * Deletes a pending_uploads row by id after a successful sync.
 */
export async function deletePendingUploadById(id: string): Promise<void> {
  await db.delete(pendingUploads).where(eq(pendingUploads.id, id));
}


// %%%%% END - Pending uploads %%%%%


// %%%%% KYC expiry reminder queries %%%%%

/**
 * Finds station documents with a non-null expiry_date that are within the
 * given threshold (days from now) and have not yet had their reminder sent
 * for that threshold level.
 *
 * Only includes documents for active stations; skips rejected or suspended ones.
 *
 * @param thresholdDays - Days before expiry to trigger the reminder
 * @param reminderField - Which flag to check: 'first' | 'second'
 */
export async function findDocumentsNeedingReminder(
  thresholdDays: number,
  reminderField:  ReminderField
): Promise<DocumentReminderRow[]> {
  const rows = await db
    .select({
      document:          stationDocuments,
      stationUserId:     stations.user_id,
      stationName:       stations.name,
      stationOwnerEmail: users.email,
    })
    .from(stationDocuments)
    .innerJoin(stations, eq(stationDocuments.station_id, stations.id))
    .innerJoin(users, eq(stations.user_id, users.id))
    .where(
      and(
        // Raw SQL only for the date-arithmetic conditions that Drizzle's query
        // builder cannot express without a template literal.
        sql`
          ${stationDocuments.expiry_date} IS NOT NULL
          AND ${stationDocuments.expiry_date} >= CURRENT_DATE
          AND ${stationDocuments.expiry_date} <= CURRENT_DATE + ${thresholdDays} * INTERVAL '1 day'
        `,
        isNull(reminderColumn(reminderField)),
        eq(stations.status, 'active')
      )
    );

  // Both joins are INNER, so every row is guaranteed to carry non-null user data.
  // The non-null assertions below narrow the Drizzle-inferred `string | null` to
  // `string` to match DocumentReminderRow — safe because the INNER JOINs on
  // stations.user_id and users.id structurally exclude NULL values.
  return rows.map((r) => ({
    document:          r.document,
    stationUserId:     r.stationUserId!,
    stationOwnerEmail: r.stationOwnerEmail,
    stationName:       r.stationName,
  }));
}


/**
 * Sets the appropriate reminder sent timestamp to now on a station document.
 *
 * @param documentId   - UUID of the station_documents row
 * @param reminderField - 'first' or 'second'
 */
export async function setReminderSent(
  documentId:    string,
  reminderField: ReminderField
): Promise<void> {
  await db
    .update(stationDocuments)
    .set(reminderUpdatePayload(reminderField))
    .where(eq(stationDocuments.id, documentId));
}


// %%%%% END - KYC expiry reminder queries %%%%%
