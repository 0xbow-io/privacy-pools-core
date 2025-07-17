
/**
 * Represents the relayer commitment for a pre-built withdrawal.
 */
export interface FeeCommitment {
  expiration: number,
  withdrawalData: `0x${string}`,
  signedRelayerCommitment: `0x${string}`,
}

