import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Address, getContract, createWalletClient, http, encodeAbiParameters, getAddress, SimulateContractReturnType, WriteContractReturnType, GetContractReturnType, SendTransactionParameters, WriteContractParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { writeContract } from 'viem/actions';

import { getChainConfig, getSignerPrivateKey } from "../../config/index.js";
import { web3Provider } from '../../providers/index.js';
import { BlockchainError, RelayerError } from '../../exceptions/base.exception.js';
import { isViemError } from '../../utils.js';
import { getRouterAddress, getQuoterAddress, WRAPPED_NATIVE_TOKEN_ADDRESS, getPermit2Address } from './constants.js';
import { IERC20MinimalABI } from './abis/erc20.abi.js';
import { QuoterV2ABI } from './abis/quoterV2.abi.js';
import { UniversalRouterABI } from './abis/universalRouter.abi.js';
import * as routerCommands from "./commands.js";
import { getPoolPath } from './pools.js';
import { createPermit2 } from './permit.js';

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

interface SwapWithRefundParams {
  feeReceiver: `0x${string}`;
  nativeRecipient: `0x${string}`;
  tokenIn: `0x${string}`;
  amountIn: bigint;
  refundAmount: bigint;
  chainId: number;
}

export class UniswapProvider {

  async getTokenInfo(chainId: number, address: Address): Promise<Token> {
    const contract = getContract({
      address,
      abi: IERC20MinimalABI,
      client: web3Provider.client(chainId)
    });
    const [decimals, symbol] = await Promise.all([
      contract.read.decimals(),
      contract.read.symbol(),
    ]);
    return new Token(chainId, address, Number(decimals), symbol);
  }

  async quoteNativeToken(chainId: number, addressIn: Address, amountIn: bigint): Promise<Quote> {
    const weth = WRAPPED_NATIVE_TOKEN_ADDRESS[chainId]!;
    return this.quote({
      chainId,
      amountIn,
      addressOut: weth.address,
      addressIn
    });
  }

  async quote({ chainId, addressIn, addressOut, amountIn }: UniswapQuote) {
    const tokenIn = await this.getTokenInfo(chainId, addressIn as Address);
    const tokenOut = await this.getTokenInfo(chainId, addressOut as Address);
    const quoterContract = getContract({
      address: getQuoterAddress(chainId),
      abi: QuoterV2ABI,
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
    const routerAddress = getRouterAddress(chainId);
    if (!routerAddress) {
      throw RelayerError.unknown(`Universal Router not configured for chain ${chainId}`);
    }

    const account = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);

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
      abi: UniversalRouterABI,
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

  async approvePermit2forERC20(tokenIn: `0x${string}`, chainId: number) {
    const relayer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
    const PERMIT2_ADDRESS = getPermit2Address(chainId);
    const client = web3Provider.client(chainId);
    const erc20 = getContract({
      abi: IERC20MinimalABI,
      address: tokenIn,
      client,
    });
    const allowance = await erc20.read.allowance([relayer.address, PERMIT2_ADDRESS]);
    if (allowance < 2n ** 128n) {
      await erc20.write.approve(
        [PERMIT2_ADDRESS, 2n ** 256n - 1n],
        { chain: client.chain, account: relayer }
      );
    }
  }

  // OPERATIONS:
  //  0) - (this is done only once) - Approve Permit2 to move Relayer's ERC20
  //  1) AllowanceTransfer from Relayer to Router
  //  2) Swap ERC20 for WETH, destination Router, setting the permit2=true flag
  //  3) Unwrap WETH to Router
  //  4) Transfer Refund value to Relayer
  //  5) Sweep whatever is left to Recipient
  async swapExactInputSingleForWeth({ nativeRecipient, feeReceiver, tokenIn, amountIn, refundAmount, chainId }: SwapWithRefundParams): Promise<WriteContractParameters> {

    const minAmountOut = 200_000n;
    const ROUTER_ADDRESS = getRouterAddress(chainId);
    const PERMIT2_ADDRESS = getPermit2Address(chainId);
    const relayer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
    const client = web3Provider.client(chainId);

    const router = getContract({
      abi: UniversalRouterABI,
      address: ROUTER_ADDRESS,
      client
    });

    const [permitSingle, signature] = await createPermit2({
      signer: relayer,
      chainId,
      amountIn,
      permit2Address: PERMIT2_ADDRESS,
      routerAddress: ROUTER_ADDRESS,
      assetAddress: tokenIn
    });

    // This is used to authorize the router to move our tokens
    const permitCommandPair = routerCommands.permit2({ permit: permitSingle, signature });

    const transferERC20NetFee = routerCommands.transfer({
      // 0 address means moving native
      token: getAddress("0x0000000000000000000000000000000000000000"),
      recipient: relayer.address,
      amount: refundAmount,
    });

    const pathParams = await getPoolPath(tokenIn, chainId);

    // Swap consuming all
    const swapCommandPAir = routerCommands.swapV3ExactIn({
      // we're going to unwrap weth from here
      recipient: router.address,
      amountIn,
      minAmountOut,
      // USDC-WETH
      path: pathParams,
      // The relayer is the tx initiator
      payerIsUser: true,
    });

    const unwrapOutputWeth = routerCommands.unwrapWeth({
      // the router will hold the value for further splitting
      recipient: router.address,
      minAmountOut
    });

    const transferRefundNative = routerCommands.transfer({
      // 0 address means moving native
      token: getAddress("0x0000000000000000000000000000000000000000"),
      recipient: relayer.address,
      amount: refundAmount,
    });

    const sweepReminders = routerCommands.sweep({
      // 0 address means moving native
      token: getAddress("0x0000000000000000000000000000000000000000"),
      // this is the withdrawal address
      recipient: nativeRecipient,
      minAmountOut
    });

    const commandPairs: [number, `0x${string}`][] = [
      permitCommandPair,
      swapCommandPAir,
      unwrapOutputWeth,
      transferRefundNative,
      sweepReminders
    ];

    const commands = "0x" + commandPairs.map(x => x[0].toString(16).padStart(2, "0")).join("") as `0x${string}`;
    const params = commandPairs.map(x => x[1]);

    const { request: simulation } = await router.simulate.execute([commands, params]);

    const estimateGas = await client.estimateContractGas(simulation);

    const {
      address,
      abi,
      functionName,
      args,
      chain,
      nonce,
    } = simulation;

    return {
      functionName,
      account: relayer,
      address,
      abi,
      args,
      chain,
      nonce,
      gas: estimateGas * 15n / 10n
    };

  }

}
