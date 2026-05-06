/**
 * GET /api/v1/formats — Public. Returns all active global vehicle formats.
 */
import { getAllFormats } from '@/server/station/format-service';
import { handleError } from '@/lib/responses';

export async function GET() {
  try {
    const formats = await getAllFormats();
    return Response.json({ data: formats });
  } catch (error) {
    return handleError(error);
  }
}
