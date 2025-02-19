import { encodeAbiParameters, getAddress, Hex } from "viem";
import { request } from "./api-test.js";
import { deposit, proveWithdrawal } from "./create-withdrawal.js";
import { Hash, Withdrawal } from "@0xbow/privacy-pools-core-sdk";

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

const recipient = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
const processooor = getAddress("0xa513E6E4b8f2a923D98304ec87F64353C4D5C853"); // when relaying processooor is the entrypoint
const FEE_RECEIVER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function prove(w: Withdrawal) {
  return proveWithdrawal(w);
}

async function depositEth() {
  const r = await deposit();
  console.log(r.hash);
  await r.wait();
  console.log("done");
}

(async () => {
  const scope = BigInt(
    "0x0555c5fdc167f1f1519c1b21a690de24d9be5ff0bde19447a5f28958d9256e50",
  ) as Hash;
  const data = encodeAbiParameters(FeeDataAbi, [
    {
      recipient,
      feeRecipient: FEE_RECEIVER_ADDRESS,
      relayFeeBPS: 1_000n,
    },
  ]) as Hex;

  const withdrawal = { processooor, scope, data };

  await depositEth();

  // prove
  const { proof, publicSignals } = await prove(withdrawal);
  const requestBody = {
    withdrawal: { ...withdrawal, scope: withdrawal.scope.toString() },
    publicSignals,
    proof,
  };

  await request(requestBody);
})();
