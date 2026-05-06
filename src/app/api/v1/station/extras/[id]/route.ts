/**
 * PATCH /api/v1/station/extras/:id: Update an extra
 * DELETE /api/v1/station/extras/:id: Delete an extra
 */
import { requireRole } from '@/lib/require-role';
import {
  updateExtraWithAuth,
  deleteExtraWithAuth,
} from '@/server/station/services-service';
import { patchExtraBodySchema, extraIdParamSchema } from '@/validators/station';
import { handleError } from '@/lib/responses';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole('station');
    const { id } = extraIdParamSchema.parse(params);
    const body = await request.json();
    const validated = patchExtraBodySchema.parse(body);

    const extra = await updateExtraWithAuth(user.id, id, validated);

    return Response.json({ data: extra });
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
    const { id } = extraIdParamSchema.parse(params);

    await deleteExtraWithAuth(user.id, id);

    return Response.json({ message: 'Extra deleted' });
  } catch (error) {
    return handleError(error);
  }
}
