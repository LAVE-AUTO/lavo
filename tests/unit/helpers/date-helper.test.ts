import { parseTimeForDate } from '@/helpers/date-helper';

describe('parseTimeForDate', () => {
  const DATE = '2026-04-17';
  const EXPECTED_MS = new Date('2026-04-17T14:30:00Z').getTime();

  it('parses HH:mm format', () => {
    const result = parseTimeForDate(DATE, '14:30');
    expect(result.getTime()).toBe(EXPECTED_MS);
  });

  it('parses HH:mm:ss format', () => {
    const result = parseTimeForDate(DATE, '14:30:00');
    expect(result.getTime()).toBe(EXPECTED_MS);
  });

  it('parses HH:mm+00 format (DB time value)', () => {
    const result = parseTimeForDate(DATE, '14:30+00');
    expect(result.getTime()).toBe(EXPECTED_MS);
  });

  it('parses HH:mm:ssZ format', () => {
    const result = parseTimeForDate(DATE, '14:30:00Z');
    expect(result.getTime()).toBe(EXPECTED_MS);
  });
});
