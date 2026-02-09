# Privacy Pools Core

> Privacy Pools enables compliant private transactions on Ethereum using
> zero-knowledge proofs and Association Set Providers (ASPs).
> Docs: https://docs.privacypools.com

## Repository Structure

Yarn workspaces monorepo:

- `packages/circuits/` - Circom circuits (commitment, withdrawal, LeanIMT)
- `packages/contracts/` - Solidity contracts (Entrypoint + PrivacyPool variants)
- `packages/relayer/` - Relayer service for relayed withdrawals
- `packages/sdk/` - TypeScript SDK for protocol integration
- `docs/` - Docusaurus docs site
- `audit/` - Security audit reports (read-only)

## Key Domain Concepts

- **Privacy Pool**: Public deposit + private withdrawal pool
- **Commitment**: Hash committed at deposit time and inserted into state tree
- **Nullifier**: One-time value revealed on withdrawal to prevent double-spend
- **ASP**: Association Set Provider that publishes approved-label roots
- **LeanIMT**: Lean incremental Merkle tree used for efficient membership proofs
- **Ragequit**: Public fallback withdrawal when ASP approval is unavailable/revoked
- **Entrypoint**: Coordinator contract for deposits, relays, and pool routing

## Build and Test Commands

```bash
# Repo dependencies
yarn

# Contracts
yarn workspace @0xbow/contracts test

# Circuits
yarn workspace @0xbow/circuits test

# SDK
yarn workspace @0xbow/sdk test

# Relayer
yarn workspace @0xbow/relayer test

# Docs
cd docs && yarn build
```

## Coding Conventions

- **Solidity**: Follow patterns in `packages/contracts/src/`; keep NatSpec docs.
- **Circom**: Keep signal names consistent with interfaces and tests.
- **TypeScript**: Strict mode; prefer explicit types across package boundaries.
- **Lint/Format**: Use project ESLint/Prettier configs before submitting changes.
- **Commits**: Prefer conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`).

## Security Boundaries

- Never modify files under `audit/`.
- Treat circuit changes as high risk; require extra review and test coverage.
- Do not commit private keys, mnemonics, or API secrets.
- Contract upgrade logic changes require explicit security/governance review.
- Follow `SECURITY.md` for vulnerability reporting and disclosure.

## Documentation Notes

- Docs source is in `docs/docs/` with sidebar config in `docs/sidebars.ts`.
- Mermaid is enabled for flow diagrams.
- LLM artifacts (`llms.txt`, `llms-full.txt`, markdown exports) are generated at build.
- Keep `title`, `description`, and `keywords` frontmatter on all docs pages.
