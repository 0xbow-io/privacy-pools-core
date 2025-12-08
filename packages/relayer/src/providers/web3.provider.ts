import { createPublicClient, createWalletClient, http, PublicClient, verifyTypedData, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RelayerConfig } from "../config/index.js";
import { FeeCommitment } from "../interfaces/relayer/common.js";
import { createChainObject } from "../utils.js";
import { ChainId } from "../types.js";

interface IWeb3Provider {
  client(chainId: ChainId): Promise<PublicClient>;
  getGasPrice(chainId: ChainId): Promise<bigint>;
}

const domain = (chainId: ChainId) => ({
  name: "Privacy Pools Relayer",
  version: "1",
  chainId,
} as const);

const RelayerCommitmentTypes = {
  RelayerCommitment: [
    { name: "withdrawalData", type: "bytes" },
    { name: "asset", type: "address" },
    { name: "expiration", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "extraGas", type: "bool" },
  ]
} as const;

/**
 * Class representing the provider for interacting with several chains
 */
export class Web3Provider implements IWeb3Provider {
  constructor() {}

  /*
   * Create a Client object for a specific chainId
   *
   **/
  async client(chainId: ChainId): Promise<PublicClient> {
    const config = new RelayerConfig();
    const chainConfig = await config.chain(chainId).config();
    const chain = createChainObject(chainConfig); 
    const client = createPublicClient({ 
      chain, 
      transport: http(chain.rpcUrls.default.http[0])
    });
    if (client === undefined) {
      throw Error(`Web3ProviderError::UnsupportedChainId(${chainId})`);
    }
    else return client;
  }

  async signer(chainId: ChainId): Promise<WalletClient> {
    const config = new RelayerConfig().chain(chainId);
    const chainConfig = await config.config();
    const chain = createChainObject(chainConfig);  
    const pkey = await config.signerPrivateKey();
    const account = privateKeyToAccount(pkey);
    const signer = createWalletClient({
      account,
      chain,
      transport: http(chain.rpcUrls.default.http[0])
    });
    if (signer === undefined) {
      throw Error(`Web3ProviderError::UnsupportedChainId(${chainId})`);
    } 
    else return signer;
  }

  async getGasPrice(chainId: ChainId): Promise<bigint> {
    const client = await this.client(chainId);
    return client.getGasPrice();
  }

  async signRelayerCommitment(chainId: ChainId, commitment: Omit<FeeCommitment, 'signedRelayerCommitment'>) {
    const chain = new RelayerConfig().chain(chainId);
    const pkey = await chain.signerPrivateKey();
    const signer = privateKeyToAccount(pkey);
    const { withdrawalData, expiration, extraGas, amount, asset } = commitment;
    return signer.signTypedData({
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        asset,
        amount,
        extraGas,
        expiration: BigInt(expiration)
      }
    });
  }

  async verifyRelayerCommitment(chainId: ChainId, commitment: FeeCommitment): Promise<boolean> {
    const chain = new RelayerConfig().chain(chainId);
    const pkey = await chain.signerPrivateKey();
    const signer = privateKeyToAccount(pkey);
    const { withdrawalData, asset, expiration, amount, extraGas, signedRelayerCommitment } = commitment;
    return verifyTypedData({
      address: signer.address,
      domain: domain(chainId),
      types: RelayerCommitmentTypes,
      primaryType: 'RelayerCommitment',
      message: {
        withdrawalData,
        asset,
        amount,
        extraGas,
        expiration: BigInt(expiration)
      },
      signature: signedRelayerCommitment
    });
  }

}
