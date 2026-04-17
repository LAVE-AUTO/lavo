/**
 * POST /api/v1/dev/reservations
 * Dev-only endpoint: creates a confirmed reservation without Stripe.
 * Returns 403 in production. Used to test the reservation flow before payment is wired.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error409, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { createReservationBodySchema, mapZodErrors } from '@/validators/entry';
import { stationIdParamSchema, mapZodErrors as mapStationZodErrors } from '@/validators/station';
import { findStationById } from '@/server/station/station-repository';
import { findFormatByIdAndStation } from '@/server/station/format-repository';
import { lockSlotForUpdate, countReservationsBySlotId, incrementSlotBookedCount } from '@/server/station/slot-repository';
import { getConfigByStationId } from '@/server/station/config-repository';
import { getActiveCommissionRate } from '@/server/admin/platform-settings-service';
import { hasActiveEntryAtStation, createReservationEntry } from '@/server/reservations/entry-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { ActiveReservationExistsError, SlotFullError, NotFoundError } from '@/lib/errors';
import { db } from '@/lib/db';
import type { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return error403('Not available in production');
  }

  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const bodyWithStation = body as Record<string, unknown>;
  const stationParsed = stationIdParamSchema.safeParse({ id: bodyWithStation.station_id });
  if (!stationParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapStationZodErrors(stationParsed.error));
  }
  const bodyParsed = createReservationBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  const stationId = stationParsed.data.id;
  const { time_slot_id, vehicle_format_id } = bodyParsed.data;

  try {
    const station = await findStationById(stationId);
    if (!station || station.status !== 'active') return error404('Station not found or not active');

    const format = await findFormatByIdAndStation(vehicle_format_id, stationId);
    if (!format) return error404('Vehicle format not found');

    const config = await getConfigByStationId(stationId);
    const surcharge = config?.reservation_surcharge ? parseFloat(String(config.reservation_surcharge)) : 0;
    const amountTotal = parseFloat(String(format.price)) + surcharge;

    const commissionRate = await getActiveCommissionRate();
    const commissionAmount = amountTotal * parseFloat(commissionRate);
    const stationPayout = amountTotal - commissionAmount;

    const entry = await db.transaction(async (tx) => {
      const hasActive = await hasActiveEntryAtStation(auth.sub, stationId, tx);
      if (hasActive) throw new ActiveReservationExistsError();

      const slot = await lockSlotForUpdate(time_slot_id, stationId, tx);
      if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

      const count = await countReservationsBySlotId(time_slot_id, tx);
      if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

      const created = await createReservationEntry(
        {
          user_id: auth.sub,
          station_id: stationId,
          vehicle_format_id,
          time_slot_id,
          status: 'confirmed',
          amount_paid: amountTotal.toFixed(2),
          commission_rate: commissionRate,
          commission_amount: commissionAmount.toFixed(2),
          station_payout: stationPayout.toFixed(2),
          stripe_payment_id: null,
        },
        tx
      );
      await incrementSlotBookedCount(time_slot_id, tx);
      return created;
    });

    return successResponse({ reservation_id: entry.id, ...serializeEntry(entry) }, undefined, 201);
  } catch (e) {
    if (e instanceof ActiveReservationExistsError) return error409(e.message, ApiCode.ACTIVE_RESERVATION_EXISTS);
    if (e instanceof SlotFullError) return error409(e.message, ApiCode.SLOT_FULL);
    if (e instanceof NotFoundError) return error404(e.message);
    return error500(e);
  }
}
