import { getAddress } from "viem";

export { RelayerConfig } from "./config.js";

export const FRAXUSD_ADDRESS = getAddress("0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29");  // FRAXUSD
export const WOETH_ADDRESS   = getAddress("0xDcEe70654261AF21C44c093C300eD3Bb97b78192");  // WOETH
export const EXCEPTION_TOKENS = [
  FRAXUSD_ADDRESS,
  WOETH_ADDRESS
];

export function isExceptionToken(asset: string): boolean {
  return EXCEPTION_TOKENS.includes(getAddress(asset));
}

// Re-export types
export * from "./types.js";
