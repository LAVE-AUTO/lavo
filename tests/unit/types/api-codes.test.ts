import { ApiCode } from '@/types/api-codes';

describe('ApiCode', () => {
  it('exports expected enum values', () => {
    expect(ApiCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
    expect(ApiCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ApiCode.FORBIDDEN).toBe('FORBIDDEN');
    expect(ApiCode.NOT_FOUND).toBe('NOT_FOUND');
    expect(ApiCode.CONFLICT).toBe('CONFLICT');
    expect(ApiCode.EMAIL_ALREADY_EXISTS).toBe('EMAIL_ALREADY_EXISTS');
    expect(ApiCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
    expect(ApiCode.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(ApiCode.NOT_IMPLEMENTED).toBe('NOT_IMPLEMENTED');
  });

  it('can be used as error response code type', () => {
    const code: ApiCode = ApiCode.UNAUTHORIZED;
    expect(code).toBe('UNAUTHORIZED');
  });
});
