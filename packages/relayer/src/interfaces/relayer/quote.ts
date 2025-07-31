export interface QuotetBody {
  /** Chain ID to process the request on */
  chainId: string | number;
  /** Potential balance to withdraw */
  amount: string;
  /** Asset address */
  asset: string;
  /** Asset address */
  recipient?: string;
  /** Extra gas flag */
  extraGas: boolean;
}

export interface QuoteResponse {
  baseFeeBPS: bigint,
  feeBPS: bigint,
  gasPrice: bigint,
  detail: { [key: string]: { gas: bigint, eth: bigint; } | undefined; };
  feeCommitment?: {
    expiration: number,
    withdrawalData: `0x${string}`,
    amount: string,
    extraGas: boolean,
    signedRelayerCommitment: `0x${string}`,
  };
}
