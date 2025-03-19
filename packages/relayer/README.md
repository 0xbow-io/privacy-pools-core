# ts-turborepo-boilerplate: relayer package

Description of your package goes here.

## Setup

1. Install dependencies running `pnpm install`

## Available Scripts

Available scripts that can be run using `pnpm`:

| Script        | Description                                             |
| ------------- | ------------------------------------------------------- |
| `build`       | Build library using tsc                                 |
| `check-types` | Check types issues using tsc                            |
| `clean`       | Remove `dist` folder                                    |
| `lint`        | Run ESLint to check for coding standards                |
| `lint:fix`    | Run linter and automatically fix code formatting issues |
| `format`      | Check code formatting and style using Prettier          |
| `format:fix`  | Run formatter and automatically fix issues              |
| `test`        | Run tests using vitest                                  |
| `test:cov`    | Run tests with coverage report                          |

## Usage

Describe how to use your package here.

## API

Describe your package's API here.

## Configuration

The relayer service uses a JSON configuration file. A sample configuration file is provided as `config.example.json`. To set up your own configuration, copy this file to `config.json` and modify it according to your needs.

### Configuration Structure

```json
{
  "defaults": {
    "fee_receiver_address": "0x...",
    "signer_private_key": "0x...",
    "entrypoint_address": "0x..."
  },
  "chains": [
    // Chain configurations...
  ],
  "sqlite_db_path": "/path/to/database.sqlite",
  "cors_allow_all": true,
  "allowed_domains": ["https://example.com"]
}
```

### Default Configuration

The `defaults` section provides global default values that apply across all chains unless overridden:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `fee_receiver_address` | Address (0x-prefixed) | Ethereum address where transaction fees will be sent |
| `signer_private_key` | Private Key (0x-prefixed) | Private key used for signing transactions |
| `entrypoint_address` | Address (0x-prefixed) | Address of the entrypoint contract |

### Chain Configuration

Each entry in the `chains` array configures support for a specific blockchain:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `chain_id` | String/Number | The chain ID of the blockchain network |
| `chain_name` | String | Human-readable name of the blockchain |
| `rpc_url` | URL String | JSON-RPC endpoint URL for the blockchain |
| `fee_receiver_address` | Address (optional) | Chain-specific fee receiver address (overrides defaults) |
| `signer_private_key` | Private Key (optional) | Chain-specific signer private key (overrides defaults) |
| `entrypoint_address` | Address (optional) | Chain-specific entrypoint address (overrides defaults) |
| `native_currency` | Object | Information about the chain's native currency |
| `supported_assets` | Array | List of supported assets on this chain |

#### Asset Configuration

Each entry in the `supported_assets` array configures a token that can be used with Privacy Pools:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `asset_address` | Address | Contract address of the token |
| `asset_name` | String | Human-readable name of the token |
| `fee_bps` | String/Number | Fee in basis points (1/100 of a percent, so 100 = 1%) |
| `min_withdraw_amount` | String/Number | Minimum amount that can be withdrawn |

### Global Settings

| Field | Type | Description |
| ----- | ---- | ----------- |
| `sqlite_db_path` | String | Path to the SQLite database file |
| `cors_allow_all` | Boolean | Whether to allow all CORS requests (true) or only from specified domains (false) |
| `allowed_domains` | Array of URLs | List of domains allowed to access the API when CORS is restricted |

## References

Add any relevant references here.
