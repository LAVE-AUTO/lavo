const mockSend = jest.fn().mockResolvedValue({});
const mockToDataUrl = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => mockSend(...args),
    },
  })),
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: (...args: unknown[]) => mockToDataUrl(...args),
  },
}));

describe('email QR fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-key';
  });

  it('falls back to link-only and logs when QR image generation fails', async () => {
    mockToDataUrl.mockRejectedValue(new Error('qr failed'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { sendStationApprovalEmail } = await import('@/lib/email');
    await sendStationApprovalEmail('merchant@example.com', 'Station QR', 'fr', {
      qrPublicUrl: 'https://example.com/fr/stations/station-id?qr_token=abc&v=1',
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[STATION_APPROVAL_QR_IMAGE_FALLBACK_LINK_ONLY]',
      expect.objectContaining({ error: 'qr failed' })
    );
    warnSpy.mockRestore();
  });
});
