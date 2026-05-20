import { requireRole } from '@/lib/require-role';
import { findDocumentById } from '@/server/station/document-repository';
import { error400, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import {
  adminStationIdParamSchema,
  adminDocumentIdParamSchema,
  mapZodErrors,
} from '@/validators/station';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';


// %%%%% Helpers %%%%%

function guessContentType(fileUrl: string): string {
  try {
    const ext = path.extname(new URL(fileUrl).pathname).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

function isRemoteUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

function deriveCloudinaryAsset(fileUrl: string): { publicId: string; format: string; resourceType: 'image' | 'raw' } | null {
  try {
    const parsed = new URL(fileUrl);
    const uploadIndex = parsed.pathname.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let assetPath = parsed.pathname.slice(uploadIndex + '/upload/'.length);
    assetPath = assetPath.replace(/^v\d+\//, '');
    if (!assetPath) return null;

    const lastSegment = assetPath.split('/').pop() ?? '';
    const format = path.extname(lastSegment).slice(1).toLowerCase() || 'pdf';
    const resourceType: 'image' | 'raw' = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(format) ? 'image' : 'raw';

    return {
      publicId: assetPath.replace(/\.[^.]+$/, ''),
      format,
      resourceType,
    };
  } catch {
    return null;
  }
}

async function serveDocumentFile(fileUrl: string, filename: string): Promise<NextResponse> {
  if (!isRemoteUrl(fileUrl)) {
    const absPath = path.isAbsolute(fileUrl) ? fileUrl : path.join(process.cwd(), fileUrl);
    const buffer = await readFile(absPath);
    const contentType = guessContentType(fileUrl);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const cloudinaryAsset = deriveCloudinaryAsset(fileUrl);
  const contentType = guessContentType(fileUrl);

  if (cloudinaryAsset) {
    try {
      // Dynamic import avoids top-level CJS bundling issues with cloudinary.
      const { v2: cloudinary } = await import('cloudinary');
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const publicId = cloudinaryAsset.resourceType === 'raw'
        ? `${cloudinaryAsset.publicId}.${cloudinaryAsset.format}`
        : cloudinaryAsset.publicId;

      const candidateUrl = cloudinary.utils.private_download_url(
        publicId,
        cloudinaryAsset.format,
        { resource_type: cloudinaryAsset.resourceType, type: 'upload', attachment: true }
      );

      const response = await fetch(candidateUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': response.headers.get('content-type') ?? contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      console.error('[admin-document-download] cloudinary returned non-ok', {
        status: response.status,
        filename,
      });
    } catch {
      // Fall through to final error.
    }
  } else {
    console.error('[admin-document-download] unable to derive cloudinary asset', { fileUrl, filename });
  }

  console.error('[admin-document-download] unable to resolve document', { fileUrl, filename });
  return error500('Unable to open document');
}


// %%%%% END - Helpers %%%%%


// %%%%% Route handlers %%%%%

/**
 * GET /api/v1/admin/stations/:id/documents/:docId/download
 * Serve station documents to authenticated admins.
 * Supports Cloudinary-hosted files and local filesystem files.
 *
 * Responses:
 *   200  file bytes (Content-Disposition: attachment)
 *   400  VALIDATION_FAILED - invalid UUID params
 *   401  UNAUTHORIZED
 *   403  FORBIDDEN
 *   404  NOT_FOUND - document not found or does not belong to station
 *   500  INTERNAL_ERROR
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id, docId } = await params;

  const stationParamParsed = adminStationIdParamSchema.safeParse({ id });
  if (!stationParamParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(stationParamParsed.error))
    );
  }

  const docParamParsed = adminDocumentIdParamSchema.safeParse({ docId });
  if (!docParamParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid document id', ApiCode.VALIDATION_FAILED, mapZodErrors(docParamParsed.error))
    );
  }

  try {
    const document = await findDocumentById(docParamParsed.data.docId);
    if (!document || document.station_id !== stationParamParsed.data.id) {
      return applyNoStoreHeaders(error404('Document not found'));
    }

    const filename = path.basename(document.file_url.split('?')[0]) || `${document.id}.pdf`;
    return applyNoStoreHeaders(await serveDocumentFile(document.file_url, filename));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}


// %%%%% END - Route handlers %%%%%
