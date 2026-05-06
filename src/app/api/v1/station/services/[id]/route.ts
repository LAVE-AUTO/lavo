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
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole('station');
    const { id } = serviceIdParamSchema.parse(params);
    const body = await request.json();
    const validated = patchServiceBodySchema.parse(body);

    const service = await updateServiceWithEntries(user.id, id, validated);

    return Response.json({ data: service });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole('station');
    const { id } = serviceIdParamSchema.parse(params);

    await deleteServiceWithAuth(user.id, id);

    return Response.json({ message: 'Service deleted' });
  } catch (error) {
    return handleError(error);
  }
}
