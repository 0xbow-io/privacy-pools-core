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

Use this page as the human-facing integration entrypoint. It gives the minimum production path and links to deeper references without duplicating the entire canonical runbook.

## Recommended Read Order

1. [Deployments](/deployments) for chain-specific addresses and `startBlock`
2. [SDK Utilities](/reference/sdk) for SDK types/functions
3. [Deposit](/protocol/deposit), [Withdrawal](/protocol/withdrawal), [Ragequit](/protocol/ragequit) for protocol behavior
4. [skills.md](https://docs.privacypools.com/skills.md) for full operational detail, edge cases, and API schemas

## Default Production Path

For most integrators, the best path is:

1. Use `@0xbow/privacy-pools-core-sdk` for proof inputs/proof generation and contract interactions.
2. Use ASP API endpoints (`/public/mt-roots`, `/public/mt-leaves`) for association-set data.
3. Cross-check ASP root parity against onchain Entrypoint `latestRoot()`.
4. Use relayed withdrawals by default:
   - Production: `https://fastrelay.xyz`
   - Testnets: `https://testnet-relayer.privacypools.com`
5. Use self-relay only as an advanced fallback when relayer service is unavailable.
6. Keep ragequit as a fallback path when a private withdrawal cannot proceed.

## Required Safety Checks

- `X-Pool-Scope` must be a decimal bigint string.
- `onchainMtRoot` must equal `Entrypoint.latestRoot()` exactly before proof generation/submission.
- `withdrawalAmount` must be `> 0` and `<=` commitment value.
- Check `minimumDepositAmount` before submitting deposit transactions.
- Relayer `feeCommitment` has a short TTL (about 60s); quote and request should be near-contiguous.
- After partial withdrawals, refresh leaves before generating the next proof.

## Data Sources by Responsibility

| Need | Canonical Source |
|---|---|
| Chain addresses and start blocks | [Deployments](/deployments) |
| Protocol mechanics | [Using Privacy Pools](/protocol/deposit) + [Withdrawal](/protocol/withdrawal) + [Ragequit](/protocol/ragequit) |
| SDK API/types | [SDK Utilities](/reference/sdk) |
| Deep operational integration guidance | [skills.md](https://docs.privacypools.com/skills.md) |
| Agent workflow file map | [Agent Workflows](/agent-workflows) |

## When to Use [skills.md](https://docs.privacypools.com/skills.md) vs Docs Pages

- Use docs pages for architecture and protocol semantics.
- Use [skills.md](https://docs.privacypools.com/skills.md) when you need concrete end-to-end code paths, request/response shapes, edge-case handling, or direct implementation checklists.

This split keeps docs concise for humans while preserving a single deep source of truth for agents and advanced integrators.
