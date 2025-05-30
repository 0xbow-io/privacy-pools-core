import { createPublicClient, defineChain, getContract, http, parseAbi } from "viem";
import { localhost } from "viem/chains";
import { ENTRYPOINT_ADDRESS, LOCAL_ANVIL_RPC } from "./constants.js";

const anvil_id = 31337;
const sepolia_id = 11155111;
const main = 1;

export const anvilChain = defineChain({ ...localhost, id: main });

export const publicClient = createPublicClient({
  chain: anvilChain,
  transport: http(LOCAL_ANVIL_RPC),
});

export const entrypoint = getContract({
  address: ENTRYPOINT_ADDRESS,
  abi: [{
    "type": "function",
    "name": "assetConfig",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "outputs": [
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_minimumDepositAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_vettingFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  }],
  client: publicClient,
});


export async function getPoolContract(asset: `0x${string}`) {
  const [
    poolAddress,
    _minimumDepositAmount,
    _vettingFeeBPS,
    _maxRelayFeeBPS
  ] = await entrypoint.read.assetConfig([asset]);
  return getContract({
    address: poolAddress,
    abi: parseAbi(["function SCOPE() view returns (uint256)"]),
    client: publicClient,
  });
}
