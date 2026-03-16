# Privacy Pool Core SDK

A TypeScript SDK for interacting with the Privacy Pool protocol. This SDK provides cryptographic utilities, proof generation, account management, and contract interactions for Privacy Pool integration.

## Installation

```bash
npm install @0xbow/privacy-pools-core-sdk
# or
yarn add @0xbow/privacy-pools-core-sdk
# or
pnpm add @0xbow/privacy-pools-core-sdk
```

## Setup

1. Install dependencies by running `pnpm install`
2. Build the SDK by running `pnpm build`

## Available Scripts

| Script        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `build`       | Build the SDK using Rollup                              |
| `build:bundle`| Build the SDK and set up circuits                       |
| `check-types` | Check for TypeScript type issues                        |
| `clean`       | Remove build artifacts                                  |
| `lint`        | Run ESLint to check code quality                        |
| `lint:fix`    | Fix linting issues automatically                        |
| `format`      | Check code formatting using Prettier                    |
| `format:fix`  | Fix formatting issues automatically                     |
| `test`        | Run tests using Vitest                                  |
| `test:cov`    | Generate test coverage report                           |

## Usage

### Initialization

```typescript
import { PrivacyPoolSDK, Circuits } from '@0xbow/privacy-pools-core-sdk';

// In Node.js — set browser: false to load artifacts from the filesystem
const circuits = new Circuits({ browser: false });

// In the browser — the default (browser: true) uses fetch
// const circuits = new Circuits();

const sdk = new PrivacyPoolSDK(circuits);
```

### Commitment Proofs

```typescript
const commitmentProof = await sdk.proveCommitment(value, label, nullifier, secret);
const isValid = await sdk.verifyCommitment(commitmentProof);
```

### Withdrawal Proofs

```typescript
const withdrawalProof = await sdk.proveWithdrawal(commitment, withdrawalInput);
const isValid = await sdk.verifyWithdrawal(withdrawalProof);
```

### Key Derivation

The SDK derives deterministic master keys from a BIP-39 mnemonic phrase using `generateMasterKeys`. These keys are used to generate per-deposit and per-withdrawal nullifiers and secrets.

```typescript
import { generateMasterKeys, generateDepositSecrets, generateWithdrawalSecrets } from '@0xbow/privacy-pools-core-sdk';

const { masterNullifier, masterSecret } = generateMasterKeys(mnemonic);

const depositSecrets = generateDepositSecrets(
  { masterNullifier, masterSecret },
  scope,
  index,
);

const withdrawalSecrets = generateWithdrawalSecrets(
  { masterNullifier, masterSecret },
  label,
  index,
);
```

### Account Recovery

The `AccountService` reconstructs on-chain account state from a mnemonic by scanning deposit, withdrawal, and ragequit events.

```typescript
import { AccountService, DataService } from '@0xbow/privacy-pools-core-sdk';

const { account, errors } = await AccountService.initializeWithEvents(
  dataService,
  { mnemonic },
  pools,
);
```

### Contract Interactions

```typescript
const contracts = sdk.createContractInstance(rpcUrl, chain, entrypointAddress, privateKey);
```

## Mnemonic Security

The SDK does **not** provide a `generateMnemonic` utility. Use a trusted BIP-39 library (e.g. `@scure/bip39` or `viem/accounts`) to generate mnemonic phrases externally.

- **Never hardcode** mnemonics in source code or configuration files.
- **Never log or transmit** mnemonics in plaintext.
- **Store mnemonics** using OS-level secure storage (e.g. OS keychain, encrypted vault) — never in browser localStorage or unencrypted files.
- **Do not reuse** a single mnemonic across unrelated applications. A compromised mnemonic exposes all derived keys and the funds they control.
- The mnemonic is the **sole root of all derived keys**. Loss of the mnemonic means permanent loss of access to all associated commitments and funds.

## Features

- Zero-knowledge proof generation and verification (commitments and withdrawals)
- Deterministic key derivation from BIP-39 mnemonics
- Account state recovery from on-chain events
- Commitment and Merkle proof utilities
- Contract interaction helpers
- Type-safe API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache-2.0 License - see the [LICENSE](LICENSE) file for details.
