import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Address, getContract } from 'viem';

import { RelayerError } from '../exceptions/base.exception.js';
import { web3Provider } from '../providers/index.js';
import { FACTORY_CONTRACT_ADDRESS, INTERMEDIATE_TOKENS, QUOTER_CONTRACT_ADDRESS, WRAPPED_NATIVE_TOKEN_ADDRESS } from './uniswap/constants.js';
import { IERC20MinimalABI } from './uniswap/erc20.abi.js';
import { FactoryABI } from './uniswap/factory.abi.js';
import { QuoterV2ABI } from './uniswap/quoterV2.abi.js';


function isNullAddress(a: string) {
  return a === '0x0000000000000000000000000000000000000000';
}

const feeTiers: FeeAmount[] = [
  FeeAmount.LOWEST,
  FeeAmount.LOW_200,
  FeeAmount.LOW_300,
  FeeAmount.LOW_400,
  FeeAmount.LOW,
  FeeAmount.MEDIUM,
  FeeAmount.HIGH,
];

export type UniswapQuote = {
  chainId: number;
  addressIn: string;
  addressOut: string;
  amountIn: bigint;
};

type QuoteToken = { amount: bigint, decimals: number; };
export type Quote = {
  in: QuoteToken;
  out: QuoteToken;
};

export class UniswapProvider {

  private getFactory(chainId: number) {
    const factoryAddress = FACTORY_CONTRACT_ADDRESS[chainId.toString()];
    if (!factoryAddress) {
      throw RelayerError.unknown(`No Uniswap V3 factory address configured for chain ${chainId}`);
    }
    return getContract({
      address: factoryAddress,
      abi: FactoryABI.abi,
      client: web3Provider.client(chainId)
    });
  }

  async getTokenInfo(chainId: number, address: Address): Promise<Token> {
    const contract = getContract({
      address,
      abi: IERC20MinimalABI.abi,
      client: web3Provider.client(chainId)
    });
    const [decimals, symbol] = await Promise.all([
      contract.read.decimals(),
      contract.read.symbol(),
    ]);
    return new Token(chainId, address, Number(decimals), symbol);
  }

  async quoteNativeToken(chainId: number, addressIn: Address, amountIn: bigint): Promise<Quote> {
    const addressOut = WRAPPED_NATIVE_TOKEN_ADDRESS[chainId.toString()]!;

    // First try direct quote
    try {
      return await this.quote({
        chainId,
        amountIn,
        addressOut,
        addressIn
      });
    } catch (directError) {

      // If direct quote fails, try multi-hop routing
      const intermediateTokens = INTERMEDIATE_TOKENS[chainId.toString()] || [];

      for (const intermediateToken of intermediateTokens) {

        // Skip if intermediate token is same as input or output
        if (intermediateToken.toLowerCase() === addressIn.toLowerCase() ||
          intermediateToken.toLowerCase() === addressOut.toLowerCase()) {
          continue;
        }

        try {
          return await this.quoteMultiHop({
            chainId,
            amountIn,
            path: [addressIn as Address, intermediateToken, addressOut]
          });
        } catch {
          continue;
        }

      }

      throw directError;
    }
  }

  async quote({ chainId, addressIn, addressOut, amountIn }: UniswapQuote): Promise<Quote> {
    const tokenIn = await this.getTokenInfo(chainId, addressIn as Address);
    const tokenOut = await this.getTokenInfo(chainId, addressOut as Address);
    const client = web3Provider.client(chainId);

    const quoterContract = getContract({
      address: QUOTER_CONTRACT_ADDRESS[chainId.toString()]!,
      abi: QuoterV2ABI.abi,
      client
    });

    const factoryContract = this.getFactory(chainId);

    for (const fee of feeTiers) {
      const pool = await factoryContract.read.getPool([
        addressIn as Address,
        addressOut as Address,
        fee,
      ]);

      // pool does not exist
      if (isNullAddress(pool)) {
        continue;
      }

      try {
        const quotedAmountOut = await quoterContract.simulate.quoteExactInputSingle([{
          tokenIn: tokenIn.address as Address,
          tokenOut: tokenOut.address as Address,
          fee,
          amountIn,
          sqrtPriceLimitX96: 0n,
        }]);

        const [amountOut] = quotedAmountOut.result;

        return {
          in: {
            amount: amountIn,
            decimals: tokenIn.decimals
          },
          out: {
            amount: amountOut,
            decimals: tokenOut.decimals
          }
        };
      } catch {
        continue; // try next fee
      }

    }

    throw RelayerError.unknown(
      `No usable Uniswap V3 pool found for pair ${tokenIn.symbol}/${tokenOut.symbol} on any known fee tier`
    );
  }

  async quoteMultiHop({ chainId, amountIn, path }: { chainId: number, amountIn: bigint, path: Address[]; }): Promise<Quote> {
    if (path.length < 2) {
      throw RelayerError.unknown('Path must contain at least 2 addresses');
    }

    const client = web3Provider.client(chainId);
    const quoterContract = getContract({
      address: QUOTER_CONTRACT_ADDRESS[chainId.toString()]!,
      abi: QuoterV2ABI.abi,
      client
    });

    // Get token info for input and output
    const [tokenIn, tokenOut] = await Promise.all([
      this.getTokenInfo(chainId, path[0]!),
      this.getTokenInfo(chainId, path[path.length - 1]!)
    ]);

    // For each hop, we need to find a valid pool and fee tier
    const pathWithFees: { token: Address, fee: FeeAmount; }[] = [];
    const hops: [`0x${string}`, `0x${string}`][] = [];
    for (let i = 1; i <= path.length - 1; i++) {
      hops.push([path[i - 1]!, path[i]!]);
    }

    for (const hop of hops) {
      const [tokenA, tokenB] = hop;
      const feePaths = await Promise.all(feeTiers.map(async fee => {
        const pool = await this.getPool(chainId, tokenA as Address, tokenB as Address, fee);
        if (isNullAddress(pool)) {
          return;
        } else {
          return { token: tokenA, fee };
        }
      }));
      const feePath = feePaths.find(o => o?.fee !== undefined);
      if (feePath === undefined) {
        throw RelayerError.unknown(
          `No pool found for hop: ${tokenA} -> ${tokenB}`
        );
      }
      pathWithFees.push(feePath);
    }
    pathWithFees.push({ token: path[path.length - 1] as Address, fee: FeeAmount.MEDIUM }); // fee doesn't matter for last token

    // Encode the path for quoteExactInput
    // Path encoding: token0 (20 bytes) + fee0 (3 bytes) + token1 (20 bytes) + fee1 (3 bytes) + token2 (20 bytes)...
    let encodedPath = '0x';
    pathWithFees.forEach((p, i) => {
      const { token, fee } = p;
      encodedPath += token.replace(/^0x/, ""); // Remove '0x' prefix
      if (i < pathWithFees.length - 1) {
        // Add fee as 3 bytes (24 bits)
        encodedPath += fee.toString(16).padStart(6, '0');
      }
    });

    try {
      const quotedAmount = await quoterContract.simulate.quoteExactInput([
        encodedPath as `0x${string}`,
        amountIn
      ]);

      const [amountOut] = quotedAmount.result;

      return {
        in: {
          amount: amountIn,
          decimals: tokenIn.decimals
        },
        out: {
          amount: amountOut,
          decimals: tokenOut.decimals
        }
      };
    } catch {
      throw RelayerError.unknown(
        `Failed to get multi-hop quote for path: ${path.join(' -> ')}`
      );
    }
  }

  private async getPool(chainId: number, tokenA: Address, tokenB: Address, fee: FeeAmount): Promise<Address> {
    return await this.getFactory(chainId).read.getPool([tokenA, tokenB, fee]);
  }

}
