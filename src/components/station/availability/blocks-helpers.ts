import { intlDateLocale } from '@/helpers/date-helper';
import type { AvailabilityBlock } from './types';

/** Merge blocks that share the same startTime+endTime into one display card. */
export function groupBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  const map = new Map<string, AvailabilityBlock>();

  for (const block of blocks) {
    const key = `${block.startTime}|${block.endTime}`;
    const existing = map.get(key);

    if (existing) {
      const mergedDates = Array.from(new Set([...existing.dates, ...block.dates])).sort();
      const mergedBayIds =
        existing.bayIds.includes('all') || block.bayIds.includes('all')
          ? ['all']
          : Array.from(new Set([...existing.bayIds, ...block.bayIds]));
      const mergedIds = [...(existing.ids ?? [existing.id]), block.id];

      map.set(key, { ...existing, ids: mergedIds, dates: mergedDates, bayIds: mergedBayIds });
    } else {
      map.set(key, { ...block, ids: [block.id] });
    }
  }

  return Array.from(map.values());
}

/** Group consecutive ISO dates into ranges, then format the ranges compactly.
 *  e.g. ["2026-02-10","2026-02-11","2026-02-15","2026-03-01","2026-03-02"]
 *       → "10-11 févr. & 15 févr. & 1-2 mars 2026"
 */
export function formatDates(dates: string[], locale: string): string {
  if (dates.length === 0) return '';

  const sorted = [...dates].sort();

  // Build consecutive ranges
  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(rangeEnd + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      rangeEnd = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });

  // Format each range; include a year suffix whenever a range's year differs
  // from the next range (or on the final range) so cross-year sets are unambiguous.
  const parts = ranges.map(({ start, end }, idx) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sDay = s.getDate();
    const eDay = e.getDate();
    const sMonth = s.toLocaleDateString(intlDateLocale(locale), { month: 'short' });
    const eMonth = e.toLocaleDateString(intlDateLocale(locale), { month: 'short' });
    const rangeYear = e.getFullYear();

    // Attach the year to this segment if it differs from the next segment's year,
    // or if this is the final segment.
    const nextYear = idx < ranges.length - 1
      ? new Date(ranges[idx + 1].end + 'T00:00:00').getFullYear()
      : null;
    const showYear = nextYear === null || rangeYear !== nextYear;

    let segment: string;
    if (start === end) {
      segment = `${sDay} ${sMonth}`;
    } else if (sMonth === eMonth) {
      segment = `${sDay}-${eDay} ${sMonth}`;
    } else {
      segment = `${sDay} ${sMonth}-${eDay} ${eMonth}`;
    }

    return showYear ? `${segment} ${rangeYear}` : segment;
  });

  return parts.join(' & ');
}
