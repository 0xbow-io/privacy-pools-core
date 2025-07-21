import { Ajv, JSONSchemaType } from "ajv";
import { QuotetBody } from "../../interfaces/relayer/quote.js";

// AJV schema for validation
const ajv = new Ajv();

const quoteSchema: JSONSchemaType<QuotetBody> = {
  type: "object",
  properties: {
    chainId: { type: ["string", "number"] },
    amount: { type: ["string"] },
    asset: { type: ["string"] },
    recipient: { type: ["string"], nullable: true },
    extraGas: { type: "boolean" }
  },
  required: ["chainId", "amount", "asset"],
} as const;

export const validateQuoteBody = ajv.compile(quoteSchema);
