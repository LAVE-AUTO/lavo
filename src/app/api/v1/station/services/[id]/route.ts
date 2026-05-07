/**
 * PATCH /api/v1/station/services/:id: Update a service
 * DELETE /api/v1/station/services/:id: Delete a service
 */
import { requireRole } from '@/lib/require-role';
import {
  updateServiceWithEntries,
  deleteServiceWithAuth,
} from '@/server/station/services-service';
import { patchServiceBodySchema, serviceIdParamSchema } from '@/validators/station';
import { handleError } from '@/lib/responses';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const { id } = serviceIdParamSchema.parse(await params);
    const body = await request.json();
    const validated = patchServiceBodySchema.parse(body);

    const service = await updateServiceWithEntries(auth.sub, id, validated);

    return Response.json({ data: service });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const { id } = serviceIdParamSchema.parse(await params);

    await deleteServiceWithAuth(auth.sub, id);

    return Response.json({ message: 'Service deleted' });
  } catch (error) {
    return handleError(error);
  }
}
