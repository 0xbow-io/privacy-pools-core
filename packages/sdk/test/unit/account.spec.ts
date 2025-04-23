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

    accountService = new AccountService(dataService, { mnemonic: TEST_MNEMONIC });
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
      expect(() => new AccountService(dataService, { mnemonic: "invalid mnemonic" })).toThrow(
        AccountError
      );
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
      expect(() => accountService.createDepositSecrets(TEST_POOL.scope, -1n)).toThrow(AccountError);
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
      const account = accountService.account.poolAccounts.get(
        TEST_POOL.scope
      )!.at(0)!;
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
      const account = accountService.account.poolAccounts.get(
        TEST_POOL.scope
      )!.at(0)!;
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
      const accountInMap = accountService.account.poolAccounts.get(
        TEST_POOL.scope
      )!.at(0)!;
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
});
