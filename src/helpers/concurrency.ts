/**
 * Runs async tasks in fixed-size batches with bounded concurrency.
 * Each batch is awaited with Promise.allSettled before the next starts.
 */
export async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  const limit = Math.max(1, Math.min(concurrency, 10));
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const settled = await Promise.allSettled(chunk.map((item) => fn(item)));
    results.push(...settled);
  }
  return results;
}
