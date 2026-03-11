import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { DataService } from '../../src/core/data.service.js';
import { ChainConfig, DepositEvent, WithdrawalEvent, RagequitEvent } from '../../src/types/events.js';
import { Hash } from '../../src/types/commitment.js';
import { DataError } from '../../src/errors/data.error.js';
import { PoolInfo } from '../../src/types/account.js';

// Hoist the mock so it's available inside vi.mock factory
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

describe('DataService', () => {
  let dataService: DataService;
  const SEPOLIA_CHAIN_ID = 11155111;
  const POOL_ADDRESS = '0xbbe3b00d54f0ee032eff07a47139da8d44095c96';
  const START_BLOCK = 7781496n;

  const poolInfo: PoolInfo = {
    chainId: SEPOLIA_CHAIN_ID,
    address: POOL_ADDRESS,
    deploymentBlock: START_BLOCK,
    scope: 1n as Hash,
  };

  const invalidPoolInfo: PoolInfo = {
    chainId: 1234,
    address: '0x0000000000000000000000000000000000000000',
    deploymentBlock: 0n,
    scope: 1n as Hash,
  };

  beforeAll(() => {
    const config: ChainConfig = {
      chainId: SEPOLIA_CHAIN_ID,
      privacyPoolAddress: POOL_ADDRESS,
      startBlock: START_BLOCK,
      rpcUrl: 'https://sepolia.rpc.hypersync.xyz',
    };

    const logFetchConfig = new Map();
    logFetchConfig.set(SEPOLIA_CHAIN_ID, { concurrency: 10 });

    dataService = new DataService([config], logFetchConfig);
  });

  beforeEach(() => {
    mockGetLogs.mockReset();
    mockGetBlockNumber.mockReset();
    mockGetBlockNumber.mockResolvedValue(START_BLOCK + 100_000n);
  });

  it('should throw error when chain is not configured', async () => {
    await expect(dataService.getDeposits(invalidPoolInfo)).rejects.toThrow(DataError);
    await expect(dataService.getWithdrawals(invalidPoolInfo)).rejects.toThrow(DataError);
    await expect(dataService.getRagequits(invalidPoolInfo)).rejects.toThrow(DataError);
  });

  it('should fetch deposit events', async () => {
    mockGetLogs.mockResolvedValue([
      {
        args: {
          _depositor: '0x1234567890abcdef1234567890abcdef12345678',
          _commitment: 111222333n,
          _label: 444555666n,
          _value: 1000000000000000000n,
          _merkleRoot: 777888999n,
        },
        blockNumber: START_BLOCK + 10n,
        transactionHash: '0x' + 'ab'.repeat(32),
      },
      {
        args: {
          _depositor: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          _commitment: 222333444n,
          _label: 555666777n,
          _value: 2000000000000000000n,
          _merkleRoot: 888999111n,
        },
        blockNumber: START_BLOCK + 20n,
        transactionHash: '0x' + 'cd'.repeat(32),
      },
    ]);

    const deposits = await dataService.getDeposits(poolInfo);

    expect(deposits.length).toBe(2);
    expect(deposits[0]).toBeDefined();

    const deposit = deposits[0] as DepositEvent;
    expect(deposit).toEqual(
      expect.objectContaining({
        depositor: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
        commitment: expect.any(BigInt),
        label: expect.any(BigInt),
        value: expect.any(BigInt),
        precommitment: expect.any(BigInt),
        blockNumber: expect.any(BigInt),
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
      })
    );

    expect(typeof deposit.commitment).toBe('bigint');
    expect(deposit.commitment).toBeGreaterThan(0n);
    expect(typeof deposit.label).toBe('bigint');
    expect(deposit.label).toBeGreaterThan(0n);
    expect(typeof deposit.precommitment).toBe('bigint');
    expect(deposit.precommitment).toBeGreaterThan(0n);
    expect(deposit.value).toBeGreaterThan(0n);
    expect(deposit.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
    expect(deposit.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should fetch withdrawal events', async () => {
    mockGetLogs.mockResolvedValue([
      {
        args: {
          _processooor: '0x1234567890abcdef1234567890abcdef12345678',
          _value: 500000000000000000n,
          _spentNullifier: 111222333n,
          _newCommitment: 444555666n,
        },
        blockNumber: START_BLOCK + 30n,
        transactionHash: '0x' + 'ef'.repeat(32),
      },
    ]);

    const withdrawals = await dataService.getWithdrawals(poolInfo);

    expect(withdrawals.length).toBe(1);
    expect(withdrawals[0]).toBeDefined();

    const withdrawal = withdrawals[0] as WithdrawalEvent;
    expect(withdrawal).toEqual(
      expect.objectContaining({
        withdrawn: expect.any(BigInt),
        spentNullifier: expect.any(BigInt),
        newCommitment: expect.any(BigInt),
        blockNumber: expect.any(BigInt),
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
      })
    );

    expect(typeof withdrawal.spentNullifier).toBe('bigint');
    expect(withdrawal.spentNullifier).toBeGreaterThan(0n);
    expect(typeof withdrawal.newCommitment).toBe('bigint');
    expect(withdrawal.newCommitment).toBeGreaterThan(0n);
    expect(withdrawal.withdrawn).toBeGreaterThan(0n);
    expect(withdrawal.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
    expect(withdrawal.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('should fetch ragequit events', async () => {
    mockGetLogs.mockResolvedValue([
      {
        args: {
          _ragequitter: '0x1234567890abcdef1234567890abcdef12345678',
          _commitment: 111222333n,
          _label: 444555666n,
          _value: 1000000000000000000n,
        },
        blockNumber: START_BLOCK + 40n,
        transactionHash: '0x' + '11'.repeat(32),
      },
    ]);

    const ragequits = await dataService.getRagequits(poolInfo);

    expect(ragequits.length).toBe(1);
    expect(ragequits[0]).toBeDefined();

    const ragequit = ragequits[0] as RagequitEvent;
    expect(ragequit).toEqual(
      expect.objectContaining({
        ragequitter: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
        commitment: expect.any(BigInt),
        label: expect.any(BigInt),
        value: expect.any(BigInt),
        blockNumber: expect.any(BigInt),
        transactionHash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
      })
    );

    expect(typeof ragequit.commitment).toBe('bigint');
    expect(ragequit.commitment).toBeGreaterThan(0n);
    expect(typeof ragequit.label).toBe('bigint');
    expect(ragequit.label).toBeGreaterThan(0n);
    expect(ragequit.value).toBeGreaterThan(0n);
    expect(ragequit.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
    expect(ragequit.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it('handles empty ragequit response', async () => {
    mockGetLogs.mockResolvedValue([]);

    const ragequits = await dataService.getRagequits(poolInfo);
    expect(ragequits.length).toBe(0);
  });

  it('should handle fromBlock parameter', async () => {
    const fromBlock = START_BLOCK + 500n;

    mockGetLogs.mockResolvedValue([
      {
        args: {
          _processooor: '0x1234567890abcdef1234567890abcdef12345678',
          _value: 500000000000000000n,
          _spentNullifier: 111222333n,
          _newCommitment: 444555666n,
        },
        blockNumber: fromBlock + 10n,
        transactionHash: '0x' + 'aa'.repeat(32),
      },
    ]);

    const withdrawals = await dataService.getWithdrawals(poolInfo, fromBlock);

    for (const event of withdrawals) {
      expect(event.blockNumber).toBeGreaterThanOrEqual(fromBlock);
    }
  });

  it('should throw DataError when getLogs fails for deposits', async () => {
    mockGetLogs.mockRejectedValue(new Error('RPC timeout'));

    await expect(dataService.getDeposits(poolInfo)).rejects.toThrow(DataError);
  });

  it('should throw DataError when getLogs fails for withdrawals', async () => {
    mockGetLogs.mockRejectedValue(new Error('RPC timeout'));

    await expect(dataService.getWithdrawals(poolInfo)).rejects.toThrow(DataError);
  });

  it('should throw DataError when getLogs fails for ragequits', async () => {
    mockGetLogs.mockRejectedValue(new Error('RPC timeout'));

    await expect(dataService.getRagequits(poolInfo)).rejects.toThrow(DataError);
  });

  it('should throw on deposit log with missing args', async () => {
    mockGetLogs.mockResolvedValue([
      { args: undefined, blockNumber: START_BLOCK + 1n, transactionHash: '0x' + 'ff'.repeat(32) },
    ]);

    await expect(dataService.getDeposits(poolInfo)).rejects.toThrow(DataError);
  });

  it('should throw on withdrawal log with missing required fields', async () => {
    mockGetLogs.mockResolvedValue([
      {
        args: { _value: null, _spentNullifier: null, _newCommitment: null },
        blockNumber: START_BLOCK + 1n,
        transactionHash: '0x' + 'ff'.repeat(32),
      },
    ]);

    await expect(dataService.getWithdrawals(poolInfo)).rejects.toThrow(DataError);
  });
});
