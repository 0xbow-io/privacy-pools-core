import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Address, getContract, createWalletClient, http, encodeAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { writeContract } from 'viem/actions';

import { getChainConfig, getSignerPrivateKey } from "../../config/index.js";
import { web3Provider } from '../../providers/index.js';
import { BlockchainError, RelayerError } from '../../exceptions/base.exception.js';
import { isViemError } from '../../utils.js';
import { UNIVERSAL_ROUTER_ADDRESS, QUOTER_CONTRACT_ADDRESS, WRAPPED_NATIVE_TOKEN_ADDRESS } from './constants.js';
import { IERC20MinimalABI } from './abis/erc20.abi.js';
import { QuoterV2ABI } from './abis/quoterV2.abi.js';
import { UniversalRouterABI } from './abis/universalRouter.abi.js';

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
      }]);

      // amount, sqrtPriceX96After, tickAfter, gasEstimate
      const [amount, , ,] = quotedAmountOut.result;
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
        throw BlockchainError.txError((metaMessages ? metaMessages[0] : undefined) || shortMessage);
      } else {
        throw RelayerError.unknown("Something went wrong while quoting");
      }
    }
  }

  async swapExactInputSingle({
    chainId,
    amountIn,
    quotedAmountOut,
    slippageBps,
    assetIn,
    assetOut,
    recipient
  }: {
    chainId: number;
    amountIn: bigint;
    quotedAmountOut: bigint;
    slippageBps: bigint;
    assetIn: Address;
    assetOut: Address;
    recipient: Address;
  }): Promise<string> {
    const config = getChainConfig(chainId);
    const routerAddress = UNIVERSAL_ROUTER_ADDRESS[chainId.toString()];
    if (!routerAddress) {
      throw RelayerError.unknown(`Universal Router not configured for chain ${chainId}`);
    }

    const privateKey = getSignerPrivateKey(chainId);
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const client = createWalletClient({
      chain: {
        id: config.chain_id,
        name: config.chain_name,
        rpcUrls: { default: { http: [config.rpc_url] } },
        nativeCurrency: config.native_currency!,
      },
      transport: http(config.rpc_url),
      account,
    });

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10); // 10 minutes


    // when setting slippage use this:
    // const slippageBps = 10n; // 0.1%
    const minAmountOut = quotedAmountOut - (quotedAmountOut * slippageBps / 10_000n);

    // command: V3_SWAP_EXACT_IN
    const commands = '0x00';

    const encodedInput = encodeAbiParameters(
      [
        { name: 'tokenIn', type: 'address' },
        { name: 'tokenOut', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'recipient', type: 'address' },
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'deadline', type: 'uint160' },
      ],
      [
        assetIn,
        assetOut,
        FeeAmount.MEDIUM,
        recipient,
        amountIn,
        minAmountOut,
        deadline,
      ]
    );

    const hash = await writeContract(client, {
      address: routerAddress,
      abi: UniversalRouterABI.abi,
      functionName: 'execute',
      args: [commands, [encodedInput]],
      account
    });

    return hash;
  }

  async sendNativeToken(
    chainId: number,
    to: Address,
    amount: bigint
  ): Promise<void> {
    const config = getChainConfig(chainId);
    const privateKey = getSignerPrivateKey(chainId);
    const account = privateKeyToAccount(privateKey as `0x${string}`);

    const client = createWalletClient({
      chain: {
        id: config.chain_id,
        name: config.chain_name,
        rpcUrls: { default: { http: [config.rpc_url] } },
        nativeCurrency: config.native_currency!,
      },
      transport: http(config.rpc_url),
      account,
    });

    await client.sendTransaction({
      chain: {
        id: config.chain_id,
        name: config.chain_name,
        rpcUrls: { default: { http: [config.rpc_url] } },
        nativeCurrency: config.native_currency!,
      },
      account,
      to,
      value: amount,
    });
  }
}
