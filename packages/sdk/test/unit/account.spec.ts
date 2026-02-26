import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountService } from "../../src/core/account.service.js";
import { DataService } from "../../src/core/data.service.js";
import { Hash, Secret } from "../../src/types/commitment.js";
import { RagequitEvent } from "../../src/types/events.js";
import {
  AccountCommitment,
  PoolAccount,
  PoolInfo,
  PrivacyPoolAccount,
} from "../../src/types/account.js";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Address, Hex } from "viem";
import { english, generateMnemonic } from "viem/accounts";
import { AccountError } from "../../src/errors/account.error.js";
import { generateMasterKeys } from "../../src/crypto.js";

describe("AccountService", () => {
  // Test constants
  const TEST_MNEMONIC = generateMnemonic(english);
  const TEST_POOL: PoolInfo = {
    chainId: 1,
    address: "0x8Fac8db5cae9C29e9c80c40e8CeDC47EEfe3874E" as Address,
    scope: BigInt("123456789") as Hash,
    deploymentBlock: 1000n,
  };

  let dataService: DataService;
  let accountService: AccountService;

  // Helper function to create mock transaction hashes
  function mockTxHash(index: number): Hex {
    // Pad the index to create a valid 32-byte hash
    const paddedIndex = index.toString(16).padStart(64, "0");
    return `0x${paddedIndex}` as Hex;
  }

  beforeEach(() => {
    dataService = {
      getDeposits: vi.fn(async () => []),
      getWithdrawals: vi.fn(async () => []),
      getRagequits: vi.fn(async () => []),
    } as unknown as DataService;

    accountService = new AccountService(dataService, {
      mnemonic: TEST_MNEMONIC,
    });
  });

  describe("constructor", () => {
    it("initialize with master keys derived from mnemonic", () => {
      const {
        masterNullifier: expectedMasterNullifier,
        masterSecret: expectedMasterSecret,
      } = generateMasterKeys(TEST_MNEMONIC);
      const [masterNullifier, masterSecret] = accountService.account.masterKeys;

      expect(masterNullifier).toBeDefined();
      expect(masterSecret).toBeDefined();
      expect(masterNullifier).toBe(expectedMasterNullifier);
      expect(masterSecret).toBe(expectedMasterSecret);
      expect(accountService.account.poolAccounts.size).toBe(0);
    });

    it("initialize with empty pool accounts map", () => {
      expect(accountService.account.poolAccounts).toBeInstanceOf(Map);
      expect(accountService.account.poolAccounts.size).toBe(0);
    });

    it("throw an error if account initialization fails", () => {
      // Test that error is properly caught and re-thrown
      expect(
        () => new AccountService(dataService, { mnemonic: "invalid mnemonic" })
      ).toThrow(AccountError);
    });

    it("initialize with provided account", () => {
      const ppAccount: PrivacyPoolAccount = {
        masterKeys: [
          BigInt("123456789") as Secret,
          BigInt("987654321") as Secret,
        ],
        poolAccounts: new Map(),
        creationTimestamp: BigInt("123456789"),
        lastUpdateTimestamp: BigInt("987654321"),
      };

      const account = new AccountService(dataService, { account: ppAccount });
      expect(account).toBeDefined();
      expect(account.account).toBe(ppAccount);
    });
  });

  describe("createDepositSecrets", () => {
    it("generate deterministic nullifier and secret for a scope", () => {
      const { nullifier, secret, precommitment } =
        accountService.createDepositSecrets(TEST_POOL.scope);

      expect(nullifier).toBeDefined();
      expect(secret).toBeDefined();
      expect(precommitment).toBeDefined();

      // Verify precommitment is the hash of nullifier and secret
      const expectedPrecommitment = poseidon([nullifier, secret]);
      expect(precommitment).toBe(expectedPrecommitment);
    });

    it("generate different secrets for different scopes", () => {
      const scope1 = 123456789n as Hash;
      const scope2 = 987654321n as Hash;

      const result1 = accountService.createDepositSecrets(scope1);
      const result2 = accountService.createDepositSecrets(scope2);

      expect(result1.nullifier).not.toBe(result2.nullifier);
      expect(result1.secret).not.toBe(result2.secret);
      expect(result1.precommitment).not.toBe(result2.precommitment);
    });

    it("generates different secrets for different indices", () => {
      const result1 = accountService.createDepositSecrets(TEST_POOL.scope, 0n);
      const result2 = accountService.createDepositSecrets(TEST_POOL.scope, 1n);

      expect(result1.nullifier).not.toBe(result2.nullifier);
      expect(result1.secret).not.toBe(result2.secret);
      expect(result1.precommitment).not.toBe(result2.precommitment);
    });

    it("uses the number of existing accounts as index if not provided", () => {
      // Add a mock pool account for the scope
      accountService.account.poolAccounts.set(TEST_POOL.scope, [
        {} as PoolAccount,
        {} as PoolAccount,
      ]);

      const withIndexZero = accountService.createDepositSecrets(
        TEST_POOL.scope,
        0n
      );
      const withDefaultIndex = accountService.createDepositSecrets(
        TEST_POOL.scope
      );

      // If the default index is used correctly, the results should be different
      expect(withDefaultIndex.nullifier).not.toBe(withIndexZero.nullifier);
      expect(withDefaultIndex.secret).not.toBe(withIndexZero.secret);
    });

    it("throws an error if the index is negative", () => {
      expect(() =>
        accountService.createDepositSecrets(TEST_POOL.scope, -1n)
      ).toThrow(AccountError);
    });
  });

  describe("createWithdrawalSecrets", () => {
    let testCommitment: AccountCommitment;

    beforeEach(() => {
      // Set up a mock commitment and account
      const label = BigInt("987654321") as Hash;
      testCommitment = {
        hash: BigInt("111222333") as Hash,
        value: 100n,
        label,
        nullifier: BigInt("444555666") as Secret,
        secret: BigInt("777888999") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(1),
      };

      // Add an account with this commitment
      accountService.account.poolAccounts.set(TEST_POOL.scope, [
        {
          label,
          deposit: testCommitment,
          children: [],
        },
      ]);
    });

    it("generate deterministic nullifier and secret for a commitment", () => {
      const { nullifier, secret } =
        accountService.createWithdrawalSecrets(testCommitment);

      expect(nullifier).toBeDefined();
      expect(secret).toBeDefined();
      expect(typeof nullifier).toBe("bigint");
      expect(typeof secret).toBe("bigint");
    });

    it("throw an error if the commitment is not found", () => {
      const unknownCommitment: AccountCommitment = {
        ...testCommitment,
        label: BigInt("999999999") as Hash,
      };

      expect(() =>
        accountService.createWithdrawalSecrets(unknownCommitment)
      ).toThrow(AccountError);
    });
  });

  describe("addPoolAccount", () => {
    it("adds a new pool account correctly", () => {
      const scope = TEST_POOL.scope;
      const value = 100n;
      const nullifier = BigInt("123456789") as Secret;
      const secret = BigInt("987654321") as Secret;
      const label = BigInt("555666777") as Hash;
      const blockNumber = 1000n;
      const txHash = mockTxHash(1);

      const newAccount = accountService.addPoolAccount(
        scope,
        value,
        nullifier,
        secret,
        label,
        blockNumber,
        txHash
      );

      expect(newAccount).toBeDefined();
      expect(newAccount.label).toBe(label);
      expect(newAccount.deposit.value).toBe(value);
      expect(newAccount.deposit.nullifier).toBe(nullifier);
      expect(newAccount.deposit.secret).toBe(secret);
      expect(newAccount.deposit.blockNumber).toBe(blockNumber);
      expect(newAccount.deposit.txHash).toBe(txHash);
      expect(newAccount.children).toEqual([]);

      // Verify account was added to the map
      expect(accountService.account.poolAccounts.has(scope)).toBe(true);
      expect(accountService.account.poolAccounts.get(scope)!.length).toBe(1);
      expect(accountService.account.poolAccounts.get(scope)![0]).toBe(
        newAccount
      );
    });

    it("generates the correct commitment hash", () => {
      const scope = TEST_POOL.scope;
      const value = 100n;
      const nullifier = BigInt("123456789") as Secret;
      const secret = BigInt("987654321") as Secret;
      const label = BigInt("555666777") as Hash;
      const blockNumber = 1000n;
      const txHash = mockTxHash(1);

      const newAccount = accountService.addPoolAccount(
        scope,
        value,
        nullifier,
        secret,
        label,
        blockNumber,
        txHash
      );

      // Calculate expected commitment hash
      const precommitment = poseidon([nullifier, secret]);
      const expectedCommitment = poseidon([value, label, precommitment]);

      expect(newAccount.deposit.hash).toBe(expectedCommitment);
    });

    it("adds multiple accounts to the same scope", () => {
      const scope = TEST_POOL.scope;

      // Add first account
      accountService.addPoolAccount(
        scope,
        100n,
        BigInt("111111111") as Secret,
        BigInt("222222222") as Secret,
        BigInt("333333333") as Hash,
        1000n,
        mockTxHash(1)
      );

      // Add second account
      accountService.addPoolAccount(
        scope,
        200n,
        BigInt("444444444") as Secret,
        BigInt("555555555") as Secret,
        BigInt("666666666") as Hash,
        1100n,
        mockTxHash(2)
      );

      expect(accountService.account.poolAccounts.get(scope)!.length).toBe(2);
      expect(
        accountService.account.poolAccounts.get(scope)!.at(0)!.deposit.value
      ).toBe(100n);
      expect(
        accountService.account.poolAccounts.get(scope)!.at(1)!.deposit.value
      ).toBe(200n);
    });
  });

  describe("addWithdrawalCommitment", () => {
    let parentCommitment: AccountCommitment;

    beforeEach(() => {
      // Set up parent commitment and account
      const label = BigInt("987654321") as Hash;
      parentCommitment = {
        hash: BigInt("111222333") as Hash,
        value: 100n,
        label,
        nullifier: BigInt("444555666") as Secret,
        secret: BigInt("777888999") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(1),
      };

      // Add an account with this commitment
      accountService.account.poolAccounts.set(TEST_POOL.scope, [
        {
          label,
          deposit: parentCommitment,
          children: [],
        },
      ]);
    });

    it("adds withdrawal commitment correctly", () => {
      const value = 90n; // 100n - 10n withdrawal
      const nullifier = BigInt("123123123") as Secret;
      const secret = BigInt("456456456") as Secret;
      const blockNumber = 1100n;
      const txHash = mockTxHash(2);

      const newCommitment = accountService.addWithdrawalCommitment(
        parentCommitment,
        value,
        nullifier,
        secret,
        blockNumber,
        txHash
      );

      // Verify commitment was created correctly
      expect(newCommitment).toBeDefined();
      expect(newCommitment.value).toBe(value);
      expect(newCommitment.label).toBe(parentCommitment.label);
      expect(newCommitment.nullifier).toBe(nullifier);
      expect(newCommitment.secret).toBe(secret);
      expect(newCommitment.blockNumber).toBe(blockNumber);
      expect(newCommitment.txHash).toBe(txHash);

      // Verify commitment was added to account
      const account = accountService.account.poolAccounts
        .get(TEST_POOL.scope)!
        .at(0)!;
      expect(account.children.length).toBe(1);
      expect(account.children.at(0)!).toBe(newCommitment);
    });

    it("generates the correct commitment hash", () => {
      const value = 90n;
      const nullifier = BigInt("123123123") as Secret;
      const secret = BigInt("456456456") as Secret;
      const blockNumber = 1100n;
      const txHash = mockTxHash(2);

      const newCommitment = accountService.addWithdrawalCommitment(
        parentCommitment,
        value,
        nullifier,
        secret,
        blockNumber,
        txHash
      );

      // Calculate expected commitment hash
      const precommitment = poseidon([nullifier, secret]);
      const expectedCommitment = poseidon([
        value,
        parentCommitment.label,
        precommitment,
      ]);

      expect(newCommitment.hash).toBe(expectedCommitment);
    });

    it("finds parent commitment in account's children", () => {
      // First create a child commitment
      const intermediateCommitment = accountService.addWithdrawalCommitment(
        parentCommitment,
        90n,
        BigInt("123123123") as Secret,
        BigInt("456456456") as Secret,
        1100n,
        mockTxHash(2)
      );

      // Now create a second withdrawal from the first child
      const secondChildCommitment = accountService.addWithdrawalCommitment(
        intermediateCommitment,
        80n,
        BigInt("789789789") as Secret,
        BigInt("321321321") as Secret,
        1200n,
        mockTxHash(3)
      );

      // Verify both children were added
      const account = accountService.account.poolAccounts
        .get(TEST_POOL.scope)!
        .at(0)!;
      expect(account.children.length).toBe(2);
      expect(account.children.at(0)!).toBe(intermediateCommitment);
      expect(account.children.at(1)!).toBe(secondChildCommitment);
    });

    it("throws an error if parent commitment is not found", () => {
      const unknownCommitment: AccountCommitment = {
        ...parentCommitment,
        hash: BigInt("999999999") as Hash,
      };

      expect(() =>
        accountService.addWithdrawalCommitment(
          unknownCommitment,
          90n,
          BigInt("123123123") as Secret,
          BigInt("456456456") as Secret,
          1100n,
          mockTxHash(2)
        )
      ).toThrow(AccountError);
    });
  });

  describe("addRagequitToAccount", () => {
    let testLabel: Hash;

    beforeEach(() => {
      // Set up an account
      testLabel = BigInt("987654321") as Hash;
      const commitment: AccountCommitment = {
        hash: BigInt("111222333") as Hash,
        value: 100n,
        label: testLabel,
        nullifier: BigInt("444555666") as Secret,
        secret: BigInt("777888999") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(1),
      };

      // Add an account with this commitment
      accountService.account.poolAccounts.set(TEST_POOL.scope, [
        {
          label: testLabel,
          deposit: commitment,
          children: [],
        },
      ]);
    });

    it("adds a ragequit event to account correctly", () => {
      const ragequitEvent: RagequitEvent = {
        ragequitter: "0x123456789abcdef",
        commitment: BigInt("111222333") as Hash,
        label: testLabel,
        value: 100n,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      const updatedAccount = accountService.addRagequitToAccount(
        testLabel,
        ragequitEvent
      );

      // Verify ragequit was added to account
      expect(updatedAccount.ragequit).toBeDefined();
      expect(updatedAccount.ragequit).toBe(ragequitEvent);

      // Verify it's the same account in the map
      const accountInMap = accountService.account.poolAccounts
        .get(TEST_POOL.scope)!
        .at(0)!;
      expect(accountInMap.ragequit).toBe(ragequitEvent);
    });

    it("throws an error if no account with the label is found", () => {
      const unknownLabel = BigInt("111111111") as Hash;
      const ragequitEvent: RagequitEvent = {
        ragequitter: "0x123456789abcdef",
        commitment: BigInt("111222333") as Hash,
        label: unknownLabel,
        value: 100n,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      expect(() =>
        accountService.addRagequitToAccount(unknownLabel, ragequitEvent)
      ).toThrow(AccountError);
    });
  });

  describe("getSpendableCommitments", () => {
    beforeEach(() => {
      // Scope 1: Account with non-zero value, not ragequit
      const scope1 = BigInt("1111") as Hash;
      const commitment1: AccountCommitment = {
        hash: BigInt("10001") as Hash,
        value: 100n,
        label: BigInt("1001") as Hash,
        nullifier: BigInt("10002") as Secret,
        secret: BigInt("10003") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(1),
      };

      accountService.account.poolAccounts.set(scope1, [
        {
          label: commitment1.label,
          deposit: commitment1,
          children: [],
        },
      ]);

      // Scope 2: Ragequit account
      const scope2 = BigInt("2222") as Hash;
      const commitment2: AccountCommitment = {
        hash: BigInt("20001") as Hash,
        value: 100n,
        label: BigInt("2001") as Hash,
        nullifier: BigInt("20002") as Secret,
        secret: BigInt("20003") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(3),
      };

      const ragequitEvent: RagequitEvent = {
        ragequitter: "0x123456789abcdef",
        commitment: commitment2.hash,
        label: commitment2.label,
        value: 100n,
        blockNumber: 1100n,
        transactionHash: mockTxHash(4),
      };

      accountService.account.poolAccounts.set(scope2, [
        {
          label: commitment2.label,
          deposit: commitment2,
          children: [],
          ragequit: ragequitEvent,
        },
      ]);

      // Scope 3: Account with children
      const scope3 = BigInt("3333") as Hash;
      const depositCommitment: AccountCommitment = {
        hash: BigInt("30001") as Hash,
        value: 100n,
        label: BigInt("3001") as Hash,
        nullifier: BigInt("30002") as Secret,
        secret: BigInt("30003") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(5),
      };

      const childCommitment: AccountCommitment = {
        hash: BigInt("30004") as Hash,
        value: 50n, // Partial withdrawal
        label: depositCommitment.label,
        nullifier: BigInt("30005") as Secret,
        secret: BigInt("30006") as Secret,
        blockNumber: 1100n,
        txHash: mockTxHash(6),
      };

      accountService.account.poolAccounts.set(scope3, [
        {
          label: depositCommitment.label,
          deposit: depositCommitment,
          children: [childCommitment],
        },
      ]);
    });

    it("returns only non-zero, non-ragequit commitments", () => {
      const spendableCommitments = accountService.getSpendableCommitments();

      // Should include scope1 and scope3, but not scope2 (ragequit)
      expect(spendableCommitments.size).toBe(2);
      expect(spendableCommitments.has(BigInt("1111"))).toBe(true);
      expect(spendableCommitments.has(BigInt("3333"))).toBe(true);
      expect(spendableCommitments.has(BigInt("2222"))).toBe(false);
    });

    it("returns the latest commitment in the chain", () => {
      const spendableCommitments = accountService.getSpendableCommitments();

      // For scope3, should return the child commitment (latest) not the deposit
      const scope3Commitments = spendableCommitments.get(BigInt("3333"))!;
      expect(scope3Commitments.length).toBe(1);
      expect(scope3Commitments.at(0)!.value).toBe(50n);
      expect(scope3Commitments.at(0)!.hash).toBe(BigInt("30004"));
    });

    it("returns empty map when no spendable commitments exist", () => {
      // Clear all accounts and add only zero-value and ragequit accounts
      accountService.account.poolAccounts.clear();

      // Add zero-value account
      const zeroValueCommitment: AccountCommitment = {
        hash: BigInt("50001") as Hash,
        value: 0n,
        label: BigInt("5001") as Hash,
        nullifier: BigInt("50002") as Secret,
        secret: BigInt("50003") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(7),
      };

      accountService.account.poolAccounts.set(BigInt("5555") as Hash, [
        {
          label: zeroValueCommitment.label,
          deposit: zeroValueCommitment,
          children: [],
        },
      ]);

      // Add ragequit account
      const ragequitCommitment: AccountCommitment = {
        hash: BigInt("60001") as Hash,
        value: 100n,
        label: BigInt("6001") as Hash,
        nullifier: BigInt("60002") as Secret,
        secret: BigInt("60003") as Secret,
        blockNumber: 1000n,
        txHash: mockTxHash(8),
      };

      const ragequitEvent: RagequitEvent = {
        ragequitter: "0x123456789abcdef",
        commitment: ragequitCommitment.hash,
        label: ragequitCommitment.label,
        value: 100n,
        blockNumber: 1100n,
        transactionHash: mockTxHash(9),
      };

      accountService.account.poolAccounts.set(BigInt("6666") as Hash, [
        {
          label: ragequitCommitment.label,
          deposit: ragequitCommitment,
          children: [],
          ragequit: ragequitEvent,
        },
      ]);

      const spendableCommitments = accountService.getSpendableCommitments();
      expect(spendableCommitments.size).toBe(0);
    });
  });

  describe("getDepositEvents", () => {
    it("returns a map of precommitments to deposit events", async () => {
      const depositEvent1 = {
        depositor: "0x123",
        commitment: BigInt("11111") as Hash,
        label: BigInt("22222") as Hash,
        value: 100n,
        precommitment: BigInt("33333") as Hash,
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };
      const depositEvent2 = {
        depositor: "0x456",
        commitment: BigInt("44444") as Hash,
        label: BigInt("55555") as Hash,
        value: 200n,
        precommitment: BigInt("66666") as Hash,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      const mockDeposits = [depositEvent1, depositEvent2];
      vi.spyOn(dataService, "getDeposits").mockResolvedValue(mockDeposits);

      const result = await accountService.getDepositEvents(TEST_POOL);

      expect(result.size).toBe(2);
      expect(result.get(depositEvent1.precommitment)).toEqual(depositEvent1);
      expect(result.get(depositEvent2.precommitment)).toEqual(depositEvent2);

      expect(dataService.getDeposits).toHaveBeenCalledWith(TEST_POOL);
    });

    it("returns an empty map when no deposits exist", async () => {
      vi.spyOn(dataService, "getDeposits").mockResolvedValue([]);

      const result = await accountService.getDepositEvents(TEST_POOL);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);

      expect(dataService.getDeposits).toHaveBeenCalledWith(TEST_POOL);
    });

    it("throws an EventError when dataService fails", async () => {
      const errorMessage = "API request failed";
      vi.spyOn(dataService, "getDeposits").mockRejectedValue(
        new Error(errorMessage)
      );

      await expect(() =>
        accountService.getDepositEvents(TEST_POOL)
      ).rejects.toThrow();

      expect(dataService.getDeposits).toHaveBeenCalledWith(TEST_POOL);
    });
  });

  describe("getWithdrawalEvents", () => {
    it("returns a map of spent nullifiers to withdrawal events", async () => {
      const withdrawalEvent1 = {
        withdrawn: 10n,
        spentNullifier: BigInt("11111") as Hash,
        newCommitment: BigInt("22222") as Hash,
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };

      const withdrawalEvent2 = {
        withdrawn: 20n,
        spentNullifier: BigInt("33333") as Hash,
        newCommitment: BigInt("44444") as Hash,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      const mockWithdrawals = [withdrawalEvent1, withdrawalEvent2];
      vi.spyOn(dataService, "getWithdrawals").mockResolvedValue(
        mockWithdrawals
      );

      const result = await accountService.getWithdrawalEvents(TEST_POOL);

      expect(result.size).toBe(2);
      expect(result.get(withdrawalEvent1.spentNullifier)).toEqual(
        withdrawalEvent1
      );
      expect(result.get(withdrawalEvent2.spentNullifier)).toEqual(
        withdrawalEvent2
      );

      expect(dataService.getWithdrawals).toHaveBeenCalledWith(TEST_POOL);
    });

    it("returns an empty map when no withdrawals exist", async () => {
      vi.spyOn(dataService, "getWithdrawals").mockResolvedValue([]);

      const result = await accountService.getWithdrawalEvents(TEST_POOL);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);

      expect(dataService.getWithdrawals).toHaveBeenCalledWith(TEST_POOL);
    });

    it("throws an EventError when dataService fails", async () => {
      const errorMessage = "API request failed";
      vi.spyOn(dataService, "getWithdrawals").mockRejectedValue(
        new Error(errorMessage)
      );

      await expect(
        accountService.getWithdrawalEvents(TEST_POOL)
      ).rejects.toThrow();

      expect(dataService.getWithdrawals).toHaveBeenCalledWith(TEST_POOL);
    });
  });

  describe("getRagequitEvents", () => {
    it("returns a map of labels to ragequit events", async () => {
      const ragequitEvent1 = {
        ragequitter: "0x123",
        commitment: BigInt("11111") as Hash,
        label: BigInt("22222") as Hash,
        value: 100n,
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };

      const ragequitEvent2 = {
        ragequitter: "0x456",
        commitment: BigInt("33333") as Hash,
        label: BigInt("44444") as Hash,
        value: 200n,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      const mockRagequits = [ragequitEvent1, ragequitEvent2];
      vi.spyOn(dataService, "getRagequits").mockResolvedValue(mockRagequits);

      const result = await accountService.getRagequitEvents(TEST_POOL);

      expect(result.size).toBe(2);
      expect(result.get(ragequitEvent1.label)).toEqual(ragequitEvent1);
      expect(result.get(ragequitEvent2.label)).toEqual(ragequitEvent2);

      expect(dataService.getRagequits).toHaveBeenCalledWith(TEST_POOL);
    });

    it("returns an empty map when no ragequits exist", async () => {
      vi.spyOn(dataService, "getRagequits").mockResolvedValue([]);

      const result = await accountService.getRagequitEvents(TEST_POOL);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);

      expect(dataService.getRagequits).toHaveBeenCalledWith(TEST_POOL);
    });

    it("throws an EventError when dataService fails", async () => {
      const errorMessage = "API request failed";
      vi.spyOn(dataService, "getRagequits").mockRejectedValue(
        new Error(errorMessage)
      );

      await expect(
        accountService.getRagequitEvents(TEST_POOL)
      ).rejects.toThrow();

      expect(dataService.getRagequits).toHaveBeenCalledWith(TEST_POOL);
    });
  });

  describe("getEvents", () => {
    it("collects events for all pools and returns a map of results", async () => {
      const pool1 = TEST_POOL;
      const pool2: PoolInfo = {
        chainId: 2,
        address: "0x9876543210987654321098765432109876543210" as Address,
        scope: BigInt("987654321") as Hash,
        deploymentBlock: 2000n,
      };

      const depositEvent1 = {
        depositor: "0x123",
        commitment: BigInt("11111") as Hash,
        label: BigInt("22222") as Hash,
        value: 100n,
        precommitment: BigInt("33333") as Hash,
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };

      const withdrawalEvent1 = {
        withdrawn: 10n,
        spentNullifier: BigInt("44444") as Hash,
        newCommitment: BigInt("55555") as Hash,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      const ragequitEvent1 = {
        ragequitter: "0x123",
        commitment: BigInt("66666") as Hash,
        label: BigInt("77777") as Hash,
        value: 100n,
        blockNumber: 1200n,
        transactionHash: mockTxHash(3),
      };

      vi.spyOn(dataService, "getDeposits").mockImplementation(async (pool) => {
        if (pool.chainId === pool1.chainId) return [depositEvent1];
        return [];
      });

      vi.spyOn(dataService, "getWithdrawals").mockImplementation(
        async (pool) => {
          if (pool.chainId === pool1.chainId) return [withdrawalEvent1];
          return [];
        }
      );

      vi.spyOn(dataService, "getRagequits").mockImplementation(async (pool) => {
        if (pool.chainId === pool1.chainId) return [ragequitEvent1];
        return [];
      });

      const result = await accountService.getEvents([pool1, pool2]);

      expect(result.size).toBe(2);

      const pool1Result = result.get(pool1.scope);
      expect(pool1Result).toBeDefined();
      expect("depositEvents" in pool1Result!).toBe(true);
      expect("withdrawalEvents" in pool1Result!).toBe(true);
      expect("ragequitEvents" in pool1Result!).toBe(true);

      if ("depositEvents" in pool1Result!) {
        expect(pool1Result.depositEvents.size).toBe(1);
        expect(
          pool1Result.depositEvents.get(depositEvent1.precommitment)
        ).toEqual(depositEvent1);

        expect(pool1Result.withdrawalEvents.size).toBe(1);
        expect(
          pool1Result.withdrawalEvents.get(withdrawalEvent1.spentNullifier)
        ).toEqual(withdrawalEvent1);

        expect(pool1Result.ragequitEvents.size).toBe(1);
        expect(pool1Result.ragequitEvents.get(ragequitEvent1.label)).toEqual(
          ragequitEvent1
        );
      }

      const pool2Result = result.get(pool2.scope);
      expect(pool2Result).toBeDefined();
      expect("depositEvents" in pool2Result!).toBe(true);

      if ("depositEvents" in pool2Result!) {
        expect(pool2Result.depositEvents.size).toBe(0);
        expect(pool2Result.withdrawalEvents.size).toBe(0);
        expect(pool2Result.ragequitEvents.size).toBe(0);
      }

      expect(dataService.getDeposits).toHaveBeenCalledTimes(2);
      expect(dataService.getWithdrawals).toHaveBeenCalledTimes(2);
      expect(dataService.getRagequits).toHaveBeenCalledTimes(2);
    });

    it("handles errors for individual pools and continues processing", async () => {
      const pool1 = TEST_POOL;
      const pool2: PoolInfo = {
        chainId: 2,
        address: "0x9876543210987654321098765432109876543210" as Address,
        scope: BigInt("987654321") as Hash,
        deploymentBlock: 2000n,
      };

      vi.spyOn(dataService, "getDeposits").mockImplementation(async (pool) => {
        if (pool.chainId === pool1.chainId)
          throw new Error("Failed to fetch deposits");
        return [];
      });

      vi.spyOn(dataService, "getWithdrawals").mockResolvedValue([]);
      vi.spyOn(dataService, "getRagequits").mockResolvedValue([]);

      const result = await accountService.getEvents([pool1, pool2]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);

      const pool1Result = result.get(pool1.scope);
      expect(pool1Result).toBeDefined();
      expect("reason" in pool1Result!).toBe(true);

      if ("reason" in pool1Result!) {
        expect(pool1Result.reason).toContain("Failed to fetch deposits");
        expect(pool1Result.scope).toBe(pool1.scope);
      }

      const pool2Result = result.get(pool2.scope);
      expect(pool2Result).toBeDefined();
      expect("depositEvents" in pool2Result!).toBe(true);

      expect(dataService.getDeposits).toHaveBeenCalledTimes(2);
    });
  });

  describe("initializeWithEvents", () => {
    it("initializes a new account and processes pool events successfully", async () => {
      const pool1 = TEST_POOL;
      const pool2: PoolInfo = {
        chainId: 2,
        address: "0x9876543210987654321098765432109876543210" as Address,
        scope: BigInt("987654321") as Hash,
        deploymentBlock: 2000n,
      };

      // Create a temp service to generate the correct secrets
      const tempService = new AccountService(dataService, {
        mnemonic: TEST_MNEMONIC,
      });
      const { precommitment, nullifier, secret } =
        tempService.createDepositSecrets(pool1.scope);

      const depositEvent1 = {
        depositor: "0x123",
        commitment: BigInt("1111111") as Hash, // Value doesn't matter, will be recalculated
        label: BigInt("2222222") as Hash,
        value: 100n,
        precommitment, // Use actual precommitment that matches the secret generation
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };

      // Calculate the expected spent nullifier hash for the withdrawal event
      const spentNullifierHash = poseidon([nullifier]) as Hash;

      const withdrawalEvent1 = {
        withdrawn: 10n,
        spentNullifier: spentNullifierHash, // Use the HASHED nullifier
        newCommitment: BigInt("5555555") as Hash,
        blockNumber: 1100n,
        transactionHash: mockTxHash(2),
      };

      vi.spyOn(dataService, "getDeposits").mockImplementation(async (pool) => {
        if (pool.scope === pool1.scope) return [depositEvent1];
        if (pool.scope === pool2.scope) return [];
        return [];
      });
      vi.spyOn(dataService, "getWithdrawals").mockImplementation(
        async (pool) => {
          if (pool.scope === pool1.scope) return [withdrawalEvent1];
          if (pool.scope === pool2.scope) return [];
          return [];
        }
      );
      vi.spyOn(dataService, "getRagequits").mockResolvedValue([]);

      const { account, errors } = await AccountService.initializeWithEvents(
        dataService,
        { mnemonic: TEST_MNEMONIC },
        [pool1, pool2]
      );

      expect(account).toBeInstanceOf(AccountService);
      expect(errors).toEqual([]);

      expect(account.account.poolAccounts.has(pool1.scope)).toBe(true);
      expect(account.account.poolAccounts.has(pool2.scope)).toBe(false); // No events for pool2
      expect(account.account.poolAccounts.get(pool1.scope)?.length).toBe(1);

      const pool1Account = account.account.poolAccounts.get(pool1.scope)?.at(0);
      expect(pool1Account).toBeDefined();
      expect(pool1Account?.deposit.nullifier).toBe(nullifier);
      expect(pool1Account?.deposit.secret).toBe(secret); // Also check secret for completeness
      expect(pool1Account?.deposit.label).toBe(depositEvent1.label);
      expect(pool1Account?.deposit.value).toBe(depositEvent1.value);

      expect(pool1Account?.children.length).toBe(1);
      const childCommitment = pool1Account?.children.at(0);
      expect(childCommitment).toBeDefined();
      expect(childCommitment?.value).toBe(
        depositEvent1.value - withdrawalEvent1.withdrawn
      ); // Check remaining value
      expect(childCommitment?.blockNumber).toBe(withdrawalEvent1.blockNumber);
      expect(childCommitment?.txHash).toBe(withdrawalEvent1.transactionHash);
    });

    it("handles errors from individual pools and continues processing", async () => {
      const pool1 = TEST_POOL;
      const pool2: PoolInfo = {
        chainId: 2,
        address: "0x9876543210987654321098765432109876543210" as Address,
        scope: BigInt("987654321") as Hash,
        deploymentBlock: 2000n,
      };

      const tempService = new AccountService(dataService, {
        mnemonic: TEST_MNEMONIC,
      });
      const { precommitment, nullifier, secret } =
        tempService.createDepositSecrets(pool2.scope);

      const depositEvent2 = {
        depositor: "0x123",
        commitment: BigInt("1111111") as Hash,
        label: BigInt("2222222") as Hash,
        value: 100n,
        precommitment,
        blockNumber: 1000n,
        transactionHash: mockTxHash(1),
      };

      vi.spyOn(dataService, "getDeposits").mockImplementation(async (pool) => {
        if (pool.scope === pool1.scope) {
          throw new Error("Simulated deposit fetch failure");
        }
        if (pool.scope === pool2.scope) {
          return [depositEvent2];
        }
        return [];
      });
      vi.spyOn(dataService, "getWithdrawals").mockResolvedValue([]);
      vi.spyOn(dataService, "getRagequits").mockResolvedValue([]);

      const { account, errors } = await AccountService.initializeWithEvents(
        dataService,
        { mnemonic: TEST_MNEMONIC },
        [pool1, pool2]
      );

      expect(account).toBeInstanceOf(AccountService);

      // Verify errors are collected for pool1
      expect(errors.length).toBe(1);
      expect(errors[0]?.scope).toBe(pool1.scope);
      expect(errors[0]?.reason).toContain("Simulated deposit fetch failure");

      // Verify pool accounts map has only pool2 data
      expect(account.account.poolAccounts.has(pool2.scope)).toBe(true);
      expect(account.account.poolAccounts.has(pool1.scope)).toBe(false); // pool1 errored

      // Verify pool2 account was processed correctly
      const pool2Account = account.account.poolAccounts.get(pool2.scope)?.at(0);
      expect(pool2Account).toBeDefined();
      expect(pool2Account?.deposit.nullifier).toBe(nullifier);
      expect(pool2Account?.deposit.secret).toBe(secret);
      expect(pool2Account?.deposit.label).toBe(depositEvent2.label);
      expect(pool2Account?.deposit.value).toBe(depositEvent2.value);
      expect(pool2Account?.children.length).toBe(0); // No withdrawals for pool2
    });

    it("throws an error when duplicate pool scopes are provided", async () => {
      const pool1 = TEST_POOL;
      const pool2 = { ...TEST_POOL, chainId: 2 };

      await expect(
        AccountService.initializeWithEvents(
          dataService,
          { mnemonic: TEST_MNEMONIC },
          [pool1, pool2]
        )
      ).rejects.toThrow();
    });

    it("initializes from an existing service instance", async () => {
      const sourceService = new AccountService(dataService, {
        mnemonic: TEST_MNEMONIC,
      });

      const existingScope = BigInt("555555") as Hash;
      const deposit = {
        hash: BigInt("666666") as Hash,
        value: 100n,
        label: BigInt("777777") as Hash,
        nullifier: BigInt("888888") as Secret,
        secret: BigInt("999999") as Secret,
        blockNumber: 500n,
        txHash: mockTxHash(10),
      };

      sourceService.account.poolAccounts.set(existingScope, [
        {
          label: deposit.label,
          deposit,
          children: [],
        },
      ]);

      const newPool: PoolInfo = {
        chainId: 3,
        address: "0x1234567890123456789012345678901234567890" as Address,
        scope: BigInt("111111") as Hash,
        deploymentBlock: 3000n,
      };

      vi.spyOn(dataService, "getDeposits").mockImplementation(async (pool) => {
        if (pool.scope === newPool.scope) return [];
        return []; // Default empty
      });
      vi.spyOn(dataService, "getWithdrawals").mockImplementation(
        async (pool) => {
          if (pool.scope === newPool.scope) return [];
          return []; // Default empty
        }
      );
      vi.spyOn(dataService, "getRagequits").mockImplementation(async (pool) => {
        if (pool.scope === newPool.scope) return [];
        return []; // Default empty
      });

      // Call the static method with source service and the new pool
      const { account, errors } = await AccountService.initializeWithEvents(
        dataService,
        { service: sourceService }, // Initialize from existing service
        [newPool] // Provide the new pool to fetch events for
      );

      // Verify the new account contains the existing accounts from sourceService
      expect(account).toBeInstanceOf(AccountService);
      expect(errors).toEqual([]); // No errors expected as newPool had no events
      expect(account.account.poolAccounts.has(existingScope)).toBe(true);
      expect(
        account.account.poolAccounts.get(existingScope)?.[0]?.deposit.hash
      ).toBe(deposit.hash);

      // Verify no new accounts were added for newPool (since no events were returned)
      expect(account.account.poolAccounts.has(newPool.scope)).toBe(false);
    });
  });
});
