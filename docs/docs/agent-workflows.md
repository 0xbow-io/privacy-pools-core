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

This page explains the agent-facing documentation architecture for Privacy Pools.

Design goal: one canonical source of truth with thin wrappers per runtime.

## File Map

| File | Purpose | Primary Audience | Notes |
|---|---|---|---|
| `docs/static/skills.md` | Canonical deep operational reference | Agents + engineers | Source of truth for SDK/API/protocol integration details |
| `docs/static/skills-core.md` | Short operational quickstart | Autonomous agents and human+agent sessions | Start here to reduce context cost |
| `AGENTS.md` | Repo-level operating guidance | Codex and similar coding agents | Includes build/test/security constraints |
| `CLAUDE.md` | Thin Claude Code router | Claude Code | Points to canonical/core docs; avoids duplicate protocol logic |
| `skills/privacy-pools/SKILL.md` | Installable Codex skill wrapper | Codex skill users | Frontmatter-driven trigger + concise workflow |
| `llms.txt` | Lightweight LLM index | Crawlers and retrieval systems | Discovery and routing |
| `llms-full.txt` | Expanded LLM corpus | Retrieval systems with larger context | Prepends `skills-core.md` + `skills.md`; fully self-contained |

## Recommended Runtime Strategy

1. Load `skills-core.md` first.
2. Load only required sections from `skills.md`.
3. Pull chain addresses and start blocks from `deployments.md`.
4. Validate all proof-critical inputs against on-chain state and live API responses.

## How To Use (Codex and Claude Code)

### Codex

1. Open the repository root so `AGENTS.md` is discoverable.
2. Start with `docs/static/skills-core.md`.
3. Escalate to `docs/static/skills.md` only for advanced/edge-case handling.
4. Use `docs/docs/deployments.md` for authoritative addresses and start blocks.

For reusable skill installation in Codex environments:

1. Install/copy `skills/privacy-pools/SKILL.md` into your Codex skills directory.
2. Trigger with prompts like "integrate Privacy Pools deposit + relayed withdrawal flow."
3. Keep the skill wrapper thin; update canonical content in `skills.md`.

### Claude Code

1. Open the repository root so `CLAUDE.md` is loaded.
2. Follow `CLAUDE.md` read order (core -> canonical -> deployments).
3. Prefer relayed withdrawals as default flow; keep self-relay as fallback.

## Why This Layout

- Keeps one canonical deep document (`skills.md`) to prevent drift.
- Reduces context bloat during normal agent execution (`skills-core.md`).
- Supports multiple runtimes without duplicating protocol logic (`AGENTS.md`, `CLAUDE.md`, and Codex `SKILL.md` stay thin).

## Maintenance Rules

- Treat `docs/static/skills.md` as canonical.
- Update `docs/static/skills-core.md` whenever operational guidance changes.
- Keep wrappers thin and reference canonical/core docs instead of repeating details.
- Avoid hardcoding addresses in wrappers; use `deployments.md`.
- Rebuild docs after changes: `cd docs && yarn build`.

## Integration Endpoints

- Canonical docs: https://docs.privacypools.com/skills.md
- Agent quickstart: https://docs.privacypools.com/skills-core.md
- LLM full index: https://docs.privacypools.com/llms-full.txt
