---
name: privacy-pools-integration
description: Integrate with Privacy Pools for deposits, private withdrawals (direct or relayed), and ragequit fallback using @0xbow/privacy-pools-core-sdk plus ASP and relayer APIs. Use when building autonomous agents, backend services, or human+agent workflows that need correct end-to-end execution, proof generation inputs, and on-chain/API safety checks.
---

# Privacy Pools Integration Skill

Use this skill as a thin wrapper around the canonical Privacy Pools docs.

## Read Order

1. Read https://docs.privacypools.com/skills-core.md for the short operational path.
2. Read relevant sections of https://docs.privacypools.com/skills.md for implementation depth.
3. Read https://docs.privacypools.com/deployments for chain-specific contract addresses and `startBlock`.

If you are running inside the `privacy-pools-core` repository, local source files mirror these docs:

- `docs/static/skills-core.md`
- `docs/static/skills.md`
- `docs/docs/deployments.md`

## Standard Workflow

1. Identify chain, asset, pool address, and entrypoint from deployments.
2. Derive secrets and submit deposit.
3. Parse `Deposited` event and persist `label` + committed value.
4. Fetch ASP roots/leaves and verify ASP root parity with on-chain `latestRoot()`.
5. Build Merkle proofs and generate withdrawal proof.
6. Use relayer flow by default (`fastrelay.xyz` on production chains).
7. Use self-relay only when relayer is unavailable or explicitly required.
8. Use ragequit as public fallback if private withdrawal cannot proceed.

## Required Guards

- `X-Pool-Scope` must be decimal bigint string.
- `onchainMtRoot` must equal `Entrypoint.latestRoot()` exactly.
- `withdrawalAmount` must be `> 0` and `<= commitment value`.
- Minimum deposit must be checked before deposit transaction.
- Relayer quote TTL is short (~60 seconds), so quote and request must be near-contiguous.
- After partial withdrawal, refresh leaf data before generating the next proof.

## Output Expectations

When asked to implement or review an integration:

- provide copy-pasteable code and commands
- include exact data sources for every proof input
- include fallback behavior and failure handling
- avoid inventing addresses or API fields not in canonical docs
