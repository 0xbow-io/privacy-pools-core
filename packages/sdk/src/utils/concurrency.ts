/**
 * Executes an array of promise-returning functions with a maximum concurrency limit.
 * This prevents overwhelming RPC endpoints with too many concurrent requests.
 *
 * @param tasks - Array of functions that return promises
 * @param maxConcurrency - Maximum number of concurrent executions (default: 5)
 * @returns Promise that resolves to an array of settled results
 *
 * @example
 * ```typescript
 * const tasks = pools.map(pool => () => fetchPoolData(pool));
 * const results = await batchWithConcurrency(tasks, 5);
 * ```
 */
export async function batchWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number = 5
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];

  // Process tasks in batches
  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map(task => task())
    );
    results.push(...batchResults);
  }

  return results;
}

