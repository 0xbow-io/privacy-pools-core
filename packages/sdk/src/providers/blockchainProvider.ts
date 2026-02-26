import type { Address, Chain, HttpTransport } from "viem";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { IBlockchainProvider, InvalidRpcUrl } from "../internal.js";

export class BlockchainProvider implements IBlockchainProvider {
  private client: ReturnType<typeof createPublicClient<HttpTransport, Chain>>;

  constructor(rpcUrl: string) {
    // dummy check for the rpcUrl
    if (!rpcUrl || !rpcUrl.startsWith("http")) {
      throw new InvalidRpcUrl(rpcUrl);
    }

    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
  }

  /** @inheritdoc */
  async getBalance(address: Address): Promise<bigint> {
    return this.client.getBalance({ address });
  }
}
