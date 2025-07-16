
/**
 * Represents the relayer commitment for a pre-built withdrawal.
 */
export interface FeeCommitment {
  expiration: number,
  withdrawalData: `0x${string}`,
  amount: bigint,
  extraGas: boolean,
  signedRelayerCommitment: `0x${string}`,
}

