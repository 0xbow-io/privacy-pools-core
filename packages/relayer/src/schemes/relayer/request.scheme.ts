import { z } from "zod";
import { zChainId, zFeeCommitment, zAddress, zHex, zNonNegativeBigInt } from "../shared.schemes.js";

const zWithdrawal = z.object({
  processooor: zAddress,
  data: zHex,
});

const zPublicSignals = z.array(z.string()).length(8);

const zProof = z.object({
  protocol: z.string().optional(),
  curve: z.string().optional(),
  pi_a: z.array(z.string()).min(1),
  pi_b: z.array(z.array(z.string()).min(1)).min(1),
  pi_c: z.array(z.string()).min(1),
});

const zRelayRequest = z.object({
  withdrawal: zWithdrawal,
  publicSignals: zPublicSignals,
  proof: zProof,
  scope: zNonNegativeBigInt,
  chainId: zChainId,
  feeCommitment: zFeeCommitment.optional(),
});

export type RelayBody = z.infer<typeof zRelayRequest>; 

export const validateRelayRequestBody = (data: unknown) => {
  const result = zRelayRequest.safeParse(data);
  return {
    ...result,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
