import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations, stationDocuments, pendingUploads } from '@/lib/db/schema';
import { requireAuthWithPasswordCheck } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';

const REAPPLY_COOLDOWN_HOURS = 24;
const REJECTION_COUNT_FOR_COOLDOWN = 3;
const MIN_NAME_LENGTH = 2;
const MIN_CITY_LENGTH = 2;
const MIN_ADDRESS_LENGTH = 5;

const ALLOWED_DOC_TYPES = ['registration_certificate', 'address_proof', 'license'] as const;
type DocType = (typeof ALLOWED_DOC_TYPES)[number];

interface DocumentInput {
  document_type: DocType;
  file_url: string;
  storage: 'cloudinary' | 'local';
}

/**
 * POST /api/v1/station/reapply
 * Allows a rejected station to resubmit their KYC application.
 * Resets status to pending_admin_validation and clears the rejection reason.
 * Replaces existing station documents with the newly uploaded ones.
 * Optionally updates name, address, city, and description.
 * Intentionally bypasses requireRole active-status check — rejected stations need access.
 * Rate-limited: one reapplication per REAPPLY_COOLDOWN_HOURS hours, but only after
 * REJECTION_COUNT_FOR_COOLDOWN or more rejections.
 *
 * Body: { name?, address?, city?, description?, documents: DocumentInput[] }
 *
 * Responses:
 *   200 { data: { reapplied: true } }
 *   400 VALIDATION_FAILED — station is not rejected or required docs missing
 *   403 FORBIDDEN — user is not a station
 *   404 NOT_FOUND
 *   429 TOO_MANY_REQUESTS — reapplied too recently (after 3+ rejections)
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const auth = await requireAuthWithPasswordCheck(request);
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.role !== 'station') {
    return error403('Access restricted to station accounts', ApiCode.FORBIDDEN);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  try {
    const station = await db.query.stations.findFirst({
      where: eq(stations.user_id, auth.sub),
      columns: { id: true, status: true, updated_at: true, rejection_count: true },
    });

    if (!station) {
      return error404('No station found for this account');
    }

    if (station.status !== 'rejected') {
      return error400('Only rejected stations can reapply', ApiCode.VALIDATION_FAILED);
    }

    // Cooldown applies only after REJECTION_COUNT_FOR_COOLDOWN or more rejections
    if ((station.rejection_count ?? 0) >= REJECTION_COUNT_FOR_COOLDOWN && station.updated_at) {
      const hoursSinceLastUpdate =
        (Date.now() - new Date(station.updated_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUpdate < REAPPLY_COOLDOWN_HOURS) {
        return error400(
          `Please wait ${REAPPLY_COOLDOWN_HOURS} hours before resubmitting`,
          ApiCode.TOO_MANY_REQUESTS
        );
      }
    }

    const { name, address, city, description, documents } = body as {
      name?: string;
      address?: string;
      city?: string;
      description?: string;
      documents?: DocumentInput[];
    };

    // Validate documents — required types must be present; deduplicate by type (keep last)
    const rawDocs: DocumentInput[] = Array.isArray(documents) ? documents : [];
    const docsByType = new Map<string, DocumentInput>();
    for (const d of rawDocs) {
      if (
        ALLOWED_DOC_TYPES.includes(d.document_type as DocType) &&
        typeof d.file_url === 'string' &&
        d.file_url.trim().startsWith('http') &&
        (d.storage === 'cloudinary' || d.storage === 'local')
      ) {
        docsByType.set(d.document_type, d);
      }
    }
    const docs = Array.from(docsByType.values());

    const hasRegistrationCert = docs.some((d) => d.document_type === 'registration_certificate');
    const hasAddressProof = docs.some((d) => d.document_type === 'address_proof');

    if (!hasRegistrationCert || !hasAddressProof) {
      return error400(
        'Registration certificate and address proof are required',
        ApiCode.VALIDATION_FAILED
      );
    }

    // Validate provided text fields
    if (typeof name === 'string' && name.trim().length > 0 && name.trim().length < MIN_NAME_LENGTH) {
      return error400(`Station name must be at least ${MIN_NAME_LENGTH} characters`, ApiCode.VALIDATION_FAILED);
    }
    if (typeof address === 'string' && address.trim().length > 0 && address.trim().length < MIN_ADDRESS_LENGTH) {
      return error400(`Address must be at least ${MIN_ADDRESS_LENGTH} characters`, ApiCode.VALIDATION_FAILED);
    }
    if (typeof city === 'string' && city.trim().length > 0 && city.trim().length < MIN_CITY_LENGTH) {
      return error400(`City must be at least ${MIN_CITY_LENGTH} characters`, ApiCode.VALIDATION_FAILED);
    }

    const updates: Partial<typeof stations.$inferInsert> = {
      status: 'pending_admin_validation',
      rejection_reason: null,
      updated_at: new Date(),
      ...(typeof name === 'string' && name.trim() ? { name: name.trim().slice(0, 150) } : {}),
      ...(typeof address === 'string' && address.trim() ? { address: address.trim().slice(0, 200) } : {}),
      ...(typeof city === 'string' && city.trim() ? { city: city.trim().slice(0, 100) } : {}),
      ...(typeof description === 'string' ? { description: description.trim().slice(0, 1000) || null } : {}),
    };

    // Replace documents and reset station status in a transaction.
    // WHERE includes status = 'rejected' to guard against concurrent reapply requests.
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(stations)
        .set(updates)
        .where(and(eq(stations.id, station.id), eq(stations.status, 'rejected')))
        .returning({ id: stations.id });

      if (updated.length === 0) {
        throw new Error('CONCURRENT_REAPPLY');
      }

      // Remove existing documents (pending_uploads rows cascade-deleted)
      await tx.delete(stationDocuments).where(eq(stationDocuments.station_id, station.id));

      // Insert validated + deduplicated documents
      if (docs.length > 0) {
        const inserted = await tx
          .insert(stationDocuments)
          .values(
            docs.map((d) => ({
              station_id: station.id,
              document_type: d.document_type,
              file_url: d.file_url.trim(),
              storage: d.storage,
              terms_accepted: true,
            }))
          )
          .returning({ id: stationDocuments.id, storage: stationDocuments.storage });

        // Queue local files for Cloudinary sync
        for (const row of inserted) {
          if (row.storage === 'local') {
            await tx.insert(pendingUploads).values({ station_document_id: row.id });
          }
        }
      }
    });

    return successResponse({ reapplied: true }, 'Application resubmitted successfully.');
  } catch (e) {
    if (e instanceof Error && e.message === 'CONCURRENT_REAPPLY') {
      return error400('Application is no longer in rejected state', ApiCode.VALIDATION_FAILED);
    }
    return error500(e);
  }
}
