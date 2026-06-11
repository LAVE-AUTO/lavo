import { createHmac, timingSafeEqual } from 'crypto';

export const QR_TOKEN_VERSION = '1';
export const CANONICAL_QR_LOCALE: 'fr' | 'en' = 'fr';
const QR_TOKEN_HEX_PATTERN = /^[a-f0-9]{64}$/;
const MIN_QR_TOKEN_SECRET_LENGTH = 32;

function getQrTokenSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error('QR_TOKEN_SECRET is not configured');
  }
  if (secret.length < MIN_QR_TOKEN_SECRET_LENGTH) {
    throw new Error(`QR_TOKEN_SECRET must be at least ${MIN_QR_TOKEN_SECRET_LENGTH} characters`);
  }
  return secret;
}

function signStationId(stationId: string): string {
  return createHmac('sha256', getQrTokenSecret()).update(stationId).digest('hex');
}

export function generateQrToken(stationId: string): string {
  return signStationId(stationId);
}

export function verifyQrToken(params: {
  stationId: string;
  qrToken: string;
  version?: string | null;
}): { isValid: boolean; reason?: 'missing_version' | 'invalid_version' | 'invalid_signature' } {
  const { stationId, qrToken, version } = params;
  if (!version) return { isValid: false, reason: 'missing_version' };
  if (version !== QR_TOKEN_VERSION) return { isValid: false, reason: 'invalid_version' };
  // Accept caller casing by normalizing once, then validating/signature-checking a canonical lowercase token.
  const normalizedToken = qrToken.toLowerCase();
  if (!QR_TOKEN_HEX_PATTERN.test(normalizedToken)) return { isValid: false, reason: 'invalid_signature' };

  const expected = signStationId(stationId);
  // Compare raw digest bytes (not UTF-8 text) to keep constant-time semantics explicit.
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(normalizedToken, 'hex');
  const sameLength = expectedBuffer.length === receivedBuffer.length;
  const valid = sameLength && timingSafeEqual(expectedBuffer, receivedBuffer);

  if (!valid) return { isValid: false, reason: 'invalid_signature' };
  return { isValid: true };
}

export function buildStationQrPublicUrl(params: {
  origin: string;
  locale?: 'fr' | 'en';
  stationId: string;
  qrToken?: string;
  version?: string;
  includeQrContext?: boolean;
}): string {
  const qrToken = params.qrToken ?? generateQrToken(params.stationId);
  const version = params.version ?? QR_TOKEN_VERSION;
  const origin = params.origin.replace(/\/+$/, '');
  const localizedPrefix = params.locale ? `/${params.locale}` : '';
  const base = `${origin}${localizedPrefix}/stations/${params.stationId}`;
  if (params.includeQrContext === false) {
    return base;
  }
  const query = new URLSearchParams({
    qr_token: qrToken,
    v: version,
  });
  return `${base}?${query.toString()}`;
}

export function buildStationQrResolverUrl(params: {
  origin: string;
  locale?: 'fr' | 'en';
  stationId: string;
}): string {
  const qrToken = generateQrToken(params.stationId);
  const origin = params.origin.replace(/\/+$/, '');
  const localizedPrefix = `/${params.locale ?? CANONICAL_QR_LOCALE}`;
  const base = `${origin}${localizedPrefix}/qr/station/${params.stationId}`;
  const query = new URLSearchParams({
    qr_token: qrToken,
    v: QR_TOKEN_VERSION,
  });
  return `${base}?${query.toString()}`;
}
