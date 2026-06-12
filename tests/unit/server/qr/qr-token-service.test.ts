import {
  CANONICAL_QR_LOCALE,
  buildStationQrPublicUrl,
  buildStationQrResolverUrl,
  generateQrToken,
  verifyQrToken,
  QR_TOKEN_VERSION,
} from '@/server/qr/qr-token-service';

describe('qr-token-service', () => {
  const stationId = 'a3f1150f-8e52-4cbf-b037-f9755ec6162c';

  beforeEach(() => {
    process.env.QR_TOKEN_SECRET = 'unit-test-qr-secret-0123456789abcdef';
  });

  it('validates a signed token with version v=1', () => {
    const qrToken = generateQrToken(stationId);
    const result = verifyQrToken({ stationId, qrToken, version: QR_TOKEN_VERSION });
    expect(result).toEqual({ isValid: true });
  });

  it('rejects token when version is missing or invalid', () => {
    const qrToken = generateQrToken(stationId);
    expect(verifyQrToken({ stationId, qrToken, version: undefined })).toEqual({
      isValid: false,
      reason: 'missing_version',
    });
    expect(verifyQrToken({ stationId, qrToken, version: '2' })).toEqual({
      isValid: false,
      reason: 'invalid_version',
    });
    expect(verifyQrToken({ stationId, qrToken, version: '1 ' })).toEqual({
      isValid: false,
      reason: 'invalid_version',
    });
  });

  it('rejects tampered signatures', () => {
    const result = verifyQrToken({
      stationId,
      qrToken: 'tampered-signature',
      version: QR_TOKEN_VERSION,
    });
    expect(result).toEqual({ isValid: false, reason: 'invalid_signature' });
  });

  it('accepts uppercase hex token variants', () => {
    const qrToken = generateQrToken(stationId).toUpperCase();
    const result = verifyQrToken({ stationId, qrToken, version: QR_TOKEN_VERSION });
    expect(result).toEqual({ isValid: true });
  });

  it('rejects valid signature bound to another station (bypass attempt)', () => {
    const station2 = '2d8f0e9b-0d58-44d0-a84f-b84483c370f7';
    const qrTokenForOtherStation = generateQrToken(station2);
    const result = verifyQrToken({
      stationId,
      qrToken: qrTokenForOtherStation,
      version: QR_TOKEN_VERSION,
    });
    expect(result).toEqual({ isValid: false, reason: 'invalid_signature' });
  });

  it('throws when QR_TOKEN_SECRET is too short', () => {
    process.env.QR_TOKEN_SECRET = 'short-secret';
    expect(() => generateQrToken(stationId)).toThrow('QR_TOKEN_SECRET must be at least 32 characters');
  });

  it('builds the canonical resolver URL for station QR codes', () => {
    const url = buildStationQrResolverUrl({
      origin: 'https://app.example.com/',
      locale: 'en',
      stationId,
    });

    expect(url).toMatch(new RegExp(`^https://app\\.example\\.com/en/qr/station/${stationId}\\?`));
    expect(url).toContain(`v=${QR_TOKEN_VERSION}`);
    expect(url).toContain(`qr_token=${generateQrToken(stationId)}`);
  });

  it('defaults resolver URLs to the canonical QR locale', () => {
    const url = buildStationQrResolverUrl({
      origin: 'https://app.example.com/',
      stationId,
    });

    expect(url).toMatch(new RegExp(`^https://app\\.example\\.com/${CANONICAL_QR_LOCALE}/qr/station/${stationId}\\?`));
  });

  it('can build a station public URL without QR context', () => {
    const url = buildStationQrPublicUrl({
      origin: 'https://app.example.com/',
      locale: 'fr',
      stationId,
      includeQrContext: false,
    });

    expect(url).toBe(`https://app.example.com/fr/stations/${stationId}`);
  });
});
