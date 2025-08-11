import minimist from 'minimist';
import { getAddress } from 'viem';
import { quote, request } from "./api-test.js";
import { ChainContext } from "./chain.js";
import { feeRecipient, PRIVATE_KEY, processooor, recipient } from "./constants.js";
import { encodeFeeData, isNative } from "./util.js";
import { SdkWrapper } from './sdk-wrapper.js';
import * as fs from "fs";

interface Context {
  chainId: number;
  privateKey: `0x${string}`;
}

interface DepositCli {
  context: Context;
  accNonce: bigint;
  amount: bigint;
  asset: `0x${string}`;
}

export async function depositCli({ accNonce, amount, asset, context }: DepositCli) {
  const { chainId, privateKey } = context;
  const sdkWrapper = new SdkWrapper(ChainContext(chainId, privateKey));
  let r;
  if (isNative(asset)) {
    r = await sdkWrapper.deposit(accNonce, amount);
  } else {
    r = await sdkWrapper.depositAsset(accNonce, amount, asset);
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

  fromDeposit: boolean;
  fromLabel?: bigint;
  accNonce: bigint;
  value: bigint;

  leaves: {
    index: bigint;
    leaf: bigint;
    root: bigint;
    block: bigint;
  }[];
}

export async function relayCli({ asset, withQuote, amount, extraGas, fromDeposit, fromLabel, accNonce, value, context, leaves }: RelayCli) {

  const { chainId, privateKey } = context;
  const sdkWrapper = new SdkWrapper(ChainContext(chainId, privateKey));

  const pool = await sdkWrapper.chainContext.getPoolContract(asset);
  const scope = await pool.read.SCOPE();

  let note: { nullifier: bigint, secret: bigint; };
  let newNote: { nullifier: bigint, secret: bigint; } | undefined;
  let label: bigint;
  if (fromDeposit) {
    note = sdkWrapper.depositSecret(scope, accNonce);
    const noteLabel = await sdkWrapper.findLabelFromDepositNote(asset, note);
    label = noteLabel;
    newNote = sdkWrapper.withdrawSecret(noteLabel, 0n);
  } else if (fromLabel !== undefined) {
    note = sdkWrapper.withdrawSecret(fromLabel, accNonce);
    newNote = sdkWrapper.withdrawSecret(fromLabel, accNonce + 1n);
    label = fromLabel;
  } else {
    throw new Error("No deposit or label");
  }

  console.log("note", note);
  console.log("newnote", newNote);

  // 0.1 ETH or 1.5 dollars
  const withdrawAmount = amount;

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
  const { proof, publicSignals } = await sdkWrapper.proveWithdrawal(withdrawAmount, withdrawal, scope, label, value, note, newNote, leaves);

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
    string: ["asset", "fromLabel", "accNonce", "output"],
    boolean: ["quote", "extraGas", "fromDeposit"],
    alias: {
      "private-key": "privateKey",
      "chain-id": "chainId",
      "from-deposit": "fromDeposit",
      "acc-nonce": "accNonce",
      "from-label": "fromLabel",
      "cache-file": "cacheFile"
    },
    default: {
      "chainId": process.env["CHAIN_ID"] || 1115511,
      "privateKey": process.env["PRIVATE_KEY"] || PRIVATE_KEY,
      "asset": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "extraGas": true,
      "quote": false,
      "fromDeposit": false,
    }
  });
  const action = process.argv[2]!;
  const actions = [
    "deposit",
    "quote",
    "relay",
    "tree"
  ];

  if (!actions.includes(action)) {
    console.log("No action selected");
    process.exit(0);
  }

  const context = { chainId: Number.parseInt(args.chainId), privateKey: args.privateKey };

  switch (action) {
    case "deposit": {
      args = args as DefArgs & { amount: string, asset?: string; note: string; };
      const r = await depositCli({ accNonce: BigInt(args.accNonce), amount: BigInt(args.amount), asset: args.asset, context });
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
      args = args as DefArgs & {
        amount: string;
        asset: string;
        quote: boolean;
        extraGas: boolean;

        fromDeposit: boolean;
        fromLabel: string;
        accNonce: string;
        value: string;

        cacheFile: string;
      };

      await relayCli({
        context,
        asset: getAddress(args.asset),
        amount: BigInt(args.amount),
        extraGas: args.extraGas,
        withQuote: args.quote,

        fromDeposit: args.fromDeposit,
        fromLabel: args.fromLabel ? BigInt(args.fromLabel) : undefined,
        accNonce: BigInt(args.accNonce),
        value: BigInt(args.value),

        leaves: readLeavesFromFile(args.cacheFile),
      });
      break;
    }
    case "tree": {
      args = args as DefArgs & { fromBlock: string; asset: string; output?: string; };
      buildTreeCache({ context, asset: args.asset, fromBlock: args.fromBlock, output: args.output });
      break;
    }
    case undefined: {
      console.log("No action selected");
      break;
    }
  }

}

async function buildTreeCache({ context, asset, fromBlock, output }: { fromBlock: string; asset: string; output?: string; } & { context: Context; }) {
  console.log("Building tree");
  const { chainId, privateKey } = context;
  const sdkWrapper = new SdkWrapper(ChainContext(chainId, privateKey));
  const pool = await sdkWrapper.chainContext.getPoolContract(asset as `0x${string}`);
  const leavesRaw = await pool.getEvents.LeafInserted({ fromBlock: BigInt(fromBlock) });
  const leaves = leavesRaw.map(l => ({
    index: l.args._index!.toString(),
    leaf: l.args._leaf!.toString(),
    root: l.args._root!.toString(),
    block: l.blockNumber.toString()
  }));
  const timestamp = (new Date()).toISOString().replaceAll(":", "_").replace(new RegExp(".[0-9]{3}Z"), "");
  const treeFileName = output || `./tree-cache-${timestamp}.json`;
  fs.writeFileSync(treeFileName, JSON.stringify(leaves, null, 2));
  console.log(`Wrote ${leaves.length} leaves to file ${treeFileName}`);
}

function readLeavesFromFile(filePath: string) {
  const rawLeaves = JSON.parse(fs.readFileSync(filePath, { encoding: 'utf-8' })) as { index: string, leaf: string, root: string, block: string; }[];
  return rawLeaves.map(l => ({
    index: BigInt(l.index),
    leaf: BigInt(l.leaf),
    root: BigInt(l.root),
    block: BigInt(l.block),
  }));
}
