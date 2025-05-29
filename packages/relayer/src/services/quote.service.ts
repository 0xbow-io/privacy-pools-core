import { Address } from "viem";
import { quoteProvider, web3Provider } from "../providers/index.js";

interface QuoteFeeBPSParams {
  chainId: number,
  assetAddress: Address,
  amountIn: bigint,
  baseFeeBPS: bigint,
  extraGas: boolean;
};

const NativeAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export class QuoteService {

  readonly relayTxCost: bigint;
  readonly extraGasTxCost: bigint;
  readonly extraGasFundAmount: bigint;

  constructor() {
    // a typical withdrawal costs between 450k-650k gas
    this.relayTxCost = 650_000n;
    // approximate value of a uniswap Router call
    this.extraGasTxCost = 200_000n;
    // this gas will be transformed into equivalent native units at the time of the fund swap.
    this.extraGasFundAmount = 600_000n;
  }

  async netFeeBPSNative(baseFee: bigint, balance: bigint, nativeQuote: { num: bigint, den: bigint; }, gasPrice: bigint, extraGasUnits: bigint): Promise<bigint> {
    const totalGasUnits = this.relayTxCost + extraGasUnits;
    const nativeCosts = (1n * gasPrice * totalGasUnits);
    return baseFee + nativeQuote.den * 10_000n * nativeCosts / balance / nativeQuote.num;
  }

  async quoteFeeBPSNative(quoteParams: QuoteFeeBPSParams): Promise<bigint> {
    const { chainId, assetAddress, amountIn, baseFeeBPS, extraGas } = quoteParams;
    const gasPrice = await web3Provider.getGasPrice(chainId);

    const EXTRA_GAS_AMOUNT = this.extraGasTxCost + this.extraGasFundAmount;
    const extraGasUnits = extraGas ? EXTRA_GAS_AMOUNT : 0n;

    let quote: { num: bigint, den: bigint; };
    if (assetAddress.toLowerCase() === NativeAddress.toLowerCase()) {
      quote = { num: 1n, den: 1n };
    } else {
      quote = await quoteProvider.quoteNativeTokenInERC20(chainId, assetAddress, amountIn);
    }

    const feeBPS = await this.netFeeBPSNative(baseFeeBPS, amountIn, quote, gasPrice, extraGasUnits);
    return feeBPS;
  }

}
