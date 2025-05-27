import { BigNumber } from "@ethersproject/bignumber";
import { arrayify } from "@ethersproject/bytes";
import { AllowanceTransfer } from "@uniswap/permit2-sdk";
import { Address, CustomSource, fromBytes, getAddress, getContract, TypedDataDomain as ViemTypedDataDomain } from "viem";

import { Permit2ABI } from "./abis/permit2.abi.js";
import { IPermitSingle } from "./commands.js";
import { web3Provider } from "../index.js";

function domainEthersToViem(domain: ReturnType<(typeof AllowanceTransfer.getPermitData)>["domain"]): ViemTypedDataDomain {
  const {
    name,
    version,
    chainId,
    verifyingContract,
    salt,
  } = domain;
  return {
    name: name || undefined,
    version: version || undefined,
    chainId: chainId ? BigNumber.from(chainId).toBigInt() : undefined,
    verifyingContract: verifyingContract ? getAddress(verifyingContract) : undefined,
    salt: salt ? fromBytes(arrayify(salt), "hex") : undefined,
  };
}

export async function createPermit2<Signer extends CustomSource>({
  signer,
  chainId,
  permit2Address,
  routerAddress,
  assetAddress,
  amountIn,
}: {
  signer: Signer,
  chainId: number,
  permit2Address: Address,
  routerAddress: Address,
  assetAddress: Address,
  amountIn: bigint,
}): Promise<[IPermitSingle, `0x${string}`]> {

  const deadline = Math.floor(3600 + Number(new Date()) / 1000); // one hour

  const permitContract = getContract({
    abi: Permit2ABI,
    address: permit2Address,
    client: web3Provider.client(chainId)
  });

  const allowance = await permitContract.read.allowance([
    signer.address,
    assetAddress,
    routerAddress
  ]);
  const [, , nonce] = allowance;

  const permitSingle = {
    spender: routerAddress,
    details: {
      token: assetAddress,
      amount: amountIn,
      expiration: deadline,
      nonce
    },
    sigDeadline: BigInt(deadline)
  };
  const permitData = AllowanceTransfer.getPermitData(permitSingle, permit2Address, chainId);

  const details = permitData.values.details;
  if (Array.isArray(details)) {
    throw new Error();
  }

  const signature = await signer.signTypedData({
    domain: domainEthersToViem(permitData.domain),
    types: permitData.types,
    message: permitSingle,
    primaryType: "PermitSingle"
  });

  return [permitSingle, signature];
}
