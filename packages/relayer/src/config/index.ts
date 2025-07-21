import fs from "node:fs";
import path from "node:path";
import { ConfigError, RelayerError } from "../exceptions/base.exception.js";
import { zConfig } from "./schemas.js";
import { AssetConfig, ChainConfig } from "./types.js";

/**
 * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
 * or from the default path ./config.json.
 * 
 * @returns {Record<string, unknown>} The parsed configuration object
 * @throws {ConfigError} If the configuration file is not found
 */
function readConfigFile(): Record<string, unknown> {
  let configPathString = process.env["CONFIG_PATH"];
  if (!configPathString) {
    console.warn("CONFIG_PATH is not set, using default path: ./config.json");
    configPathString = "./config.json";
  }
  if (!fs.existsSync(configPathString)) {
    throw ConfigError.default("No config.json found for relayer.");
  }
  return JSON.parse(
    fs.readFileSync(path.resolve(configPathString), { encoding: "utf-8" }),
  );
}

// Parse the configuration file
const config = zConfig.parse(readConfigFile());

// Export the configuration
export const CONFIG = config;

// Export common configuration
export const SQLITE_DB_PATH = config.sqlite_db_path;
export const ALLOWED_DOMAINS = config.allowed_domains;
export const CORS_ALLOW_ALL = config.cors_allow_all;

/**
 * Gets the chain configuration by chain ID.
 * 
 * @param {number} chainId - The chain ID to look up
 * @returns {ChainConfig} The chain configuration
 * @throws {ConfigError} If the chain is not found
 */
export function getChainConfig(chainId: number): ChainConfig {
  const chainConfig = CONFIG.chains.find(chain => chain.chain_id === chainId);
  if (!chainConfig) {
    throw ConfigError.default(`Chain with ID ${chainId} not supported.`);
  }

  // Log warnings for implicit defaults
  if (!chainConfig.fee_receiver_address && CONFIG.defaults.fee_receiver_address) {
    console.warn(`[CONFIG WARNING] Using default fee_receiver_address for chain ${chainId}`);
  }

  if (!chainConfig.signer_private_key && CONFIG.defaults.signer_private_key) {
    console.warn(`[CONFIG WARNING] Using default signer_private_key for chain ${chainId}`);
  }

  if (!chainConfig.entrypoint_address && CONFIG.defaults.entrypoint_address) {
    console.warn(`[CONFIG WARNING] Using default entrypoint_address for chain ${chainId}`);
  }

  if (!chainConfig.max_gas_price) {
    console.warn(`[CONFIG WARNING] There's no max_gas_price set for chain ${chainId}`);
  }

  return chainConfig;
}

/**
 * Gets the effective fee receiver address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 * 
 * @param {number} chainId - The chain ID
 * @returns {string} The fee receiver address
 */
export function getFeeReceiverAddress(chainId: number): string {
  const chainConfig = getChainConfig(chainId);
  return chainConfig.fee_receiver_address || CONFIG.defaults.fee_receiver_address;
}

/**
 * Gets the effective signer private key for a chain.
 * Uses the chain-specific key if available, otherwise falls back to the default.
 * 
 * @param {number} chainId - The chain ID
 * @returns {string} The signer private key
 */
export function getSignerPrivateKey(chainId: number): string {
  const chainConfig = getChainConfig(chainId);
  return chainConfig.signer_private_key || CONFIG.defaults.signer_private_key;
}

/**
 * Gets the effective entrypoint address for a chain.
 * Uses the chain-specific address if available, otherwise falls back to the default.
 * 
 * @param {number} chainId - The chain ID
 * @returns {string} The entrypoint address
 */
export function getEntrypointAddress(chainId: number): string {
  const chainConfig = getChainConfig(chainId);
  return chainConfig.entrypoint_address || CONFIG.defaults.entrypoint_address;
}

/**
 * Gets the asset configuration for a specific chain and asset address.
 * 
 * @param {number} chainId - The chain ID
 * @param {string} assetAddress - The asset address
 * @returns {AssetConfig} The asset configuration, or undefined if not found
 */
export function getAssetConfig(chainId: number, assetAddress: string): AssetConfig {
  const chainConfig = getChainConfig(chainId);

  if (!chainConfig.supported_assets) {
    throw RelayerError.assetNotSupported();
  }

  const assetConfig =  chainConfig.supported_assets.find(
    asset => asset.asset_address.toLowerCase() === assetAddress.toLowerCase()
  );

  if (!assetConfig) {
    throw RelayerError.assetNotSupported();
  }

  return assetConfig

}

// Re-export types
export * from "./types.js";
