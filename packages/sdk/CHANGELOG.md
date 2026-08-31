# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-08-31

### Fixed

- **Deposits are no longer hidden by key migration.** Deposit indices and migration-derived accounts are independent namespaces, but reconstruction started the corrected-key deposit scan at the number of migration-derived accounts for the scope (`depositStartIndex = poolAccounts.length`) and derived the next deposit index the same way. Any deposit whose index fell below the final migration count was never generated, so never scanned, and was permanently absent from reconstructed state while remaining spendable on-chain. Two sequences reached this:
  - a scope whose event history failed to load reported no accounts, so the next deposit index was inferred as `0`; once the history recovered and the legacy note migrated, the index-0 deposit was skipped;
  - a deposit placed between two staged migrations, with no fetch failure involved — the second migration shifted the scan start past the deposit's index, so the reconstructed balance *decreased* after a successful migration.

  The deposit scan now always starts at index 0. Accounts record the derivation index they were reconstructed from (`PoolAccount.depositIndex`), migration-derived accounts are tagged (`PoolAccount.isMigrationDerived`) and consume no deposit index, and the next index is derived from the recorded indices rather than array position. The consecutive-miss tolerance is widened by the migration count so deposits already written at an offset index by earlier versions are still found.

- **A reused deposit index is detected and reported instead of silently collapsing.** Two deposits at the same index share a precommitment, and because the deposit nullifier comes from the same `(masterKeys, scope, depositIndex)` derivation they share a nullifier hash too — so the pool permits a withdrawal for only one of them (`State.sol` reverts `NullifierAlreadySpent` for the second). Reconstruction keeps the earliest deposit under a total order (`blockNumber`, `logIndex`, `transactionHash`) and logs a warning naming the kept and ignored transactions, so affected accounts can be found. Both reconstruction paths (`getDepositEvents` and the deprecated `retrieveHistory`) now use that same rule and agree on which deposit is the spendable one.

- **Completeness of a scope's history is tracked on the account and survives restore.** `PrivacyPoolAccount.scopeStatus` records `complete` / `incomplete` per scope, and a scope absent from it reads as `not-loaded`. Previously this lived only on the transient service, so a service rebuilt from a persisted account lost the guard entirely and would infer a deposit index for a scope it knew nothing about. `not-loaded` is now also distinguished from `complete`: a scope that was never fetched no longer reports as complete.

- **Retries no longer drop pools or duplicate accounts.** `initializeWithEvents({ service })` ran no migration discovery, so retrying a failed scope produced a reconstruction omitting migration-derived accounts — a different, also incomplete, view than a fresh `{ mnemonic }` call on the same events. Pass `legacyService` (returned by the original `{ mnemonic }` call) to run the full pipeline on retry. Retry scope selection is now driven by recorded status, which fixes two further defects: a pool newly added to `pools` is no longer skipped as though it had been processed, and a scope that loaded successfully but matched no commitments is no longer re-scanned on the legacy side, which had duplicated its accounts on every retry. Because status lives on the shared `PrivacyPoolAccount`, a scope reconstructed on retry also stops reading as incomplete on the caller's original service handle.

### Added

- `AccountService.getScopeStatus(scope)` returning `complete` / `incomplete` / `not-loaded`, plus `isScopeComplete(scope)` and `getIncompleteScopes()`. Reconstructed state for a scope that is not `complete` is **absent, not empty**; callers should block deposits and withdrawals for it rather than treating it as a scope with no accounts.
- `PrivacyPoolAccount.scopeStatus` (optional, so accounts persisted by earlier versions still load) and the `ScopeLoadStatus` type.
- `PoolAccount.depositIndex` and `PoolAccount.isMigrationDerived`.
- `DepositEvent.logIndex`, populated from the log, giving a total order over deposits that share a precommitment within one transaction.
- `initializeWithEvents` accepts `{ service, legacyService }` for migration-aware retries.
- `addPoolAccount` accepts an optional trailing `{ depositIndex, isMigrationDerived }` argument. Callers that record a deposit locally after sending it should pass the index they used.

### Changed

- **BREAKING** `createDepositSecrets(scope)` with no explicit index now throws `AccountError` when the scope's history is incomplete or was never loaded, instead of silently returning an index derived from partial state. Passing an explicit index is still permitted, which is what recovery flows should do. An account that has loaded nothing at all stays permissive, so a first deposit on a new account is unaffected.
- `createDepositSecrets` validates a supplied index of `0n` (previously `if (index && index < 0n)` skipped validation for `0n`).

## [1.4.0] - 2026-08-06

### Added

- `ChainConfig` accepts optional `timeout` and `retryCount`, forwarded to the viem `http` transport built for that chain. Previously the transport always used viem's defaults (10s timeout, 3 retries), so a single chunked `eth_getLogs` could never run longer than 10s no matter what the RPC provider allowed — which capped the usable `blockChunkSize`. Omitting both keeps the previous behavior.

## [1.3.0] - 2026-06-24

### Added

- Added `includeEmptyNodes` option to `AccountService` (constructor and `initializeWithEvents`). When `true` (the new default), `getSpendableCommitments` returns empty (zero-value), migrated, and ragequit nodes alongside spendable ones. Set to `false` to restore the previous spendable-only behavior.

## [1.2.0] - 2026-03-18

### Fixed

- Replaced `bytesToNumber` with `bytesToBigInt` for proper large-number handling
- Added circuits artifact integrity verification

## [1.1.1] - 2026-03-08

### Fixed

- Fixed 0n value withdrawals processing in the SDK

## [1.1.0] - 2026-02-19

### Added

- Added per-chain and per-pool concurrency configurations

## [1.0.3] - 2026-02-10

### Fixed

- Fixed issue with concurrent logs fetching

## [1.0.2] - 2025-09-02

### Fixed

- Fixed issue with incorrect deposits decryption
- Fixed duplicated precommitments collision

## [1.0.1] - 2025-07-31

### Fixed

- Patched lean-imt package to fix ZK proof generation

## [1.0.0] - 2025-07-03

### Added

- Initial state of the code for upcoming releases
