import { Account, createPublicClient, defineChain, getContract, GetContractReturnType, http, parseAbi, PublicClient } from "viem";
import { localhost } from "viem/chains";
import { abi as EntrypointAbi } from "./abis/Entrypoint.abi.js";
import { abi as PoolAbi } from "./abis/Pool.abi.js";
import { abi as Erc20Abi } from "./abis/ERC20.abi.js";
import { ENTRYPOINT_ADDRESS, LOCAL_ANVIL_RPC } from "./constants.js";
import { privateKeyToAccount } from "viem/accounts";

const anvil_id = 31337;
const sepolia_id = 11155111;
const main = 1;

export interface IChainContext {
  account: Account,
  chain: ReturnType<typeof defineChain>;
  client: PublicClient;
  entrypoint: GetContractReturnType<typeof EntrypointAbi, PublicClient, `0x${string}`>,
  getPoolContract: (asset: `0x${string}`) => Promise<GetContractReturnType<typeof PoolAbi, PublicClient, `0x${string}`>>;
  getErc20Contract: (asset: `0x${string}`) => GetContractReturnType<typeof Erc20Abi, PublicClient, `0x${string}`>;
}

export function ChainContext(chainId: number, privateKey: `0x${string}`): IChainContext {

  const anvilChain = defineChain({ ...localhost, id: chainId });

  const publicClient = createPublicClient({
    chain: anvilChain,
    transport: http(LOCAL_ANVIL_RPC),
  });

  const entrypoint = getContract({
    address: ENTRYPOINT_ADDRESS,
    abi: EntrypointAbi,
    client: publicClient,
  });

  async function getPoolContract(asset: `0x${string}`) {
    const [
      poolAddress,
      _minimumDepositAmount,
      _vettingFeeBPS,
      _maxRelayFeeBPS
    ] = await entrypoint.read.assetConfig([asset]);
    return getContract({
      address: poolAddress,
      abi: PoolAbi,
      client: publicClient,
    });
  }

  function getErc20Contract(asset: `0x${string}`) {
    return getContract({
      address: asset,
      client: publicClient,
      abi: Erc20Abi
    });
  }

  return {
    account: privateKeyToAccount(privateKey),
    chain: anvilChain,
    client: publicClient,
    entrypoint,
    getPoolContract,
    getErc20Contract
  };

}

