/**
 * GET /api/v1/station/services: List services for authenticated station
 * POST /api/v1/station/services: Create a new service
 */
import { requireRole } from '@/lib/require-role';
import {
  getServicesByStationUser,
  createServiceWithEntries,
} from '@/server/station/services-service';
import { createServiceBodySchema } from '@/validators/station';
import { handleError } from '@/lib/responses';

export async function GET() {
  try {
    const auth = await requireRole(undefined, 'station');
    if (auth instanceof Response) return auth;
    const services = await getServicesByStationUser(auth.sub);
    return Response.json({ data: services });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const body = await request.json();
    const validated = createServiceBodySchema.parse(body);

    const service = await createServiceWithEntries(auth.sub, validated);

    return Response.json({ data: service }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
