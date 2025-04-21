import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountService } from "../../src/core/account.service.js";
import { DataService } from "../../src/core/data.service.js";
import { Hash, Secret } from "../../src/types/commitment.js";
import { DepositEvent, WithdrawalEvent } from "../../src/types/events.js";
import { PoolInfo, AccountCommitment } from "../../src/types/account.js";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Address } from "viem";
import { english, generateMnemonic } from "viem/accounts";

function randomBigInt(): bigint {
  return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
}

// Helper function to create mock transaction hashes
function mockTxHash(index: bigint): `0x${string}` {
  // Pad the index to create a valid 32-byte hash
  const paddedIndex = index.toString(16).padStart(64, '0');
  return `0x${paddedIndex}`;
}

describe("AccountService", () => {
  // Configuration for test data size
  const NUM_DEPOSITS = 1; // Number of random deposits
  const NUM_WITHDRAWALS = 2; // Number of withdrawals per pool account

  // Test pool configuration
  const POOL: PoolInfo = {
    chainId: 1,
    address: "0x8Fac8db5cae9C29e9c80c40e8CeDC47EEfe3874E" as Address,
    scope: randomBigInt() as Hash,
    deploymentBlock: 1000n,
  };

  let dataService: DataService;
  let accountService: AccountService;
  let masterKeys: [Secret, Secret];
  let depositEvents: DepositEvent[] = [];
  let withdrawalEvents: WithdrawalEvent[] = [];
  const testMnemonic = generateMnemonic(english);

  beforeEach(() => {
    // Reset test data arrays
    depositEvents = [];
    withdrawalEvents = [];

    // Mock the DataService first
    dataService = {
      getDeposits: vi.fn(async (chainId: number) => {
        return chainId === POOL.chainId ? depositEvents : [];
      }),
      getWithdrawals: vi.fn(async (chainId: number) => {
        return chainId === POOL.chainId ? withdrawalEvents : [];
      }),
    } as unknown as DataService;

    // Initialize account service with mocked data service
    accountService = new AccountService(dataService, {mnemonic: testMnemonic});
    masterKeys = accountService.account.masterKeys;

    // Generate test data
    generateTestData();
  });

  function generateTestData() {
    for (let i = 0; i < NUM_DEPOSITS; ++i) {
      const value = 100n;
      const label = randomBigInt() as Hash;
      const [masterNullifier, masterSecret] = masterKeys;

      const nullifier = poseidon([
        masterNullifier,
        POOL.scope,
        BigInt(i),
      ]) as Secret;
      const secret = poseidon([masterSecret, POOL.scope, BigInt(i)]) as Secret;

      const precommitment = poseidon([nullifier, secret]) as Hash;
      const commitment = poseidon([value, label, precommitment]) as Hash;

      const deposit: DepositEvent = {
        depositor: POOL.address,
        commitment,
        label,
        value,
        precommitment,
        blockNumber: POOL.deploymentBlock + BigInt(i * 100),
        transactionHash: mockTxHash(BigInt(i + 1)),
      };

      depositEvents.push(deposit);

      // Track the current commitment for this withdrawal chain
      let currentCommitment = {
        hash: commitment,
        value: value,
        label: label,
        nullifier,
        secret,
        blockNumber: deposit.blockNumber,
        txHash: deposit.transactionHash,
      };
      let remainingValue = value;

      for (let j = 0; j < NUM_WITHDRAWALS; ++j) {
        const withdrawnAmount = 10n;
        remainingValue -= withdrawnAmount;

        // Generate withdrawal nullifier and secret using master keys
        const withdrawalNullifier = poseidon([
          masterNullifier,
          currentCommitment.label,
          BigInt(j),
        ]) as Secret;
        const withdrawalSecret = poseidon([
          masterSecret,
          currentCommitment.label,
          BigInt(j),
        ]) as Secret;

        // Create precommitment and new commitment
        const withdrawalPrecommitment = poseidon([
          withdrawalNullifier,
          withdrawalSecret,
        ]) as Hash;
        const newCommitment = poseidon([
          remainingValue,
          currentCommitment.label,
          withdrawalPrecommitment,
        ]) as Hash;

        // Create withdrawal event
        const withdrawal: WithdrawalEvent = {
          withdrawn: withdrawnAmount,
          spentNullifier: poseidon([withdrawalNullifier]) as Hash,
          newCommitment,
          blockNumber: currentCommitment.blockNumber + BigInt((j + 1) * 100),
          transactionHash: mockTxHash(BigInt(i * 100 + j + 2)),
        };

        withdrawalEvents.push(withdrawal);

        // Update current commitment for next iteration
        currentCommitment = {
          hash: newCommitment,
          value: remainingValue,
          label: currentCommitment.label,
          nullifier: withdrawalNullifier,
          secret: withdrawalSecret,
          blockNumber: withdrawal.blockNumber,
          txHash: withdrawal.transactionHash,
        };
      }
    }
  }

  it("should reconstruct account history and find the valid deposit chain", async () => {
    // Process the pool
    await accountService.retrieveHistory([POOL]);

    // Log internal state
    console.log(
      "Account service internal state:",
      accountService.account.poolAccounts,
    );

    accountService.account.poolAccounts.forEach((p) =>
      console.log("PoolAccounts", p),
    );

    const spendable = accountService
      .getSpendableCommitments()
      .get(POOL.scope) as AccountCommitment[];

    if (spendable) {
      console.log("Spendable:", spendable);
    }

    // Verify service calls
    // expect(dataService.getDeposits).toHaveBeenCalledWith(POOL.chainId, {
    //   fromBlock: POOL.deploymentBlock,
    // });
    // expect(dataService.getWithdrawals).toHaveBeenCalledWith(POOL.chainId, {
    //   fromBlock: depositEvents[0].blockNumber,
    // });
  });
});
