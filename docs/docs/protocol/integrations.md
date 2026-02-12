---
title: Integrations
description: "Production integration guide for Privacy Pools using SDK, ASP API, and relayer flows with required safety checks."
keywords:
  - privacy pools
  - integrations
  - sdk integration
  - relayer
  - asp api
  - production guide
  - fastrelay
  - developer workflow
---

This page covers the recommended production integration path for Privacy Pools, including required safety checks and key references.

## Key References

1. [Deployments](/deployments) — chain-specific addresses and `startBlock`
2. [SDK Utilities](/reference/sdk) — SDK types and functions
3. [Deposit](/protocol/deposit), [Withdrawal](/protocol/withdrawal), [Ragequit](/protocol/ragequit) — protocol behavior
4. [skills.md](https://docs.privacypools.com/skills.md) — end-to-end code paths, API schemas, and edge cases

## Getting Started

1. Use `@0xbow/privacy-pools-core-sdk` for proof generation and contract interactions.
2. Use ASP API endpoints (`/public/mt-roots`, `/public/mt-leaves`) for association-set data.
3. Build proof `aspRoot` from ASP `onchainMtRoot` and require exact parity with on-chain Entrypoint `latestRoot()`.
4. Use relayed withdrawals by default:
   - Production: `https://fastrelay.xyz`
   - Testnets: `https://testnet-relayer.privacypools.com`
5. Fall back to self-relay only when the relayer service is unavailable.
6. Use ragequit as a last-resort exit when private withdrawal cannot proceed.

## API Hosts

| Service | Network scope | Base URL |
|---|---|---|
| ASP API | Mainnet chains (`1`, `42161`, `10`) | `https://api.0xbow.io` |
| ASP API | Testnet chains (`11155111`, `11155420`) | `https://dw.0xbow.io` |
| Relayer API | Production chains | `https://fastrelay.xyz` |
| Relayer API | Sepolia testnets | `https://testnet-relayer.privacypools.com` |

ASP API docs: `https://api.0xbow.io/api-docs`

## Critical API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /{chainId}/public/mt-roots` | Fetch ASP `mtRoot` and `onchainMtRoot` (requires decimal `X-Pool-Scope`) |
| `GET /{chainId}/public/mt-leaves` | Fetch ASP labels and state tree leaves for proof construction (requires decimal `X-Pool-Scope`) |
| `POST /relayer/quote` | Get relay fee quote and signed `feeCommitment` |
| `GET /relayer/details` | Fetch relayer config (`feeReceiverAddress`, fee bounds, asset support) |
| `POST /relayer/request` | Submit relayed withdrawal before quote expiry |

## Required Safety Checks

- `X-Pool-Scope` must be a decimal bigint string.
- `onchainMtRoot` must equal `Entrypoint.latestRoot()` exactly before proof generation/submission.
- `withdrawalAmount` must be `> 0` and `<=` commitment value.
- Check `minimumDepositAmount` before submitting deposit transactions.
- Relayer `feeCommitment` has a short TTL (~60s); quote and request should be near-contiguous.
- After partial withdrawals, refresh leaves before generating the next proof.

## Reference Map

| What you need | Where to find it |
|---|---|
| Chain addresses and start blocks | [Deployments](/deployments) |
| Protocol flows | [Deposit](/protocol/deposit), [Withdrawal](/protocol/withdrawal), [Ragequit](/protocol/ragequit) |
| SDK API and types | [SDK Utilities](/reference/sdk) |
| End-to-end integration detail | [skills.md](https://docs.privacypools.com/skills.md) |

## Common Failure Modes

| Error | Typical cause | Immediate action |
|---|---|---|
| `IncorrectASPRoot` | ASP root mismatch (`onchainMtRoot` parity not satisfied) | Re-fetch `mt-roots` + `mt-leaves`, use `onchainMtRoot`, regenerate proof |
| `MERKLE_ERROR` | Leaf missing from provided leaves (wrong scope/pool or stale data) | Verify scope and pool, refresh leaves, rebuild Merkle proofs |
| `InvalidProcessooor` | Direct vs relayed `processooor` mismatch | Direct: `processooor = msg.sender`; relayed: `processooor = entrypointAddress` |
| `NullifierAlreadySpent` | Commitment already exited via withdrawal or ragequit | Stop retrying that commitment and select another spendable commitment |
| `PrecommitmentAlreadyUsed` | Duplicate deposit precommitment / index reuse | Increment deposit index, recompute secrets/precommitment, resubmit |
