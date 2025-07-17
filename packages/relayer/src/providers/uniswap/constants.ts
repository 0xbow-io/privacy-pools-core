import { Address } from "viem";

/**
* Mainnet, Polygon, Optimism, Arbitrum, Testnets Address
* source: https://github.com/Uniswap/v3-periphery/blob/main/deploys.md
*/
export const QUOTER_CONTRACT_ADDRESS: Record<string, Address> = {
  "1": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",         // Ethereum
  "137": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",       // polygon
  "10": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",        // Optimism
  "42161": "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",     // Arbitrum
  "11155111": "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3",  // Sepolia
};

export const FACTORY_CONTRACT_ADDRESS: Record<string, Address> = {
  "1": "0x1F98431c8aD98523631AE4a59f267346ea31F984",         // Ethereum
  "137": "0x1F98431c8aD98523631AE4a59f267346ea31F984",       // polygon
  "10": "0x1F98431c8aD98523631AE4a59f267346ea31F984",        // Optimism
  "42161": "0x1F98431c8aD98523631AE4a59f267346ea31F984",     // Arbitrum
  "11155111": "0x0227628f3f023bb0b980b67d528571c95c6dac1c",  // Sepolia
}

export const WRAPPED_NATIVE_TOKEN_ADDRESS: Record<string, Address> = {
  "1": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",         // mainnet (WETH)
  "137": "0x0000000000000000000000000000000000001010",       // polygon (POL)
  // "137": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // (WPOL) TODO: compare which token to use
  "10": "0x4200000000000000000000000000000000000006",        // Optimism (WETH)
  "42161": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",     // Arbitrum (WETH)
  "11155111": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",  // sepolia (WETH)
}
