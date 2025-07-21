import { Token, WETH9 } from "@uniswap/sdk-core";
import { encodeRouteToPath, FeeAmount, Pool, Route as V3Route } from '@uniswap/v3-sdk';
import { getAddress, getContract, toHex } from "viem";

import { getV3Factory } from "./constants.js";
import { web3Provider } from "../index.js";
import { v3PoolABI } from "./abis/v3pool.abi.js";


function sortTokens(tokenA: Token, tokenB: Token): [Token, Token] {
  return tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];
}

export async function getPool(chainId: number, tokenA: Token, tokenB: Token, fee: FeeAmount) {

  const V3_FACTORY = getV3Factory(chainId);

  const [token0, token1] = sortTokens(tokenA, tokenB);
  const poolAddress = Pool.getAddress(token0, token1, fee, undefined, V3_FACTORY);

  const poolContract = getContract({
    abi: v3PoolABI,
    address: getAddress(poolAddress),
    client: web3Provider.client(chainId),
  });

  const [liquidity, slot0] = await Promise.all([
    poolContract.read.liquidity(),
    poolContract.read.slot0(),
  ]);

  const [sqrtPriceX96, tick, , , , ,] = slot0;

  const pool = new Pool(token0, token1, fee, toHex(sqrtPriceX96), toHex(liquidity), tick);

  return pool;
}

export async function getPoolPath(tokenIn: `0x${string}`, chainId: number) {
  const weth = WETH9[chainId]!;
  const TokenIn = new Token(chainId, tokenIn, 1);
  const pool = await getPool(chainId, TokenIn, weth, FeeAmount.LOW); // 0.05% fee tier
  const route = new V3Route([pool], TokenIn, weth);
  const pathParams = encodeRouteToPath(route, false) as `0x${string}`;
  return pathParams;
}

export function hopsFromAddressRoute(route: `0x${string}`[]) {
  const hops: [`0x${string}`, `0x${string}`][] = [];
  for (let i = 1; i <= route.length - 1; i++) {
    hops.push([route[i - 1]!, route[i]!]);
  }
  return hops;
}

function isAddress(p: `0x${string}` | FeeAmount): p is `0x${string}` {
  return (p as `0x${string}`).length !== undefined;
}

export function encodePath(path: (`0x${string}` | FeeAmount)[]): `0x${string}` {
  // Encode the path for quoteExactInput
  // Path encoding: token0 (20 bytes) + fee0 (3 bytes) + token1 (20 bytes) + fee1 (3 bytes) + token2 (20 bytes)...
  let encodedPath: `0x${string}` = '0x';
  path.forEach(p => {
    // is address
    if (isAddress(p)) {
      encodedPath += p.replace(/^0x/, ""); // Remove '0x' prefix
      // is number
    } else {
      encodedPath += p.toString(16).padStart(6, '0');
    }
  });
  return encodedPath
}
