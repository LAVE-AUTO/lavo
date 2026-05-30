/**
 * PATCH /api/v1/station/extras/:id: Update an extra
 * DELETE /api/v1/station/extras/:id: Delete an extra
 */
import { requireRole } from '@/lib/require-role';
import {
  updateExtraWithAuth,
  deleteExtraWithAuth,
} from '@/server/station/services-service';
import type { UpdateExtraData } from '@/server/station/service-repository';
import { patchExtraBodySchema, extraIdParamSchema } from '@/validators/station';
import { handleError } from '@/lib/responses';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, 'station');
    if (auth instanceof Response) return auth;
    const { id } = extraIdParamSchema.parse(await params);
    const body = await request.json();
    const validated = patchExtraBodySchema.parse(body);

    const dto: UpdateExtraData = {};
    if (validated.name !== undefined) dto.label = validated.name;
    if (validated.applicable_on !== undefined) dto.scope = validated.applicable_on;
    if (validated.price !== undefined) dto.price = validated.price;
    if (validated.duration !== undefined) dto.duration_min = validated.duration;
    if (validated.is_active !== undefined) dto.is_active = validated.is_active;

    const extra = await updateExtraWithAuth(auth.sub, id, dto);

    return Response.json({ data: extra });
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
    const { id } = extraIdParamSchema.parse(await params);

    await deleteExtraWithAuth(auth.sub, id);

    return Response.json({ message: 'Extra deleted' });
  } catch (error) {
    return handleError(error);
  }
}
