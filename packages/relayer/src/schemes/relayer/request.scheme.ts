import { Ajv, JSONSchemaType } from "ajv";
import { RelayRequestBody } from "../../interfaces/relayer/request.js";

// AJV schema for validation
const ajv = new Ajv();

const relayRequestSchema: JSONSchemaType<RelayRequestBody> = {
  type: "object",
  properties: {
    withdrawal: {
      type: "object",
      properties: {
        processooor: { type: "string" },
        data: { type: "string", pattern: "0x[0-9a-fA-F]+" },
      },
      required: ["processooor", "data"],
    },
    publicSignals: {
      type: "array",
      items: { type: "string" },
      minItems: 8,
      maxItems: 8,
    },
    proof: {
      type: "object",
      properties: {
        protocol: { type: "string" },
        curve: { type: "string" },
        pi_a: { type: "array", items: { type: "string" }, minItems: 1 },
        pi_b: {
          type: "array",
          items: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
          },
          minItems: 1,
        },
        pi_c: { type: "array", items: { type: "string" }, minItems: 1 },
      },
      required: ["pi_a", "pi_b", "pi_c"],
    },
    scope: { type: "string" },
    chainId: { type: ["string", "number"] },
    feeCommitment: {
      type: "object",
      properties: {
        expiration: { type: "number" },
        withdrawalData: { type: "string", pattern: "0x[0-9a-fA-F]+" },
        signedRelayerCommitment: { type: "string", pattern: "0x[0-9a-fA-F]+" }
      },
      nullable: true,
      required: ["expiration", "signedRelayerCommitment"]
    }
  },
  required: ["withdrawal", "proof", "publicSignals", "scope", "chainId"],
} as const;

export const validateRelayRequestBody = ajv.compile(relayRequestSchema);
