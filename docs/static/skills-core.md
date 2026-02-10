# Privacy Pools Agent Quickstart (skills-core)

> Concise operational guide for autonomous agents and human+agent workflows.
> Canonical deep reference: https://docs.privacypools.com/skills.md
> SDK: `@0xbow/privacy-pools-core-sdk`

## Read Order

1. Read this file first for flow and safety-critical rules.
2. Read `https://docs.privacypools.com/deployments` for chain addresses and start blocks.
3. Read `https://docs.privacypools.com/skills.md` only for advanced implementation details and edge cases.

## Scope

This guide covers production-critical workflows:

- deposit (ETH/ERC20)
- private withdrawal (direct and relayed)
- ragequit fallback
- ASP and relayer integration rules

## Non-Negotiable Rules

- `X-Pool-Scope` header must be a decimal bigint string (`scope.toString()`), not hex.
- Use `onchainMtRoot` from ASP `mt-roots` as proof `aspRoot`.
- Require exact equality: `BigInt(onchainMtRoot) === Entrypoint.latestRoot()`.
- Validate `withdrawalAmount > 0n && withdrawalAmount <= committedValue` before proof generation.
- Validate `amount >= minimumDepositAmount` before any deposit.
- `feeCommitment` from relayer quote expires in ~60 seconds; quote -> request must complete inside this window.
- Direct withdraw requires `withdrawal.processooor == msg.sender`.
- Ragequit and private withdrawal are mutually exclusive on the same commitment (`NullifierAlreadySpent`).
- After partial withdrawal, refresh tree data before next proof (new change commitment leaf is inserted).

## Network and Host Selection

Use deployment addresses from:

- https://docs.privacypools.com/deployments

ASP host helper:

```typescript
function getAspApiHost(chainId: number): string {
  const hosts: Record<number, string> = {
    1: "https://api.0xbow.io",        // Ethereum mainnet
    42161: "https://api.0xbow.io",    // Arbitrum
    10: "https://api.0xbow.io",       // OP mainnet
    11155111: "https://dw.0xbow.io",  // Sepolia
    11155420: "https://dw.0xbow.io",  // OP Sepolia
  };
  const host = hosts[chainId];
  if (!host) throw new Error(`No ASP API host configured for chainId ${chainId}`);
  return host;
}
```

Relayer host helper:

```typescript
function getRelayerHost(chainId: number): string {
  const hosts: Record<number, string> = {
    1: "https://fastrelay.xyz",
    42161: "https://fastrelay.xyz",
    10: "https://fastrelay.xyz",
    11155111: "https://testnet-relayer.privacypools.com",
    11155420: "https://testnet-relayer.privacypools.com",
  };
  const host = hosts[chainId];
  if (!host) throw new Error(`No relayer host configured for chainId ${chainId}`);
  return host;
}
```

Production default: use `fastrelay.xyz` for relayed withdrawals. Treat self-relay as advanced fallback.

## Minimal End-to-End Flows

Implementation note:

- This section is an execution checklist.
- For copy-paste imports and SDK/service initialization, use the `SDK Quick Start` section in `https://docs.privacypools.com/skills.md`.
- For relay payload construction details (including ABI encoding of relay data), use the `Constructing the Withdrawal object` section in `https://docs.privacypools.com/skills.md`.

### Deposit (ETH)

1. Derive deposit secrets from mnemonic + scope + depositIndex.
2. Compute precommitment.
3. Validate minimum deposit via `getAssetConfig`.
4. Call `depositETH`.
5. Parse `Deposited` event and capture:
   - `label`
   - committed `value` (post-fee value)
6. Reconstruct commitment locally from `value`, `label`, `nullifier`, `secret`.

### Relayed Withdrawal (Default)

1. Load `scope` and current pool state root.
2. Fetch ASP roots and leaves:
   - `GET /{chainId}/public/mt-roots`
   - `GET /{chainId}/public/mt-leaves`
3. Verify root contract parity:
   - `BigInt(onchainMtRoot) === Entrypoint.latestRoot()`
4. Build state and ASP Merkle proofs from returned leaves.
5. Request quote and fetch relayer details:
   - `POST /relayer/quote` (returns signed `feeCommitment`)
   - `GET /relayer/details` (returns `feeReceiverAddress`)
6. Build withdrawal object for relay using fee data from step 5 (`processooor = entrypointAddress` and encoded relay data).
7. Generate ZK proof (context is derived from the withdrawal object).
8. Submit request before expiry (~60s):
   - `POST /relayer/request`
9. Wait for receipt and verify success.

If relayer is unavailable after proof generation, self-relay is possible with:

- `contracts.relay(withdrawal, proof, scope)`

### Direct Withdrawal (Advanced)

Use direct withdrawal only when recipient should be the tx signer:

- set `withdrawal.processooor` to signer address (`msg.sender`)
- call `contracts.withdraw(withdrawal, proof, scope)`

### Ragequit (Public Fallback)

Use when private withdrawal is unavailable (e.g., ASP not approved or label removed):

1. Generate commitment proof.
2. Call `contracts.ragequit(commitmentProof, privacyPoolAddress)`.

Ragequit is public and irreversible for that commitment (nullifier is spent).

## Required Runtime Validations

Before any withdrawal attempt:

- verify target commitment exists in current state leaves
- verify label exists in current ASP leaves
- prefer `stateMerkleProof.root === currentRoot()` before submit for deterministic execution (the protocol accepts recent historical roots, but current-root parity is the safest default)
- verify ASP root parity (`onchainMtRoot == latestRoot()`)

Before relayed submit:

- verify quote TTL still valid
- verify relayer fee bounds (`feeBPS <= maxRelayFeeBPS`)
- verify asset + chain support via `GET /relayer/details`

## High-Signal Error Triage

- `MERKLE_ERROR`: leaf not present in provided leaves (wrong pool, stale data, or missing indexing).
- `IncorrectASPRoot`: ASP root mismatch; re-fetch roots/leaves and regenerate proof.
- `InvalidProcessooor`: direct vs relayed `processooor` mismatch.
- `NullifierAlreadySpent`: commitment already exited (withdraw or ragequit already happened).
- `PrecommitmentAlreadyUsed`: duplicate deposit precommitment; increment deposit index and retry.

## Canonical References

- Deep operational reference: https://docs.privacypools.com/skills.md
- Deployments and start blocks: https://docs.privacypools.com/deployments
- SDK reference: https://docs.privacypools.com/reference/sdk
- Contracts reference: https://docs.privacypools.com/reference/contracts
- Full LLM index: https://docs.privacypools.com/llms-full.txt
