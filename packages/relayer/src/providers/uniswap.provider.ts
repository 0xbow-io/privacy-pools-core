import { Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
import { Address, getContract } from 'viem'

import { web3Provider } from '../providers/index.js'
import { RelayerError } from '../exceptions/base.exception.js'
import { QUOTER_CONTRACT_ADDRESS, WRAPPED_NATIVE_TOKEN_ADDRESS } from './uniswap/constants.js'
import { IERC20MinimalABI } from './uniswap/erc20.abi.js'
import { QuoterV2ABI } from './uniswap/quoterV2.abi.js'

export type UniswapQuote = {
  chainId: number;
  addressIn: string;
  addressOut: string;
  amountIn: bigint;
};

type QuoteToken = { amount: bigint, decimals: number }
export type Quote = {
  in: QuoteToken
  out: QuoteToken
};

const UNISWAP_V3_FACTORY_ADDRESS: Record<string, Address> = {
  '1': '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  '11155111': '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
};

// Common intermediate tokens for multi-hop routing
const INTERMEDIATE_TOKENS: Record<string, Address[]> = {
  '1': [ // Mainnet
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
    '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
  ],
  '11155111': [ // Sepolia
    '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC
    '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // USDT
  ],
};

export class UniswapProvider {

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

    const factoryAddress = UNISWAP_V3_FACTORY_ADDRESS[chainId.toString()];
    if (!factoryAddress) {
      throw RelayerError.unknown(`No Uniswap V3 factory address configured for chain ${chainId}`);
    }

    const factoryContract = getContract({
      address: factoryAddress,
      abi: [{
        type: 'function',
        name: 'getPool',
        stateMutability: 'view',
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
          { name: 'fee', type: 'uint24' }
        ],
        outputs: [
          { name: 'pool', type: 'address' }
        ]
      }],
      client
    });

    const feeTiers: FeeAmount[] = [
      FeeAmount.LOWEST,
      FeeAmount.LOW_200,
      FeeAmount.LOW_300,
      FeeAmount.LOW_400,
      FeeAmount.LOW,
      FeeAmount.MEDIUM,
      FeeAmount.HIGH,
    ];

    for (const fee of feeTiers) {
      const pool = await factoryContract.read.getPool([
        addressIn as Address,
        addressOut as Address,
        fee,
      ]);

      if (pool !== '0x0000000000000000000000000000000000000000') {
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
    }

    throw RelayerError.unknown(
      `No usable Uniswap V3 pool found for pair ${tokenIn.symbol}/${tokenOut.symbol} on any known fee tier`
    );
  }

  async quoteMultiHop({ chainId, amountIn, path }: { chainId: number, amountIn: bigint, path: Address[] }): Promise<Quote> {
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
    const pathWithFees: { token: Address, fee: FeeAmount }[] = [];

    for (let i = 0; i < path.length - 1; i++) {
      const tokenA = path[i]!;
      const tokenB = path[i + 1]!;

      let poolFound = false;

      // Try each fee tier to find a valid pool
      for (const fee of [
        FeeAmount.LOWEST,
        FeeAmount.LOW_200,
        FeeAmount.LOW_300,
        FeeAmount.LOW_400,
        FeeAmount.LOW,
        FeeAmount.MEDIUM,
        FeeAmount.HIGH,
      ]) {
        const pool = await this.getPool(chainId, tokenA as Address, tokenB as Address, fee);

        if (pool !== '0x0000000000000000000000000000000000000000') {
          if (i === 0) {
            pathWithFees.push({ token: tokenA as Address, fee });
          }
          if (i === path.length - 2) {
            pathWithFees.push({ token: tokenB as Address, fee: FeeAmount.MEDIUM }); // fee doesn't matter for last token
          } else {
            pathWithFees.push({ token: tokenB as Address, fee });
          }
          poolFound = true;
          break;
        }
      }

      if (!poolFound) {
        throw RelayerError.unknown(
          `No pool found for hop ${i}: ${tokenA} -> ${tokenB}`
        );
      }
    }

    // Encode the path for quoteExactInput
    // Path encoding: token0 (20 bytes) + fee0 (3 bytes) + token1 (20 bytes) + fee1 (3 bytes) + token2 (20 bytes)...
    let encodedPath = '0x';
    for (let i = 0; i < pathWithFees.length; i++) {
      const item = pathWithFees[i]!;
      encodedPath += item.token.slice(2); // Remove '0x' prefix
      if (i < pathWithFees.length - 1) {
        // Add fee as 3 bytes (24 bits)
        encodedPath += item.fee.toString(16).padStart(6, '0');
      }
    }

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
    } catch (error) {
      throw RelayerError.unknown(
        `Failed to get multi-hop quote for path: ${path.join(' -> ')}`
      );
    }
  }

  private async getPool(chainId: number, tokenA: Address, tokenB: Address, fee: FeeAmount): Promise<Address> {
    const factoryAddress = UNISWAP_V3_FACTORY_ADDRESS[chainId.toString()];
    if (!factoryAddress) {
      throw RelayerError.unknown(`No Uniswap V3 factory address configured for chain ${chainId}`);
    }

    const client = web3Provider.client(chainId);
    const factoryContract = getContract({
      address: factoryAddress,
      abi: [{
        type: 'function',
        name: 'getPool',
        stateMutability: 'view',
        inputs: [
          { name: 'tokenA', type: 'address' },
          { name: 'tokenB', type: 'address' },
          { name: 'fee', type: 'uint24' }
        ],
        outputs: [
          { name: 'pool', type: 'address' }
        ]
      }],
      client
    });

    return await factoryContract.read.getPool([tokenA, tokenB, fee]);
  }

}
