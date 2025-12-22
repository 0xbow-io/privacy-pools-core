import { getAddress } from "viem";

export { RelayerConfig } from "./config.js";

export const YUSND_ADDRESS   = getAddress("0x252b965400862d94bda35fecf7ee0f204a53cc36");  // yUSND
export const FRAXUSD_ADDRESS = getAddress("0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29");  // FRAXUSD
export const FXUSD_ADDRESS   = getAddress("0x085780639cc2cacd35e474e71f4d000e2405d8f6");  // fxUSD
export const WOETH_ADDRESS   = getAddress("0xDcEe70654261AF21C44c093C300eD3Bb97b78192");  // WOETH
export const EXCEPTION_TOKENS = [
  FRAXUSD_ADDRESS,
  FXUSD_ADDRESS,
  WOETH_ADDRESS,
];

export function isExceptionToken(asset: string): boolean {
  return EXCEPTION_TOKENS.includes(getAddress(asset));
}

// Re-export types
export * from "./types.js";
export * from "./schemas.js";
