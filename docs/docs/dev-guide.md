---
title: Developer Guide
---

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or later)
- Yarn (v1.22 or later)
- Foundry (for smart contracts)
- Docker (for running the relayer)
- Circom (for zero-knowledge circuits)

## Project Structure

The project is organized as a monorepo with the following packages:

- `contracts`: Solidity smart contracts
- `circuits`: Zero-knowledge circuits in Circom
- `sdk`: TypeScript SDK for interacting with the protocol
- `relayer`: Note relayer service

## Installation

1. Clone the repository:

```bash
git clone <https://github.com/defi-wonderland/privacy-pool-core.git>
cd privacy-pool-core
```

1. Install dependencies:

```bash
yarn install
```

## Building and Testing Packages

### Contracts

The contracts package contains the Solidity smart contracts for the Privacy Pool protocol.

```bash
cd packages/contracts

# Build contracts
yarn build

# Run tests
yarn test

# Run unit tests
yarn test:unit

# Run integration tests
yarn test:integration

# Run coverage
yarn coverage

# Lint
yarn lint:check
yarn lint:fix
```

### Circuits

The circuits package contains the zero-knowledge circuits written in Circom.

```bash
cd packages/circuits

# Compile circuits
yarn compile

# Run tests
yarn test

# Run specific test suites
yarn test:merkle
yarn test:withdraw
yarn test:commitment

# Setup
yarn setup:all  # Sets up all circuits
yarn setup:ptau  # Generate Powers of Tau
yarn setup:withdraw  # Setup withdrawal circuit
yarn setup:commitment  # Setup commitment circuit
yarn setup:merkle  # Setup merkle tree circuit

# Generate groth16 verifier contracts
yarn gencontract:withdraw
yarn gencontract:commitment
```

### SDK

The SDK package provides TypeScript bindings for interacting with the protocol.

```bash
cd packages/sdk

# Build SDK
yarn build

# Build with circuit artifacts
yarn build:bundle

# Run tests
yarn test

# Run coverage
yarn test:cov

# Type checking
yarn check-types

# Lint and format
yarn lint
yarn format
```

### Relayer

The relayer package provides a service for relaying notes.

```bash
cd packages/relayer

# Build
yarn build

# Start the relayer
yarn start

# Build and start
yarn build:start

# Run with TypeScript
yarn start:ts

# Docker commands
yarn docker:build
yarn docker:run

# Tests
yarn test
yarn test:cov
```

## Environment Setup

Some packages require environment variables to be set.

### Contracts

```
// packages/contracts/.env
MAINNET_RPC=
MAINNET_DEPLOYER_NAME=

SEPOLIA_RPC=
SEPOLIA_DEPLOYER_NAME=

ETHERSCAN_API_KEY=

OWNER_ADDRESS=
POSTMAN_ADDRESS=
VERIFIER_ADDRESS=
ENTRYPOINT_ADDRESS=
```

### Relayer

```json
// config.example.json
{
  "fee_receiver_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  "provider_url": "http://0.0.0.0:8545", // Anvil port
  "fee_bps": "1000",
  "signer_private_key": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "sqlite_db_path": "/tmp/pp_relayer.sqlite",
  "entrypoint_address": "0xa513e6e4b8f2a923d98304ec87f64353c4d5c853",
  "chain": {
    "name": "localhost",
    "id": "31337"
  },
  "withdraw_amounts": {
    "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9": 100
  }
}
```
