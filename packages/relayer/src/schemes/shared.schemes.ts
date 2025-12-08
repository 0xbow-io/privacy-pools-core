import { getAddress, Hex } from "viem";
import { z } from "zod";
import { ChainId, PrivateKey } from "../types.js";

export const zChainId = z
  .string()
  .or(z.number()).pipe(z.coerce.number().positive())
  .transform(v => v as ChainId);

export const zNonNegativeBigInt = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Address validation schema
export const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .length(42)
  .transform((v) => getAddress(v));

// Private key validation schema
export const zPrivateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .length(66)
  .transform((v) => v as PrivateKey);

// Hex validation schema
export const zHex = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .transform((v) => v as Hex);

export const zFeeCommitment = z.object({
  withdrawalData: zHex,
  asset: zAddress,
  expiration: z.number(),
  amount: zNonNegativeBigInt,
  extraGas: z.boolean(),
  signedRelayerCommitment: zHex,
});
