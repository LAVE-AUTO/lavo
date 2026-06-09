/**
 * Station subscription pricing — an alternative to per-transaction commission.
 *
 * Two pieces, both stored in the generic `settings` table:
 *  - Global subscription PLANS (type='admin', entity_id=null, key='subscription_plans'):
 *    a JSON array the admin edits on the Tarification screen.
 *  - Per-station BILLING MODEL (type='station', entity_id=stationId, key='billing_model'):
 *    whether a station pays via commission (default) or a subscription plan.
 */
import { randomUUID } from 'crypto';
import { and, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { ValidationError } from '@/lib/errors';

const PLANS_KEY = 'subscription_plans';
const BILLING_KEY = 'billing_model';

export interface SubscriptionPlan {
  id: string;
  name: string;
  /** Short marketing description shown on the plan card. */
  description: string;
  /** Bullet-point perks shown with checkmarks on the card. */
  features: string[];
  /** Monthly price in the platform currency (CAD). */
  monthly_price: number;
  /** Optional annual price; null when not offered. */
  annual_price: number | null;
  is_active: boolean;
}

export type StationBillingModel =
  | { model: 'commission' }
  | { model: 'subscription'; plan_id: string };

function toMoney(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (!Number.isFinite(n) || n < 0) throw new ValidationError('Price must be a positive number');
  return Math.round(n * 100) / 100;
}

// %%%%% Plans (global) %%%%%

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.type, 'admin'), isNull(settings.entity_id), eq(settings.key, PLANS_KEY)),
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as SubscriptionPlan[]) : [];
  } catch {
    return [];
  }
}

export async function setSubscriptionPlans(
  input: Array<Partial<SubscriptionPlan>>,
  adminId: string,
): Promise<SubscriptionPlan[]> {
  const normalized: SubscriptionPlan[] = input.map((p) => {
    const name = String(p.name ?? '').trim();
    if (name.length === 0) throw new ValidationError('Plan name is required');
    return {
      id: p.id && /^[0-9a-f-]{16,}$/i.test(p.id) ? p.id : randomUUID(),
      name: name.slice(0, 80),
      description: String(p.description ?? '').trim().slice(0, 500),
      features: Array.isArray(p.features)
        ? p.features.map((f) => String(f).trim()).filter((f) => f.length > 0).slice(0, 20)
        : [],
      monthly_price: toMoney(p.monthly_price),
      annual_price: p.annual_price == null || p.annual_price === ('' as unknown) ? null : toMoney(p.annual_price),
      is_active: Boolean(p.is_active),
    };
  });

  await db
    .insert(settings)
    .values({ type: 'admin', key: PLANS_KEY, value: JSON.stringify(normalized), entity_id: null, updated_by: adminId, updated_at: new Date() })
    .onConflictDoUpdate({
      target: [settings.type, settings.key],
      targetWhere: isNull(settings.entity_id),
      set: { value: sql`excluded.value`, updated_by: sql`excluded.updated_by`, updated_at: sql`NOW()` },
    });

  return normalized;
}

// %%%%% Per-station billing model %%%%%

export async function getStationBillingModel(stationId: string): Promise<StationBillingModel> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.type, 'station'), eq(settings.entity_id, stationId), eq(settings.key, BILLING_KEY)),
  });
  if (!row?.value) return { model: 'commission' };
  try {
    const parsed = JSON.parse(row.value) as StationBillingModel;
    if (parsed?.model === 'subscription' && typeof parsed.plan_id === 'string') return parsed;
    return { model: 'commission' };
  } catch {
    return { model: 'commission' };
  }
}

export async function setStationBillingModel(
  stationId: string,
  model: StationBillingModel,
  adminId: string,
): Promise<StationBillingModel> {
  let value: StationBillingModel;
  if (model.model === 'subscription') {
    const plans = await getSubscriptionPlans();
    if (!plans.some((p) => p.id === model.plan_id && p.is_active)) {
      throw new ValidationError('Unknown or inactive subscription plan');
    }
    value = { model: 'subscription', plan_id: model.plan_id };
  } else {
    value = { model: 'commission' };
  }

  await db
    .insert(settings)
    .values({ type: 'station', key: BILLING_KEY, value: JSON.stringify(value), entity_id: stationId, updated_by: adminId, updated_at: new Date() })
    .onConflictDoUpdate({
      target: [settings.type, settings.entity_id, settings.key],
      targetWhere: isNotNull(settings.entity_id),
      set: { value: sql`excluded.value`, updated_by: sql`excluded.updated_by`, updated_at: sql`NOW()` },
    });

  return value;
}
