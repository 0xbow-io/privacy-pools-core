import { getAddress } from "viem";
import { z } from "zod";

const zNonNegativeBigInt = z
  .string()
  .or(z.number())
  .pipe(z.coerce.bigint().nonnegative());

// Address validation schema
export const zAddress = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .length(42)
  .transform((v) => getAddress(v));

export const zHex = z
  .string()
  .regex(/^0x[0-9a-fA-F]+/)
  .transform(x => x as `0x${string}`);

export const zWithdrawal = z.object({
  processooor: zAddress,
  data: zHex
});

export const zProof = z.object({
  protocol: z.string().optional(),
  curve: z.string().optional(),
  pi_a: z.tuple([z.string(), z.string(), z.string()]),
  pi_b: z.tuple([
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string()]),
    z.tuple([z.string(), z.string()]),
  ]),
  pi_c: z.tuple([z.string(), z.string(), z.string()]),
});

export const zFeeCommitment = z.object({
  expiration: z.number().nonnegative().int(),
  withdrawalData: zHex,
  asset: zAddress,
  signedRelayerCommitment: zHex,
  extraGas: z.boolean(),
  amount: zNonNegativeBigInt
});

export const zRelayRequest = z.object({
  withdrawal: zWithdrawal,
  publicSignals: z.array(z.string()).length(8),
  proof: zProof,
  scope: zNonNegativeBigInt,
  chainId: z.string().or(z.number()).pipe(z.coerce.number().positive()),
  feeCommitment: zFeeCommitment.optional()
})
  .strict()
  .readonly();
