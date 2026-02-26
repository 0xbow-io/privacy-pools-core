---
title: SDK Utilities
---

### `PrivacyPoolSDK`

Main SDK class providing high-level protocol interaction.

```tsx
class PrivacyPoolSDK {
  // Ragequit Operations
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
  ): Promise<WithdrawalPayload>;

  async verifyWithdrawal(
    withdrawalPayload: WithdrawalPayload,
  ): Promise<boolean>;
}
```

### Crypto Utilities

Core cryptographic operations.

```tsx
// Generate random nullifier and secret
function generateSecrets(): {
  nullifier: Secret;
  secret: Secret;
};

// Create commitment with provided parameters
function getCommitment(
  value: bigint,
  label: bigint,
  nullifier: Secret,
  secret: Secret,
): Commitment;

// Generate Merkle proof for leaf
function generateMerkleProof(
  leaves: bigint[],
  leaf: bigint,
): LeanIMTMerkleProof<bigint>;
```

### Types

```tsx
interface Commitment {
  hash: Hash; // Commitment hash
  nullifierHash: Hash; // Hash of nullifier
  preimage: {
    value: bigint; // Committed value
    label: bigint; // Commitment label
    precommitment: {
      // Precommitment data
      hash: Hash; // Precommitment hash
      nullifier: Secret; // Nullifier value
      secret: Secret; // Secret value
    };
  };
}

interface WithdrawalProofInput {
  withdrawalAmount: bigint; // Amount to withdraw
  context: bigint; // Proof context
  stateMerkleProof: {
    // State tree proof
    root: bigint;
    leaf: bigint;
    index: number;
    siblings: bigint[];
  };
  aspMerkleProof: {
    // ASP tree proof
    root: bigint;
    leaf: bigint;
    index: number;
    siblings: bigint[];
  };
  stateRoot: bigint; // Current state root
  stateTreeDepth: number; // State tree depth
  aspRoot: bigint; // Current ASP root
  aspTreeDepth: number; // ASP tree depth
  newSecret: bigint; // New secret
  newNullifier: bigint; // New nullifier
}
```
