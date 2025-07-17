import { Token } from '@uniswap/sdk-core'
import { FeeAmount } from '@uniswap/v3-sdk'
import { Address, getContract } from 'viem'

import { web3Provider } from '../providers/index.js'
import { BlockchainError, RelayerError } from '../exceptions/base.exception.js'
import { isViemError } from '../utils.js'
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
    ])
    return new Token(chainId, address, Number(decimals), symbol);
  }

  async quoteNativeToken(chainId: number, addressIn: Address, amountIn: bigint): Promise<Quote> {
    const addressOut = WRAPPED_NATIVE_TOKEN_ADDRESS[chainId.toString()]!
    return this.quote({
      chainId,
      amountIn,
      addressOut,
      addressIn
    });
  }

  async quote({ chainId, addressIn, addressOut, amountIn }: UniswapQuote) {
    const tokenIn = await this.getTokenInfo(chainId, addressIn as Address);
    const tokenOut = await this.getTokenInfo(chainId, addressOut as Address);
    const quoterContract = getContract({
      address: QUOTER_CONTRACT_ADDRESS[chainId.toString()]!,
      abi: QuoterV2ABI.abi,
      client: web3Provider.client(chainId)
    });

    try {

      const quotedAmountOut = await quoterContract.simulate.quoteExactInputSingle([{
        tokenIn: tokenIn.address as Address,
        tokenOut: tokenOut.address as Address,
        fee: FeeAmount.MEDIUM,
        amountIn,
        sqrtPriceLimitX96: 0n,
      }])

      // amount, sqrtPriceX96After, tickAfter, gasEstimate
      const [amount, , , ] = quotedAmountOut.result;
      return {
        in: {
          amount: amountIn, decimals: tokenIn.decimals
        },
        out: {
          amount, decimals: tokenOut.decimals
        }
      };
    } catch (error) {
      if (error instanceof Error && isViemError(error)) {
        const { metaMessages, shortMessage } = error;
        throw BlockchainError.txError((metaMessages ? metaMessages[0] : undefined) || shortMessage)
      } else {
        throw RelayerError.unknown("Something went wrong while quoting")
      }
    }

  }

}
