import { Account, createPublicClient, defineChain, getContract, GetContractReturnType, http, PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";
import { abi as EntrypointAbi } from "./abis/Entrypoint.abi.js";
import { abi as Erc20Abi } from "./abis/ERC20.abi.js";
import { abi as PoolAbi } from "./abis/Pool.abi.js";
import { ENTRYPOINT_ADDRESS, LOCAL_ANVIL_RPC } from "./constants.js";

type PoolContract = GetContractReturnType<typeof PoolAbi, PublicClient, `0x${string}`>;

export interface IChainContext {
  account: Account,
  chain: ReturnType<typeof defineChain>;
  client: PublicClient;
  entrypoint: GetContractReturnType<typeof EntrypointAbi, PublicClient, `0x${string}`>,
  getPoolContract: (asset: `0x${string}`) => Promise<PoolContract>;
  getPoolContractByScope: (scope: bigint) => PoolContract;
  getErc20Contract: (asset: `0x${string}`) => GetContractReturnType<typeof Erc20Abi, PublicClient, `0x${string}`>;
}

export function ChainContext(chainId: number, privateKey: `0x${string}`): IChainContext {

  const _poolCacheByAsset: { [key: `0x${string}`]: PoolContract; } = {};
  const _poolCacheByScope: { [key: string]: PoolContract; } = {};

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
    const cachedPool = _poolCacheByAsset[asset];
    if (cachedPool !== undefined)
      return cachedPool;
    const [
      poolAddress,
      _minimumDepositAmount,  // eslint-disable-line @typescript-eslint/no-unused-vars
      _vettingFeeBPS,  // eslint-disable-line @typescript-eslint/no-unused-vars
      _maxRelayFeeBPS  // eslint-disable-line @typescript-eslint/no-unused-vars
    ] = await entrypoint.read.assetConfig([asset]);
    const pool = getContract({
      address: poolAddress,
      abi: PoolAbi,
      client: publicClient,
    });
    const scope = await pool.read.SCOPE();
    _poolCacheByAsset[asset] = pool;
    _poolCacheByScope[scope.toString()] = pool;
    return pool;
  }

  function getPoolContractByScope(scope: bigint) {
    const cachedPool = _poolCacheByScope[scope.toString()];
    if (cachedPool !== undefined)
      return cachedPool;
    throw Error("Pool is not instantiated")
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
    getErc20Contract,
    getPoolContractByScope
  };

}

