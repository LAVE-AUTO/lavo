/**
 * @jest-environment node
 */
import { isTruePlatformSetting } from '@/helpers/platform-setting-boolean';

describe('isTruePlatformSetting', () => {
  it('returns true only for trimmed case-insensitive "true"', () => {
    expect(isTruePlatformSetting('true')).toBe(true);
    expect(isTruePlatformSetting(' TRUE ')).toBe(true);
    expect(isTruePlatformSetting('True')).toBe(true);
  });

  it('returns false for other strings, null, and undefined', () => {
    expect(isTruePlatformSetting('false')).toBe(false);
    expect(isTruePlatformSetting('1')).toBe(false);
    expect(isTruePlatformSetting('')).toBe(false);
    expect(isTruePlatformSetting(' truee ')).toBe(false);
    expect(isTruePlatformSetting(null)).toBe(false);
    expect(isTruePlatformSetting(undefined)).toBe(false);
  });
});
