import { Hash, Withdrawal } from "@0xbow/privacy-pools-core-sdk";
import { encodeAbiParameters, getAddress, Hex } from "viem";
import { request, quote } from "./api-test.js";
import { anvilChain, pool } from "./chain.js";
import { ENTRYPOINT_ADDRESS } from "./constants.js";
import { deposit, proveWithdrawal } from "./create-withdrawal.js";

interface QuoteResponse {
  baseFeeBPS: bigint,
  feeBPS: bigint,
  feeCommitment?: {
    expiration: number,
    withdrawalData: `0x${string}`,
    signedRelayerCommitment: `0x${string}`,
  }
}

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
const processooor = ENTRYPOINT_ADDRESS;
const FEE_RECEIVER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function prove(w: Withdrawal, scope: bigint) {
  return proveWithdrawal(w, scope);
}

async function depositCli() {
  const r = await deposit();
  await r.wait();
  console.log(`Successful deposit, hash := ${r.hash}`);
}

async function quoteReq(chainId: number, asset: string, recipient: string, amount: string) {
  return (await quote({
    chainId,
    amount,
    asset,
    recipient
  }) as QuoteResponse);
}

async function quoteCli(chainId: string, asset: string, amount?: string) {
  const _amount = amount ? Number(amount) : 100_000_000_000_000_000n
  quoteReq(Number(chainId), asset, recipient, _amount.toString())
}

async function relayCli(chainId: string, asset: string, withQuote: boolean) {

  const scope = await pool.read.SCOPE() as Hash;

  let data;
  let feeCommitment = undefined;
  if (withQuote) {
    const amount = "100000000000000000";  // 0.1 ETH
    const quoteRes = await quoteReq(Number(chainId), asset, recipient, amount);
    data = quoteRes.feeCommitment!.withdrawalData as Hex
    feeCommitment = {
      ...quoteRes.feeCommitment,
    };
  } else {
    data = encodeAbiParameters(FeeDataAbi, [
      {
        recipient,
        feeRecipient: FEE_RECEIVER_ADDRESS,
        relayFeeBPS: 100n,
      },
    ]) as Hex;
  }

  const withdrawal = { processooor, data };

  // prove
  const { proof, publicSignals } = await prove(withdrawal, scope);

  const requestBody = {
    scope: scope.toString(),
    chainId: anvilChain.id,
    withdrawal,
    publicSignals,
    proof,
    feeCommitment
  };

  await request(requestBody);
}

async function cli() {
  const args = process.argv.slice(2)
  const action = args[0];
  switch (action) {
    case "deposit": {
      console.log(action)
      await depositCli();
      break;
    }
    case "quote": {
      console.log(action)
      if (args.length < 3) {
        throw Error("Not enough args")
      }
      await quoteCli(args[1]!, args[2]!, args[3])
      break;
    }
    case "relay": {
      console.log(...args)
      const withQuote = args.includes("--with-quote")
      const noFlags = args.slice(1).filter(a => a !== "--with-quote")
      if (noFlags.length < 2) {
        throw Error("Not enough args")
      }
      await relayCli(noFlags[0]!, noFlags[1]!, withQuote);
      break;
    }
    case undefined: {
      console.log("No action selected")
      break;
    }
  }

}


(async () => {

  cli();

})();
