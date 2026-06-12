import { createHmac, timingSafeEqual } from 'crypto';

export const QR_TOKEN_VERSION = '1';
export const CANONICAL_QR_LOCALE: 'fr' | 'en' = 'fr';
const QR_TOKEN_HEX_PATTERN = /^[a-f0-9]{64}$/;
const MIN_QR_TOKEN_SECRET_LENGTH = 32;

/**
 * Reads and validates the QR token signing secret
 *
 * Loads the shared HMAC secret used to generate deterministic station QR
 * signatures. This helper centralizes configuration validation so every QR
 * token operation fails consistently when the environment is incomplete.
 *
 * @returns {string} Trimmed QR token secret string with a minimum length of 32 characters
 * @throws {Error} If `QR_TOKEN_SECRET` is missing from the environment
 * @throws {Error} If `QR_TOKEN_SECRET` is shorter than 32 characters
 *
 * @example
 * const secret = getQrTokenSecret();
 * console.log(secret.length >= 32);
 *
 * @example
 * process.env.QR_TOKEN_SECRET = 'x'.repeat(32);
 * const secret = getQrTokenSecret();
 *
 * @example
 * delete process.env.QR_TOKEN_SECRET;
 * // getQrTokenSecret(); // Throws Error('QR_TOKEN_SECRET is not configured')
 */
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

/**
 * Signs a station identifier into a deterministic QR digest
 *
 * Uses the shared QR HMAC secret to derive the canonical token embedded in
 * station QR URLs. This helper is kept private so all token generation and
 * verification flows rely on the same digest algorithm and secret source.
 *
 * @param {string} stationId - Station UUID to sign into the QR payload
 * @returns {string} Lowercase SHA-256 hex digest bound to the provided station id
 * @throws {Error} Propagates configuration errors from `getQrTokenSecret`
 *
 * @example
 * const digest = signStationId('station-123');
 * console.log(digest.length); // 64
 *
 * @example
 * const a = signStationId('station-123');
 * const b = signStationId('station-123');
 * console.log(a === b); // true
 *
 * @example
 * const digest = signStationId('station-456');
 * console.log(/^[a-f0-9]{64}$/.test(digest)); // true
 */
function signStationId(stationId: string): string {
  return createHmac('sha256', getQrTokenSecret()).update(stationId).digest('hex');
}

/**
 * Generates the canonical QR token for a station
 *
 * Exposes the deterministic station signature used by admin pages, station
 * dashboards, and resolver URLs. Because the token is derived from the station
 * id and shared secret, every caller receives the same stable value.
 *
 * @param {string} stationId - Station UUID whose QR token should be generated
 * @returns {string} Stable 64-character lowercase hex token for the station
 * @throws {Error} Propagates configuration errors from `getQrTokenSecret`
 *
 * @example
 * const token = generateQrToken('station-123');
 * console.log(token.length); // 64
 *
 * @example
 * const first = generateQrToken('station-123');
 * const second = generateQrToken('station-123');
 * console.log(first === second); // true
 *
 * @example
 * const token = generateQrToken('station-456');
 * console.log(/^[a-f0-9]{64}$/.test(token)); // true
 */
export function generateQrToken(stationId: string): string {
  return signStationId(stationId);
}

/**
 * Verifies that a station QR token matches the expected signature
 *
 * Validates both the version marker and the HMAC signature embedded in a
 * scanned QR URL. The token is normalized to lowercase before validation so
 * callers can pass scanner output without caring about casing differences.
 *
 * @param {{ stationId: string; qrToken: string; version?: string | null }} params - Verification input bundle
 * @param {string} params.stationId - Station UUID expected to own the QR token
 * @param {string} params.qrToken - Raw token value extracted from the QR query string
 * @param {string | null} [params.version] - Version marker from the QR query string
 * @returns {{ isValid: boolean; reason?: 'missing_version' | 'invalid_version' | 'invalid_signature' }} Validation result with an optional failure reason
 * @throws {Error} Propagates configuration errors when the signing secret is unavailable
 *
 * @example
 * const result = verifyQrToken({
 *   stationId: 'station-123',
 *   qrToken: generateQrToken('station-123'),
 *   version: QR_TOKEN_VERSION,
 * });
 * console.log(result.isValid); // true
 *
 * @example
 * const result = verifyQrToken({
 *   stationId: 'station-123',
 *   qrToken: 'bad-token',
 *   version: QR_TOKEN_VERSION,
 * });
 * console.log(result.reason); // 'invalid_signature'
 *
 * @example
 * const result = verifyQrToken({
 *   stationId: 'station-123',
 *   qrToken: generateQrToken('station-123'),
 *   version: null,
 * });
 * console.log(result.reason); // 'missing_version'
 */
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

/**
 * Builds the localized public station URL for QR fallbacks or direct access
 *
 * Produces the station public page URL and, by default, preserves QR context
 * in the query string so downstream flows can still recognize QR-originated
 * visits. Callers can disable that query payload when they need a clean
 * fallback destination with no scan context.
 *
 * @param {{ origin: string; locale?: 'fr' | 'en'; stationId: string; qrToken?: string; version?: string; includeQrContext?: boolean }} params - URL generation options
 * @param {string} params.origin - Absolute application origin such as `https://app.example.com`
 * @param {'fr' | 'en'} [params.locale] - Optional locale prefix included before `/stations`
 * @param {string} params.stationId - Station UUID to embed in the path
 * @param {string} [params.qrToken] - Existing QR token to reuse instead of regenerating one
 * @param {string} [params.version] - Existing QR version marker to reuse instead of the current default
 * @param {boolean} [params.includeQrContext=true] - Whether to append `qr_token` and `v` query params
 * @returns {string} Absolute public station URL, with or without QR query context depending on the options
 * @throws {Error} Propagates configuration errors if a token must be generated
 *
 * @example
 * const url = buildStationQrPublicUrl({
 *   origin: 'https://app.example.com',
 *   locale: 'fr',
 *   stationId: 'station-123',
 * });
 *
 * @example
 * const fallbackUrl = buildStationQrPublicUrl({
 *   origin: 'https://app.example.com',
 *   locale: 'en',
 *   stationId: 'station-123',
 *   includeQrContext: false,
 * });
 *
 * @example
 * const url = buildStationQrPublicUrl({
 *   origin: 'https://app.example.com/',
 *   stationId: 'station-123',
 *   qrToken: 'abc',
 *   version: '1',
 * });
 */
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

/**
 * Builds the canonical station QR resolver URL
 *
 * Produces the single stable URL that printed station QR codes should point
 * to. The resolver route can then decide at runtime whether the scan should
 * lead to promo registration or the station public page without regenerating
 * the QR asset.
 *
 * @param {{ origin: string; locale?: 'fr' | 'en'; stationId: string }} params - Resolver URL generation options
 * @param {string} params.origin - Absolute application origin such as `https://app.example.com`
 * @param {'fr' | 'en'} [params.locale='fr'] - Locale prefix to embed in the resolver path
 * @param {string} params.stationId - Station UUID to embed in the resolver path
 * @returns {string} Absolute resolver URL containing the deterministic QR token and version query params
 * @throws {Error} Propagates configuration errors if the signing secret is unavailable
 *
 * @example
 * const url = buildStationQrResolverUrl({
 *   origin: 'https://app.example.com',
 *   stationId: 'station-123',
 * });
 *
 * @example
 * const url = buildStationQrResolverUrl({
 *   origin: 'https://app.example.com',
 *   locale: 'en',
 *   stationId: 'station-123',
 * });
 *
 * @example
 * const url = buildStationQrResolverUrl({
 *   origin: 'https://app.example.com/',
 *   stationId: 'station-123',
 * });
 */
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
