import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Account, Address, getAddress, getContract, WriteContractParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getSignerPrivateKey } from "../../config/index.js";
import { BlockchainError, RelayerError } from '../../exceptions/base.exception.js';
import { web3Provider } from '../../providers/index.js';
import { isFeeReceiverSameAsSigner, isViemError } from '../../utils.js';
import { IERC20MinimalABI } from './abis/erc20.abi.js';
import { QuoterV2ABI } from './abis/quoterV2.abi.js';
import { UniversalRouterABI } from './abis/universalRouter.abi.js';
import { Command, CommandPair, encodeInstruction, Instruction, Permit2Params } from './commands.js';
import { getPermit2Address, getQuoterAddress, getRouterAddress, WRAPPED_NATIVE_TOKEN_ADDRESS } from './constants.js';
import { createPermit2 } from './createPermit.js';
import { getPoolPath } from './pools.js';

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
  feeGross: bigint;
  refundAmount: bigint;
  chainId: number;
  feeBase: bigint;
}

interface CreateInstructionsFeeReceiveerIsRelayer {
  router: { address: Address; };
  relayer: Account;
  nativeRecipient: Address;
  amountToSwap: bigint;
  minAmountOut: bigint;
  permitParmas: Permit2Params;
  pathParams: `0x${string}`;
  refundAmount: bigint;
}

interface CreateInstructionsFeeReceiveerIsNotRelayer extends CreateInstructionsFeeReceiveerIsRelayer {
  tokenIn: Address;
  feeReceiver: Address;
  feeBase: bigint;
}

export class UniswapProvider {

  static readonly ZERO_ADDRESS = getAddress("0x0000000000000000000000000000000000000000");

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
        fee: FeeAmount.LOW,
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

  async approvePermit2forERC20(tokenIn: `0x${string}`, chainId: number) {
    //  0) - (this is done only once) - Approve Permit2 to move Relayer's ERC20
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
      const hash = await erc20.write.approve(
        [PERMIT2_ADDRESS, 2n ** 256n - 1n],
        { chain: client.chain, account: relayer }
      );
      await client.waitForTransactionReceipt({ hash });
    }
  }

  static createInstructionsIfFeeReceiverIsNotRelayer({
    permitParmas, router, pathParams, relayer,
    tokenIn, feeReceiver, feeBase,
    refundAmount, amountToSwap, minAmountOut, nativeRecipient
  }: CreateInstructionsFeeReceiveerIsNotRelayer): Instruction[] {
    // OPERATIONS:
    //  1) Send permit for Router to move Gross Fees in Token from Relayer
    //  2) AllowanceTransfer from Relayer to feeReceiver for Base Fees
    //  3) Swap ERC20 for WETH consuming (Gross-Base) Fees, destination Router, setting the payerIsUser=true flag, meaning to use permit2 (Relayer has the tokens)
    //  4) Unwrap WETH to Router
    //  5) Transfer native Refund value to Relayer
    //  6) Sweep whatever is left to Recipient
    return [
      // This is used to authorize the router to move our tokens
      { command: Command.permit2, params: permitParmas },
      // We send relaying fees to feeReceiver
      { command: Command.transferWithPermit, params: { token: tokenIn, recipient: feeReceiver, amount: feeBase } },

      // Swap consuming all
      {
        command: Command.swapV3ExactIn, params: {
          // we're going to unwrap weth from here
          recipient: router.address,
          amountIn: amountToSwap,
          minAmountOut,
          // USDC-WETH
          path: pathParams,
          // The relayer is the tx initiator
          payerIsUser: true,
        }
      },
      // the router will hold the value for further splitting
      { command: Command.unrwapWeth, params: { recipient: router.address, minAmountOut } },
      // gas refund to relayer
      // 0 address means moving native
      { command: Command.transfer, params: { token: this.ZERO_ADDRESS, recipient: relayer.address, amount: refundAmount } },
      // 0 address means moving native
      // sweep reminder to the withdrawal address
      { command: Command.sweep, params: { token: this.ZERO_ADDRESS, recipient: nativeRecipient, minAmountOut } }
    ];
  }

  static createInstructionsIfFeeReceiverIsRelayer({
    permitParmas, router, pathParams, relayer,
    refundAmount, amountToSwap, minAmountOut, nativeRecipient
  }: CreateInstructionsFeeReceiveerIsRelayer): Instruction[] {
    // OPERATIONS:
    //  1) Send permit for Router to move Gross Fees in Token from Relayer
    //  2) Swap ERC20 for WETH, destination Router, setting the payerIsUser=true flag
    //  3) Unwrap WETH to Router
    //  4) Transfer native Refund value to Relayer
    //  5) Sweep whatever is left to Recipient
    return [
      // This is used to authorize the router to move our tokens
      { command: Command.permit2, params: permitParmas },
      // Swap consuming all
      {
        command: Command.swapV3ExactIn, params: {
          // we're going to unwrap weth from here
          recipient: router.address,
          amountIn: amountToSwap,
          minAmountOut,
          // USDC-WETH
          path: pathParams,
          // The relayer is the tx initiator
          payerIsUser: true,
        }
      },
      // the router will hold the value for further splitting
      { command: Command.unrwapWeth, params: { recipient: router.address, minAmountOut } },
      // gas refund to relayer
      // 0 address means moving native
      { command: Command.transfer, params: { token: this.ZERO_ADDRESS, recipient: relayer.address, amount: refundAmount } },
      // 0 address means moving native
      // sweep reminder to the withdrawal address
      { command: Command.sweep, params: { token: this.ZERO_ADDRESS, recipient: nativeRecipient, minAmountOut } }
    ];
  }

  async simulateSwapExactInputSingleForWeth({
    nativeRecipient,
    feeReceiver,
    feeBase,
    feeGross,
    tokenIn,
    refundAmount,
    chainId
  }: SwapWithRefundParams): Promise<WriteContractParameters> {

    await this.approvePermit2forERC20(tokenIn, chainId);

    const minAmountOut = refundAmount;
    const ROUTER_ADDRESS = getRouterAddress(chainId);
    const PERMIT2_ADDRESS = getPermit2Address(chainId);
    const relayer = privateKeyToAccount(getSignerPrivateKey(chainId) as `0x${string}`);
    const client = web3Provider.client(chainId);

    const router = getContract({
      abi: UniversalRouterABI,
      address: ROUTER_ADDRESS,
      client
    });

    const amountToSwap = feeGross - feeBase;

    const [permit, signature] = await createPermit2({
      signer: relayer,
      chainId,
      allowanceAmount: feeGross,
      permit2Address: PERMIT2_ADDRESS,
      routerAddress: ROUTER_ADDRESS,
      assetAddress: tokenIn
    });

    const pathParams = await getPoolPath(tokenIn, chainId);

    let instructions;
    if (isFeeReceiverSameAsSigner(chainId)) {
      // If feeReceiver is the same as signer, moving coins around is easier
      instructions = UniswapProvider.createInstructionsIfFeeReceiverIsRelayer({
        relayer,
        router,
        amountToSwap,
        permitParmas: { permit, signature },
        refundAmount,
        minAmountOut,
        pathParams,
        nativeRecipient
      });

    } else {
      instructions = UniswapProvider.createInstructionsIfFeeReceiverIsNotRelayer({
        relayer,
        router,
        amountToSwap,
        permitParmas: { permit, signature },
        refundAmount,
        minAmountOut,
        pathParams,
        nativeRecipient,
        // we need to know receiver and how much to take
        feeReceiver,
        feeBase,
        tokenIn
      });
    }

    const commandPairs: CommandPair[] = [];
    instructions.forEach((ins) => commandPairs.push(encodeInstruction(ins)));

    const commands = "0x" + commandPairs.map(x => x[0].toString(16).padStart(2, "0")).join("") as `0x${string}`;
    const params = commandPairs.map(x => x[1]);

    try {
      const { request: simulation } = await router.simulate.execute([commands, params], { account: relayer });
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
        gas: estimateGas * 11n / 10n
      };
    } catch (e) {
      console.error(e);
      throw e;
    }

  }

  async swapExactInputSingleForWeth(params: SwapWithRefundParams) {
    const { chainId } = params;
    const writeContractParams = await this.simulateSwapExactInputSingleForWeth(params);
    const relayer = web3Provider.signer(chainId);
    const txHash = await relayer.writeContract(writeContractParams);
    return txHash;
  }

}
