# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `getCommitment` and `BruteForceRecoveryService` now set `Commitment.nullifierHash` to `poseidon([nullifier])`, matching the docs, the `commitment.circom` circuit, and the pool's on-chain `nullifierHashes` spent marker (previously set to the precommitment hash `poseidon([nullifier, secret])`)

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
