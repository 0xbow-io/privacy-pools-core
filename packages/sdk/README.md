# Privacy Pool Core SDK

A TypeScript SDK for interacting with the Privacy Pool protocol. This SDK provides a comprehensive set of tools and utilities for integrating with Privacy Pool, enabling deposits, withdrawals, and other core functionality.

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

```typescript
import { PrivacyPoolSDK } from '@0xbow/privacy-pools-core-sdk';

// Initialize the SDK
const sdk = new PrivacyPoolSDK({
  // Configuration options
});

// Example: Create a deposit
const deposit = await sdk.deposit({
  // Deposit parameters
});

// Example: Create a withdrawal
const withdrawal = await sdk.withdraw({
  // Withdrawal parameters
});
```

For detailed usage examples and API documentation, please refer to our [documentation](https://github.com/defi-wonderland/privacy-pool-core/tree/main/docs).

## Features

- Deposit and withdrawal functionality
- Zero-knowledge proof generation
- Commitment management
- Contract interactions
- Type-safe API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache-2.0 License - see the [LICENSE](LICENSE) file for details.
