import { z } from "zod";
import { zAddress, zChainId } from "../shared.schemes.js";

const zDetailsRequest = z.object({
  chainId: zChainId,
  assetAddress: zAddress,
});

export type DetailsQuery = z.infer<typeof zDetailsRequest>;

export const validateDetailsQuerystring = (data: unknown) => {
  const result = zDetailsRequest.safeParse(data);

  return {
    ...result,
    errors: result.success ? undefined : result.error.errors.map(err => ({ 
      message: `${err.path.join('.')}: ${err.message}` 
    }))
  };
};
