import { QUOTER_ADDRESSES, V3_CORE_FACTORY_ADDRESSES } from "@uniswap/sdk-core";
import { UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from "@uniswap/universal-router-sdk";
import { FeeAmount } from "@uniswap/v3-sdk";
import { Address, getAddress } from "viem";

export { WETH9 as WRAPPED_NATIVE_TOKEN_ADDRESS } from "@uniswap/sdk-core";

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export function permit2Address(chainId?: number): `0x${string}` {
  switch (chainId) {
    case 324:
      return '0x0000000000225e31D15943971F47aD3022F714Fa'
    default:
      return PERMIT2_ADDRESS
  }
}

/**
* Mainnet (1), Polygon (137), Optimism (10), Arbitrum (42161), Testnets Address (11155111)
* source: https://github.com/Uniswap/v3-periphery/blob/main/deploys.md
*/

// export const QUOTER_CONTRACT_ADDRESS: Record<string, Address> = {
//   "1": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",         // Ethereum
//   "137": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",       // polygon
//   "10": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",        // Optimism
//   "42161": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",     // Arbitrum
//   "11155111": "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",  // Sepolia
// };

export const FACTORY_CONTRACT_ADDRESS: Record<string, Address> = {
  "1": "0x1F98431c8aD98523631AE4a59f267346ea31F984",         // Ethereum
  "137": "0x1F98431c8aD98523631AE4a59f267346ea31F984",       // polygon
  "10": "0x1F98431c8aD98523631AE4a59f267346ea31F984",        // Optimism
  "42161": "0x1F98431c8aD98523631AE4a59f267346ea31F984",     // Arbitrum
  "11155111": "0x0227628f3f023bb0b980b67d528571c95c6dac1c",  // Sepolia
};

// Common intermediate tokens for multi-hop routing
export const INTERMEDIATE_TOKENS: Record<string, Address[]> = {
  '1': [ // Mainnet
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
  ],
  '11155111': [ // Sepolia
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC
    '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // USDT
  ],
};

export function getRouterAddress(chainId: number) {
  return getAddress(UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, chainId));
}

export function getPermit2Address(chainId: number) {
  return getAddress(permit2Address(chainId));
}

export function getV3Factory(chainId: number) {
  return getAddress(V3_CORE_FACTORY_ADDRESSES[chainId]!)
}

export function getQuoterAddress(chainId: number) {
  const mainnetQuoter = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
  return getAddress(chainId !== 1 ? QUOTER_ADDRESSES[chainId]! : mainnetQuoter)
}

export const FeeTiers: FeeAmount[] = [
  FeeAmount.LOWEST,
  FeeAmount.LOW_200,
  FeeAmount.LOW_300,
  FeeAmount.LOW_400,
  FeeAmount.LOW,
  FeeAmount.MEDIUM,
  FeeAmount.HIGH,
];
