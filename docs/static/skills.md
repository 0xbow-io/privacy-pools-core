# Privacy Pools

> Privacy Pools enables compliant private transactions on Ethereum.
> Users deposit assets publicly and withdraw them privately using zero-knowledge proofs.
> Association Set Providers (ASPs) ensure only approved deposits can be withdrawn.
> Built by 0xbow. Website: https://privacypools.com | Docs: https://docs.privacypools.com

## What It Does

Privacy Pools breaks the on-chain link between deposit and withdrawal addresses. A user deposits ETH or ERC20 tokens into a pool, then later withdraws to a different address. A ZK proof demonstrates that the withdrawal is valid without revealing which deposit it came from. The ASP layer screens deposits for compliance and excludes unapproved labels from private withdrawals.

## Core Operations

1. **Deposit**: Send assets to a Privacy Pool. The user submits a precommitment hash (derived from a nullifier and secret) on-chain. The pool contract generates a unique `label` and computes the full `commitment = poseidon(value, label, precommitment)`, which is inserted into the on-chain Merkle tree. The `label` is emitted in the `Deposited` event — the user must capture and store it along with the nullifier and secret for later withdrawal.
2. **Withdraw**: Generate a ZK proof showing your commitment exists in both the state tree and the ASP-approved set, then submit it on-chain (directly or via a relayer). Supports partial withdrawals.
3. **Ragequit**: Emergency public exit. Prove ownership of a commitment via a commitment proof, then call ragequit to recover funds to the original depositor. Sacrifices privacy but guarantees fund recovery.

## SDK Quick Start

```bash
npm install @0xbow/privacy-pools-core-sdk
```

```typescript
import {
  PrivacyPoolSDK,
  Circuits,
  DataService,
  generateMasterKeys,
  generateDepositSecrets,
  generateWithdrawalSecrets,
  getCommitment,
  hashPrecommitment,
  generateMerkleProof,
  calculateContext,
  SDKError,
  ProofError,
  type Commitment,
  type Withdrawal,
  type PoolInfo,
  type MasterKeys,
  type Hash,
} from "@0xbow/privacy-pools-core-sdk";
import { mainnet } from "viem/chains";  // or arbitrum, optimism, etc.

// 1. Initialize SDK — circuit artifacts are fetched automatically
const circuits = new Circuits();  // defaults to browser mode (fetch). For Node.js: new Circuits({ browser: false })
const sdk = new PrivacyPoolSDK(circuits);

// 2. Create contract service
// - entrypointAddress: the Entrypoint proxy contract for the target network
// - privacyPoolAddress (used below): the specific pool contract for the asset you want (ETH, USDC, etc.)
// Both addresses are listed at https://docs.privacypools.com/deployments
// Note: privateKey is for server-side / backend usage. For frontend dapps with browser wallets,
// use the contract ABIs from the contracts package (packages/contracts) with your own viem
// WalletClient. The crypto functions (generateMasterKeys, hashPrecommitment, etc.) work in
// any environment — only the ContractInteractionsService requires a private key.
const contracts = sdk.createContractInstance(rpcUrl, mainnet, entrypointAddress, privateKey);

// Read-only usage: DataService can be used standalone without PrivacyPoolSDK or a private key.
// It only needs an RPC URL. ContractInteractionsService (above) always requires a privateKey,
// even for read-only methods like getScope() — this is a constructor requirement.
```

### Deposit

```typescript
// Step 1: Generate deterministic secrets from a mnemonic
const masterKeys = generateMasterKeys(mnemonic);
const scope = await contracts.getScope(privacyPoolAddress) as unknown as Hash; // getScope returns bigint; cast to branded Hash
// depositIndex is a sequential counter: 0n for your first deposit to this pool, 1n for second, etc.
const { nullifier, secret } = generateDepositSecrets(masterKeys, scope, depositIndex);

// Step 2: Compute precommitment hash (this is what gets submitted on-chain)
const precommitment = hashPrecommitment(nullifier, secret);

// Step 3: Submit deposit on-chain
// amount is in the token's smallest unit (wei for ETH, token decimals for ERC20)
// ETH: 100000000000000000n = 0.1 ETH (18 decimals)
// USDC: 1000000n = 1 USDC (6 decimals)
const tx = await contracts.depositETH(amount, precommitment);
await tx.wait();

// For ERC20 deposits, approve spending first, then deposit:
// const approveTx = await contracts.approveERC20(entrypointAddress, tokenAddress, amount);
// await approveTx.wait();
// const tx = await contracts.depositERC20(tokenAddress, amount, precommitment);
// await tx.wait();

// Step 4: Capture the label AND committedValue from the Deposited event
// The pool contract generates label = keccak256(scope, nonce) % SNARK_SCALAR_FIELD
// and emits: Deposited(depositor, commitment, label, value, precommitmentHash)
// You must read `label` and `value` from the event logs of the deposit transaction.
// IMPORTANT: The event's `value` is the post-fee committed amount (after vettingFeeBPS
// deduction), which may be less than what you sent. Always use this value, not `amount`.

// Step 5: Reconstruct the full commitment locally using the on-chain label and value
const commitment = getCommitment(committedValue, label, nullifier, secret);

// Step 6 (optional): Generate commitment proof now (needed for ragequit)
const commitmentProof = await sdk.proveCommitment(committedValue, label, nullifier, secret);

// IMPORTANT: Store commitment, masterKeys, label, nullifier, and secret locally.
// You need them to withdraw or ragequit.
```

### Withdrawal

```typescript
// Step 1: Generate new secrets for the change commitment
// withdrawalIndex is a sequential counter: 0n for the first withdrawal from this deposit, 1n for second, etc.
const { nullifier: newNullifier, secret: newSecret } = generateWithdrawalSecrets(
  masterKeys, label, withdrawalIndex
);

// Step 2: Reconstruct the state tree and build Merkle proofs
// (see "Data Sourcing" section below for full details)
const stateMerkleProof = generateMerkleProof(allCommitmentHashes, commitment.hash);
const aspMerkleProof = generateMerkleProof(aspLabels, commitment.preimage.label);

// Step 3: Construct the Withdrawal object and compute context
// IMPORTANT: For direct withdrawal, processooor MUST equal the tx signer (msg.sender).
// The contract checks msg.sender == processooor and reverts with InvalidProcessooor otherwise.
// This means direct withdrawals go to the signer's own address only.
// To withdraw to a *different* address, use the relayed withdrawal flow instead (see below).
import { privateKeyToAccount } from "viem/accounts";
const signerAddress = privateKeyToAccount(privateKey).address; // derive signer address from the same key used in createContractInstance
const withdrawal: Withdrawal = { processooor: signerAddress, data: "0x" };
const scope = await contracts.getScope(privacyPoolAddress) as unknown as Hash;
const context = BigInt(calculateContext(withdrawal, scope)); // calculateContext returns hex string; cast to bigint for proveWithdrawal

// Step 4: Generate ZK withdrawal proof
// NOTE: contracts.getStateRoot() has a known SDK bug (calls wrong ABI function).
// Use this workaround to read the pool's current state root directly:
import { createPublicClient, http } from "viem";
const publicClient = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
const stateRoot = await publicClient.readContract({
  address: privacyPoolAddress, abi: [{ name: "currentRoot", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }], functionName: "currentRoot",
}) as unknown as Hash;  // readContract returns bigint; cast to branded Hash
const withdrawalProof = await sdk.proveWithdrawal(commitment, {
  context,
  withdrawalAmount,
  stateMerkleProof,
  aspMerkleProof,
  stateRoot,
  stateTreeDepth: 32n, // max tree depth — always 32n (the circuit handles actual depth via siblings)
  aspRoot: aspRoot as unknown as Hash,  // ASP API returns bigint; cast to branded Hash
  aspTreeDepth: 32n,   // max tree depth — always 32n
  newNullifier,
  newSecret,
});

// Step 5: Submit on-chain (direct withdrawal — funds go to signerAddress)
await contracts.withdraw(withdrawal, withdrawalProof, scope);
// For relayed withdrawals (third-party recipient), you must construct a DIFFERENT withdrawal
// object with processooor = entrypointAddress and ABI-encoded RelayData in data.
// See "Constructing the Withdrawal object" section below for the full relay example.
```

### Ragequit

```typescript
// Step 1: Prove ownership of the original commitment (requires label from deposit event)
const commitmentProof = await sdk.proveCommitment(
  commitment.preimage.value,
  commitment.preimage.label,
  commitment.preimage.precommitment.nullifier,
  commitment.preimage.precommitment.secret,
);

// Step 2: Execute ragequit — funds returned to original depositor (public, non-private)
await contracts.ragequit(commitmentProof, privacyPoolAddress);
```

## Data Sourcing

The withdrawal flow requires several inputs sourced from on-chain state and external services:

| Input | Source | How to get it |
|-------|--------|---------------|
| `scope` | Pool contract | `contracts.getScope(privacyPoolAddress)` |
| `stateRoot` | Pool contract | Read `currentRoot()` directly via viem `readContract` (see workaround in Step 4 above — the SDK's `getStateRoot()` has a known bug) |
| `allCommitmentHashes` | ASP API (preferred) or on-chain events | **Preferred:** `GET /{chainId}/public/mt-leaves` → `response.stateTreeLeaves` (pre-ordered). **Fallback:** reconstruct from `DataService` events (see below) |
| `aspRoot` | ASP API | `GET /{chainId}/public/mt-roots` → `response.mtRoot`. Requires `X-Pool-Scope` header. Verify against on-chain `Entrypoint.latestRoot()` before submitting |
| `aspLabels` | ASP API | `GET /{chainId}/public/mt-leaves` → `response.aspLeaves`. Requires `X-Pool-Scope` header. Returns `string[]` of decimal bigint labels |
| `label` | Deposit event | Read from `Deposited` event logs after deposit tx |
| `withdrawal` | Constructed by user | `{ processooor: signerAddress, data: "0x" }` (direct) or `{ processooor: entrypointAddress, data: relayData }` (relayed) |
| `context` | Derived | `calculateContext(withdrawal, scope)` |

### Reconstructing the state tree

**Preferred: Use the ASP API.** The `GET /{chainId}/public/mt-leaves` endpoint returns `stateTreeLeaves` — the complete, pre-ordered list of commitment hashes for the pool. This is the simplest and most reliable way to build the state Merkle proof:

```typescript
// Fetch state tree leaves and ASP labels in one call
const aspApiHost = getAspApiHost(chainId); // see getAspApiHost helper in "ASP data" section below
const scope = await contracts.getScope(privacyPoolAddress);
const res = await fetch(`${aspApiHost}/${chainId}/public/mt-leaves`, {
  headers: { "X-Pool-Scope": scope.toString() },
});
const { aspLeaves, stateTreeLeaves } = await res.json();

// Convert to bigint arrays
const allCommitmentHashes: bigint[] = stateTreeLeaves.map((s: string) => BigInt(s));
const aspLabels: bigint[] = aspLeaves.map((s: string) => BigInt(s));

// Build Merkle proofs directly
const stateMerkleProof = generateMerkleProof(allCommitmentHashes, commitment.hash);
const aspMerkleProof = generateMerkleProof(aspLabels, commitment.preimage.label);
```

**Fallback: Reconstruct from on-chain events.** If the API is unavailable, build the state tree from deposit and withdrawal event logs. Each deposit inserts a `commitment` leaf; each withdrawal inserts a `newCommitment` leaf (the change commitment). Ragequit does NOT insert a leaf — it only spends a nullifier. Leaves must be merged in **on-chain insertion order** (by block number, then log index within the block). The SDK event types don't expose `logIndex`, so the best available approach is to sort by `blockNumber` and rely on stable sort to preserve relative order. Since `DataService` returns events via `getLogs` (which preserves log ordering), each array from `getDeposits()` and `getWithdrawals()` is already internally ordered. Spread deposits before withdrawals and stable-sort by block — this is correct for the common case (a commitment must exist before it can be spent). Always validate the reconstructed root against the on-chain `currentRoot()` (via `readContract` — see Step 4 workaround) to catch rare same-block interleaving mismatches.

```typescript
// Use the deployment start block for the chain (see Supported Networks table above).
// Using 0n would scan from genesis and be extremely slow.
const startBlock = 22153709n; // mainnet — see Supported Networks table for other chains
const dataService = new DataService([{ chainId, rpcUrl, privacyPoolAddress, startBlock }]);
const pool: PoolInfo = { chainId, address: privacyPoolAddress, scope, deploymentBlock: startBlock };

// Fetch all events from the pool
const deposits = await dataService.getDeposits(pool);
const withdrawals = await dataService.getWithdrawals(pool);
// Also available: const ragequits = await dataService.getRagequits(pool);
// getWithdrawals accepts an optional fromBlock parameter for incremental fetching:
//   const newWithdrawals = await dataService.getWithdrawals(pool, lastProcessedBlock + 1n);

// Merge leaves in on-chain insertion order (by block number).
// Both arrays are already in log order from getLogs. Use a stable merge so that
// same-block events from each array keep their relative order.
const depositLeaves = deposits.map(d => ({ hash: d.commitment, blockNumber: d.blockNumber }));
const withdrawalLeaves = withdrawals.map(w => ({ hash: w.newCommitment, blockNumber: w.blockNumber }));
const allLeaves = [...depositLeaves, ...withdrawalLeaves]
  .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));
// Note: JavaScript's Array.sort is stable (ES2019+), so same-blockNumber items
// preserve their relative order from the spread. Since deposits are spread first,
// same-block deposits appear before same-block withdrawals, matching on-chain order
// (a commitment must be inserted before it can be spent in the same block).
//
// Caveat: the SDK event types don't expose logIndex, so if unrelated deposits and
// withdrawals interleave within the same block, this ordering may not match on-chain
// insertion order exactly. Always validate the reconstructed root (see below) and
// re-fetch events if it doesn't match.

const allCommitmentHashes: bigint[] = allLeaves.map(l => l.hash);

// Generate Merkle proof for your specific commitment
const stateMerkleProof = generateMerkleProof(allCommitmentHashes, commitment.hash);
// Returns LeanIMTMerkleProof<bigint> with: { root, leaf, index, siblings }
// IMPORTANT: Always validate — if stateMerkleProof.root !== the on-chain currentRoot(),
// your tree is stale or misordered. Re-fetch events and rebuild. If the root still
// doesn't match after a fresh fetch, same-block interleaving may be the cause —
// try swapping the order of deposit/withdrawal leaves that share the same blockNumber.
```

### ASP data

The `aspRoot` and `aspLabels` come from the Association Set Provider (ASP), operated by 0xbow. The ASP screens deposits for compliance and publishes a Merkle tree of approved **labels** (not commitment hashes). The ZK circuit verifies that the deposit's `label` is a leaf in the ASP tree. Since the `label` stays the same across partial withdrawals, a single ASP approval covers the original deposit and all its subsequent change commitments. Most deposits are approved within 1 hour, though some may take up to 7 days. The ASP can also retroactively remove a label from the approved set — if removed, private withdrawal fails but ragequit (public exit) always remains available.

**Canonical source (engineering-confirmed): ASP HTTP API backed by database data.**

Base URLs:
- Mainnet: `https://api.0xbow.io`
- Testnet: `https://dw.0xbow.io`
- Swagger docs: `https://api.0xbow.io/api-docs` (⚠️ **Swagger schemas are inaccurate across multiple endpoints** — e.g., `mt-roots` advertises `{ root }` but returns `{ mtRoot, createdAt, onchainMtRoot }`; deposit/withdrawal endpoints return `depositEvents`/`withdrawalEvents` keys where Swagger says `events`; `pool-info` returns a completely different shape than the DTO. **Do not trust Swagger DTOs for response parsing.** Always use the response shapes documented in this file.)

> **Note:** `request.0xbow.io` is a partner-only host (API-key gated) and does **not** serve the public `mt-roots` / `mt-leaves` endpoints documented below. Only use `api.0xbow.io` (mainnet) or `dw.0xbow.io` (testnet) for ASP data.

**Host selection helper** (used in all code samples below):

```typescript
function getAspApiHost(chainId: number): string {
  const hosts: Record<number, string> = {
    1:        "https://api.0xbow.io",  // Ethereum Mainnet
    42161:    "https://api.0xbow.io",  // Arbitrum
    10:       "https://api.0xbow.io",  // OP Mainnet
    11155111: "https://dw.0xbow.io",   // Sepolia testnet
  };
  const host = hosts[chainId];
  if (!host) throw new Error(`No ASP API host configured for chainId ${chainId}`);
  return host;
}
```

#### `GET /{chainId}/public/mt-roots` — ASP Merkle root

Returns the current ASP tree root for a pool. **Required header:** `X-Pool-Scope` (scope as decimal string).

```typescript
const aspApiHost = getAspApiHost(chainId); // see helper above
const scope = await contracts.getScope(privacyPoolAddress);
const res = await fetch(`${aspApiHost}/${chainId}/public/mt-roots`, {
  headers: { "X-Pool-Scope": scope.toString() },
});
const { mtRoot, createdAt, onchainMtRoot } = await res.json();
// mtRoot: string — current ASP Merkle root (decimal bigint string) from the database
// createdAt: string — ISO timestamp of this root
// onchainMtRoot: string — the on-chain root value (may lag slightly behind mtRoot)
const aspRoot = BigInt(mtRoot) as unknown as Hash;
```

#### `GET /{chainId}/public/mt-leaves` — ASP labels + state tree leaves

Returns both the ASP-approved labels and the state tree commitment hashes for a pool. **Required header:** `X-Pool-Scope` (scope as decimal string).

```typescript
const aspApiHost = getAspApiHost(chainId); // see helper above
const res = await fetch(`${aspApiHost}/${chainId}/public/mt-leaves`, {
  headers: { "X-Pool-Scope": scope.toString() },
});
const { aspLeaves, stateTreeLeaves } = await res.json();
// aspLeaves: string[] — approved labels (decimal bigint strings), in tree insertion order
// stateTreeLeaves: string[] — all commitment hashes (decimal bigint strings), in tree insertion order
const aspLabels: bigint[] = aspLeaves.map((s: string) => BigInt(s));
const allCommitmentHashes: bigint[] = stateTreeLeaves.map((s: string) => BigInt(s));
```

**Important notes:**
- The `X-Pool-Scope` value must be a **decimal string** (hex will return 404).
- Both endpoints are unauthenticated (no API key required) on the mainnet and testnet hosts.
- No pagination — the full leaf arrays are returned in a single response.
- The contract validates against the latest on-chain ASP root. Verify: `BigInt(mtRoot) === Entrypoint.latestRoot()` before submitting. If they differ, the ASP database may be ahead of the on-chain root — wait for the next `updateRoot` transaction or re-fetch.

**On-chain/IPFS (supplemental, not canonical client source):**

- Latest root: `Entrypoint.latestRoot()` (selector: `0xd7b0fef1`).
- Historical root access: admin-only.
- CID source: `associationSets(index).ipfsCID` — returns IPFS CID containing the label set for a given root index.

### Constructing the Withdrawal object

```typescript
interface Withdrawal {
  processooor: Address;  // Direct: signer's own address (msg.sender). Relayed: MUST be the Entrypoint address.
  data: Hex;             // "0x" for direct withdrawals; ABI-encoded RelayData for relayed
}

// Direct withdrawal — funds go to the signer's own address (processooor == msg.sender required)
const withdrawal: Withdrawal = { processooor: signerAddress, data: "0x" };

// Relayed withdrawal — processooor MUST be the Entrypoint address (not the relayer).
// The Entrypoint.relay() function checks: _withdrawal.processooor == address(this).
// The actual recipient and fee recipient are encoded in the data field as RelayData.
// Fee is bounded by maxRelayFeeBPS from getAssetConfig().
import { encodeAbiParameters } from "viem";
const relayData = encodeAbiParameters(
  [
    { name: "recipient", type: "address" },       // final recipient of withdrawn funds
    { name: "feeRecipient", type: "address" },     // relayer address (receives the fee)
    { name: "relayFeeBPS", type: "uint256" },      // fee in basis points (e.g. 50 = 0.5%)
  ],
  [recipientAddress, relayerAddress, relayFeeBPS]
);
const withdrawal: Withdrawal = { processooor: entrypointAddress, data: relayData };
```

### Relayer API (engineering-confirmed)

The relayer is a **separate service** from the ASP API — it is NOT hosted on `api.0xbow.io` or `dw.0xbow.io`.

Base URLs:
- Testnet: `https://testnet-relayer.privacypools.com` (confirmed live)
- Mainnet: not yet publicly documented — check with 0xbow engineering or the [docs site](https://docs.privacypools.com) for updates.

The API matches the OSS relayer contract (`packages/relayer`) exactly:

- `POST /relayer/quote`
- `POST /relayer/request`
- `GET /relayer/details`

Example `POST /relayer/quote`:

```json
{
  "chainId": 11155111,
  "amount": "1000000000000000000",
  "asset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "extraGas": false,
  "recipient": "0xRecipientAddress"
}
```

Example response (values are dynamic — vary with gas price and relayer config):

```json
{
  "baseFeeBPS": "10",
  "feeBPS": "17",
  "gasPrice": "1089675357",
  "detail": {
    "relayTxCost": {
      "gas": "650000",
      "eth": "708288982050000"
    }
  }
}
```

When `recipient` is provided in the quote request, the response also includes a `feeCommitment` object (pass it through unchanged to `/relayer/request`):

```json
{
  "baseFeeBPS": "10",
  "feeBPS": "17",
  "gasPrice": "1089675357",
  "detail": { "relayTxCost": { "gas": "650000", "eth": "708288982050000" } },
  "feeCommitment": {
    "expiration": 1744676669549,
    "withdrawalData": "0x...",
    "asset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "amount": "1000000000000000000",
    "extraGas": false,
    "signedRelayerCommitment": "0x..."
  }
}
```

Example `POST /relayer/request` (schema: `zRelayRequest` in `packages/relayer/src/schemes/relayer/request.scheme.ts`):

```json
{
  "chainId": 11155111,
  "scope": "123456789012345678901234567890",
  "withdrawal": {
    "processooor": "0x6818809eefce719e480a7526d76bd3e561526b46",
    "data": "0x..."
  },
  "proof": {
    "pi_a": ["...", "...", "..."],
    "pi_b": [["...", "..."], ["...", "..."], ["...", "..."]],
    "pi_c": ["...", "...", "..."]
  },
  "publicSignals": ["0", "1", "2", "3", "4", "5", "6", "7"],
  "feeCommitment": {
    "expiration": 1744676669549,
    "withdrawalData": "0x...",
    "asset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "extraGas": false,
    "amount": "1000000000000000000",
    "signedRelayerCommitment": "0x..."
  }
}
```

**Schema notes:**
- `scope`: decimal bigint string (not hex)
- `publicSignals`: must be exactly 8 elements (string array)
- `proof.pi_a` / `pi_c`: 3-element string tuples; `proof.pi_b`: 3×2-element string tuples
- `feeCommitment` is optional, but when present ALL 6 fields are required: `expiration`, `withdrawalData`, `asset`, `extraGas`, `amount`, `signedRelayerCommitment`
- The `feeCommitment` fields come directly from the `/relayer/quote` response — pass them through unchanged

Example response:

```json
{
  "success": true,
  "txHash": "0x...",
  "timestamp": 1744676669549,
  "requestId": "uuid"
}
```

Example `GET /relayer/details?chainId=11155111&assetAddress=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` response:

```json
{
  "chainId": 11155111,
  "feeBPS": "10",
  "minWithdrawAmount": "100",
  "feeReceiverAddress": "0x349746Ab142B5d0D65899d9bcB6f2Cd53AB084d8",
  "assetAddress": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "maxGasPrice": "10000000000000"
}
```

### Reading the label and committed value from deposit events

The `label` and `value` (post-fee committed amount) are generated on-chain during deposit. You must read them from the `Deposited` event emitted by the pool contract.

**Option A: From the transaction receipt (viem)**

```typescript
import { decodeEventLog, parseAbi } from "viem";

// Note: the 5th arg is named _precommitmentHash in the contract (IPrivacyPool.sol).
// The SDK's DataService internally parses it as _merkleRoot — this is a naming mismatch
// in the SDK, but the value is the same. Use the contract name when decoding manually.
const depositedEvent = parseAbi([
  "event Deposited(address indexed _depositor, uint256 _commitment, uint256 _label, uint256 _value, uint256 _precommitmentHash)"
]);

const receipt = await publicClient.getTransactionReceipt({ hash: tx.hash });
for (const log of receipt.logs) {
  try {
    const decoded = decodeEventLog({ abi: depositedEvent, data: log.data, topics: log.topics });
    const label = decoded.args._label;              // bigint
    const committedValue = decoded.args._value;      // bigint (post-fee amount)
    break;
  } catch { /* not this event */ }
}
```

**Option B: From DataService (simpler, fetches all deposits)**

```typescript
const deposits = await dataService.getDeposits(pool);
const myDeposit = deposits.find(d => d.transactionHash === tx.hash);
if (!myDeposit) throw new Error("Deposit not found — tx may not be indexed yet");
const label = myDeposit.label;              // bigint
const committedValue = myDeposit.value;     // bigint (post-fee amount)
```

### Recovering deposits from a mnemonic

To find which deposits belong to a given mnemonic, compute the expected precommitment hash for each sequential deposit index and match it against on-chain deposit events:

```typescript
const masterKeys = generateMasterKeys(mnemonic);
const scope = await contracts.getScope(privacyPoolAddress) as unknown as Hash;
const allDeposits = await dataService.getDeposits(pool);

const myDeposits = [];
let consecutiveMisses = 0;
const MAX_CONSECUTIVE_MISSES = 10; // tolerate gaps from failed txs (matches SDK behavior)
for (let i = 0n; ; i++) {
  const { nullifier, secret } = generateDepositSecrets(masterKeys, scope, i);
  const precommitment = hashPrecommitment(nullifier, secret);
  const match = allDeposits.find(d => d.precommitment === precommitment);
  if (!match) {
    consecutiveMisses++;
    if (consecutiveMisses >= MAX_CONSECUTIVE_MISSES) break;
    continue;
  }
  consecutiveMisses = 0;
  myDeposits.push({ ...match, nullifier, secret, index: i });
}
// myDeposits now contains all your deposits with their secrets for withdrawal/ragequit
```

## Contract Read Methods

`ContractInteractionsService` (returned by `sdk.createContractInstance()`) provides these read methods:

| Method | Returns | Description |
|--------|---------|-------------|
| `getScope(poolAddress)` | `bigint` | Pool's unique scope identifier |
| `getStateRoot(poolAddress)` | `bigint` | **⚠️ Known SDK bug:** This method calls `latestRoot` (an Entrypoint-only function) at the pool address instead of the pool's `currentRoot`. It will return incorrect data or revert. **Do not use.** Read `currentRoot()` directly from the pool contract using viem's `readContract` (see Step 4 workaround in the Withdrawal section). |
| `getStateSize(poolAddress)` | `bigint` | Current number of leaves in the state tree |
| `getAssetConfig(assetAddress)` | `AssetConfig` | Pool address, minimum deposit, fee config |
| `getScopeData(scope)` | `{ poolAddress, assetAddress }` | Reverse lookup: scope → pool + asset addresses |

## Contract Write Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `depositETH(amount, precommitment)` | `bigint, bigint` | Deposit ETH into the pool |
| `depositERC20(tokenAddress, amount, precommitment)` | `Address, bigint, bigint` | Deposit ERC20 tokens |
| `approveERC20(spenderAddress, tokenAddress, amount)` | `Address, Address, bigint` | Approve ERC20 spending (call before depositERC20) |
| `withdraw(withdrawal, proof, scope)` | `Withdrawal, WithdrawalProof, Hash` | Direct withdrawal |
| `relay(withdrawal, proof, scope)` | `Withdrawal, WithdrawalProof, Hash` | Relayed withdrawal via entrypoint |
| `ragequit(commitmentProof, poolAddress)` | `CommitmentProof, Address` | Emergency public exit |

All write methods return `Promise<{ hash: string; wait: () => Promise<void> }>`. The `hash` is a hex tx hash string (e.g. `"0xabc..."`).

## Proof Verification (off-chain)

`PrivacyPoolSDK` provides methods to verify proofs locally before submitting on-chain:

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `sdk.verifyCommitment(proof)` | `CommitmentProof` | `Promise<boolean>` | Verify a commitment proof locally |
| `sdk.verifyWithdrawal(proof)` | `WithdrawalProof` | `Promise<boolean>` | Verify a withdrawal proof locally |

## Supported Networks

| Network | Chain ID | viem import | Entrypoint (Proxy) | `startBlock` |
|---------|----------|-------------|-------------------|-------------|
| Ethereum Mainnet | 1 | `import { mainnet } from "viem/chains"` | `0x6818809eefce719e480a7526d76bd3e561526b46` | `22153709n` |
| Arbitrum | 42161 | `import { arbitrum } from "viem/chains"` | `0x44192215fed782896be2ce24e0bfbf0bf825d15e` | `404391804n` |
| OP Mainnet | 10 | `import { optimism } from "viem/chains"` | `0x44192215fed782896be2ce24e0bfbf0bf825d15e` | `144288141n` |

Privacy Pools is also deployed on Starknet, but as of February 9, 2026 Starknet is **not supported by this SDK** (`@0xbow/privacy-pools-core-sdk`). Starknet integration requires a separate SDK (not viem-based). Engineering has indicated a public Starknet SDK is planned but not yet released.

Full pool addresses and asset addresses: https://docs.privacypools.com/deployments

## Architecture

- **Entrypoint Contract**: Single entry point per network. Routes deposits and relayed withdrawals to the correct pool. You initialize the SDK with this address.
- **PrivacyPool Contracts**: One per asset (ETH, USDC, etc.). Hold funds, manage state tree, generate labels, enforce nullifier checks. Each pool has a unique `scope` identifier. Use `getAssetConfig(assetAddress)` to find the pool for a given token, or `getScopeData(scope)` to go from scope to pool address.
- **Commitment Circuit**: Computes commitment and nullifier hashes from deposit inputs.
- **Withdrawal Circuit**: Proves commitment ownership and ASP set membership privately.
- **LeanIMT**: Lean Incremental Merkle Tree for efficient on-chain state and membership proofs.
- **ASP (Association Set Provider)**: Operated by 0xbow. Screens deposits for compliance and publishes Merkle roots of approved labels for private withdrawals.

## Key Types

```typescript
type Hash = bigint;    // Branded bigint for commitment/Merkle hashes (TypeScript: `bigint & { __brand }`)
type Secret = bigint;  // Branded bigint for nullifier/secret values (TypeScript: `bigint & { __brand }`)
// Note: Hash and Secret are branded types. SDK functions return properly branded values,
// but if you construct a raw bigint (e.g. from readContract), cast it: `value as unknown as Hash`.

interface MasterKeys { masterNullifier: Secret; masterSecret: Secret }

interface Commitment {
  hash: Hash;
  nullifierHash: Hash;
  preimage: {
    value: bigint;
    label: bigint;
    precommitment: { hash: Hash; nullifier: Secret; secret: Secret };
  };
}

interface CommitmentProof { proof: Groth16Proof; publicSignals: PublicSignals }
interface WithdrawalProof { proof: Groth16Proof; publicSignals: PublicSignals }
interface Withdrawal { processooor: Address; data: Hex }

interface PoolInfo { chainId: number; address: Hex; scope: Hash; deploymentBlock: bigint }
// vettingFeeBPS: deposit fee in basis points, deducted on deposit (100 = 1%).
//   Committed value = amount - (amount * vettingFeeBPS / 10000).
// maxRelayFeeBPS: maximum relayer fee for relayed withdrawals.
interface AssetConfig { pool: Address; minimumDepositAmount: bigint; vettingFeeBPS: bigint; maxRelayFeeBPS: bigint }

// Event types returned by DataService
interface DepositEvent {
  depositor: string;       // depositor address (lowercase)
  commitment: Hash;        // the on-chain commitment hash
  label: Hash;             // the on-chain generated label
  value: bigint;           // deposited amount
  precommitment: Hash;     // precommitment hash (matches hashPrecommitment output)
  blockNumber: bigint;
  transactionHash: Hex;
}

interface WithdrawalEvent {
  withdrawn: bigint;           // amount withdrawn
  spentNullifier: Hash;        // nullifier of the spent commitment
  newCommitment: Hash;         // change commitment hash (remaining balance)
  blockNumber: bigint;
  transactionHash: Hex;
}

interface RagequitEvent {
  ragequitter: string;         // ragequitter address (lowercase)
  commitment: Hash;            // the commitment being exited
  label: Hash;                 // the commitment's label
  value: bigint;               // amount recovered
  blockNumber: bigint;
  transactionHash: Hex;
}
```

**Linking deposits to withdrawals:** These three values are related but **not identical**:
- `DepositEvent.precommitment` = `Commitment.nullifierHash` = `Poseidon(nullifier, secret)` — the precommitment hash submitted on-chain during deposit.
- `WithdrawalEvent.spentNullifier` = `Poseidon(nullifier)` — the circuit's nullifier hash (single input, NOT the precommitment).

To match a withdrawal to its source deposit, compute `Poseidon(nullifier)` from the deposit's nullifier and compare: `withdrawalEvent.spentNullifier === poseidon([commitment.preimage.precommitment.nullifier])`. You cannot match directly against `depositEvent.precommitment` because they are different hashes.

## Error Handling

The SDK uses typed errors for proof and data operations, but contract write methods throw generic `Error`:

| Error Class | When | Common Codes |
|-------------|------|-------------|
| `ProofError` | Proof generation or verification fails | `PROOF_GENERATION_FAILED`, `PROOF_VERIFICATION_FAILED`, `INVALID_PROOF` |
| `SDKError` | Base class; DataService failures, Merkle errors | `NETWORK_ERROR`, `MERKLE_ERROR`, `INVALID_INPUT` |
| `Error` (generic) | Contract write methods (`deposit`, `withdraw`, `ragequit`, etc.) | N/A — wraps the underlying viem/RPC error message |

Common failure modes:
- **`MERKLE_ERROR`**: Leaf not found in tree — your commitment isn't in the provided leaf set (wrong pool, stale data, or commitment not yet indexed).
- **`PROOF_GENERATION_FAILED`**: Circuit inputs are invalid — check that value, label, nullifier, and secret match the original deposit.
- **Contract reverts**: On-chain tx revert — typically a spent nullifier (double-withdraw attempt) or invalid proof. Contract write methods throw generic `Error` with a message like `"Failed to Withdraw: ..."`.

```typescript
try {
  const proof = await sdk.proveWithdrawal(commitment, input);
  const tx = await contracts.withdraw(withdrawal, proof, scope);
  await tx.wait();
} catch (error) {
  if (error instanceof ProofError) {
    // Bad circuit inputs — check commitment secrets match deposit
  } else if (error instanceof SDKError) {
    // DataService failures, Merkle errors, etc.
  } else {
    // On-chain revert or unknown error
  }
}
```

## Key Constraints

- Withdrawals require inclusion in the ASP-approved set. Most deposits are approved within 1 hour; some may take up to 7 days. Until approved, the only exit path is ragequit.
- **Root freshness**: The contract accepts any of the last 64 state roots (historical buffer), so a slight delay between building your state tree and submitting is fine. However, the ASP root must match the **latest** ASP root exactly — if the ASP publishes a new root between proof generation and submission, the withdrawal will revert with `IncorrectASPRoot`. Fetch the ASP root as close to submission time as possible.
- Ragequit is always available as a public fallback path. It works on both original deposits and change commitments (from partial withdrawals), but can only be called by the original depositor address (`OnlyOriginalDepositor` revert otherwise).
- Partial withdrawals are supported — `withdrawalAmount` can be less than the committed value. After a partial withdrawal, the old commitment is spent and a new "change commitment" is inserted into the state tree with the remaining balance. To continue withdrawing from the change commitment, reconstruct it: `const changeCommitment = getCommitment(existingValue - withdrawalAmount, label, newNullifier, newSecret)`. The `label` stays the same as the original deposit. **Important:** `withdrawalIndex` is a global counter across all withdrawals sharing the same label — it does NOT reset for each change commitment. If your first withdrawal used index 0n, the next withdrawal (from the resulting change commitment) must use index 1n, then 2n, etc.
- Full withdrawals (entire balance) still create a zero-value change commitment on-chain (it is inserted into the state tree), but it is not spendable. The SDK's account tracking automatically filters out zero-value commitments.
- Both ETH and ERC20 pools are supported (use different deposit methods).
- Protocol is non-custodial: users must store commitment secrets, labels, and master keys safely.
- The `label` is generated on-chain during deposit — it is NOT a user-provided input.

## Repository

https://github.com/0xbow-io/privacy-pools-core

Monorepo packages:

- `packages/circuits` — ZK circuits (commitment + withdrawal)
- `packages/contracts` — Solidity smart contracts (Entrypoint, PrivacyPool, State, verifiers)
- `packages/relayer` — Withdrawal relayer service
- `packages/sdk` — TypeScript SDK (`@0xbow/privacy-pools-core-sdk`)
- `docs` — Docusaurus documentation site

## Further Reading

- Full docs: https://docs.privacypools.com
- LLM full index: https://docs.privacypools.com/llms-full.txt
- Contracts reference: https://docs.privacypools.com/reference/contracts
- Circuits reference: https://docs.privacypools.com/reference/circuits
- SDK reference: https://docs.privacypools.com/reference/sdk
