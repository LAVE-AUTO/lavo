/**
 * Queue position helper: determines where to place a client when moving from reservation to queue.
 * Used by the cron that downgrades late (unconfirmed) reservations. Strategy is pluggable so
 * first_in_queue, middle_of_queue, etc. can be swapped without changing cron or services.
 */

export type QueuePositionContext = {
  /** Number of entries currently in the queue (entry_type = 'queue') for the station. */
  existingQueueCount?: number;
};

export type QueuePositionStrategy = 'first_in_queue' | 'middle_of_queue';

const DEFAULT_STRATEGY: QueuePositionStrategy = 'first_in_queue';

/**
 * Returns the queue_position to assign when moving a reservation to the queue (downgrade).
 * Default strategy: first_in_queue (position 1). To add middle_of_queue: use context.existingQueueCount
 * and return Math.floor(context.existingQueueCount / 2) + 1; then shift existing positions in the
 * repository/service when inserting.
 *
 * @param _stationId - Station id (reserved for future strategies that may need station config).
 * @param context - Optional context; existingQueueCount used for middle_of_queue strategy.
 * @returns The 1-based queue position to assign.
 */
export function getQueuePositionWhenMovingFromReservation(
  _stationId: string,
  context?: QueuePositionContext
): number {
  switch (DEFAULT_STRATEGY) {
    case 'first_in_queue':
      return 1;
    case 'middle_of_queue': {
      const n = context?.existingQueueCount ?? 0;
      return n <= 0 ? 1 : Math.floor(n / 2) + 1;
    }
    default:
      return 1;
  }
}
