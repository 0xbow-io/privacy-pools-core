/**
 * Configuration options for rate-limited log fetching
 */
export interface LogFetchConfig {
  /**
   * Maximum number of blocks to fetch in a single RPC call.
   * Default: 10000 (typical limit for most RPC providers)
   */
  blockChunkSize: number;

  /**
   * Maximum number of concurrent log fetch operations.
   * Default: 3
   */
  concurrency: number;

  /**
   * Delay in milliseconds between chunk requests (for additional throttling).
   * Default: 0 (no delay)
   */
  chunkDelayMs: number;

  /**
   * Whether to retry failed chunk fetches.
   * Default: true
   */
  retryOnFailure: boolean;

  /**
   * Maximum number of retries for a failed chunk.
   * Default: 3
   */
  maxRetries: number;

  /**
   * Base delay for exponential backoff on retries (ms).
   * Default: 1000
   */
  retryBaseDelayMs: number;
}

/**
 * Default log fetch configuration
 */
export const DEFAULT_LOG_FETCH_CONFIG: LogFetchConfig = {
  blockChunkSize: 10000,
  concurrency: 3,
  chunkDelayMs: 0,
  retryOnFailure: true,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
};

/**
 * Block range for chunked fetching
 */
export interface BlockRange {
  fromBlock: bigint;
  toBlock: bigint;
}
