import { requireRole } from '@/lib/require-role';
import { updateDocumentExpiry } from '@/server/station/document-repository';
import { successResponse, error400, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import {
  adminStationIdParamSchema,
  adminDocumentIdParamSchema,
  updateDocumentExpirySchema,
  mapZodErrors,
} from '@/validators/station';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';


// %%%%% Route handlers %%%%%

/**
 * PATCH /api/v1/admin/stations/:id/documents/:docId
 * Update the expiry_date of a station document.
 * Requires admin role.
 *
 * Body: { expiry_date: string | null }  - YYYY-MM-DD string or null to clear.
 *
 * Responses:
 *   200 { data: StationDocument }
 *   400 VALIDATION_FAILED - :id or :docId is not a valid UUID, or body is malformed
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND - document not found or does not belong to the station
 *   500 INTERNAL_ERROR
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id, docId } = await params;

  // Validate station path param.
  const stationParamParsed = adminStationIdParamSchema.safeParse({ id });
  if (!stationParamParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(stationParamParsed.error))
    );
  }

  // Validate document path param.
  const docParamParsed = adminDocumentIdParamSchema.safeParse({ docId });
  if (!docParamParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid document id', ApiCode.VALIDATION_FAILED, mapZodErrors(docParamParsed.error))
    );
  }

  // Parse and validate JSON body.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const bodyParsed = updateDocumentExpirySchema.safeParse(rawBody);
  if (!bodyParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid request body', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error))
    );
  }

  // Update expiry_date. The repository query scopes the update to the station,
  // so a missing result means either the document does not exist or it belongs
  // to a different station - both cases are a 404.
  try {
    const document = await updateDocumentExpiry(
      docParamParsed.data.docId,
      stationParamParsed.data.id,
      bodyParsed.data.expiry_date
    );

    if (!document) {
      return applyNoStoreHeaders(error404('Document not found'));
    }

    return applyNoStoreHeaders(successResponse(document));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}


// %%%%% END - Route handlers %%%%%
