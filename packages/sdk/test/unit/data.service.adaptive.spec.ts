import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataService } from '../../src/core/data.service.js';
import { ChainConfig } from '../../src/types/events.js';
import { Hash } from '../../src/types/commitment.js';
import { PoolInfo } from '../../src/types/account.js';

const { mockGetLogs, mockGetBlockNumber } = vi.hoisted(() => ({
  mockGetLogs: vi.fn(),
  mockGetBlockNumber: vi.fn(),
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getLogs: mockGetLogs,
      getBlockNumber: mockGetBlockNumber,
    })),
  };
});

/**
 * Narrowing a refused block range.
 *
 * Retrying a 429 by re-sending the identical request at the identical size is
 * not slowing down, and retrying a range-too-large can never succeed however
 * many times it is repeated. Both are answered by asking for less.
 *
 * This matters beyond throughput: when the scan fails, the account loads with
 * no pools and no balances, and a user looking at that screen concludes their
 * funds are gone.
 */
describe('DataService adaptive block ranges', () => {
  const CHAIN_ID = 11155111;
  const POOL_ADDRESS = '0xbbe3b00d54f0ee032eff07a47139da8d44095c96';
  const START_BLOCK = 0n;

  const pool: PoolInfo = {
    chainId: CHAIN_ID,
    address: POOL_ADDRESS,
    deploymentBlock: START_BLOCK,
    scope: 1n as Hash,
  };

  const config: ChainConfig = {
    chainId: CHAIN_ID,
    privacyPoolAddress: POOL_ADDRESS,
    startBlock: START_BLOCK,
    rpcUrl: 'https://example.invalid',
  };

  /** One chunk covering every block, so the split is the only thing under test. */
  const service = (overrides: Record<string, unknown> = {}) => {
    const logFetchConfig = new Map();
    logFetchConfig.set(CHAIN_ID, {
      blockChunkSize: 1_000_000,
      concurrency: 1,
      chunkDelayMs: 0,
      retryOnFailure: false,
      ...overrides,
    });
    return new DataService([config], logFetchConfig);
  };

  const spans = () =>
    mockGetLogs.mock.calls.map(
      ([args]: [{ fromBlock: bigint; toBlock: bigint }]) => args.toBlock - args.fromBlock + 1n,
    );

  beforeEach(() => {
    mockGetLogs.mockReset();
    mockGetBlockNumber.mockReset();
    mockGetBlockNumber.mockResolvedValue(999n);
  });

  it('halves the range on a rate limit instead of re-sending the same request', async () => {
    // Refuse anything wider than 250 blocks, exactly as a provider cap behaves.
    mockGetLogs.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (toBlock - fromBlock + 1n > 250n) {
        throw new Error('429 Too Many Requests');
      }
      return [];
    });

    await expect(service().getDeposits(pool)).resolves.toEqual([]);

    // It got there by narrowing, not by luck: the first attempt was the full
    // 1000 blocks and the accepted ones are all inside the cap.
    expect(spans()[0]).toBe(1000n);
    const accepted = spans().filter((span) => span <= 250n);
    expect(accepted.length).toBeGreaterThan(0);
    expect(Math.max(...spans().map(Number))).toBe(1000);
  });

  it('covers every block exactly once when it splits', async () => {
    // The bug a naive split invites is an off-by-one at the midpoint, which
    // silently drops or double-counts the events in one block.
    const seen: Array<[bigint, bigint]> = [];
    mockGetLogs.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      if (toBlock - fromBlock + 1n > 100n) throw new Error('block range is too large');
      seen.push([fromBlock, toBlock]);
      return [];
    });

    await service().getDeposits(pool);

    const covered = seen.sort((a, b) => Number(a[0] - b[0]));
    expect(covered[0]![0]).toBe(0n);
    expect(covered[covered.length - 1]![1]).toBe(999n);
    for (let i = 1; i < covered.length; i += 1) {
      // Contiguous, no gap and no overlap.
      expect(covered[i]![0]).toBe(covered[i - 1]![1] + 1n);
    }
  });

  it('does not split a failure a smaller range cannot fix', async () => {
    // Splitting an unrelated error would turn one clear failure into many
    // requests against an endpoint that is already refusing them.
    mockGetLogs.mockRejectedValue(new Error('invalid address'));

    await expect(service().getDeposits(pool)).rejects.toThrow('invalid address');
    expect(mockGetLogs).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than splitting forever', async () => {
    mockGetLogs.mockRejectedValue(new Error('429 Too Many Requests'));

    await expect(service().getDeposits(pool)).rejects.toThrow('429');
    // Bounded: 2^(depth+1) is the ceiling, not an unbounded fan-out.
    expect(mockGetLogs.mock.calls.length).toBeLessThanOrEqual(2 ** 9);
  });

  it('still retries first when retries are enabled, and only then narrows', async () => {
    let calls = 0;
    mockGetLogs.mockImplementation(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
      calls += 1;
      if (toBlock - fromBlock + 1n > 250n) throw new Error('rate limit exceeded');
      return [];
    });

    await expect(
      service({ retryOnFailure: true, maxRetries: 2, retryBaseDelayMs: 0 }).getDeposits(pool),
    ).resolves.toEqual([]);

    // The full range was attempted three times (1 + 2 retries) before the
    // first halving, so the existing backoff behaviour is unchanged.
    expect(spans().slice(0, 3)).toEqual([1000n, 1000n, 1000n]);
    expect(calls).toBeGreaterThan(3);
  });
});
