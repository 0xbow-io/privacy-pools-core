import { describe, it, expect, beforeAll } from 'vitest';
import { DataService } from '../../src/core/data.service.js';
import { ChainConfig, DepositEvent, WithdrawalEvent, RagequitEvent } from '../../src/types/events.js';
import { Hash } from '../../src/types/commitment.js';
import { DataError } from '../../src/errors/data.error.js';
import { PoolInfo } from '../../src/types/account.js';

describe('DataService with Sepolia', () => {
  let dataService: DataService;
  const SEPOLIA_CHAIN_ID = 11155111;
  const POOL_ADDRESS = '0xbbe3b00d54f0ee032eff07a47139da8d44095c96';
  const START_BLOCK = 7781496n;

  // Create a PoolInfo object for testing
  const poolInfo: PoolInfo = {
    chainId: SEPOLIA_CHAIN_ID,
    address: POOL_ADDRESS,
    deploymentBlock: START_BLOCK,
    scope: 1n as Hash // Using a dummy value for scope
  };

  // Create an invalid pool for error testing
  const invalidPoolInfo: PoolInfo = {
    chainId: 1234,
    address: '0x0000000000000000000000000000000000000000',
    deploymentBlock: 0n,
    scope: 1n as Hash // Using a dummy value for scope
  };

  beforeAll(() => {
    const config: ChainConfig = {
      chainId: SEPOLIA_CHAIN_ID,
      privacyPoolAddress: POOL_ADDRESS,
      startBlock: START_BLOCK,
      rpcUrl: 'https://sepolia.rpc.hypersync.xyz',
    };

    dataService = new DataService([config]);
  });

  it('should throw error when chain is not configured', async () => {
    await expect(dataService.getDeposits(invalidPoolInfo)).rejects.toThrow(DataError);
    await expect(dataService.getWithdrawals(invalidPoolInfo)).rejects.toThrow(DataError);
    await expect(dataService.getRagequits(invalidPoolInfo)).rejects.toThrow(DataError);
  });

  it('should fetch deposit events', async () => {
    const deposits = await dataService.getDeposits(poolInfo);

    expect(deposits.length).toBeGreaterThan(0);
    expect(deposits[0]).toBeDefined();

    // Verify the structure of a deposit event
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

    // Verify Hash type assertions and value ranges
    expect(typeof deposit.commitment).toBe('bigint');
    expect(deposit.commitment).toBeGreaterThan(0n);
    expect(typeof deposit.label).toBe('bigint');
    expect(deposit.label).toBeGreaterThan(0n);
    expect(typeof deposit.precommitment).toBe('bigint');
    expect(deposit.precommitment).toBeGreaterThan(0n);
    expect(deposit.value).toBeGreaterThan(0n);
    expect(deposit.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
    expect(deposit.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Log some useful information
    console.log(`Found ${deposits.length} deposits`);
    console.log('Sample deposit:', {
      blockNumber: deposit.blockNumber.toString(),
      depositor: deposit.depositor,
      commitment: deposit.commitment.toString(),
      label: deposit.label.toString(),
      value: deposit.value.toString(),
      precommitment: deposit.precommitment.toString(),
      transactionHash: deposit.transactionHash,
    });
  });

  it('should fetch withdrawal events', async () => {
    const withdrawals = await dataService.getWithdrawals(poolInfo);

    expect(withdrawals.length).toBeGreaterThan(0);
    expect(withdrawals[0]).toBeDefined();

    // Verify the structure of a withdrawal event
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

    // Verify Hash type assertions and value ranges
    expect(typeof withdrawal.spentNullifier).toBe('bigint');
    expect(withdrawal.spentNullifier).toBeGreaterThan(0n);
    expect(typeof withdrawal.newCommitment).toBe('bigint');
    expect(withdrawal.newCommitment).toBeGreaterThan(0n);
    expect(withdrawal.withdrawn).toBeGreaterThan(0n);
    expect(withdrawal.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
    expect(withdrawal.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Log some useful information
    console.log(`Found ${withdrawals.length} withdrawals`);
    console.log('Sample withdrawal:', {
      blockNumber: withdrawal.blockNumber.toString(),
      withdrawn: withdrawal.withdrawn.toString(),
      spentNullifier: withdrawal.spentNullifier.toString(),
      newCommitment: withdrawal.newCommitment.toString(),
      transactionHash: withdrawal.transactionHash,
    });
  });

  it('should fetch ragequit events', async () => {
    const ragequits = await dataService.getRagequits(poolInfo);

    // Ragequits might not exist, so we don't assert on length
    if (ragequits.length > 0) {
      expect(ragequits[0]).toBeDefined();

      // Verify the structure of a ragequit event
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

      // Verify Hash type assertions and value ranges
      expect(typeof ragequit.commitment).toBe('bigint');
      expect(ragequit.commitment).toBeGreaterThan(0n);
      expect(typeof ragequit.label).toBe('bigint');
      expect(ragequit.label).toBeGreaterThan(0n);
      expect(ragequit.value).toBeGreaterThan(0n);
      expect(ragequit.blockNumber).toBeGreaterThanOrEqual(START_BLOCK);
      expect(ragequit.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Log some useful information
      console.log(`Found ${ragequits.length} ragequits`);
      console.log('Sample ragequit:', {
        blockNumber: ragequit.blockNumber.toString(),
        ragequitter: ragequit.ragequitter,
        commitment: ragequit.commitment.toString(),
        label: ragequit.label.toString(),
        value: ragequit.value.toString(),
        transactionHash: ragequit.transactionHash,
      });
    } else {
      console.log('No ragequit events found');
    }
  });

  it('should handle fromBlock parameter', async () => {
    const fromBlock = START_BLOCK + 500n;

    // Test with custom fromBlock
    const withdrawals = await dataService.getWithdrawals(poolInfo, fromBlock);
    const ragequits = await dataService.getRagequits(poolInfo, fromBlock);

    // Verify that all events are after the fromBlock
    for (const event of [...withdrawals, ...ragequits]) {
      expect(event.blockNumber).toBeGreaterThanOrEqual(fromBlock);
    }
  });
}); 
