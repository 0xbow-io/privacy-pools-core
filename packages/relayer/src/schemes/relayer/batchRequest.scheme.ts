import { z } from "zod";
import { zFeeCommitment, zAddress } from "../shared.schemes.js";

// proof payload schema
const zProofPayload = z.object({
  pi_a: z.array(z.string()).length(2),
  pi_b: z.array(z.array(z.string()).length(2)).length(2),
  pi_c: z.array(z.string()).length(2),
});

// individual proof in the array
const zBatchProof = z.object({
  publicSignals: z.array(z.string()).min(1),
  proof: zProofPayload,
});

// withdrawal schema
const zWithdrawal = z.object({
  processooor: zAddress,
  data: z.string(),
});

// main batch relay request body schema
const zBatchRelayRequestBody = z.object({
  withdrawal: zWithdrawal,
  proofs: z.array(zBatchProof).min(1).max(255), // max batch size
  poolAddress: z.string(),
  chainId: z.union([z.string(), z.number()]),
  feeCommitment: zFeeCommitment.optional(),
});

export const validateBatchRelayRequestBody = (data: unknown) => {
  const result = zBatchRelayRequestBody.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
