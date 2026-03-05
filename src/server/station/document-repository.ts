import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stationDocuments } from '@/lib/db/schema';

export type StationDocument = typeof stationDocuments.$inferSelect;

type DocumentInput = { document_type: string; file_url: string };

export async function createDocuments(
  stationId: string,
  docs: DocumentInput[],
  termsAccepted: boolean
): Promise<StationDocument[]> {
  const rows = docs.map((d) => ({
    station_id: stationId,
    document_type: d.document_type,
    file_url: d.file_url,
    terms_accepted: termsAccepted,
  }));

  return db.insert(stationDocuments).values(rows).returning();
}

export async function findDocumentsByStationId(stationId: string): Promise<StationDocument[]> {
  return db.query.stationDocuments.findMany({
    where: eq(stationDocuments.station_id, stationId),
  });
}
