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
    // Two deposits at the same index share a precommitment AND a nullifier
    // hash, so the pool only ever allows one of them to be withdrawn
    // (State.sol reverts NullifierAlreadySpent for the second). Reconstruction
    // must therefore surface exactly one spendable account, not both.
    const pre0 = poseidon([
      poseidon([safeMN, SCOPE, 0n]),
      poseidon([safeMS, SCOPE, 0n]),
    ]) as Hash;
    const collide = (label: bigint, value: bigint, block: bigint, t: number, logIndex?: number): DepositEvent => ({
      depositor: "0xbbb",
      commitment: poseidon([value, label as Hash, pre0]) as Hash,
      label: label as Hash, value, precommitment: pre0,
      blockNumber: block, transactionHash: tx(t), logIndex,
    });

    it("keeps only the earliest deposit and never reports a negative balance", async () => {
      const older = collide(111n, 700n, 1200n, 1);
      const newer = collide(222n, 100n, 1800n, 2);

      // One withdrawal spending all 700. Its spentNullifier is derived from the
      // shared deposit nullifier, so it matches both deposits' accounts if both
      // were reconstructed — which previously produced a -600 commitment.
      const wPre = poseidon([
        poseidon([safeMN, 111n as Hash, 0n]),
        poseidon([safeMS, 111n as Hash, 0n]),
      ]) as Hash;
      const withdrawal: WithdrawalEvent = {
        withdrawn: 700n,
        spentNullifier: poseidon([poseidon([safeMN, SCOPE, 0n])]) as Hash,
        newCommitment: poseidon([0n, 111n as Hash, wPre]) as Hash,
        blockNumber: 1900n, transactionHash: tx(3),
      };

      const { account } = await AccountService.initializeWithEvents(
        mockDataService([older, newer], [withdrawal]), { mnemonic: MNEMONIC }, [POOL]
      );

      const accounts = account.account.poolAccounts.get(SCOPE) ?? [];
      expect(accounts).toHaveLength(1);
      expect(accounts[0]!.label).toBe(111n);

      const commitments = account.getSpendableCommitments().get(SCOPE) ?? [];
      expect(commitments.every((c) => c.value >= 0n)).toBe(true);
      expect(accounts[0]!.isMigrated).toBeFalsy();
    });

    it("orders a same-transaction collision by logIndex", async () => {
      const second = collide(222n, 100n, 1200n, 1, 5);
      const first = collide(111n, 700n, 1200n, 1, 2);

      const service = new AccountService(mockDataService([second, first], []), { mnemonic: MNEMONIC });
      const kept = await service.getDepositEvents(POOL);

      // Same block and same transaction hash — only logIndex separates them.
      expect(kept.get(pre0)?.label).toBe(111n);
    });

    it("does not inflate the next deposit index when indices collide", async () => {
      const deposits = Array.from({ length: 12 }, (_, i) => collide(BigInt(500 + i), 10n, 1200n + BigInt(i), i, i));

      const { account } = await AccountService.initializeWithEvents(
        mockDataService(deposits, []), { mnemonic: MNEMONIC }, [POOL]
      );

      // One account survives at index 0, so the next index is 1 — not 12, which
      // would leave a gap wider than the scan's miss tolerance.
      expect(account.createDepositSecrets(SCOPE).precommitment).toBe(
        account.createDepositSecrets(SCOPE, 1n).precommitment
      );
    });
  });

  describe("scope load status", () => {
    const OTHER_SCOPE = BigInt("987654321") as Hash;
    const OTHER_POOL: PoolInfo = {
      chainId: 1,
      address: "0x1111111111111111111111111111111111111111" as Address,
      scope: OTHER_SCOPE,
      deploymentBlock: 1000n,
    };

    it("distinguishes never-loaded from complete", async () => {
      const { account } = await AccountService.initializeWithEvents(
        mockDataService([NOTE_A.deposit], [NOTE_A.migration]), { mnemonic: MNEMONIC }, [POOL]
      );

      expect(account.getScopeStatus(SCOPE)).toBe("complete");
      expect(account.getScopeStatus(OTHER_SCOPE)).toBe("not-loaded");
      expect(account.isScopeComplete(OTHER_SCOPE)).toBe(false);

      // A scope nothing is known about must not yield an inferred index.
      expect(() => account.createDepositSecrets(OTHER_SCOPE)).toThrow(AccountError);
    });

    it("still allows a first deposit on a brand-new account", () => {
      // Nothing loaded at all: index 0 is genuinely correct here, so the guard
      // must not block the very first deposit.
      const fresh = new AccountService(mockDataService([], []), { mnemonic: MNEMONIC });

      expect(() => fresh.createDepositSecrets(SCOPE)).not.toThrow();
      expect(fresh.createDepositSecrets(SCOPE).precommitment).toBe(
        fresh.createDepositSecrets(SCOPE, 0n).precommitment
      );
    });

    it("survives persist and restore", async () => {
      const first = await AccountService.initializeWithEvents(
        mockDataService([], [], true), { mnemonic: MNEMONIC }, [POOL]
      );
      expect(first.account.getScopeStatus(SCOPE)).toBe("incomplete");

      // Status rides on PrivacyPoolAccount, the serializable shape, so a service
      // rebuilt from a restored account keeps the guard.
      const restored = new AccountService(mockDataService([], []), {
        account: first.account.account,
      });

      expect(restored.getScopeStatus(SCOPE)).toBe("incomplete");
      expect(() => restored.createDepositSecrets(SCOPE)).toThrow(AccountError);
    });

    it("stays permissive for account state restored without a status map", () => {
      // An account object written by an earlier version has no scopeStatus at
      // all; blocking there would lock existing users out of depositing.
      const legacy = new AccountService(mockDataService([], []), {
        account: {
          masterKeys: [1n as Secret, 2n as Secret],
          poolAccounts: new Map(),
        },
      });

      expect(() => legacy.createDepositSecrets(SCOPE)).not.toThrow();
    });
  });

  describe("retry correctness", () => {
    const NEW_SCOPE = BigInt("555000555") as Hash;
    const NEW_POOL: PoolInfo = {
      chainId: 1,
      address: "0x2222222222222222222222222222222222222222" as Address,
      scope: NEW_SCOPE,
      deploymentBlock: 1000n,
    };

    it("does not drop a pool added after the first attempt", async () => {
      let fail = true;
      const dataService = {
        getDeposits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
        getWithdrawals: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
        getRagequits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
      } as unknown as DataService;

      const first = await AccountService.initializeWithEvents(dataService, { mnemonic: MNEMONIC }, [POOL]);
      expect(first.account.getScopeStatus(SCOPE)).toBe("incomplete");

      fail = false;
      // NEW_POOL was never attempted; narrowing the retry to only the
      // incomplete scope would skip it silently and still report it complete.
      const retry = await AccountService.initializeWithEvents(
        dataService, { service: first.account, legacyService: first.legacyAccount }, [POOL, NEW_POOL]
      );

      expect(retry.account.getScopeStatus(SCOPE)).toBe("complete");
      expect(retry.account.getScopeStatus(NEW_SCOPE)).toBe("complete");
    });

    it("does not duplicate legacy accounts when retrying a completed scope", async () => {
      // Legacy note present and un-migrated: the legacy account holds an entry
      // for SCOPE while the safe side holds none.
      const dataService = mockDataService([NOTE_A.deposit], []);

      const first = await AccountService.initializeWithEvents(dataService, { mnemonic: MNEMONIC }, [POOL]);
      const legacyCount = () => (first.legacyAccount!.account.poolAccounts.get(SCOPE) ?? []).length;
      expect(legacyCount()).toBe(1);
      expect(first.account.getScopeStatus(SCOPE)).toBe("complete");

      // Retrying a scope already marked complete must be a no-op. Keying off
      // "the safe map has no entry" would re-run the legacy scan every time.
      for (let i = 0; i < 3; i++) {
        await AccountService.initializeWithEvents(
          dataService, { service: first.account, legacyService: first.legacyAccount }, [POOL]
        );
      }

      expect(legacyCount()).toBe(1);
    });

    it("clears incompleteness on the caller's original service handle", async () => {
      let fail = true;
      const deposit0 = safeDeposit(0n, SAFE_LABEL_0, 500n, 1500n, 9);
      const dataService = {
        getDeposits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return [NOTE_A.deposit, deposit0]; }),
        getWithdrawals: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return [NOTE_A.migration]; }),
        getRagequits: vi.fn(async () => { if (fail) throw new Error("RPC 503"); return []; }),
      } as unknown as DataService;

      const first = await AccountService.initializeWithEvents(dataService, { mnemonic: MNEMONIC }, [POOL]);
      fail = false;
      await AccountService.initializeWithEvents(
        dataService, { service: first.account, legacyService: first.legacyAccount }, [POOL]
      );

      // Apps commonly keep their original handle. It shares the underlying
      // account, so it must see the scope as reconstructed rather than staying
      // blocked forever.
      expect(first.account.getScopeStatus(SCOPE)).toBe("complete");
      expect(() => first.account.createDepositSecrets(SCOPE)).not.toThrow();
    });
  });
});
