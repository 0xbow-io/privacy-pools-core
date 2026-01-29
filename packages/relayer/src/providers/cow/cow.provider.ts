import { Address } from "@0xbow/privacy-pools-core-sdk";
import { TradingSdk, SupportedChainId, OrderKind, QuoteAndPost, OrderBookApi, EnrichedOrder, TradeParameters } from "@cowprotocol/cow-sdk";
import { ViemAdapter } from "@cowprotocol/sdk-viem-adapter";
import { createModuleLogger } from "../../logger/index.js";
import { web3Provider } from "../index.js";
import { Quote, QuoteInNativeTokenParams, SwapProvider, SwapWithRefundParams } from "../swap.provider.interface.js";
import { erc20Abi, Hex } from "viem";
import { ChainId } from "../../types.js";
import { RelayerConfig } from "../../config/config.js";
import { QuoterError } from "../../exceptions/base.exception.js";

function Cow() {};
const logger = createModuleLogger(Cow);

export type CowQuote = {
  num: bigint;
  den: bigint;
  path: (string | number)[];
};

export class CowProvider implements SwapProvider {
  private sdk: Map<SupportedChainId, TradingSdk>;
  private ethDecimals: number = 18;
  private vaultRelayerContract: Address = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110"; //TODO this contract could be different per chain

  constructor() {
    this.sdk = new Map();
  }

  private async createAdapter(chainId: ChainId) {
    const viemClient = await web3Provider.client(chainId);

    const adapter = new ViemAdapter({
      provider: viemClient
    });
    const config = new RelayerConfig().chain(chainId);
    const pkey = await config.signerPrivateKey();

    adapter.setSigner(pkey);
    
    return adapter; 
  }

  async quoteNativeToken({chainId, tokenAddress, amount}: QuoteInNativeTokenParams): Promise<Quote> {
    try {
      this.createSdkForChain(chainId)

      const { quoteResults } = await this.generateEthQuote(chainId, tokenAddress, amount);

      logger.debug('CoW SDK quote response', { quoteResults });

      if (!quoteResults?.quoteResponse?.quote?.sellAmount || !quoteResults?.quoteResponse?.quote?.buyAmount) {
        logger.error('Invalid quote response structure', { quoteResults });
        throw QuoterError.cowQuoterError({ message: 'Invalid quote response from CoW SDK', quoteResults});
      }

      const tokenAmount = BigInt(quoteResults.quoteResponse.quote.sellAmount);
      const ethAmount = BigInt(quoteResults.quoteResponse.quote.buyAmount);
      
      logger.debug('CoW Protocol native price response', { 
        tokenAmount: tokenAmount.toString(),
        ethAmount: ethAmount.toString()
      });

      const tokenDecimals = await this.getTokenDecimals(tokenAddress, chainId);

      return {
        valueIn: { amount: tokenAmount, decimals: tokenDecimals },
        valueOut: { amount: ethAmount, decimals: this.ethDecimals },
        path: ["cow_protocol"] // TODO this is supposed to be the optional multihop path with fees and stuff
        }; 
    } catch(error) {
      const errorMsg = `CoW SDK request failed: ${error}`;
      logger.error(errorMsg, {error});
      throw QuoterError.cowQuoterError({error});
    } 
  }


  async swapExactInputForWeth(params: SwapWithRefundParams): Promise<Hex>  {
    const { chainId, tokenIn, refundAmount } = params;
    const orderBookApi = this.getOrderBookApi(chainId);

    // get quote in native token
    const quote = await this.generateEthQuote(chainId, tokenIn, refundAmount);
    // allow quoted tokens to be swapped 
    const swapAmount = quote.quoteResults.amountsAndCosts.afterNetworkCosts.sellAmount;
    this.ensureTokenApproval(chainId, tokenIn, swapAmount);
    // call for the swap
    const {orderId} = await quote.postSwapOrderFromQuote();
    // wait for swap to complete
    const order = await this.waitForOrderExecution(orderId, orderBookApi); 

    const trades = await orderBookApi.getTrades({ orderUid: orderId });

    if (trades.length > 0) {
      const txHash = trades[0]!.txHash;
      logger.info('Transaction hash:', txHash)
      logger.info('Etherscan:', `https://etherscan.io/tx/${txHash}`)
      return txHash as Hex;
    } else {
      const errorMsg = "Could not get tx hash from swap order";
      logger.error(errorMsg, {order})
      throw QuoterError.cowQuoterError({message: errorMsg, order})
    }
  }

  private async ensureTokenApproval(chainId: ChainId, tokenAddress: Address, amount: bigint) { 
    // get vault relayer address for the chain
    const vaultRelayerAddress = this.vaultRelayerContract;
    
    const client = await web3Provider.client(chainId);
    const signer = await web3Provider.signer(chainId);

    if (!signer.account) {
      throw QuoterError.cowQuoterError("Wallet client account not found");
    }

    // check current allowance
    const currentAllowance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [signer.account.address, vaultRelayerAddress]
    });

    logger.info(`Current allowance: ${currentAllowance.toString()}, needed: ${amount.toString()}`);

    if (currentAllowance < amount) {
      logger.info(`Approving vault relayer ${vaultRelayerAddress} to spend ${amount.toString()} tokens`);
      
      const hash = await signer.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [vaultRelayerAddress, amount],
        account: signer.account,
        chain: signer.chain
      });

      logger.info(`Approval transaction: ${hash}`);
      
      // wait for transaction confirmation
      await client.waitForTransactionReceipt({ hash });
      logger.info("Approval confirmed");
    } else {
      logger.info("Token already approved for sufficient amount");
    }
  }

  getOrderBookApi(chainId: ChainId) {
    const supportedChainId = this.getSupportedChainId(chainId);
    return new OrderBookApi({ chainId: supportedChainId });
  }

  async waitForOrderExecution(orderId: string, orderBookApi: OrderBookApi, timeoutMs = 300000): Promise<EnrichedOrder> { 
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      const order = await orderBookApi.getOrder(orderId)
      
      if (order.status === 'fulfilled') {
        logger.info(`Order executed: ${order}`)
        return order
      }
      
      if (order.status === 'cancelled' || order.status === 'expired') {
        throw QuoterError.cowQuoterError(`Order ${order.status}: ${order}`)
      }
      
      logger.debug(`Order status: ${order.status}, waiting...`)
      await new Promise(resolve => setTimeout(resolve, 5000)) // check every 5s
    }
    const error = 'Order execution timeout'; 
    logger.error(error)
    throw QuoterError.cowQuoterError(error)
  }

  private async generateEthQuote(chainId: ChainId, token: Address,  amount: bigint): Promise<QuoteAndPost> {   
    const sellTokenDecimals = await this.getTokenDecimals(token, chainId);
    const supportedChainId = this.getSupportedChainId(chainId);

    logger.debug('Fetching CoW Protocol native price', { 
      supportedChainId,
      address: token,
      amount: amount.toString(),
      sellTokenDecimals
    });

    const sdk = this.sdk.get(supportedChainId)!; 

    const tradeParameters: TradeParameters = {
        kind: OrderKind.SELL,
        sellToken: token,
        buyToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address,
        amount: amount.toString(),
        sellTokenDecimals,
        buyTokenDecimals: this.ethDecimals
    };

    logger.debug('Calling CoW SDK with parameters', { tradeParameters });
    
    return sdk.getQuote(tradeParameters);
  }

  private getSupportedChainId(chainId: ChainId): SupportedChainId {
    if (Object.values(SupportedChainId).includes(chainId as SupportedChainId)) {
      return chainId as SupportedChainId;
    } 
    logger.error(`call to cow-quoter with unsupported chain id: ${chainId}`)
    throw QuoterError.chainNotSupported(`Unsupported chainId ${chainId}`);
  }

  private async getTokenDecimals(address: Address, chainId: ChainId): Promise<number> {
    const client = await web3Provider.client(chainId);
    let decimals: Promise<number> | undefined = undefined;
    try {
      decimals = await client.readContract({
        address,
        abi: [{
          name: 'decimals',
          type: 'function',
          stateMutability: 'view',
          outputs: [{ type: 'uint8' }],
        }],
        functionName: "decimals"
      }) as Promise<number>;
    } catch(e) {
      logger.warn(e)
    }
    
    return decimals || this.ethDecimals; // default to 18 decimals for unknown tokens
  }

  private async createSdkForChain(chainId: ChainId) {
    const adapter = await this.createAdapter(chainId);
    const supportedChainId = this.getSupportedChainId(chainId);
    
    if (this.sdk.get(supportedChainId) === undefined) {
      this.sdk.set(
        supportedChainId, 
        new TradingSdk(
        {
          chainId: supportedChainId,
          appCode: 'privacy-pools-relayer'
        }, 
        {}, 
        adapter
        )
      )
    } 
  }
}

