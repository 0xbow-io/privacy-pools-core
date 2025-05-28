import { Ajv, JSONSchemaType } from "ajv";
import { RelayRequestBody } from "../../interfaces/relayer/request.js";

import { z } from "zod";
import { getAddress } from "viem";

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

// // AJV schema for validation
// const ajv = new Ajv();

// const relayRequestSchema: JSONSchemaType<RelayRequestBody> = {
//   type: "object",
//   properties: {
//     withdrawal: {
//       type: "object",
//       properties: {
//         processooor: { type: "string" },
//         data: { type: "string", pattern: "0x[0-9a-fA-F]+" },
//       },
//       required: ["processooor", "data"],
//     },
//     publicSignals: {
//       type: "array",
//       items: { type: "string" },
//       minItems: 8,
//       maxItems: 8,
//     },
//     proof: {
//       type: "object",
//       properties: {
//         protocol: { type: "string" },
//         curve: { type: "string" },
//         pi_a: { type: "array", items: { type: "string" }, minItems: 1 },
//         pi_b: {
//           type: "array",
//           items: {
//             type: "array",
//             items: { type: "string" },
//             minItems: 1,
//           },
//           minItems: 1,
//         },
//         pi_c: { type: "array", items: { type: "string" }, minItems: 1 },
//       },
//       required: ["pi_a", "pi_b", "pi_c"],
//     },
//     scope: { type: "string" },
//     chainId: { type: ["string", "number"] },
//     feeCommitment: {
//       type: "object",
//       properties: {
//         expiration: { type: "number" },
//         withdrawalData: { type: "string", pattern: "0x[0-9a-fA-F]+" },
//         signedRelayerCommitment: { type: "string", pattern: "0x[0-9a-fA-F]+" },
//         extraGas: { type: "boolean" },
//         amount: { type: "number" }
//       },
//       nullable: true,
//     }
//   },
//   required: ["withdrawal", "proof", "publicSignals", "scope", "chainId"],
// } as const;

// export const validateRelayRequestBody = ajv.compile(relayRequestSchema);
