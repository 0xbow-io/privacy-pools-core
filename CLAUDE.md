# Privacy Pools Claude Code Guide

This file is a thin routing layer for Claude Code.

Do not treat this file as the canonical protocol reference.

## Canonical Docs

- Primary operational quickstart: `docs/static/skills-core.md`
- Canonical deep reference (source of truth): `docs/static/skills.md`
- Deployments and start blocks: `docs/docs/deployments.md`
- Agent file map and usage: `docs/docs/agent-workflows.md`

## Recommended Read Order

1. Read `docs/static/skills-core.md`.
2. Read only the relevant section(s) in `docs/static/skills.md`.
3. Pull addresses/startBlock from `docs/docs/deployments.md`.
4. Execute with minimal assumptions and validate all on-chain/API invariants.

## Workflow Rules

- Prefer relayed withdrawals via `fastrelay.xyz` for production flows.
- Treat self-relay as advanced fallback.
- Always verify ASP root parity before withdrawal proof submission.
- Always use decimal `X-Pool-Scope` header values.
- Never modify files under `audit/`.

## Build and Test

```bash
yarn
yarn workspace @0xbow/privacy-pools-core-sdk test
yarn workspace @privacy-pool-core/contracts test
yarn workspace @privacy-pool-core/circuits test
yarn workspace @privacy-pool-core/relayer test
cd docs && yarn build
```
