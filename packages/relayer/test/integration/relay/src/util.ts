import { encodeAbiParameters } from "viem";

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
];

export function encodeFeeData({
  recipient, feeRecipient, relayFeeBPS
}: {
  recipient: `0x${string}`; feeRecipient: `0x${string}`; relayFeeBPS: bigint;
}) {
  return encodeAbiParameters(FeeDataAbi, [
    {
      recipient,
      feeRecipient,
      relayFeeBPS,
    },
  ]);
}

export function isNative(asset: `0x${string}`) {
  return asset.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
}
