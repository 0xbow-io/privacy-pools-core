import minimist from 'minimist';
import { getAddress } from 'viem';
import { quote, request } from "./api-test.js";
import { ChainContext } from "./chain.js";
import { feeRecipient, PRIVATE_KEY, processooor, recipient } from "./constants.js";
import { encodeFeeData, isNative } from "./util.js";
import { SdkWrapper } from './sdk-wrapper.js';

interface Context {
  chainId: number;
  privateKey: `0x${string}`;
}

interface DepositCli {
  context: Context;
  note: string;
  amount: bigint;
  asset?: `0x${string}`;
}

export async function depositCli({ note, amount, asset, context }: DepositCli) {
  const { chainId, privateKey } = context;
  const sdkWrapper = new SdkWrapper(ChainContext(chainId, privateKey));
  let r;
  if (asset) {
    r = await sdkWrapper.depositAsset(note, amount, asset);
  } else {
    r = await sdkWrapper.deposit(note, amount);
  }
  await r.wait();
  console.log(`Successful deposit, hash := ${r.hash}`);
}

interface QuoteCli {
  context: Context;
  asset: `0x${string}`;
  amount: bigint;
  extraGas: boolean;
}

export async function quoteCli({ context, asset, amount, extraGas }: QuoteCli) {
  return quote({
    chainId: context.chainId,
    amount: amount.toString(),
    asset,
    recipient,
    extraGas
  });
}

interface RelayCli {
  context: Context;
  asset: `0x${string}`;
  withQuote: boolean;
  extraGas: boolean;
  amount: bigint;
  note: string;
  newNote: string;
}

export async function relayCli({ asset, withQuote, amount, extraGas, note, newNote, context }: RelayCli) {

  const { chainId, privateKey } = context;
  const sdkWrapper = new SdkWrapper(ChainContext(chainId, privateKey));

  const pool = await sdkWrapper.chainContext.getPoolContract(asset);
  const scope = await pool.read.SCOPE();

  // 0.1 ETH or 1.5 dollars
  const _withdrawAmount = isNative(asset) ? 100000000000000000n : 1500000n;
  const withdrawAmount = amount ? BigInt(amount) : _withdrawAmount;

  let data;
  let feeCommitment = undefined;
  if (withQuote) {
    const quoteRes = await quote({
      chainId,
      amount: withdrawAmount.toString(),
      asset,
      recipient,
      extraGas
    });
    data = quoteRes.feeCommitment!.withdrawalData as `0x${string}`;
    feeCommitment = {
      ...quoteRes.feeCommitment,
    };
  } else {
    data = encodeFeeData({ recipient, feeRecipient, relayFeeBPS: 100n });
  }

  const withdrawal = { processooor, data };

  // prove
  const { proof, publicSignals } = await sdkWrapper.proveWithdrawal(withdrawAmount, withdrawal, scope, note, newNote);

  const requestBody = {
    scope: scope.toString(),
    chainId: sdkWrapper.chainContext.chain.id,
    withdrawal,
    publicSignals,
    proof,
    feeCommitment
  };

  await request(requestBody);
}

interface DefArgs {
  _: string[],
  chainId: number;
  privateKey: `0x${string}`;
}

export async function cli() {
  let args = minimist(process.argv.slice(2), {
    string: ["asset", "note", "new-note"],
    boolean: ["quote", "extraGas"],
    alias: {
      "private-key": "privateKey",
      "chain-id": "chainId",
      "new-note": "newNote"
    },
    default: {
      "chainId": process.env["CHAIN_ID"] || 1115511,
      "privateKey": process.env["PRIVATE_KEY"] || PRIVATE_KEY,
      "asset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "extraGas": true,
      "quote": false,
      "note": "7338940278733227:2827991637673173",
      "new-note": "6593588285288381:1800210687471587"
    }
  });
  const action = process.argv[2]!;
  const actions = [
    "deposit",
    "quote",
    "relay"
  ];

  if (!actions.includes(action)) {
    console.log("No action selected");
    process.exit(0);
  }

  const context = { chainId: Number.parseInt(args.chainId), privateKey: args.privateKey };

  switch (action) {
    case "deposit": {
      args = args as DefArgs & { amount: string, asset?: string; note: string; };
      const r = await depositCli({ note: args.note, amount: BigInt(args.amount), asset: args.asset, context });
      console.log(r);
      break;
    }
    case "quote": {
      if (args.length < 3) {
        throw Error("Not enough args");
      }
      args = args as DefArgs & { amount: string, asset: string; extraGas: boolean; };
      await quoteCli({
        context,
        asset: getAddress(args.asset),
        amount: BigInt(args.amount),
        extraGas: args.extraGas
      });
      break;
    }
    case "relay": {
      args = args as DefArgs & { amount: string, asset: string; quote: boolean; extraGas: boolean; note: string; newNote: string; };
      await relayCli({
        context,
        asset: getAddress(args.asset),
        amount: BigInt(args.amount),
        extraGas: args.extraGas,
        withQuote: args.quote,
        note: args.note,
        newNote: args.newNote
      });
      break;
    }
    case undefined: {
      console.log("No action selected");
      break;
    }
  }

}
