import { Address, getAddress, Hex } from "viem";

// // mainnet
// export const ENTRYPOINT_ADDRESS: Address = "0x6818809EefCe719E480a7526D76bD3e561526b46";

// sepolia (localnet)
export const ENTRYPOINT_ADDRESS: Address = "0x1fF2EA3C98E22d5589d66829a1599cB74b566E94";


export const LOCAL_ANVIL_RPC = "http://127.0.0.1:8545";

// export const PRIVATE_KEY: Hex = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const PRIVATE_KEY: Hex = "0xa278275fee36ebb6f4689e79bf1a8b4650c9aec0fc39e03c111461e5b08730eb";  // 0xb9edc9DD585C13891F5B2dE85f182d3Ea4AaEa09

export const processooor = ENTRYPOINT_ADDRESS;
export const feeRecipient = getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
export const recipient = getAddress("0xabA6aeB1bCFF1096f4b8148085C4231FED9FE8E4");

