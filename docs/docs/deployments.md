---
title: Deployments
description: "Canonical deployment addresses for Privacy Pools contracts across supported networks."
keywords:
  - privacy pools
  - deployments
  - contract addresses
  - mainnet
  - arbitrum
  - optimism
  - op sepolia
  - sepolia
  - testnet
  - starknet
  - l2
  - entrypoint
  - verifiers
---

This section contains the addresses of deployed Privacy Pools contracts across various networks.

## Ethereum Mainnet (Chain ID: 1)

### Core Contracts

| Contract | Address | Deployment Block |
|----------|---------|-----------------|
| WithdrawalVerifier | `0x022891f938ae7fdc8ab9ead0fbf50aba8c897d6d` | `22153709` |
| RagequitVerifier | `0xa45aca8604a73d80c551faad6355a5c3a5565ec6` | `22153710` |
| Entrypoint (Implementation) | `0xdd8aa0560a08e39c0b3a84bba356bc025afbd4c1` | `22153711` |
| Entrypoint (Proxy) | `0x6818809eefce719e480a7526d76bd3e561526b46` | `22153713` |

### Pool Contracts

| Asset | Contract Type | Pool Address | Asset Address | Deployment Block |
|-------|---------------|-------------|---------------|-----------------|
| ETH | PrivacyPoolSimple | `0xf241d57c6debae225c0f2e6ea1529373c9a9c9fb` | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | `22153714` |
| USDS | PrivacyPoolComplex | `0x05e4dbd71b56861eed2aaa12d00a797f04b5d3c0` | `0xdc035d45d973e3ec169d2276ddab16f1e407384f` | `22917987` |
| sUSDS | PrivacyPoolComplex | `0xbbda2173cdfea1c3bd7f2908798f1265301d750c` | `0xa3931d71877c0e7a3148cb7eb4463524fec27fbd` | `22941225` |
| DAI | PrivacyPoolComplex | `0x1c31c03b8cb2ee674d0f11de77135536db828257` | `0x6b175474e89094c44da98b954eedeac495271d0f` | `22946646` |
| USDT | PrivacyPoolComplex | `0xe859c0bd25f260baee534fb52e307d3b64d24572` | `0xdac17f958d2ee523a2206206994597c13d831ec7` | `22988421` |
| USDC | PrivacyPoolComplex | `0xb419c2867ab3cbc78921660cb95150d95a94ce86` | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `22988431` |
| wstETH | PrivacyPoolComplex | `0x1a604e9dfa0efdc7ffda378af16cb81243b61633` | `0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0` | `23039970` |
| wBTC | PrivacyPoolComplex | `0xf973f4b180a568157cd7a0e6006449139e6bfc32` | `0x2260fac5e5542a773aa44fbcfedf7c193bc2c599` | `23039980` |
| USDe | PrivacyPoolComplex | `0xe6d36b33b00a7c0cb0c2a8d39d07e7db0c526abc` | `0x4c9edd5852cd905f086c759e8383e09bff1e68b3` | `23090290` |
| USD1 | PrivacyPoolComplex | `0xc0a8bc0f4f982b4d4f1ffae8f4fccb58c9b29c98` | `0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d` | `23090298` |
| frxUSD | PrivacyPoolComplex | `0xc6c769fac7aabeadd31a03fae5ca0ec5b4c50f84` | `0xcacd6fd266af91b8aed52accc382b4e165586e29` | `23090335` |
| WOETH | PrivacyPoolComplex | `0x7d2959bcfb936a84531518e8391ddba844e03ebe` | `0xdcee70654261af21c44c093c300ed3bb97b78192` | `23239091` |
| fxUSD | PrivacyPoolComplex | `0xd14f4b36e1d1d98c218db782c49149876042bc56` | `0x085780639cc2cacd35e474e71f4d000e2405d8f6` | `23988640` |
| BOLD | PrivacyPoolComplex | `0xb4b5fd38fd4788071d7287e3cb52948e0d10b23e` | `0x6440f144b7e50d6a8439336510312d2f54beb01d` | `24433029` |

### Deployment Start Block

Use **`22153709n`** as `startBlock` when initializing `DataService` for Ethereum Mainnet. This is the earliest deployment block (WithdrawalVerifier) and ensures all pool events are captured.

## Arbitrum (Chain ID: 42161)

### Core Contracts

| Contract | Address | Deployment Block |
|----------|---------|-----------------|
| WithdrawalVerifier | `0x022891f938ae7fdc8ab9ead0fbf50aba8c897d6d` | `404391795` |
| RagequitVerifier | `0xa45aca8604a73d80c551faad6355a5c3a5565ec6` | `404391799` |
| Entrypoint (Implementation) | `0x1cabfda9a9c14d16302dd7c8f4b6e2a57aa7b364` | `404391804` |
| Entrypoint (Proxy) | `0x44192215fed782896be2ce24e0bfbf0bf825d15e` | `404391809` |

### Pool Contracts

| Asset | Contract Type | Pool Address | Asset Address | Deployment Block |
|-------|---------------|-------------|---------------|-----------------|
| ETH | PrivacyPoolSimple | `0x4626a182030d9e98b13f690fff3c443191a918ff` | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | `404391814` |
| USDC | PrivacyPoolComplex | `0x3706e38af05bf0158bcdbb46239f8289980b093f` | `0xaf88d065e77c8cc2239327c5edb3a432268e5831` | `411197154` |
| yUSND | PrivacyPoolComplex | `0xa63e0bdc3a193d1e6e7c9be72cb502be4b7fc244` | `0x252b965400862d94bda35fecf7ee0f204a53cc36` | `411197625` |

### Deployment Start Block

Use **`404391795n`** as `startBlock` when initializing `DataService` for Arbitrum. This is the earliest deployment block (WithdrawalVerifier) and ensures all pool events are captured.

## OP Mainnet (Chain ID: 10)

### Core Contracts

| Contract | Address | Deployment Block |
|----------|---------|-----------------|
| WithdrawalVerifier | `0x022891f938ae7fdc8ab9ead0fbf50aba8c897d6d` | `144288139` |
| RagequitVerifier | `0xa45aca8604a73d80c551faad6355a5c3a5565ec6` | `144288140` |
| Entrypoint (Implementation) | `0x1cabfda9a9c14d16302dd7c8f4b6e2a57aa7b364` | `144288141` |
| Entrypoint (Proxy) | `0x44192215fed782896be2ce24e0bfbf0bf825d15e` | `144288142` |

### Pool Contracts

| Asset | Contract Type | Pool Address | Asset Address | Deployment Block |
|-------|---------------|-------------|---------------|-----------------|
| ETH | PrivacyPoolSimple | `0x4626a182030d9e98b13f690fff3c443191a918ff` | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | `144288143` |
| USDC | PrivacyPoolComplex | `0xe4410f6827fa04ce096975d07a9924abb65316e3` | `0x0b2c639c533813f4aa9d7837caf62653d097ff85` | `145160973` |

### Deployment Start Block

Use **`144288139n`** as `startBlock` when initializing `DataService` for OP Mainnet. This is the earliest deployment block (WithdrawalVerifier) and ensures all pool events are captured.

## OP Sepolia (Chain ID: 11155420)

### Core Contracts

| Contract | Address | Deployment Block |
|----------|---------|-----------------|
| WithdrawalVerifier | `0x23ee06ec2b5a6fcd00a426973d27cd168c7eb00d` | `32854673` |
| RagequitVerifier | `0x6b54109d73891163fd3362241182a127482dd87d` | `32854675` |
| Entrypoint (Implementation) | `0x3a8ce23ed895eb9d7a714667573cb86513447109` | `32854676` |
| Entrypoint (Proxy) | `0x54aca0d27500669fa37867233e05423701f11ba1` | `32854677` |

### Pool Contracts

| Asset | Contract Type | Pool Address | Asset Address | Deployment Block |
|-------|---------------|-------------|---------------|-----------------|
| ETH | PrivacyPoolSimple | `0x9fa2c482313b75e5bc2297cc0d666ddec19d641e` | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | `32854678` |
| WETH | PrivacyPoolComplex | `0x6d79e6062c193f6ac31ca06d98d86dc370eedda6` | `0x4200000000000000000000000000000000000006` | `32900681` |

### Deployment Start Block

Use **`32854673n`** as `startBlock` when initializing `DataService` for OP Sepolia. This is the earliest deployment block (WithdrawalVerifier) and ensures all pool events are captured.

## Sepolia Testnet (Chain ID: 11155111)

### Core Contracts

| Contract | Address | Deployment Block |
|----------|---------|-----------------|
| WithdrawalVerifier | `0x822f33ed5ac1d33ceed4eec60a99b06e5053a00a` | `8461450` |
| RagequitVerifier | `0xb4b9ce9aebd6a2c82a7ba5b64e33cc7fb6ec1b60` | `8461451` |
| Entrypoint (Implementation) | `0x457f219308fd4f06ffb39dc7b532a51b1580f58b` | `8461452` |
| Entrypoint (Proxy) | `0x34a2068192b1297f2a7f85d7d8cde66f8f0921cb` | `8461453` |

### Pool Contracts

| Asset | Contract Type | Pool Address | Asset Address | Deployment Block |
|-------|---------------|-------------|---------------|-----------------|
| ETH | PrivacyPoolSimple | `0x644d5a2554d36e27509254f32ccfebe8cd58861f` | `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` | `8461454` |
| USDT | PrivacyPoolComplex | `0x6709277e170dee3e54101cdb73a450e392adff54` | `0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0` | `8587114` |
| USDC | PrivacyPoolComplex | `0x0b062fe33c4f1592d8ea63f9a0177fca44374c0f` | `0x1c7d4b196cb0c7b01d743fbc6116a902379c7238` | `8587064` |

### Deployment Start Block

Use **`8461450n`** as `startBlock` when initializing `DataService` for Sepolia. This is the earliest deployment block (WithdrawalVerifier) and ensures all pool events are captured.

## Starknet (Chain ID: SN_MAIN)

### Core Contracts

| Contract | Address |
|----------|---------|
| Entrypoint | `0x13a0314dd07c6639921bd0e7eb8c865b28b3c7a413238baf804de3464d428dd` |

### Pool Contracts

| Asset | Pool Address | Asset Address |
|-------|-------------|---------------|
| ETH | `0x1575a7d243bf929bea1eead2a33dfb25dad16df1af7a34f61caea22e4ec57fb` | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |
| USDC | `0x78d8a02f3a7073dfd6c7a4ea3e15ba217a3196ecf6487b09a03800d69092879` | `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` |
| STRK | `0x2f35b62fff4fbf6188c758e5e1f92d98193ea179d42142746101660168a1d13` | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |
