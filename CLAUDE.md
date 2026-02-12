# Privacy Pools Claude Code Guide

This file is a thin routing layer for Claude Code.

Do not treat this file as the canonical protocol reference.

## Canonical Docs

- Integrator-friendly onboarding: `docs/docs/protocol/integrations.md`
- Primary operational quickstart: `docs/static/skills-core.md`
- Canonical deep reference (source of truth): `docs/static/skills.md`
- Deployments and start blocks: `docs/docs/deployments.md`
- Agent file map and usage: `docs/docs/agent-workflows.md`

## Recommended Read Order

1. Read `docs/docs/protocol/integrations.md` for fast orientation.
2. Read `docs/static/skills-core.md`.
3. Read only the relevant section(s) in `docs/static/skills.md`.
4. Pull addresses/startBlock from `docs/docs/deployments.md`.
5. Execute with minimal assumptions and validate all on-chain/API invariants.

## Quick Task Router

- If the task is first-time protocol integration, start with `docs/docs/protocol/integrations.md`.
- If the task needs exact SDK/API payloads or edge-case handling, use `docs/static/skills.md`.
- If the task needs chain addresses/start blocks, use `docs/docs/deployments.md`.
- If the task is about agent file behavior/discovery, use `docs/docs/agent-workflows.md`.

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
