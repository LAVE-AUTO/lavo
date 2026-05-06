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
    const user = await requireRole('station');
    const services = await getServicesByStationUser(user.id);
    return Response.json({ data: services });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole('station');
    const body = await request.json();
    const validated = createServiceBodySchema.parse(body);

    const service = await createServiceWithEntries(user.id, validated);

    return Response.json({ data: service }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
