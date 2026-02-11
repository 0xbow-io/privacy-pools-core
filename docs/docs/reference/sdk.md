---
title: SDK Utilities
description: "SDK API reference for high-level protocol operations, proof helpers, and integration-oriented TypeScript types."
keywords:
  - privacy pools
  - sdk
  - typescript
  - api reference
  - proof generation
  - withdrawal proof
  - integration
---

For production onboarding and required safety checks, start with [Integrations](/protocol/integrations). For full end-to-end operational guidance and API payload schemas, see [skills.md](https://docs.privacypools.com/skills.md).


## `PrivacyPoolSDK`

Main SDK class providing high-level protocol interaction.

```tsx
class PrivacyPoolSDK {
  // Commitment Operations (for ragequit)
  async proveCommitment(
    value: bigint,
    label: bigint,
    nullifier: bigint,
    secret: bigint,
  ): Promise<CommitmentProof>;

  async verifyCommitment(proof: CommitmentProof): Promise<boolean>;

  // Withdrawal Operations
  async proveWithdrawal(
    commitment: Commitment,
    input: WithdrawalProofInput,
  ): Promise<WithdrawalProof>;

  async verifyWithdrawal(
    proof: WithdrawalProof,
  ): Promise<boolean>;
}
```

## Crypto Utilities

Core cryptographic operations.

```tsx
// Derive master keys from a BIP-39 mnemonic
function generateMasterKeys(mnemonic: string): MasterKeys;

// Generate deterministic nullifier/secret for a deposit
function generateDepositSecrets(
  keys: MasterKeys,
  scope: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret };

// Generate deterministic nullifier/secret for a withdrawal (change commitment)
function generateWithdrawalSecrets(
  keys: MasterKeys,
  label: Hash,
  index: bigint,
): { nullifier: Secret; secret: Secret };

// Create commitment with provided parameters
function getCommitment(
  value: bigint,
  label: bigint,
  nullifier: Secret,
  secret: Secret,
): Commitment;

// Hash nullifier + secret into a precommitment
function hashPrecommitment(
  nullifier: Secret,
  secret: Secret,
): Hash;

// Compute context hash for withdrawal proof
function calculateContext(
  withdrawal: Withdrawal,
  scope: Hash,
): string;  // returns hex string — cast to bigint for proveWithdrawal

// Generate Merkle proof for leaf
function generateMerkleProof(
  leaves: bigint[],
  leaf: bigint,
): LeanIMTMerkleProof<bigint>;
```

## Types

```tsx
type Hash = bigint;    // Branded bigint for commitment/Merkle hashes
type Secret = bigint;  // Branded bigint for nullifier/secret values

interface MasterKeys {
  masterNullifier: Secret;
  masterSecret: Secret;
}

interface Commitment {
  hash: Hash;              // Commitment hash
  nullifierHash: Hash;     // Hash of nullifier
  preimage: {
    value: bigint;         // Committed value
    label: bigint;         // Commitment label
    precommitment: {
      hash: Hash;          // Precommitment hash
      nullifier: Secret;   // Nullifier value
      secret: Secret;      // Secret value
    };
  };
}

interface WithdrawalProofInput {
  context: bigint;                           // Proof context (from calculateContext, cast to bigint)
  withdrawalAmount: bigint;                  // Amount to withdraw
  stateMerkleProof: LeanIMTMerkleProof<bigint>;  // State tree inclusion proof
  aspMerkleProof: LeanIMTMerkleProof<bigint>;    // ASP tree inclusion proof
  stateRoot: Hash;                           // Current state root
  stateTreeDepth: bigint;                    // Always 32n
  aspRoot: Hash;                             // Current ASP root
  aspTreeDepth: bigint;                      // Always 32n
  newSecret: Secret;                         // New secret for change commitment
  newNullifier: Secret;                      // New nullifier for change commitment
}

interface CommitmentProof {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

interface WithdrawalProof {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
}

interface Withdrawal {
  processooor: Address;   // Direct: tx signer (msg.sender). Relayed: Entrypoint address.
  data: Hex;              // Direct: "0x". Relayed: ABI-encoded RelayData.
}
```
