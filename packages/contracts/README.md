# Privacy Pool Contracts

This package contains the smart contract implementations for the Privacy Pool protocol, built using Foundry. The contracts enable private asset transfers through a system of deposits and zero-knowledge withdrawals with built-in compliance mechanisms.

## Protocol Overview

The protocol enables users to deposit assets publicly and withdraw them privately, provided they can prove membership in an approved set of addresses. Each supported asset (native or ERC20) has its own dedicated pool contract that inherits from a common `PrivacyPool` implementation.

## Ethereum Mainnet Deployed Contracts

Entrypoint (Proxy): `0x6818809EefCe719E480a7526D76bD3e561526b46` 

Entrypoint (Implementation): `0x6818809EefCe719E480a7526D76bD3e561526b46`

ETH Pool: `0xF241d57C6DebAe225c0F2e6eA1529373C9A9C9fB`

### Deposit Flow

When a user deposits funds, they:

1. Generate commitment parameters (nullifier and secret)
2. Send the deposit transaction through the Entrypoint
3. The Entrypoint routes the deposit to the appropriate pool
4. The pool records the commitment in its state tree
5. The depositor receives a deposit identifier (label) and a commitment hash

### Withdrawal Flow

To withdraw funds privately, users:

1. Generate a zero-knowledge proof demonstrating:
   - Ownership of a valid deposit commitment
   - Membership in the approved address set
   - Correctness of the withdrawal amount
2. Submit the withdrawal transaction through a relayer
3. The pool verifies the proof and processes the withdrawal
4. A new commitment is created for the remaining funds (even if it is zero)

### Emergency Exit (`ragequit`)

The protocol implements a ragequit mechanism that allows original depositors to withdraw their funds directly for non ASP approved funds. This process:

1. Requires the original deposit label
2. Bypasses the approved address set verification
3. Can only be executed by the original depositor
4. Withdraws the full commitment amount

## Contract Architecture

### Core Contracts

**`State.sol`**
The base contract implementing fundamental state management:

- Manages the Merkle tree state using LeanIMT
- Tracks tree roots with a sliding window (30 latest roots)
- Records used nullifiers to prevent double spending
- Maps deposit labels to original depositors
- Implements tree operations

**`PrivacyPool.sol`**
An abstract contract inheriting from State.sol that implements the core protocol logic:

Standard Operations:

- Deposit processing (through Entrypoint only)
- Withdrawal verification and processing
- Wind down mechanism for pool deprecation
- Ragequit mechanism for non-approved withdrawals
- Abstract methods for asset transfers

### Pool Implementations

**`PrivacyPoolSimple.sol`**
Implements `PrivacyPool` for native asset:

- Handles native asset deposits through `payable` functions
- Implements native asset transfer logic
- Validates transaction values

**`PrivacyPoolComplex.sol`**
Implements `PrivacyPool` for ERC20 tokens:

- Manages token approvals and transfers
- Implements safe ERC20 operations

### Protocol Coordination

**`Entrypoint.sol`**
Manages protocol-wide operations:

- Routes deposits to appropriate pools
- Maintains the approved address set (ASP)
- Processes withdrawal relays
- Handles fee collection and distribution
- Manages pool registration and removal
- Controls protocol upgrades and access control

### Supporting Libraries

**`ProofLib.sol`**
Handles accessing a proof signals values.

## Development

### Prerequisites

- Foundry
- Node.js 20+
- Yarn

### Building

```bash
# Compile contracts
yarn build
```

### Testing

```bash
# Run unit tests
yarn test:unit
```

```bash
# Run integration tests (with `ffi` enabled)
yarn test:integration
```

## Deployment

### Environment Setup

1. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure the following environment variables in your `.env` file:
   ```
   # RPC endpoints
   ETHEREUM_MAINNET_RPC=https://eth-mainnet.example.com
   ETHEREUM_SEPOLIA_RPC=https://eth-sepolia.example.com
   GNOSIS_RPC=https://gnosis.example.com
   GNOSIS_CHIADO_RPC=https://gnosis-chiado.example.com
   
   # Etherscan API key for contract verification
   ETHERSCAN_API_KEY=your_etherscan_api_key
   
   # Account addresses
   DEPLOYER_ADDRESS=0x...
   OWNER_ADDRESS=0x...
   POSTMAN_ADDRESS=0x...
   
   # Only needed for role assignments and root updates
   ENTRYPOINT_ADDRESS=0x...
   ```

3. Import your deployer account to the Foundry keystore:
   ```bash
   cast wallet import DEPLOYER --interactive
   # Enter your private key when prompted
   ```

4. Optional: Import additional accounts if needed (for assigning roles or updating roots):
   ```bash
   cast wallet import SEPOLIA_DEPLOYER_NAME --interactive
   cast wallet import SEPOLIA_POSTMAN --interactive
   ```

### Deploying the Protocol

The project provides deployment scripts for various networks. Choose the appropriate command based on your target network:

> **Important:** All forge script commands must include the `--broadcast` flag to actually send transactions to the network. Without this flag, transactions will only be simulated.

#### Testnet Deployments

**Ethereum Sepolia:**
```bash
yarn deploy:protocol:sepolia --broadcast
```

**Gnosis Chiado:**
```bash
yarn deploy:protocol:chiado --broadcast
```

#### Mainnet Deployment

```bash
yarn deploy:mainnet --broadcast
```

### Post-Deployment Operations

#### Assigning Roles

To assign roles (Owner or Postman) to accounts in the deployed protocol:

```bash
yarn assignrole:sepolia --broadcast
```

This will prompt you to enter:
1. The account to assign the role to
2. The role to assign (0 for Owner, 1 for Postman)

#### Updating ASP Root

To update the Approved Set of Participants (ASP) root:

```bash
yarn updateroot:sepolia --broadcast
```

This script builds the Merkle tree using the `script/utils/tree.mjs` utility and updates the root in the Entrypoint contract.

#### Registering a New Pool

To register a new pool with the Entrypoint:

```bash
source .env && forge script script/Entrypoint.s.sol:RegisterPool --account DEPLOYER --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast -vv
```

This will prompt you to enter:
1. Asset address (empty for native asset)
2. Pool address
3. Minimum deposit amount
4. Vetting fee in basis points
5. Maximum relay fee in basis points
