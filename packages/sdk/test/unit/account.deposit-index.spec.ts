import { describe, it, expect, vi } from "vitest";
import { AccountService } from "../../src/core/account.service.js";
import { DataService } from "../../src/core/data.service.js";
import { Hash, Secret } from "../../src/types/commitment.js";
import { DepositEvent, WithdrawalEvent } from "../../src/types/events.js";
import { PoolInfo } from "../../src/types/account.js";
import { AccountError } from "../../src/errors/account.error.js";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Address, Hex, bytesToNumber, bytesToBigInt } from "viem";
import { english, generateMnemonic, mnemonicToAccount } from "viem/accounts";

/**
 * Regression tests for deposit-index reconstruction across key migration.
 *
 * Deposit indices and migration-derived accounts are independent namespaces.
 * Earlier versions started the safe deposit scan at the migration count and
 * derived the next deposit index from `poolAccounts.length`, which conflated
 * the two and permanently hid deposits whose index fell below the migration
 * count. These tests pin the corrected behaviour.
 */
describe("AccountService — deposit index vs. migration accounts", () => {
  const MNEMONIC = generateMnemonic(english);
  const SCOPE = BigInt("123456789") as Hash;
  const POOL: PoolInfo = {
    chainId: 1,
    address: "0x8Fac8db5cae9C29e9c80c40e8CeDC47EEfe3874E" as Address,
    scope: SCOPE,
    deploymentBlock: 1000n,
  };
  const tx = (i: number) => `0x${i.toString(16).padStart(64, "0")}` as Hex;

  // Legacy keys use bytesToNumber (the pre-correction derivation); safe keys
  // use bytesToBigInt. Migration rotates a note from the former to the latter.
  const legacyMaster = (i: number) =>
    poseidon([
      BigInt(bytesToNumber(mnemonicToAccount(MNEMONIC, { accountIndex: i }).getHdKey().privateKey!)),
    ]) as Secret;
  const safeMaster = (i: number) =>
    poseidon([
      bytesToBigInt(mnemonicToAccount(MNEMONIC, { accountIndex: i }).getHdKey().privateKey!),
    ]) as Secret;

  const [legacyMN, legacyMS] = [legacyMaster(0), legacyMaster(1)];
  const [safeMN, safeMS] = [safeMaster(0), safeMaster(1)];

  /** A legacy deposit plus the 0-value withdrawal that migrates it to safe keys. */
  const legacyNote = (depositIndex: bigint, label: Hash, value: bigint, block: bigint, t: number) => {
    const dn = poseidon([legacyMN, SCOPE, depositIndex]) as Secret;
    const ds = poseidon([legacyMS, SCOPE, depositIndex]) as Secret;
    const pre = poseidon([dn, ds]) as Hash;
    const deposit: DepositEvent = {
      depositor: "0xaaa",
      commitment: poseidon([value, label, pre]) as Hash,
      label, value, precommitment: pre, blockNumber: block, transactionHash: tx(t),
    };
    const safeWPre = poseidon([
      poseidon([safeMN, label, 0n]),
      poseidon([safeMS, label, 0n]),
    ]) as Hash;
    const migration: WithdrawalEvent = {
      withdrawn: 0n,
      spentNullifier: poseidon([dn]) as Hash,
      newCommitment: poseidon([value, label, safeWPre]) as Hash,
      blockNumber: block + 50n, transactionHash: tx(t + 100),
    };
    return { deposit, migration, label, value };
  };

  /** A corrected-key (safe) deposit at an explicit deposit index. */
  const safeDeposit = (depositIndex: bigint, label: Hash, value: bigint, block: bigint, t: number): DepositEvent => {
    const pre = poseidon([
      poseidon([safeMN, SCOPE, depositIndex]),
      poseidon([safeMS, SCOPE, depositIndex]),
    ]) as Hash;
    return {
      depositor: "0xbbb",
      commitment: poseidon([value, label, pre]) as Hash,
      label, value, precommitment: pre, blockNumber: block, transactionHash: tx(t),
    };
  };

  const mockDataService = (deposits: DepositEvent[], withdrawals: WithdrawalEvent[], fail = false) =>
    ({
      getDeposits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return deposits; }),
      getWithdrawals: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return withdrawals; }),
      getRagequits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
    } as unknown as DataService);

  const visibleValue = (svc: AccountService) =>
    (svc.getSpendableCommitments().get(SCOPE) ?? []).reduce((sum, c) => sum + c.value, 0n);

  const NOTE_A = legacyNote(0n, BigInt("111000111") as Hash, 100n, 1100n, 1);
  const NOTE_B = legacyNote(1n, BigInt("222000222") as Hash, 200n, 1150n, 2);
  const SAFE_LABEL_0 = BigInt("999000999") as Hash;
  const SAFE_LABEL_1 = BigInt("888000888") as Hash;

  describe("incomplete scope history", () => {
    it("records the scope as incomplete instead of leaving it indistinguishable from empty", async () => {
      const { account, errors } = await AccountService.initializeWithEvents(
        mockDataService([], [], true), { mnemonic: MNEMONIC }, [POOL]
      );

      expect(errors).toHaveLength(1);
      expect(account.isScopeComplete(SCOPE)).toBe(false);
      expect(account.getIncompleteScopes()).toEqual([SCOPE]);
    });

    it("refuses to infer a deposit index for an incomplete scope", async () => {
      const { account } = await AccountService.initializeWithEvents(
        mockDataService([], [], true), { mnemonic: MNEMONIC }, [POOL]
      );

      // Previously returned index 0, colliding with the slot that migration
      // discovery later claims.
      expect(() => account.createDepositSecrets(SCOPE)).toThrow(AccountError);
    });

    it("still allows an explicit index for recovery flows", async () => {
      const { account } = await AccountService.initializeWithEvents(
        mockDataService([], [], true), { mnemonic: MNEMONIC }, [POOL]
      );

      expect(() => account.createDepositSecrets(SCOPE, 0n)).not.toThrow();
    });

    it("marks the scope complete once its history loads", async () => {
      const { account } = await AccountService.initializeWithEvents(
        mockDataService([NOTE_A.deposit], [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );

      expect(account.isScopeComplete(SCOPE)).toBe(true);
      expect(account.getIncompleteScopes()).toEqual([]);
    });
  });

  describe("deposit scanning is independent of migration count", () => {
    it("reconstructs an index-0 deposit alongside a migration-derived account", async () => {
      const deposit0 = safeDeposit(0n, SAFE_LABEL_0, 500n, 1500n, 9);

      const { account } = await AccountService.initializeWithEvents(
        mockDataService([NOTE_A.deposit, deposit0], [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts.some((a) => a.label === SAFE_LABEL_0)).toBe(true);
      expect(visibleValue(account)).toBe(600n);
    });

    it("keeps a deposit made between two staged migrations", async () => {
      const deposit1 = safeDeposit(1n, SAFE_LABEL_1, 500n, 1400n, 10);
      const deposits = [NOTE_A.deposit, NOTE_B.deposit, deposit1];

      // After A migrates, poolAccounts.length is 1, so the deposit took index 1.
      const afterA = await AccountService.initializeWithEvents(
        mockDataService(deposits, [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );
      expect(visibleValue(afterA.account)).toBe(600n);

      // B migrating must not push the deposit scan past index 1.
      const afterB = await AccountService.initializeWithEvents(
        mockDataService(deposits, [NOTE_A.migration, NOTE_B.migration]), { mnemonic: MNEMONIC }, [POOL]
      );
      const accounts = afterB.account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts.some((a) => a.label === SAFE_LABEL_1)).toBe(true);
      expect(visibleValue(afterB.account)).toBe(800n);
    });

    it("does not starve the deposit scan when many notes migrate", async () => {
      const notes = Array.from({ length: 12 }, (_, i) =>
        legacyNote(BigInt(i), BigInt(700000 + i) as Hash, 10n, 1100n + BigInt(i), 200 + i)
      );
      const deposit0 = safeDeposit(0n, SAFE_LABEL_0, 500n, 2000n, 50);

      const { account } = await AccountService.initializeWithEvents(
        mockDataService([...notes.map((n) => n.deposit), deposit0], notes.map((n) => n.migration)),
        { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts.some((a) => a.label === SAFE_LABEL_0)).toBe(true);
      expect(visibleValue(account)).toBe(BigInt(12 * 10 + 500));
    });
  });

  describe("next deposit index", () => {
    it("derives from recorded deposit indices, not array position", async () => {
      const deposit0 = safeDeposit(0n, SAFE_LABEL_0, 500n, 1500n, 9);

      const { account } = await AccountService.initializeWithEvents(
        mockDataService([NOTE_A.deposit, deposit0], [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts).toHaveLength(2);
      expect(accounts.filter((a) => a.isMigrationDerived)).toHaveLength(1);
      expect(accounts.filter((a) => !a.isMigrationDerived).map((a) => a.depositIndex)).toEqual([0n]);

      // Array length is 2, but only index 0 is a used deposit index.
      expect(account.createDepositSecrets(SCOPE).precommitment).toBe(
        account.createDepositSecrets(SCOPE, 1n).precommitment
      );
    });

    it("tags migration-derived accounts and leaves them without a deposit index", async () => {
      const { account } = await AccountService.initializeWithEvents(
        mockDataService([NOTE_A.deposit], [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts).toHaveLength(1);
      expect(accounts[0]!.isMigrationDerived).toBe(true);
      expect(accounts[0]!.depositIndex).toBeUndefined();

      // A migration must not consume deposit index 0.
      expect(account.createDepositSecrets(SCOPE).precommitment).toBe(
        account.createDepositSecrets(SCOPE, 0n).precommitment
      );
    });
  });

  describe("migration-aware retry", () => {
    it("discovers migrations on retry when legacyService is supplied", async () => {
      let fail = true;
      const deposit0 = safeDeposit(0n, SAFE_LABEL_0, 500n, 1500n, 9);
      const dataService = {
        getDeposits: vi.fn(async () => {
          if (fail) throw new Error("RPC 503");
          return [NOTE_A.deposit, deposit0];
        }),
        getWithdrawals: vi.fn(async () => {
          if (fail) throw new Error("RPC 503");
          return [NOTE_A.migration];
        }),
        getRagequits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
      } as unknown as DataService;

      const first = await AccountService.initializeWithEvents(dataService, { mnemonic: MNEMONIC }, [POOL]);
      expect(first.errors).toHaveLength(1);
      expect(first.account.isScopeComplete(SCOPE)).toBe(false);

      fail = false;
      const retry = await AccountService.initializeWithEvents(
        dataService,
        { service: first.account, legacyService: first.legacyAccount },
        [POOL]
      );

      expect(retry.errors).toEqual([]);
      expect(retry.account.isScopeComplete(SCOPE)).toBe(true);

      // Both the migrated note and the deposit are present — the retry no
      // longer disagrees with a fresh mnemonic reconstruction.
      const accounts = retry.account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts.some((a) => a.isMigrationDerived)).toBe(true);
      expect(accounts.some((a) => a.label === SAFE_LABEL_0)).toBe(true);
      expect(visibleValue(retry.account)).toBe(600n);

      // ...and agrees with the mnemonic path on the same events.
      const fresh = await AccountService.initializeWithEvents(dataService, { mnemonic: MNEMONIC }, [POOL]);
      expect(visibleValue(retry.account)).toBe(visibleValue(fresh.account));
    });
  });

  describe("repeated deposit index", () => {
    it("reconstructs every deposit sharing a precommitment", async () => {
      // Two deposits written at index 0 by an older client: same precommitment,
      // different labels and values. Both are spendable on-chain.
      const pre0 = poseidon([
        poseidon([safeMN, SCOPE, 0n]),
        poseidon([safeMS, SCOPE, 0n]),
      ]) as Hash;
      const mk = (label: bigint, value: bigint, block: bigint, t: number): DepositEvent => ({
        depositor: "0xbbb",
        commitment: poseidon([value, label as Hash, pre0]) as Hash,
        label: label as Hash, value, precommitment: pre0,
        blockNumber: block, transactionHash: tx(t),
      });
      const older = mk(111n, 100n, 1200n, 1);
      const newer = mk(222n, 700n, 1800n, 2);

      const { account } = await AccountService.initializeWithEvents(
        mockDataService([older, newer], []), { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts).toHaveLength(2);
      expect(accounts.map((a) => a.label).sort()).toEqual([111n, 222n]);
      // Previously only the earliest block survived, hiding 700 permanently.
      expect(visibleValue(account)).toBe(800n);
    });

    it("groups deposit events by precommitment, oldest first", async () => {
      const pre0 = poseidon([
        poseidon([safeMN, SCOPE, 0n]),
        poseidon([safeMS, SCOPE, 0n]),
      ]) as Hash;
      const mk = (label: bigint, block: bigint, t: number): DepositEvent => ({
        depositor: "0xbbb", commitment: poseidon([1n, label as Hash, pre0]) as Hash,
        label: label as Hash, value: 1n, precommitment: pre0,
        blockNumber: block, transactionHash: tx(t),
      });
      const service = new AccountService(
        mockDataService([mk(222n, 1800n, 2), mk(111n, 1200n, 1)], []),
        { mnemonic: MNEMONIC }
      );

      const grouped = await service.getDepositEvents(POOL);
      expect(grouped.get(pre0)?.map((e) => e.blockNumber)).toEqual([1200n, 1800n]);
    });
  });
});
