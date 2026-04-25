/**
 * Runs async tasks in fixed-size batches with bounded concurrency.
 * Each batch is awaited with Promise.allSettled before the next starts.
 *
 * The concurrency limit is clamped to [1, 10]. Passing a value outside that
 * range in development emits a console warning so the caller is aware.
 */
export async function runWithConcurrencyLimit<T, R = void>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const limit = Math.max(1, Math.min(concurrency, 10));
  if (process.env.NODE_ENV !== 'production' && limit !== concurrency) {
    console.warn(
      `[runWithConcurrencyLimit] concurrency ${concurrency} clamped to ${limit}`
    );
  }
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const settled = await Promise.allSettled(chunk.map((item) => fn(item)));
    results.push(...settled);
  }
  return results;
}
