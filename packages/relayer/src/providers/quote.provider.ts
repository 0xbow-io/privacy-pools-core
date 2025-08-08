import { Address, getAddress } from "viem";
import { uniswapProvider } from "./index.js";

const FRAXUSD_ADDRESS = "0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export class QuoteProvider {

  constructor() {
  }

  async quoteNativeTokenInERC20(chainId: number, addressIn: Address, amountIn: bigint): Promise<{ num: bigint, den: bigint, path: (string | number)[] }> {
    // FIX: If FraxUSD, use USDC price instead
    if (getAddress(addressIn) === getAddress(FRAXUSD_ADDRESS)) {
      const { in: in_, out, path } = (await uniswapProvider.quoteNativeToken(chainId, USDC_ADDRESS as Address, amountIn))!;
      return { num: out.amount, den: in_.amount, path };
    }

    const { in: in_, out, path } = (await uniswapProvider.quoteNativeToken(chainId, addressIn, amountIn))!;
    return { num: out.amount, den: in_.amount, path };
  }

}
