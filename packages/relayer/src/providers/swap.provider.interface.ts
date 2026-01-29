import { Address } from "@0xbow/privacy-pools-core-sdk";
import { Hex } from "viem";
import { ChainId } from "../types.js";

type QuoteToken = { amount: bigint, decimals: number; };

export type Quote = {
  path: string[];
  valueIn: QuoteToken;
  valueOut: QuoteToken;
};

export interface SwapWithRefundParams {
  chainId: ChainId;
  feeReceiver: Address;
  nativeRecipient: Address;
  tokenIn: Address;
  feeGross: bigint;
  refundAmount: bigint;
  feeBase: bigint;
}

export interface QuoteInNativeTokenParams {
  chainId: ChainId, 
  tokenAddress: Address, 
  reciever?: Address,
  amount: bigint
}

export interface SwapProvider { 
  quoteNativeToken(params: QuoteInNativeTokenParams): Promise<Quote> 
  swapExactInputForWeth(params: SwapWithRefundParams): Promise<Hex> 
}
