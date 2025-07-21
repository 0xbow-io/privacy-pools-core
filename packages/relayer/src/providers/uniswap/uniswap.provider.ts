import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Account, Address, getAddress, getContract, GetContractReturnType, PublicClient, WriteContractParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { getSignerPrivateKey } from "../../config/index.js";
import { BlockchainError, RelayerError } from '../../exceptions/base.exception.js';
import { web3Provider } from '../../providers/index.js';
import { isFeeReceiverSameAsSigner, isViemError } from '../../utils.js';
import { IERC20MinimalABI } from './abis/erc20.abi.js';
import { FactoryV3ABI } from './abis/factoryV3.abi.js';
import { QuoterV2ABI } from './abis/quoterV2.abi.js';
import { UniversalRouterABI } from './abis/universalRouter.abi.js';
import { v3PoolABI } from './abis/v3pool.abi.js';
import { Command, CommandPair, encodeInstruction, Instruction, Permit2Params } from './commands.js';
import { FeeTiers, getPermit2Address, getQuoterAddress, getRouterAddress, getV3Factory, INTERMEDIATE_TOKENS, WRAPPED_NATIVE_TOKEN_ADDRESS } from './constants.js';
import { createPermit2 } from './createPermit.js';
import { encodePath, hopsFromAddressRoute } from './pools.js';

export type UniswapQuote = {
  chainId: number;
  addressIn: string;
  addressOut: string;
  amountIn: bigint;
};

type QuoteToken = { amount: bigint, decimals: number; };

export type Quote = {
  path: (string | FeeAmount)[];
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

const ZERO_ADDRESS = getAddress("0x0000000000000000000000000000000000000000");
function isNullAddress(a: string) {
  return getAddress(a) === ZERO_ADDRESS;
}

export class UniswapProvider {

  static readonly ZERO_ADDRESS = ZERO_ADDRESS;

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

  getFactory(chainId: number) {
    const factoryAddress = getV3Factory(chainId);
    if (!factoryAddress) {
      throw RelayerError.unknown(`No Uniswap V3 factory address configured for chain ${chainId}`);
    }
    return getContract({
      address: factoryAddress,
      abi: FactoryV3ABI,
      client: web3Provider.client(chainId)
    });
  }

  getQuoter(chainId: number) {
    return getContract({
      address: getQuoterAddress(chainId),
      abi: QuoterV2ABI,
      client: web3Provider.client(chainId)
    });
  }

  getPool(chainId: number, poolAddress: `0x${string}`): GetContractReturnType<typeof v3PoolABI, PublicClient> {
    return getContract({
      abi: v3PoolABI,
      address: getAddress(poolAddress),
      client: web3Provider.client(chainId),
    });
  }

  async quoteNativeToken(chainId: number, addressIn: Address, amountIn: bigint): Promise<Quote> {
    const weth = WRAPPED_NATIVE_TOKEN_ADDRESS[chainId]!;
    // First try direct quote
    try {
      return await this.quote({
        chainId,
        amountIn,
        addressOut: weth.address,
        addressIn
      });
    } catch (directError) {

      // If direct quote fails, try multi-hop routing
      const intermediateTokens = INTERMEDIATE_TOKENS[chainId.toString()] || [];
      for (const intermediateToken of intermediateTokens) {

        // Skip if intermediate token is same as input or output
        if (intermediateToken.toLowerCase() === addressIn.toLowerCase() ||
          intermediateToken.toLowerCase() === weth.address.toLowerCase()) {
          continue;
        }

        try {
          return await this.quoteMultiHop({
            chainId,
            amountIn,
            path: [addressIn as Address, intermediateToken, weth.address as Address]
          });
        } catch {
          continue;
        }

      }

      throw directError;
    }
  }

  private async poolHasLiquidity(chainId: number, poolAddress: `0x${string}`) {
    const pool = this.getPool(chainId, poolAddress);
    const [liq, slot0] = await Promise.all([
      pool.read.liquidity(),
      pool.read.slot0()
    ]);
    if (liq === 0n)
      return false;
    // sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked
    const tick = slot0[1];
    const unlocked = slot0[6];
    if (!unlocked || tick === 0)
      return false;

    return true;
  }

  async findLowestFeePoolForPair(chainId: number, addressIn: string, addressOut: string): Promise<FeeAmount> {
    const factory = this.getFactory(chainId);
    let fee: FeeAmount | undefined;
    for (const candidateFee of FeeTiers) {
      const pool = await factory.read.getPool([
        addressIn as Address,
        addressOut as Address,
        candidateFee,
      ]);

      // we found one!
      if (!isNullAddress(pool) && await this.poolHasLiquidity(chainId, pool)) {
        fee = candidateFee;
        break;
      }
    }
    if (fee === undefined) {
      throw RelayerError.unknown(
        `No usable Uniswap V3 pool found for pair ${addressIn}/${addressOut} on any known fee tier`
      );
    }
    return fee;
  }

  async quote({ chainId, addressIn, addressOut, amountIn }: UniswapQuote) {
    const tokenIn = await this.getTokenInfo(chainId, addressIn as Address);
    const tokenOut = await this.getTokenInfo(chainId, addressOut as Address);
    const quoterContract = this.getQuoter(chainId);

    const fee = await this.findLowestFeePoolForPair(chainId, addressIn, addressOut);
    try {

      const quotedAmountOut = await quoterContract.simulate.quoteExactInputSingle([{
        tokenIn: tokenIn.address as Address,
        tokenOut: tokenOut.address as Address,
        fee,
        amountIn,
        sqrtPriceLimitX96: 0n,
      }]);

      // amount, sqrtPriceX96After, tickAfter, gasEstimate
      const [amount, , ,] = quotedAmountOut.result;
      return {
        path: [tokenIn.address, fee, tokenOut.address],
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

  async quoteMultiHop({ chainId, amountIn, path }: { chainId: number, amountIn: bigint, path: Address[]; }): Promise<Quote> {
    if (path.length < 2) {
      throw RelayerError.unknown('Path must contain at least 2 addresses');
    }

    const quoterContract = this.getQuoter(chainId);

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
      try {
        const fee = await this.findLowestFeePoolForPair(chainId, tokenA, tokenB);
        const feePath = { token: tokenA, fee };
        pathWithFees.push(feePath);
      } catch {
        throw RelayerError.unknown(
          `No pool found for hop: ${tokenA} -> ${tokenB}`
        );
      }
    }
    pathWithFees.push({ token: path[path.length - 1] as Address, fee: FeeAmount.MEDIUM }); // fee doesn't matter for last token

    // Encode the path for quoteExactInput
    // Path encoding: token0 (20 bytes) + fee0 (3 bytes) + token1 (20 bytes) + fee1 (3 bytes) + token2 (20 bytes)...
    let encodedPath = '0x';
    const plainPath: (string | FeeAmount)[] = [];
    pathWithFees.forEach((p, i) => {
      const { token, fee } = p;
      encodedPath += token.replace(/^0x/, ""); // Remove '0x' prefix
      plainPath.push(token);
      if (i < pathWithFees.length - 1) {
        // Add fee as 3 bytes (24 bits)
        encodedPath += fee.toString(16).padStart(6, '0');
        plainPath.push(fee);
      }
    });

    try {
      const quotedAmount = await quoterContract.simulate.quoteExactInput([
        encodedPath as `0x${string}`,
        amountIn
      ]);

      const [amountOut] = quotedAmount.result;

      return {
        path: plainPath,
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
      { command: Command.sweep, params: { token: this.ZERO_ADDRESS, recipient: nativeRecipient, minAmountOut: 0n } }
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
      { command: Command.sweep, params: { token: this.ZERO_ADDRESS, recipient: nativeRecipient, minAmountOut: 0n } }
    ];
  }

  async simulateSwapExactInputForWeth({
    nativeRecipient,
    feeReceiver,
    feeBase,
    feeGross,
    tokenIn,
    encodedPath,
    refundAmount,
    chainId
  }: SwapWithRefundParams & { encodedPath: `0x${string}`; }): Promise<WriteContractParameters> {

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
        pathParams: encodedPath,
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
        pathParams: encodedPath,
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

  async findSingleOrMultiHopPath(chainId: number, tokenIn: `0x${string}`) {
    const weth = WRAPPED_NATIVE_TOKEN_ADDRESS[chainId]!;

    let path: (`0x${string}` | number)[] = [];
    try {
      const fee = await this.findLowestFeePoolForPair(chainId, tokenIn, weth.address);
      path = [tokenIn, fee, getAddress(weth.address)];
    } catch (error) {
      if (!(error instanceof RelayerError)) {
        throw error;
      }
      // we try multi-hop
      const intermediateTokens = INTERMEDIATE_TOKENS[chainId.toString()] || [];
      for (const auxToken of intermediateTokens) {
        try {
          const hops = hopsFromAddressRoute([tokenIn, auxToken, getAddress(weth.address)]);
          const feeHops = await Promise.all(hops.map(async hop => {
            const [tokenIn, tokenOut] = hop;
            return {
              token: tokenIn,
              fee: await this.findLowestFeePoolForPair(chainId, tokenIn, tokenOut)
            };
          }));
          feeHops.push({ token: getAddress(weth.address), fee: FeeAmount.LOWEST }); // the last fee is not encoded
          const _path: (`0x${string}` | number)[] = [];
          feeHops.forEach((h, i) => {
            const { token, fee } = h;
            _path.push(token);
            if (i < feeHops.length - 1) {
              _path.push(fee);
            }
          });
          path = _path;
          break;
        } catch {
          continue;
        }
      }

      if (path.length === 0) {
        throw RelayerError.unknown(
          `Couldn't find any Uniswap V3 route for pair ${tokenIn}/weth on any known fee tier`
        );
      }
    }

    return path;
  }

  async swapExactInputForWeth(params: SwapWithRefundParams) {
    const { chainId, tokenIn } = params;
    const path = await this.findSingleOrMultiHopPath(chainId, tokenIn);
    const encodedPath = encodePath(path);
    const writeContractParams = await this.simulateSwapExactInputForWeth({ ...params, encodedPath });
    const relayer = web3Provider.signer(chainId);
    const txHash = await relayer.writeContract(writeContractParams);
    return txHash;
  }

}
