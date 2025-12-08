import { z } from "zod";
import { zFeeCommitment } from "../shared.schemes.js";

// batch quote schema
const zBatchQuoteSchema = z.object({
  batchSize: z.number(),
  totalAmount: z.string(),
  chainId: z.union([z.string(), z.number()]),
  recipient: z.string().optional(),
  feeCommitment: zFeeCommitment.optional(),
});

export const validateBatchRelayQuoteBody = (data: unknown) => {
  const result = zBatchQuoteSchema.safeParse(data);
  return {
    success: result.success,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
