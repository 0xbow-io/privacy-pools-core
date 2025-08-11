# Privacy Pools Relayer

A relayer service that facilitates private withdrawals and fee quoting for Privacy Pools.

It provides an API for users or frontends to:

- Submit withdrawal requests
- Get real-time fee quotes (including gas cost, relayer margin, and swap fees)
- Retrieve relayer fee configuration details

Built with TypeScript, Express.js, and SQLite. Supports multi-chain configurations.

---

# Setup

## 1. Install Dependencies

```bash
yarn install
```

## 2. Environment Variables

You must set the following environment variables before running:

| Variable              | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `INFURA_API_KEY`      | For accessing Sepolia RPC (and Uniswap quoting)     |
| `RPC_URL`             | RPC URL fallback if not configured in `config.json` |
| `RELAYER_PRIVATE_KEY` | Private key used to sign fee commitments            |
| `SQLITE_DB_PATH`      | (optional) Override path to SQLite DB               |

*(You can create a `.env` file locally if you prefer.)*

## 3. Build and Start

```bash
yarn build:start
```

For TypeScript live mode:

```bash
yarn start:ts
```

Or using Docker:

```bash
yarn docker:build
yarn docker:run
```

---

# Configuration


### Important Considerations for Relayer Fee Setup

When configuring your relayer, keep the following in mind:

- In the config file, you define a `fee_bps` (basis points) value, e.g., **100 BPS** for **0.1%**.
- This represents the **desired profit margin** over the value withdrawn.
- During operation:
  - The relayer estimates the **transaction cost** (`tx_cost`) for executing a relay (gas used × gas price).
  - It calculates the **effective feeBPS** needed to fully cover `tx_cost` and still achieve the configured `fee_bps` margin.
  - This "effective" fee is dynamically adjusted upwards if gas prices spike.
- If the value withdrawn is too small and the relayer cannot achieve at least the configured margin, the transaction will be **rejected**.

TLDR: fee_bps will be your profit over the withdrawn value. If the value is too small to cover the tx_fees and the relayer cut, it will reject the tx. 

---


The relayer uses a `config.json` file to manage chains, assets, fees, and operational settings. 

For setting up your config, use config.example.json as a basic template. 


## Configuration Reference

The relayer is configured through a `config.json` file.  
This file defines global defaults, per-chain settings, supported assets, and operational parameters.

Below is the complete description of all fields, their types, and behaviors.

---

### Top-Level Fields

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `defaults` | Object | Yes | Default addresses and private keys for all chains unless overridden. |
| `chains` | Array of Objects | Yes | List of supported chains and their specific settings. |
| `sqlite_db_path` | String (absolute or relative path) | Yes | Path to the SQLite database file. |
| `cors_allow_all` | Boolean | Yes (default: `false`) | Whether to allow all CORS origins or restrict to allowed domains. |
| `allowed_domains` | Array of Strings (URLs) | Yes | List of allowed CORS domains if `cors_allow_all` is false. |

---

### `defaults` Object

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `fee_receiver_address` | String (0x-prefixed address) | Yes | Address where relayer fees are collected. |
| `signer_private_key` | String (0x-prefixed private key) | Yes | Private key used to sign fee commitments. |
| `entrypoint_address` | String (0x-prefixed address) | Yes | Entrypoint contract address for relayer operations. |

---

### `chains` Array

Each entry represents a supported chain configuration.

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `chain_id` | Number or String | Yes | Chain ID (e.g., 1 for Ethereum, 11155111 for Sepolia). |
| `chain_name` | String | Yes | Human-readable chain name. |
| `rpc_url` | String (URL) | Yes | JSON-RPC endpoint to connect to the chain. |
| `max_gas_price` | String or Number (wei) | Optional | Maximum gas price allowed for relaying (in wei). If exceeded, relayer rejects transaction. |
| `fee_receiver_address` | String (0x-prefixed address) | Optional | Chain-specific fee receiver. Overrides `defaults.fee_receiver_address` if set. |
| `signer_private_key` | String (0x-prefixed private key) | Optional | Chain-specific signer. Overrides `defaults.signer_private_key` if set. |
| `entrypoint_address` | String (0x-prefixed address) | Optional | Chain-specific entrypoint. Overrides `defaults.entrypoint_address` if set. |
| `native_currency` | Object | Optional | Info about the chain's native currency (ETH, MATIC, etc). |
| `supported_assets` | Array of Objects | Optional | List of ERC-20 or native assets supported for withdrawals on this chain. |

---

### `chains[].native_currency` Object

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `name` | String | No (default: `"Ether"`) | Full name of the native currency. |
| `symbol` | String | No (default: `"ETH"`) | Ticker symbol for the native currency. |
| `decimals` | Number | No (default: `18`) | Number of decimals used by the native currency. |

---

### `chains[].supported_assets` Array

Each entry represents a supported ERC-20 token (or native token).

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `asset_address` | String (0x-prefixed address) | Yes | Token contract address. Use `0xEeeee...` for native assets. |
| `asset_name` | String | Yes | Human-readable name of the token. |
| `fee_bps` | String or Number | Yes | Fee in basis points (1/100th of a percent). 100 = 1%. |
| `min_withdraw_amount` | String or Number | Yes | Minimum withdrawal amount allowed for this asset (in base units, not decimals). |

---

### Behavior and Fallbacks

- If `fee_receiver_address`, `signer_private_key`, or `entrypoint_address` are missing in a chain config, the relayer **falls back to `defaults`** and logs a warning.
- If `max_gas_price` is not set, no gas price limits are enforced (relayer accepts any gas price).
- If `supported_assets` is missing, no assets are available for withdrawal on that chain.
- If `native_currency` is missing, defaults to:
  - Name: `"Ether"`
  - Symbol: `"ETH"`
  - Decimals: `18`
- If withdrawal or quote transactions cannot meet the configured profit margin (`fee_bps`), the request will be rejected.

---

# Notes

- All addresses must be valid EVM addresses (0x-prefixed, checksummed).
- All private keys must be valid hex strings starting with `0x`.
- Fee calculations automatically adjust based on gas costs and swap rates when quoting.

### Configuration Fields

- **fee_receiver_address**: Where relayer fees are collected.
- **signer_private_key**: Used to sign fee commitments.
- **entrypoint_address**: Contract address handling withdrawals.
- **chains**: Supported blockchain networks.
- **supported_assets**: Supported ERC-20 or native assets with:
  - **fee_bps**: Relayer profit margin (in basis points).
  - **min_withdraw_amount**: Minimum withdrawal size allowed.
---

# API Endpoints

## POST /relayer/quote

Returns a fee quote for a withdrawal, including dynamic feeBPS adjusted for gas costs.

### Request Body

```json
{
  "chainId": 11155111,
  "amount": "1000000000000000000",
  "asset": "0xTokenAddress",
  "recipient": "0xRecipientAddress"
}
```

### Response

```json
{
  "baseFeeBPS": "200",
  "feeBPS": "291",
  "feeCommitment": {
    "expiration": 1744676669549,
    "withdrawalData": "0x...",
    "signedRelayerCommitment": "0x..."
  }
}
```

If `recipient` is provided, a signed relayer commitment is returned, valid for 20 seconds.

---

## POST /relayer/request

Submits a full withdrawal payload for execution, optionally using a previously signed fee commitment.

### Request Body

```json
{
  "chainId": 11155111,
  "scope": "0x123...",
  "withdrawal": {
    "processooor": "0x...",
    "data": "0x..."
  },
  "proof": {
    "pi_a": ["..."],
    "pi_b": [["...", "..."], ["...", "..."]],
    "pi_c": ["..."]
  },
  "publicSignals": [...],
  "feeCommitment": {
    "expiration": 1744676669549,
    "withdrawalData": "0x...",
    "signedRelayerCommitment": "0x..."
  }
}
```

### Response

```json
{
  "success": true,
  "txHash": "0x...",
  "timestamp": 1744676669549,
  "requestId": "uuid"
}
```

If no `feeCommitment` is provided, the relayer checks if the feeBPS in the payload is high enough. Otherwise, it validates the signed commitment.

---

## GET /relayer/details

Returns configuration for a given chain and asset.

### Query Parameters

| Parameter      | Required | Description                  |
| -------------- | -------- | ---------------------------- |
| `chainId`      | Yes      | Chain ID as number           |
| `assetAddress` | Yes      | Asset address (0x hex format)    |

### Response

```json
{
  "chainId": 11155111,
  "feeBPS": "200",
  "minWithdrawAmount": "1000",
  "feeReceiverAddress": "0x...",
  "assetAddress": "0x...",
  "maxGasPrice": "2392000000"
}
```

---

# Available Scripts

| Script           | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `build`          | Compile code with tsc                                     |
| `start`          | Run the compiled server                                   |
| `build:start`    | Compile and run in one command                            |
| `start:ts`       | Run using ts-node (dev mode)                              |
| `check-types`    | Type-check the codebase                                   |
| `lint` / `lint:fix` | Check or fix ESLint violations                        |
| `format` / `format:fix` | Check or fix Prettier formatting                  |
| `test` / `test:cov` | Run tests or generate coverage                         |
| `docker:build` / `docker:run` | Build or run the relayer using Docker      |

---
