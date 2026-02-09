# Engineering Questions for skills.md Completion

These are the remaining gaps in `docs/static/skills.md` that need engineer input before the file is production-ready.

---

## 1. 0xbow ASP API — CRITICAL

Without ASP data, no agent can complete a private withdrawal. The withdrawal circuit requires an ASP Merkle root and a proof that the deposit's **label** is a leaf in the ASP tree.

### What we need:

**a) ASP API endpoint and request format**
```
Endpoint URL: ___________________________________
  (e.g., https://asp.0xbow.io/v1/...)
  Same for all chains, or one per chain? __________

HTTP method: GET / POST

Required parameters:
  - chain ID? ___
  - pool address? ___
  - scope? ___
  - other? ___

Authentication: None / API key / other? ___________
```

**b) ASP API response format**

skills.md needs two values — how do they appear in the response?

```typescript
const aspRoot: bigint = ???       // hex string? decimal string?
const aspLabels: bigint[] = ???   // full list of approved labels? or a pre-computed Merkle proof for a specific label?
```

Does the API return the full list of approved labels (agent builds Merkle tree locally), or a pre-computed Merkle proof for a specific label? This changes the integration pattern significantly.

**c) One working example request/response**

Even a synthetic example is fine:
```
Request:  curl https://asp.0xbow.io/v1/labels?chainId=1&pool=0x1234...
Response: { "root": "0xabc...", "labels": ["12345...", "67890..."] }
```

---

## 2. Relayer Endpoint — HIGH PRIORITY

The fee encoding is now documented (we found the `RelayData` struct in `IEntrypoint.sol`):

```solidity
struct RelayData {
    address recipient;      // final recipient of withdrawn funds
    address feeRecipient;   // relayer address (receives the fee)
    uint256 relayFeeBPS;    // fee in basis points
}
```

And `withdrawal.processooor` must be set to the **Entrypoint address** (not the relayer) — the contract checks `_withdrawal.processooor == address(this)`.

### What we still need:

**a) Relayer discovery endpoint**
```
Relayer endpoint URL: ___________________________________
  One per chain, or single endpoint? __________
```

**b) Relayer API contract — what does the relayer expect to receive and return?**
```
Request:  POST https://relayer.0xbow.io/v1/relay
Body:     { proof: ???, publicSignals: ???, other: ??? }
Response: { txHash: "0x...", other: ??? }
```

---

## 3. SDK Bug: `getStateRoot` calls wrong function — HIGH PRIORITY

`ContractInteractionsService.getStateRoot(poolAddress)` calls `latestRoot` from `IEntrypointABI` at the **pool** address (`contracts.service.ts:263`). But:

- `latestRoot()` only exists on the **Entrypoint** contract (returns the latest ASP root)
- The **pool** contract exposes `currentRoot()` (via `State.sol:101`) for the state Merkle root

This means `getStateRoot(poolAddress)` is calling a function that doesn't exist on the target contract. It should call `currentRoot` from `IPrivacyPoolABI` instead.

We've added a workaround note in skills.md telling agents to fall back to `readContract` with `currentRoot()` if the SDK call fails.

---

## 4. Contract ABIs — MEDIUM PRIORITY

The SDK has ABIs (`IEntrypointABI`, `IPrivacyPoolABI`) in `packages/sdk/src/abi/` but they aren't exported from the SDK's public `index.ts`.

**a) Is this intentional?** Should frontend devs use ABIs from `packages/contracts` build artifacts, or should the SDK re-export them?

**b) Are contract ABIs published in a standalone package?** (e.g., `@0xbow/privacy-pools-contracts`)

---

## 5. Starknet SDK — LOW PRIORITY

Is there a separate Starknet SDK package, or is it planned but not yet available?

---

## Summary

| # | Topic | Priority | Impact | What's needed |
|---|-------|----------|--------|---------------|
| 1 | ASP API | CRITICAL | Blocks ALL withdrawal flows | Endpoint, request/response format, one example |
| 2 | Relayer endpoint | HIGH | Blocks gas-free withdrawals | Endpoint URL, API contract |
| 3 | `getStateRoot` SDK bug | HIGH | Returns wrong data for withdrawal proofs | Fix in `contracts.service.ts` |
| 4 | ABI exports | MEDIUM | Blocks frontend dapp integration | Clarification on intended pattern |
| 5 | Starknet SDK | LOW | Completeness | Availability status |
