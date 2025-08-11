import { Address, getAddress } from "viem";
import { uniswapProvider } from "./index.js";

const FRAXUSD_ADDRESS = "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export class QuoteProvider {

  constructor() {
  }

  async quoteNativeTokenInERC20(chainId: number, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[] }> {
    // XXX: if FRXUSD, use USDC quote but adjust for decimal difference
    if (getAddress(addressIn) === getAddress(FRAXUSD_ADDRESS)) {

      // FRXUSD has 18 decimals, USDC has 6 decimals
      // adjust the amountIn from 18 decimals to 6 decimals
      const DECIMAL_DIFFERENCE = 10n ** 12n;  // 18-6
      const adjustedAmount = amountIn / DECIMAL_DIFFERENCE;

      // Get the USDC quote - this returns how much ETH we need for X USDC
      const { out, path } = (await uniswapProvider.quoteNativeToken(chainId, USDC_ADDRESS as Address, adjustedAmount))!;

      // So num = ETH amount, den = FRXUSD amount in 18 decimals
      return { num: out.amount, den: amountIn, path };
    }

    const { in: in_, out, path } = (await uniswapProvider.quoteNativeToken(chainId, addressIn, amountIn))!;
    return { num: out.amount, den: in_.amount, path };
  }

}
