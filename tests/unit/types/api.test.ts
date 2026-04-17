import type { ApiSuccessBody, ApiErrorBody } from '@/types/api';
import { ApiCode } from '@/types/api-codes';

describe('API types', () => {
  describe('ApiSuccessBody', () => {
    it('allows data without message', () => {
      const body: ApiSuccessBody<{ id: string }> = { data: { id: '1' } };
      expect(body.data).toEqual({ id: '1' });
      expect('success' in body).toBe(false);
    });

    it('allows data with optional message', () => {
      const body: ApiSuccessBody<{ ok: boolean }> = {
        message: 'Done',
        data: { ok: true },
      };
      expect(body.message).toBe('Done');
      expect(body.data).toEqual({ ok: true });
    });
  });

  describe('ApiErrorBody', () => {
    it('requires message, allows optional code and errors', () => {
      const body: ApiErrorBody = { message: 'Failed' };
      expect(body.message).toBe('Failed');
      expect('success' in body).toBe(false);
    });

    it('allows code from ApiCode enum', () => {
      const body: ApiErrorBody = {
        message: 'Conflict',
        code: ApiCode.EMAIL_ALREADY_EXISTS,
      };
      expect(body.code).toBe(ApiCode.EMAIL_ALREADY_EXISTS);
    });

    it('allows field-level errors', () => {
      const body: ApiErrorBody = {
        message: 'Validation failed',
        code: ApiCode.VALIDATION_FAILED,
        errors: [
          { field: 'email', message: 'Invalid email' },
          { message: 'Required' },
        ],
      };
      expect(body.errors).toHaveLength(2);
      expect(body.errors![0].field).toBe('email');
      expect(body.errors![1].field).toBeUndefined();
    });
  });
});
