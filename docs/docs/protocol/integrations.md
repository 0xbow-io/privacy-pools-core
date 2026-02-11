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

## Recommended Read Order

1. [Deployments](/deployments) — chain-specific addresses and `startBlock`
2. [SDK Utilities](/reference/sdk) — SDK types and functions
3. [Deposit](/protocol/deposit), [Withdrawal](/protocol/withdrawal), [Ragequit](/protocol/ragequit) — protocol behavior
4. [skills.md](https://docs.privacypools.com/skills.md) — end-to-end code paths, API schemas, and edge cases

## Default Production Path

1. Use `@0xbow/privacy-pools-core-sdk` for proof generation and contract interactions.
2. Use ASP API endpoints (`/public/mt-roots`, `/public/mt-leaves`) for association-set data.
3. Cross-check ASP root parity against on-chain Entrypoint `latestRoot()`.
4. Use relayed withdrawals by default:
   - Production: `https://fastrelay.xyz`
   - Testnets: `https://testnet-relayer.privacypools.com`
5. Fall back to self-relay only when the relayer service is unavailable.
6. Use ragequit as a last-resort exit when private withdrawal cannot proceed.

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
