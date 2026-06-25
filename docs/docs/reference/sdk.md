---
title: SDK Reference
---

### `PrivacyPoolSDK`

Main SDK class providing zero-knowledge proof generation and verification.

```tsx
class PrivacyPoolSDK {
  constructor(circuits: CircuitsInterface);

  createContractInstance(
    rpcUrl: string,
    chain: Chain,
    entrypointAddress: Address,
    privateKey: Hex,
  ): ContractInteractionsService;

  async proveCommitment(
    value: bigint,
    label: bigint,
    nullifier: bigint,
    secret: bigint,
  ): Promise<CommitmentProof>;

  async verifyCommitment(proof: CommitmentProof): Promise<boolean>;

  async proveWithdrawal(
    commitment: Commitment | AccountCommitment,
    input: WithdrawalProofInput,
  ): Promise<WithdrawalProof>;

  async verifyWithdrawal(
    withdrawalProof: WithdrawalProof,
  ): Promise<boolean>;
}
```

### Crypto Utilities

Core cryptographic operations exported from `crypto.ts`.

```tsx
// Derive deterministic master keys from a BIP-39 mnemonic
function generateMasterKeys(mnemonic: string): MasterKeys;

// Generate deposit nullifier and secret for a given scope and index
function generateDepositSecrets(
  keys: MasterKeys,
  scope: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret };

// Generate withdrawal nullifier and secret for a given label and index
function generateWithdrawalSecrets(
  keys: MasterKeys,
  label: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret };

// Hash a nullifier and secret into a precommitment
function hashPrecommitment(nullifier: Secret, secret: Secret): Hash;

// Create a full commitment from value, label, nullifier, and secret
function getCommitment(
  value: bigint,
  label: bigint,
  nullifier: Secret,
  secret: Secret,
): Commitment;

// Generate a Merkle inclusion proof for a leaf in a set of leaves
function generateMerkleProof(
  leaves: bigint[],
  leaf: bigint,
): LeanIMTMerkleProof<bigint>;

// Calculate the context hash for a withdrawal
function calculateContext(withdrawal: Withdrawal, scope: Hash): string;
```

### Account Management

The `AccountService` handles deterministic account recovery and state management.

```tsx
class AccountService {
  constructor(
    dataService: DataService,
    config: { mnemonic: string; poolConcurrency?: number }
         | { account: PrivacyPoolAccount; poolConcurrency?: number },
  );

  // Reconstruct account state from on-chain events
  static async initializeWithEvents(
    dataService: DataService,
    source: { mnemonic: string } | { service: AccountService },
    pools: PoolInfo[],
  ): Promise<{
    account: AccountService;
    legacyAccount?: AccountService;
    errors: PoolEventsError[];
  }>;

  // Get all spendable commitments across all pools
  getSpendableCommitments(): Map<bigint, AccountCommitment[]>;

  // Create deposit secrets for a given scope
  createDepositSecrets(
    scope: Hash,
    index?: bigint,
  ): { nullifier: Secret; secret: Secret; precommitment: Hash };

  // Create withdrawal secrets for a given commitment
  createWithdrawalSecrets(
    commitment: AccountCommitment,
  ): { nullifier: Secret; secret: Secret };
}
```

### Types

```tsx
interface MasterKeys {
  masterNullifier: Secret;
  masterSecret: Secret;
}

interface Commitment {
  hash: Hash;
  nullifierHash: Hash;
  preimage: {
    value: bigint;
    label: bigint;
    precommitment: {
      hash: Hash;
      nullifier: Secret;
      secret: Secret;
    };
  };
}

interface WithdrawalProofInput {
  context: bigint;
  withdrawalAmount: bigint;
  stateMerkleProof: LeanIMTMerkleProof<bigint>;
  aspMerkleProof: LeanIMTMerkleProof<bigint>;
  stateRoot: Hash;
  stateTreeDepth: bigint;
  aspRoot: Hash;
  aspTreeDepth: bigint;
  newSecret: Secret;
  newNullifier: Secret;
}

interface AccountCommitment {
  hash: Hash;
  value: bigint;
  label: Hash;
  nullifier: Secret;
  secret: Secret;
  blockNumber: bigint;
  txHash: Hex;
}

interface PoolInfo {
  chainId: number;
  address: Hex;
  scope: Hash;
  deploymentBlock: bigint;
}
```

### Mnemonic Security

The SDK does **not** provide a `generateMnemonic` utility. Use a trusted BIP-39 library (e.g. `@scure/bip39` or `viem/accounts`) to generate mnemonic phrases.

- **Never hardcode** mnemonics in source code or configuration files.
- **Never log or transmit** mnemonics in plaintext.
- **Store mnemonics** using OS-level secure storage (e.g. OS keychain, encrypted vault) — never in browser localStorage or unencrypted files.
- **Do not reuse** a single mnemonic across unrelated applications. A compromised mnemonic exposes all derived keys and the funds they control.
- The mnemonic is the **sole root of all derived keys**. Loss of the mnemonic means permanent loss of access to all associated commitments and funds.
