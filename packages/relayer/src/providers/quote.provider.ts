import { Address, getAddress } from "viem";
import { uniswapProvider } from "./index.js";
import { FRAXUSD_ADDRESS, WOETH_ADDRESS } from "../config/index.js";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export class QuoteProvider {

  constructor() {
  }

  private async quoteNativeTokenInFrax(chainId: number, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // FRXUSD has 18 decimals, USDC has 6 decimals
    // adjust the amountIn from 18 decimals to 6 decimals
    const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
    const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

    // Get the USDC quote - this returns how much ETH we need for X USDC
    const { out, path } = (await uniswapProvider.quoteNativeToken(chainId, USDC_ADDRESS as Address, adjustedAmount))!;

    // So num = ETH amount, den = FRXUSD amount in 18 decimals
    return { num: out.amount, den: amountIn, path };
  }

  private quoteNativeTokenInWoeth(chainId: number, addressIn: string, amountIn: bigint): { num: bigint; den: bigint; path: (string | number)[]; } | PromiseLike<{ num: bigint; den: bigint; path: (string | number)[]; }> {
    // Here we assume 1 WOETH ~ 1.20 ETH
    return { num: amountIn, den: (amountIn * 12n) / 10n, path: [] };
  }

  async quoteNativeTokenInERC20(chainId: number, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[]; }> {
    // XXX: if FRXUSD, use USDC quote but adjust for decimal difference
    if (chainId === 1 && getAddress(addressIn) === getAddress(FRAXUSD_ADDRESS)) {
      return this.quoteNativeTokenInFrax(chainId, addressIn, amountIn);
    } else if (chainId === 1 && getAddress(addressIn) === getAddress(WOETH_ADDRESS)) {
      return this.quoteNativeTokenInWoeth(chainId, addressIn, amountIn);
    }

    const { in: in_, out, path } = (await uniswapProvider.quoteNativeToken(chainId, addressIn, amountIn))!;
    return { num: out.amount, den: in_.amount, path };
  }

}
