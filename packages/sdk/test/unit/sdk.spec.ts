import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitsMock, binariesMock } from "../mocks/index.js";
import { PrivacyPoolSDK } from "../../src/core/sdk.js";
import * as snarkjs from "snarkjs";
import { Commitment, Hash, Secret } from "../../src/types/commitment.js";
import { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import { ProofError } from "../../src/errors/base.error.js";
import { AccountCommitment, PoolInfo } from "../../src/types/account.js";
import { AccountService } from "../../src/core/account.service.js";
import { DataService } from "../../src/core/data.service.js";
import { DepositEvent } from "../../src/types/events.js";
import { Address, Hex } from "viem";
import { english, generateMnemonic } from "viem/accounts";

vi.mock("snarkjs");
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    keccak256: vi.fn().mockReturnValue("0x1234"),
    getAddress: vi.fn().mockImplementation((addr) => addr),
    encodeAbiParameters: vi.fn().mockImplementation((types, values) => ({
      types,
      values,
    })),
  };
});

describe("PrivacyPoolSDK", () => {
  let circuits: CircuitsMock;
  let sdk: PrivacyPoolSDK;

  beforeEach(() => {
    circuits = new CircuitsMock({ browser: false });
    sdk = new PrivacyPoolSDK(circuits);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("commitment operations", () => {
    it("should use Circuits binaries and delegate to snarkjs prover", async () => {
      snarkjs.groth16.fullProve = vi.fn().mockResolvedValue({
        proof: "PROOF",
        publicSignals: "SIGNALS",
      });

      const inputSignals = {
        value: BigInt(1),
        label: BigInt(2),
        nullifier: BigInt(3),
        secret: BigInt(4),
      };

      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);

      const result = await sdk.proveCommitment(
        BigInt(1),
        BigInt(2),
        BigInt(3) as Secret,
        BigInt(4) as Secret
      );
      expect(result).toStrictEqual({
        proof: "PROOF",
        publicSignals: "SIGNALS",
      });
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
      expect(snarkjs.groth16.fullProve).toHaveBeenCalledWith(
        inputSignals,
        binariesMock.commitment.wasm,
        binariesMock.commitment.zkey
      );
    });

    it("should throw an error if commitment proof verification fails", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi
        .fn()
        .mockRejectedValue(new Error("Verification error"));

      await expect(
        sdk.verifyCommitment({
          proof: {} as snarkjs.Groth16Proof,
          publicSignals: [],
        })
      ).rejects.toThrowError(ProofError);
    });

    it("should return true for a valid commitment proof", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi.fn().mockResolvedValue(true);

      const result = await sdk.verifyCommitment({
        proof: {} as snarkjs.Groth16Proof,
        publicSignals: [],
      });
      expect(result).toBe(true);
    });
  });

  describe("withdrawal operations", () => {
    const mockCommitment: Commitment = {
      hash: BigInt(1) as Hash,
      nullifierHash: BigInt(2) as Hash,
      preimage: {
        value: BigInt(1000),
        label: BigInt(3),
        precommitment: {
          hash: BigInt(0) as Hash,
          nullifier: BigInt(2) as Secret,
          secret: BigInt(4) as Secret,
        },
      },
    };

    it("should use circuits binaries and delegate to snarkjs prover", async () => {
      snarkjs.groth16.fullProve = vi.fn().mockResolvedValue({
        proof: "mockProof",
        publicSignals: "mockPublicSignals",
      });

      const stateMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(5),
        leaf: mockCommitment.hash,
        index: 1,
        siblings: [BigInt(6), BigInt(7)],
      };

      const aspMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(8),
        leaf: BigInt(3),
        index: 2,
        siblings: [BigInt(9), BigInt(10)],
      };

      const withdrawalInput = {
        withdrawalAmount: BigInt(500),
        stateMerkleProof,
        aspMerkleProof,
        stateRoot: BigInt(5) as Hash,
        aspRoot: BigInt(8) as Hash,
        newNullifier: BigInt(12) as Secret,
        newSecret: BigInt(13) as Secret,
        context: BigInt(1),
        stateTreeDepth: BigInt(32),
        aspTreeDepth: BigInt(32),
      };

      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);

      const result = await sdk.proveWithdrawal(mockCommitment, withdrawalInput);

      expect(result).toHaveProperty("proof", "mockProof");
      expect(result).toHaveProperty("publicSignals", "mockPublicSignals");
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
    });

    it("can prove withdrawal with account commitment", async () => {
      const mockAccountCommitment: AccountCommitment = {
        hash: BigInt(1) as Hash,
        value: BigInt(1000),
        label: BigInt(3) as Hash,
        nullifier: BigInt(2) as Secret,
        secret: BigInt(4) as Secret,
        blockNumber: BigInt(5),
        txHash: "0x1234",
      };

      snarkjs.groth16.fullProve = vi.fn().mockResolvedValue({
        proof: "mockProof",
        publicSignals: "mockPublicSignals",
      });

      const stateMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(5),
        leaf: mockCommitment.hash,
        index: 1,
        siblings: [BigInt(6), BigInt(7)],
      };

      const aspMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(8),
        leaf: BigInt(3),
        index: 2,
        siblings: [BigInt(9), BigInt(10)],
      };

      const withdrawalInput = {
        withdrawalAmount: BigInt(500),
        stateMerkleProof,
        aspMerkleProof,
        stateRoot: BigInt(5) as Hash,
        aspRoot: BigInt(8) as Hash,
        newNullifier: BigInt(12) as Secret,
        newSecret: BigInt(13) as Secret,
        context: BigInt(1),
        stateTreeDepth: BigInt(32),
        aspTreeDepth: BigInt(32),
      };

      const downloadArtifactsSpy = vi
        .spyOn(circuits, "downloadArtifacts")
        .mockResolvedValue(binariesMock);

      const result = await sdk.proveWithdrawal(
        mockAccountCommitment,
        withdrawalInput
      );

      expect(result).toHaveProperty("proof", "mockProof");
      expect(result).toHaveProperty("publicSignals", "mockPublicSignals");
      expect(downloadArtifactsSpy).toHaveBeenCalledOnce();
    });

    it("should throw error on proof generation failure", async () => {
      snarkjs.groth16.fullProve = vi
        .fn()
        .mockRejectedValue(new Error("Proof error"));

      const mockStateMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(5),
        leaf: mockCommitment.hash,
        index: 1,
        siblings: [BigInt(6), BigInt(7)],
      };

      const mockAspMerkleProof: LeanIMTMerkleProof<bigint> = {
        root: BigInt(8),
        leaf: BigInt(3),
        index: 2,
        siblings: [BigInt(9), BigInt(10)],
      };

      const withdrawalInput = {
        withdrawalAmount: BigInt(500),
        stateMerkleProof: mockStateMerkleProof,
        aspMerkleProof: mockAspMerkleProof,
        stateRoot: BigInt(7) as Hash,
        aspRoot: BigInt(10) as Hash,
        newNullifier: BigInt(14) as Secret,
        newSecret: BigInt(15) as Secret,
        context: BigInt(1),
        stateTreeDepth: BigInt(32),
        aspTreeDepth: BigInt(32),
      };

      await expect(
        sdk.proveWithdrawal(mockCommitment, withdrawalInput)
      ).rejects.toThrow(ProofError);
    });

    it("should throw an error when verification fails", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi
        .fn()
        .mockRejectedValue(new Error("Verification error"));

      await expect(
        sdk.verifyWithdrawal({
          proof: {} as snarkjs.Groth16Proof,
          publicSignals: [],
        })
      ).rejects.toThrow(ProofError);
    });

    it("should return true for valid withdrawal proof", async () => {
      circuits.getVerificationKey = vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode("{}"));
      snarkjs.groth16.verify = vi.fn().mockResolvedValue(true);

      const isValid = await sdk.verifyWithdrawal({
        proof: {} as snarkjs.Groth16Proof,
        publicSignals: [],
      });
      expect(isValid).toBe(true);
    });
  });
});

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
    const paddedIndex = index.toString(16).padStart(64, "0");
    return `0x${paddedIndex}` as Hex;
  }

  // Helper function to create deposit events with all required fields
  function createDepositEvent(
    value: bigint,
    label: Hash,
    precommitment: Hash,
    blockNumber: bigint,
    txHash: Hex
  ): DepositEvent {
    return {
      depositor: "0x1234567890123456789012345678901234567890" as Address,
      value,
      label,
      commitment: BigInt(123) as Hash,
      precommitment,
      blockNumber,
      transactionHash: txHash,
    };
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("_processDepositEvents", () => {
    it("should process consecutive deposits starting from index 0", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      // Create 3 consecutive deposits at indices 0, 1, 2
      for (let i = 0; i < 3; i++) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // Verify all 3 accounts were created
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(3);

      // Verify account details
      for (let i = 0; i < 3; i++) {
        const account = accounts?.[i];
        expect(account?.deposit.value).toBe(BigInt(1000 + i));
        expect(account?.deposit.label).toBe(BigInt(100 + i));
        expect(account?.deposit.blockNumber).toBe(BigInt(2000 + i));
        expect(account?.deposit.txHash).toBe(mockTxHash(i));
      }
    });

    it("should handle gaps in deposit indices with consecutive misses limit", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      // Create deposits at indices 0, 1, 5, 6 (gap at 2, 3, 4)
      const indices = [0, 1, 5, 6];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(4); // All 4 deposits should be found

      // Verify the correct deposits were processed
      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1001), BigInt(1005), BigInt(1006)]);
    });

    it("should stop after 10 consecutive misses", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      // Create deposits at indices 0, 1, then a large gap, then 15
      const indices = [0, 1, 15];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // Should only find deposits at indices 0, 1 and stop due to consecutive misses
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(2); // Only first 2 deposits found

      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1001)]);
    });

    it("should reset consecutive misses counter when a deposit is found", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      const indices = [0, 5, 10, 20];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // All deposits should be found because gaps are within the consecutive misses limit
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(4);

      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1005), BigInt(1010), BigInt(1020)]);
    });

    it("should handle empty deposit events", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // No accounts should be created
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeUndefined();
    });

    it("should handle deposits with large gaps that exceed consecutive misses limit", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      const indices = [0, 1, 2, 20];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(3);

      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1001), BigInt(1002)]);
    });

    it("should track found indices correctly", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      // Create non-consecutive deposits
      const indices = [0, 2, 4, 6];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // All should be found since gaps are small
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(4);

      // Verify deposits are in the correct order (by index)
      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1002), BigInt(1004), BigInt(1006)]);
    });

    it("should handle transaction failure scenarios with gaps", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      const indices = [0, 1, 4, 5];
      for (const i of indices) {
        const { precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      // All deposits should be found (gap of 2 is within limit)
      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(4);

      const values = accounts?.map(acc => acc.deposit.value) ?? [];
      expect(values).toEqual([BigInt(1000), BigInt(1001), BigInt(1004), BigInt(1005)]);
    });

    it("should generate correct nullifier and secret for each deposit", () => {
      const scope = TEST_POOL.scope;
      const depositEvents = new Map<Hash, DepositEvent>();

      // Create 2 deposits
      const indices = [0, 1];
      const expectedSecrets: { nullifier: Secret; secret: Secret }[] = [];

      for (const i of indices) {
        const { nullifier, secret, precommitment } = accountService.createDepositSecrets(scope, BigInt(i));
        expectedSecrets.push({ nullifier, secret });

        const event = createDepositEvent(
          BigInt(1000 + i),
          BigInt(100 + i) as Hash,
          precommitment,
          BigInt(2000 + i),
          mockTxHash(i)
        );
        depositEvents.set(precommitment, event);
      }

      (accountService as unknown as { _processDepositEvents: (scope: Hash, events: Map<Hash, DepositEvent>) => void })._processDepositEvents(scope, depositEvents);

      const accounts = accountService.account.poolAccounts.get(scope);
      expect(accounts).toBeDefined();
      expect(accounts?.length).toBe(2);

      // Verify each account has the correct nullifier and secret
      for (let i = 0; i < 2; i++) {
        const account = accounts?.[i];
        expect(account?.deposit.nullifier).toBe(expectedSecrets[i]?.nullifier);
        expect(account?.deposit.secret).toBe(expectedSecrets[i]?.secret);
      }
    });
  });
});
