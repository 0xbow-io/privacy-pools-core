import { Hex } from "viem";
import { encodeAbiParameters, getAddress } from "viem/utils";
import {
  FEE_BPS_TEST,
  FEE_RECEIVER_ADDRESS_TEST,
  RECIPIENT_TEST,
} from "./default.input";

const FeeDataAbi = [
  {
    name: "FeeData",
    type: "tuple",
    components: [
      { name: "recipient", type: "address" },
      { name: "feeRecipient", type: "address" },
      { name: "relayFeeBPS", type: "uint256" },
    ],
  },
] as const;

export function createData(
  recipient: string,
  feeRecipient: string,
  relayFeeBPS: bigint,
): Hex {
  return encodeAbiParameters(FeeDataAbi, [
    {
      recipient: getAddress(recipient),
      feeRecipient: getAddress(feeRecipient),
      relayFeeBPS,
    },
  ]) as Hex;
}

export const dataCorrect = createData(
  RECIPIENT_TEST,
  FEE_RECEIVER_ADDRESS_TEST,
  FEE_BPS_TEST,
);
export const dataMismatchFeeRecipient = createData(
  RECIPIENT_TEST,
  RECIPIENT_TEST,
  FEE_BPS_TEST,
);
export const dataMismatchFee = createData(
  RECIPIENT_TEST,
  FEE_RECEIVER_ADDRESS_TEST,
  FEE_BPS_TEST * 2n,
);
