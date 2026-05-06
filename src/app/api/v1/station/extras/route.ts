/**
 * GET /api/v1/station/extras: List extras for authenticated station
 * POST /api/v1/station/extras: Create a new extra
 */
import { requireRole } from '@/lib/require-role';
import {
  getExtrasByStationUser,
  createExtraWithAuth,
} from '@/server/station/services-service';
import { createExtraBodySchema } from '@/validators/station';
import { handleError } from '@/lib/responses';

export async function GET() {
  try {
    const user = await requireRole('station');
    const extras = await getExtrasByStationUser(user.id);
    return Response.json({ data: extras });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole('station');
    const body = await request.json();
    const validated = createExtraBodySchema.parse(body);

    const extra = await createExtraWithAuth(user.id, validated);

    return Response.json({ data: extra }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
