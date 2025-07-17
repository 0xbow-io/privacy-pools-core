import { createPublicClient, defineChain, getContract, http, parseAbi } from "viem";
import { localhost } from "viem/chains";
import { ETH_POOL_ADDRESS, LOCAL_ANVIL_RPC } from "./constants.js";

export const anvilChain = defineChain({ ...localhost, id: 31337 });

export const publicClient = createPublicClient({
  chain: anvilChain,
  transport: http(LOCAL_ANVIL_RPC),
});

export const pool = getContract({
  address: ETH_POOL_ADDRESS,
  abi: parseAbi(["function SCOPE() view returns (uint256)"]),
  client: publicClient,
})
