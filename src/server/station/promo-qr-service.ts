import 'server-only';

import { createHmac, randomUUID } from 'crypto';

const MIN_SECRET_LENGTH = 32;

function getPromoQrSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error('QR_TOKEN_SECRET is not configured');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`QR_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

export function normalizePromoCommissionRatePercent(value: number): number {
  return Number((value / 100).toFixed(4));
}

export function generatePromoRefCode(params: {
  stationId: string;
  commissionRatePercent: number;
  generatedAt?: Date;
}): string {
  const generatedAt = params.generatedAt ?? new Date();
  const nonce = randomUUID();
  return createHmac('sha256', getPromoQrSecret())
    .update(`promo:${params.stationId}:${params.commissionRatePercent.toFixed(1)}:${generatedAt.toISOString()}:${nonce}`)
    .digest('hex');
}

export function buildPromoReferralUrl(params: {
  origin: string;
  locale?: 'fr' | 'en';
  refCode: string;
}): string {
  const origin = params.origin.replace(/\/+$/, '');
  const localizedPrefix = params.locale ? `/${params.locale}` : '';
  const base = `${origin}${localizedPrefix}/register`;
  const query = new URLSearchParams({
    ref_code: params.refCode,
    source: 'promo',
  });
  return `${base}?${query.toString()}`;
}
