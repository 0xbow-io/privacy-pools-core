---
title: Agent Workflows
description: How Privacy Pools documentation is structured for autonomous agents and human+agent workflows.
keywords:
  - ai agents
  - autonomous agents
  - codex
  - claude code
  - llms
  - skills
---

# Agent Workflows

Privacy Pools documentation is layered for AI agents: one canonical source of truth with thin wrappers per runtime.

## File Map

| File | Purpose | Audience | Notes |
|---|---|---|---|
| `skills-core.md` | Operational quickstart | Agents, human+agent sessions | Start here; covers all flows with minimal context |
| `skills.md` | Canonical deep reference | Agents + engineers | Source of truth for SDK, API schemas, types, error handling |
| `deployments.md` | Contract addresses and start blocks | All | Authoritative chain-specific deployment data |
| `CLAUDE.md` | Claude Code config | Claude Code | Auto-loaded at repo root; routes to canonical docs |
| `AGENTS.md` | Repo-level guidance | Codex and similar coding agents | Build/test commands, security constraints, repo structure |
| `SKILL.md` | Installable skill wrapper | Codex skill users | Frontmatter-driven; thin wrapper around canonical docs (canonical source: `skills/privacy-pools/SKILL.md`, repo-scoped mirror: `.agents/skills/privacy-pools/SKILL.md`) |
| `llms.txt` | Lightweight site index | Crawlers, retrieval systems | Auto-generated at build; discovery and routing |
| `llms-full.txt` | Complete LLM corpus | Retrieval systems | Prepends `skills-core.md` + `skills.md`; fully self-contained |

## How To Use

### Claude Code

Claude Code auto-discovers `CLAUDE.md` at the repository root — no setup needed. It routes the agent to:

1. `docs/static/skills-core.md` — read first for operational flows and safety rules.
2. `docs/static/skills.md` — read relevant sections for SDK details, API schemas, or edge cases.
3. `docs/docs/deployments.md` — pull chain addresses and `startBlock` values.

### Codex

Codex reads `AGENTS.md` at the repository root for build commands, repo structure, and security constraints. For protocol integration work:

1. Start with `docs/static/skills-core.md` for the operational path.
2. Escalate to `docs/static/skills.md` only for advanced implementation details.
3. Use `docs/docs/deployments.md` for authoritative addresses and start blocks.

For repo-scoped auto-discovery, use `.agents/skills/privacy-pools/SKILL.md`. For user-scoped installation:

```bash
mkdir -p ~/.agents/skills/privacy-pools
cp skills/privacy-pools/SKILL.md ~/.agents/skills/privacy-pools/SKILL.md
```

### LLM Retrieval Systems

For systems that ingest a single document, use `llms-full.txt` — it prepends both `skills-core.md` and `skills.md` ahead of all docs pages, so the most operationally critical content appears first even if the context window truncates.

## Integration Endpoints

| Resource | URL |
|---|---|
| Agent quickstart | https://docs.privacypools.com/skills-core.md |
| Canonical deep reference | https://docs.privacypools.com/skills.md |
| Deployments | https://docs.privacypools.com/deployments |
| Full LLM corpus | https://docs.privacypools.com/llms-full.txt |
| Site index | https://docs.privacypools.com/llms.txt |

## Maintenance

- `skills.md` is the canonical source of truth. Update it first; keep wrappers thin.
- Update `skills-core.md` whenever operational guidance changes.
- Keep `skills/privacy-pools/SKILL.md` and `.agents/skills/privacy-pools/SKILL.md` in sync (`skills/privacy-pools/SKILL.md` is canonical).
- Avoid hardcoding addresses in wrappers — reference `deployments.md` instead.
- Rebuild after changes: `cd docs && yarn build`.
