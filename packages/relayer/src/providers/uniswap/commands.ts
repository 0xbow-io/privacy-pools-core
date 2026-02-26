import { encodeAbiParameters, getAddress } from "viem";

const V3_SWAP_EXACT_IN = 0x00;
const UNWRAP_WETH = 0x0c;
const PERMIT2_TRANSFER_FROM = 0x02;
const SWEEP = 0x04;
const TRANSFER = 0x05;
const PERMIT2_PERMIT = 0x0a;

export type CommandPair = [number, `0x${string}`];

export interface IPermitSingle {
  details: {
    token: `0x${string}`;
    amount: bigint;
    expiration: number;
    nonce: number;
  };
  spender: `0x${string}`;
  sigDeadline: bigint;
}

export interface Permit2Params {
  permit: IPermitSingle;
  signature: string;
}

export function permit2({ permit, signature }: Permit2Params): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      {
        name: 'PermitSingle', type: 'tuple',
        components: [
          {
            name: "details", type: "tuple", components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint160" },
              { name: "expiration", type: "uint48" },
              { name: "nonce", type: "uint48" },
            ]
          },
          { name: "spender", type: "address" },
          { name: "sigDeadline", type: "uint256" }
        ]
      },
      { name: 'signature', type: 'bytes' },
    ],
    [
      permit,
      signature as `0x${string}`
    ]
  );
  return [PERMIT2_PERMIT, encodedInput];
}

interface TransferParams {
  token: string;
  recipient: `0x${string}`;
  amount: bigint;
}

export function transferWithPermit({ token, recipient, amount }: TransferParams): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    [
      getAddress(token), getAddress(recipient), amount
    ]
  );
  return [PERMIT2_TRANSFER_FROM, encodedInput];
}

export function transfer({ token, recipient, amount }: TransferParams): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    [
      getAddress(token), getAddress(recipient), amount
    ]
  );
  return [TRANSFER, encodedInput];
}

interface V3SwapExactInParams {
  recipient: string;
  amountIn: bigint;
  minAmountOut: bigint;
  path: `0x${string}`;
  payerIsUser: boolean;
}

export function swapV3ExactIn({
  recipient,
  amountIn,
  minAmountOut,
  path,
  payerIsUser
}: V3SwapExactInParams): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'path', type: 'bytes' },
      { name: 'payerIsUser', type: 'bool' },
    ],
    [
      getAddress(recipient), amountIn, minAmountOut, path, payerIsUser
    ]
  );
  return [V3_SWAP_EXACT_IN, encodedInput];
}

interface UnwrapWethParams {
  recipient: string;
  minAmountOut: bigint;
}

export function unwrapWeth({ recipient, minAmountOut }: UnwrapWethParams): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      { name: 'recipient', type: 'address' },
      { name: 'minAmountOut', type: 'uint256' },
    ],
    [
      getAddress(recipient), minAmountOut
    ]
  );
  return [UNWRAP_WETH, encodedInput];
}

interface SweepParams {
  token: string;
  recipient: string;
  minAmountOut: bigint;
}

export function sweep({ token, recipient, minAmountOut }: SweepParams): CommandPair {
  const encodedInput = encodeAbiParameters(
    [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'minAmountOut', type: 'uint256' },
    ],
    [
      getAddress(token), getAddress(recipient), minAmountOut
    ]
  );
  return [SWEEP, encodedInput];
}

export const enum Command {
  permit2 = "permit2",
  transfer = "transfer",
  transferWithPermit = "transferWithPermit",
  swapV3ExactIn = "swapV3ExactIn",
  unrwapWeth = "unrwapWeth",
  sweep = "sweep",
};

interface CommandParams {
  [Command.permit2]: Permit2Params;
  [Command.transfer]: TransferParams;
  [Command.transferWithPermit]: TransferParams;
  [Command.swapV3ExactIn]: V3SwapExactInParams;
  [Command.unrwapWeth]: UnwrapWethParams;
  [Command.sweep]: SweepParams;
};

type CommandFnMap = {
  [K in keyof CommandParams]: (params: CommandParams[K]) => CommandPair;
};

export type Instruction = {
  [K in keyof CommandParams]: {
    command: K;
    params: CommandParams[K];
  }
}[keyof CommandParams];

export const commandFnMap: CommandFnMap = {
  [Command.permit2]: permit2,
  [Command.transfer]: transfer,
  [Command.transferWithPermit]: transferWithPermit,
  [Command.sweep]: sweep,
  [Command.swapV3ExactIn]: swapV3ExactIn,
  [Command.unrwapWeth]: unwrapWeth,
};

export function encodeInstruction<K extends Command>(ins: { command: K, params: CommandParams[K]; }): CommandPair {
  return commandFnMap[ins.command](ins.params);
}
