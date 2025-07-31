import { Address, CustomSource, getContract } from "viem";

import { web3Provider } from "../index.js";
import { Permit2ABI } from "./abis/permit2.abi.js";
import { createPermitSingleData, PermitSingle } from "./permit2.js";

export async function createPermit2<Signer extends CustomSource>({
  signer,
  chainId,
  permit2Address,
  routerAddress,
  assetAddress,
  allowanceAmount,
}: {
  signer: Signer,
  chainId: number,
  permit2Address: Address,
  routerAddress: Address,
  assetAddress: Address,
  allowanceAmount: bigint,
}): Promise<[PermitSingle, `0x${string}`]> {

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
      amount: allowanceAmount,
      expiration: deadline,
      nonce
    },
    sigDeadline: BigInt(deadline)
  };
  const permitData = createPermitSingleData(permitSingle, permit2Address, chainId);

  const signature = await signer.signTypedData({
    domain: permitData.domain,
    types: permitData.types,
    message: permitSingle,
    primaryType: "PermitSingle"
  });

  return [permitSingle, signature];
}
