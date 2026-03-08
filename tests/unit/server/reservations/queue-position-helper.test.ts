/**
 * Unit tests for queue-position-helper: getQueuePositionWhenMovingFromReservation.
 */
import {
  getQueuePositionWhenMovingFromReservation,
  type QueuePositionContext,
} from '@/server/reservations/queue-position-helper';

describe('queue-position-helper', () => {
  describe('getQueuePositionWhenMovingFromReservation', () => {
    it('returns 1 (first_in_queue) when no context', () => {
      expect(getQueuePositionWhenMovingFromReservation('station-1')).toBe(1);
    });

    it('returns 1 when context has existingQueueCount 0', () => {
      const ctx: QueuePositionContext = { existingQueueCount: 0 };
      expect(getQueuePositionWhenMovingFromReservation('station-1', ctx)).toBe(1);
    });

    it('returns 1 when context has existingQueueCount > 0 (default strategy is first_in_queue)', () => {
      const ctx: QueuePositionContext = { existingQueueCount: 5 };
      expect(getQueuePositionWhenMovingFromReservation('station-1', ctx)).toBe(1);
    });

    it('ignores stationId for default strategy', () => {
      expect(getQueuePositionWhenMovingFromReservation('any-station-id')).toBe(1);
    });
  });
});
