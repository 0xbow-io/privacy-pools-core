import { Address } from "../internal.js";

/**
 * Represents an interface for a blockchain provider.
 */
export interface IBlockchainProvider {
  /**
   * Retrieves the balance of the specified address.
   * @param {Address} address The address for which to retrieve the balance.
   * @returns {Promise<bigint>} A Promise that resolves to the balance of the address.
   */
  getBalance(address: Address): Promise<bigint>;
}
