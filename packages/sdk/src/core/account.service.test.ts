import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountService } from "./account.service.js";
import { DataService } from "./data.service.js";
import { Hash } from "../types/commitment.js";
import { DepositEvent, WithdrawalEvent } from "../types/events.js";
import { PoolInfo } from "../types/account.js";
import { generatePrivateKey } from "viem/accounts";
import { bigintToHash } from "../crypto.js";

describe("AccountService", () => {
  let dataService: DataService;
  let accountService: AccountService;
  
  // Mock data
  const pool1: PoolInfo = {
    chainId: 1,
    address: "0x1234567890123456789012345678901234567890",
    scope: bigintToHash(BigInt("0x1111111111111111111111111111111111111111111111111111111111111111")),
    deploymentBlock: 1000n,
  };

  const pool2: PoolInfo = {
    chainId: 137,
    address: "0x9876543210987654321098765432109876543210",
    scope: bigintToHash(BigInt("0x2222222222222222222222222222222222222222222222222222222222222222")),
    deploymentBlock: 2000n,
  };

  // Test scenario:
  // Pool 1: 2 deposits, first has 2 withdrawals, second has 1 withdrawal
  // Pool 2: 1 deposit with no withdrawals
  const pool1Deposits: DepositEvent[] = [
    {
      depositor: "0xdepositor1",
      commitment: bigintToHash(BigInt("0xc1")),
      label: bigintToHash(BigInt("0xf1")),
      value: 100n,
      precommitment: bigintToHash(BigInt("0xp1")),
      blockNumber: 1100n,
      transactionHash: bigintToHash(BigInt("0xt1")),
    },
    {
      depositor: "0xdepositor2",
      commitment: bigintToHash(BigInt("0xc2")),
      label: bigintToHash(BigInt("0xf2")),
      value: 200n,
      precommitment: bigintToHash(BigInt("0xp2")),
      blockNumber: 1200n,
      transactionHash: bigintToHash(BigInt("0xt2")),
    },
  ];

  const pool1Withdrawals: WithdrawalEvent[] = [
    {
      withdrawn: 30n,
      spentNullifier: bigintToHash(BigInt("0xn1")),
      newCommitment: bigintToHash(BigInt("0xc3")),
      blockNumber: 1150n,
      transactionHash: bigintToHash(BigInt("0xt3")),
    },
    {
      withdrawn: 40n,
      spentNullifier: bigintToHash(BigInt("0xn2")),
      newCommitment: bigintToHash(BigInt("0xc4")),
      blockNumber: 1160n,
      transactionHash: bigintToHash(BigInt("0xt4")),
    },
    {
      withdrawn: 150n,
      spentNullifier: bigintToHash(BigInt("0xn3")),
      newCommitment: bigintToHash(BigInt("0xc5")),
      blockNumber: 1250n,
      transactionHash: bigintToHash(BigInt("0xt5")),
    },
  ];

  const pool2Deposits: DepositEvent[] = [
    {
      depositor: "0xdepositor3",
      commitment: bigintToHash(BigInt("0xc6")),
      label: bigintToHash(BigInt("0xf3")),
      value: 300n,
      precommitment: bigintToHash(BigInt("0xp3")),
      blockNumber: 2100n,
      transactionHash: bigintToHash(BigInt("0xt6")),
    },
  ];

  const pool2Withdrawals: WithdrawalEvent[] = [];

  beforeEach(() => {
    // Create mock DataService
    dataService = {
      getDeposits: vi.fn(async (chainId: number) => {
        if (chainId === pool1.chainId) return pool1Deposits;
        if (chainId === pool2.chainId) return pool2Deposits;
        return [];
      }),
      getWithdrawals: vi.fn(async (chainId: number) => {
        if (chainId === pool1.chainId) return pool1Withdrawals;
        if (chainId === pool2.chainId) return pool2Withdrawals;
        return [];
      }),
    } as unknown as DataService;

    // Create AccountService with a fixed seed for deterministic tests
    accountService = new AccountService(
      dataService,
      undefined,
      generatePrivateKey()
    );
  });

  describe("retrieveHistory", () => {
    it("should correctly reconstruct account history from multiple pools", async () => {
      // Process both pools
      await accountService.retrieveHistory([pool1, pool2]);

      // Get all spendable commitments
      const spendable = accountService.getSpendableCommitments();

      // Verify pool1 accounts
      const pool1Accounts = spendable.get(pool1.scope);
      expect(pool1Accounts).toBeDefined();
      expect(pool1Accounts).toHaveLength(2);

      // First deposit should have 30 remaining (100 - 30 - 40)
      expect(pool1Accounts![0]!.value).toBe(30n);

      // Second deposit should have 50 remaining (200 - 150)
      expect(pool1Accounts![1]!.value).toBe(50n);

      // Verify pool2 accounts
      const pool2Accounts = spendable.get(pool2.scope);
      expect(pool2Accounts).toBeDefined();
      expect(pool2Accounts).toHaveLength(1);

      // Deposit should have full value (no withdrawals)
      expect(pool2Accounts![0]!.value).toBe(300n);

      // Verify DataService calls
      expect(dataService.getDeposits).toHaveBeenCalledWith(pool1.chainId, {
        fromBlock: pool1.deploymentBlock,
      });
      expect(dataService.getDeposits).toHaveBeenCalledWith(pool2.chainId, {
        fromBlock: pool2.deploymentBlock,
      });

      // Verify withdrawal calls started from first deposit block
      expect(dataService.getWithdrawals).toHaveBeenCalledWith(pool1.chainId, {
        fromBlock: 1100n, // First deposit block
      });
      expect(dataService.getWithdrawals).toHaveBeenCalledWith(pool2.chainId, {
        fromBlock: 2100n, // First deposit block
      });
    });

    it("should handle pools with no deposits", async () => {
      const emptyPool: PoolInfo = {
        chainId: 10,
        address: "0xempty",
        scope: bigintToHash(BigInt("0xdeadbeef")), // Using a valid hex value
        deploymentBlock: 3000n,
      };

      await accountService.retrieveHistory([emptyPool]);

      const spendable = accountService.getSpendableCommitments();
      expect(spendable.has(emptyPool.scope)).toBe(false);
    });

    it("should handle pools with deposits but no withdrawals", async () => {
      await accountService.retrieveHistory([pool2]);

      const spendable = accountService.getSpendableCommitments();
      const accounts = spendable.get(pool2.scope);

      expect(accounts).toBeDefined();
      expect(accounts).toHaveLength(1);
      expect(accounts![0]!.value).toBe(300n);
    });
  });
}); 