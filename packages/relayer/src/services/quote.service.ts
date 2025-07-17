import { Address } from "viem";
import { quoteProvider, web3Provider } from "../providers/index.js";

interface QuoteFeeBPSParams {
  chainId: number,
  assetAddress: Address,
  amountIn: bigint,
  value: bigint,
  baseFeeBPS: bigint
};

const NativeAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class QuoteService {

  readonly txCost: bigint;

  constructor() {
    // a typical withdrawal costs between 450k-650k gas
    this.txCost = 700_000n;
  }

  async netFeeBPSNative(baseFee: bigint, balance: bigint, nativeQuote: { num: bigint, den: bigint }, gasPrice: bigint, value: bigint): Promise<bigint> {
    const nativeCosts = (1n * gasPrice * this.txCost + value)
    return baseFee + nativeQuote.den * 10_000n * nativeCosts / balance / nativeQuote.num;
  }

  async quoteFeeBPSNative(quoteParams: QuoteFeeBPSParams): Promise<bigint> {
    const { chainId, assetAddress, amountIn, baseFeeBPS, value } = quoteParams;
    const gasPrice = await web3Provider.getGasPrice(chainId);

    let quote: { num: bigint, den: bigint };
    if (assetAddress.toLowerCase() === NativeAddress.toLowerCase()) {
      quote = { num: 1n, den: 1n };
    } else {
      quote = await quoteProvider.quoteNativeTokenInERC20(chainId, assetAddress, amountIn);
    }

    const feeBPS = await this.netFeeBPSNative(baseFeeBPS, amountIn, quote, gasPrice, value);
    return feeBPS
  }

}
