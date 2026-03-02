import { validateEmail, validatePassword, validateText } from '@/helpers/validators';

describe('validators', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test@domain.co')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for password >= 8 chars', () => {
      expect(validatePassword('password123')).toBe(true);
    });

    it('should return false for short password', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('')).toBe(false);
    });
  });

  describe('validateText', () => {
    it('should return true for valid text', () => {
      expect(validateText('hello')).toBe(true);
    });

    it('should return false for too short text', () => {
      expect(validateText('ab')).toBe(false);
    });
  });
});
