import { Ajv, JSONSchemaType } from "ajv";

// AJV schema for validation
const ajv = new Ajv();

const detailsRequestSchema: JSONSchemaType<{ chainId: string, assetAddress: string }> = {
  type: "object",
  properties: {
    "chainId": { "type": "string" },
    "assetAddress": { "type": "string" },
  },
  required: ["chainId", "assetAddress"],
} as const;

export const validateDetailsQuerystring = ajv.compile(detailsRequestSchema);
