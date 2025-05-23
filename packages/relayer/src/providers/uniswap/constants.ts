import { Address, getAddress } from "viem";
import { permit2Address } from "@uniswap/permit2-sdk";
import { V3_CORE_FACTORY_ADDRESSES, QUOTER_ADDRESSES } from "@uniswap/sdk-core";
import { UNIVERSAL_ROUTER_ADDRESS, UniversalRouterVersion } from "@uniswap/universal-router-sdk";

export { WETH9 as WRAPPED_NATIVE_TOKEN_ADDRESS } from "@uniswap/sdk-core";

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
}

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
  return getAddress(QUOTER_ADDRESSES[chainId]!)
}
