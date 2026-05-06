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
    const auth = await requireRole(undefined, 'station');
    if (auth instanceof Response) return auth;
    const extras = await getExtrasByStationUser(auth.sub);
    return Response.json({ data: extras });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const body = await request.json();
    const validated = createExtraBodySchema.parse(body);

    const extra = await createExtraWithAuth(auth.sub, {
      label: validated.name,
      scope: validated.applicable_on,
      price: validated.price,
      duration_min: validated.duration,
      is_active: validated.is_active,
    });

    return Response.json({ data: extra }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
