import { z } from "zod";
import { zAddress, zChainId, zNonNegativeBigInt } from "../shared.schemes.js";

const zQuoteRequest = z.object({
  chainId: zChainId,
  amount: zNonNegativeBigInt,
  asset: zAddress,
  recipient: zAddress.optional(),
  extraGas: z.boolean().optional(), // TODO this was missing before? idk added it back just in case
});

export type QuoteBody = z.infer<typeof zQuoteRequest>; 

export const validateQuoteBody = (data: unknown) => {
  const result = zQuoteRequest.safeParse(data);
  return {
    ...result,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
