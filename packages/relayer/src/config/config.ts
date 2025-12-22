import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ConfigError } from "../exceptions/base.exception.js";
import { PrivateKey, ChainId } from "../types.js";
import { JSONStringifyBigInt } from "../utils.js";
import { UpdateConfigBody, DeleteConfigBody, zRawConfig, zRawChainConfig } from "./schemas.js";
import { AssetConfig, RawChainConfig, RawConfig, SafeConfig } from "./types.js";
import { Address, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createModuleLogger } from "../logger/index.js";
import { z } from "zod";


class ConfigReader {

  constructor(readonly filePath: string) {
  }

  /**
   * Reads the configuration file from the path specified in the CONFIG_PATH environment variable
   * or from the default path ./config.json.
   * 
   * @returns {Record<string, unknown>} The raw configuration object
   * @throws {ConfigError} If the configuration file is not found
   */
  async readConfig(): Promise<Record<string, unknown>> {
    try {
      await access(this.filePath);
    } catch {
      logger.warn("No config.json found for relayer.");
      throw ConfigError.default("No config.json found for relayer.");
    }
    const fileContent = await readFile(this.filePath, { encoding: "utf-8" });
    return JSON.parse(fileContent);
  }

  async parseConfig(): Promise<RawConfig> {
    const rawConfig = await this.readConfig();
    const config = zRawConfig
      .refine(c => { warnings(c); return true; })
      .parse(rawConfig);
    return config;
  }


  /**
   * Gets the latest chain configuration list
   * 
   * @returns {Promise<ChainConfig[]>} The parsed chain configuration list object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async chainConfigList(): Promise<RawChainConfig[]> {
    const config = await this.parseConfig();
    return config.chains;
  }

}

class ChainConfig extends ConfigReader {

  constructor(filePath: string, readonly chainId: number) {
    super(filePath);
  }

  /**
   * Gets the latest chain configuration for a specific chain
   * 
   * @returns {Promise<ChainConfig>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async config(): Promise<[RawConfig, RawChainConfig]> {
    const config = await this.parseConfig();
    const chainConfig = config.chains.find(chain => chain.chain_id === this.chainId);
    if (chainConfig === undefined) {
      throw ConfigError.default(`ChainConfig for chain_id: ${this.chainId} not found`);
    }
    return [config, chainConfig];
  }

  /**
   * Gets the latest fee reciever address for a specific chain
   * 
   * @returns {Promise<Address>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  async feeReceiverAddress(): Promise<Address> {
    const [config, chainConfig] = await this.config();

    const defaultsFeeRecieverAddress = config.defaults?.fee_receiver_address;
    const configFeeRecieverAddress = chainConfig.fee_receiver_address;
    const envFeeRecieverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    logger.debug("fee_receiver_address", {
      chain_id: this.chainId,
      defaultsFeeRecieverAddress,
      configFeeRecieverAddress,
      envFeeRecieverAddress
    });

    const logPayload = (feeReceiver: string) => ({ chain_id: this.chainId, fee_receiver_address: feeReceiver });

    // Priority: config value > env value > default value
    let chainFeeReceiver: Address;
    if (configFeeRecieverAddress) {
      chainFeeReceiver = configFeeRecieverAddress;
      logger.info(`Using config fee_receiver_address for chain ${this.chainId}: ${configFeeRecieverAddress}`, logPayload(chainFeeReceiver));
    } else if (envFeeRecieverAddress) {
      chainFeeReceiver = getAddress(envFeeRecieverAddress);
      logger.info(`Using ENV fee_receiver_address for chain ${this.chainId}: ${envFeeRecieverAddress}`, logPayload(chainFeeReceiver));
    } else if (defaultsFeeRecieverAddress) {
      chainFeeReceiver = defaultsFeeRecieverAddress;
      logger.info(`Using default fee_receiver_address for chain ${this.chainId}: ${defaultsFeeRecieverAddress}`, logPayload(chainFeeReceiver));
    } else {
      throw ConfigError.default(`fee_receiver_address for chain_id: ${this.chainId} not found in config, env, or defaults`);
    }

    return chainFeeReceiver;
  }

  /**
   * Gets the effective signer private key for a chain.
   * 
   * @returns {PrivateKey} The signer private key
   * @throws {ConfigError} If the configuration is not initialized
   */
  async signerPrivateKey(): Promise<PrivateKey> {
    const [config, chainConfig] = await this.config();

    const defaultsSignerPrivateKey = config.defaults?.signer_private_key;
    const configSignerPrivateKey = chainConfig.signer_private_key;
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"] as PrivateKey | undefined;

    logger.debug("signer_private_key", {
      defaultsSignerPrivateKey: defaultsSignerPrivateKey === undefined,
      configSignerPrivateKey: configSignerPrivateKey === undefined,
      envSignerPrivateKey: envSignerPrivateKey === undefined
    });

    const logPayload = () => ({ chain_id: this.chainId });

    // Priority: config value > env value > default value
    let chainSignerKey: PrivateKey;
    if (configSignerPrivateKey) {
      chainSignerKey = configSignerPrivateKey;
      logger.info(`Using config signer_private_key for chain ${this.chainId}`, logPayload());
    } else if (envSignerPrivateKey) {
      chainSignerKey = envSignerPrivateKey;
      logger.info(`Using ENV signer_private_key for chain ${this.chainId}`, logPayload());
    } else if (defaultsSignerPrivateKey) {
      chainSignerKey = defaultsSignerPrivateKey;
      logger.info(`Using default signer_private_key for chain ${this.chainId}`, logPayload());
    } else {
      throw ConfigError.default(`signer_private_key for chain_id: ${this.chainId} not found in config, env, or defaults`);
    }

    return chainSignerKey;
  }

  /**
   * Gets the effective entrypoint address for a chain.
   * 
   * @returns {Address} The entrypoint address
   */
  async entrypointAddress(): Promise<Address> {
    const [config, chainConfig] = await this.config();
    const entrypointAddress = chainConfig.entrypoint_address ?? config.defaults?.entrypoint_address;
    if (entrypointAddress === undefined) {
      throw ConfigError.default(`entrypoint_address for chain_id: ${this.chainId} not found`);
    }
    return entrypointAddress;
  }

  async isFeeReceiverSameAsSigner(): Promise<boolean> {
    const feeReceiverAddress = await this.feeReceiverAddress();
    const pkey = await this.signerPrivateKey();

    const signerAddress = privateKeyToAccount(pkey).address;
    return feeReceiverAddress.toLowerCase() === signerAddress.toLowerCase();
  }

  async max_gas_price(): Promise<bigint | undefined> {
    const [_, chainConfig] = await this.config();
    return chainConfig.max_gas_price;
  }

  async rpc_url(): Promise<string> {
    const [_, chainConfig] = await this.config();
    return chainConfig.rpc_url;
  }

  async chain_name(): Promise<string> {
    const [_, chainConfig] = await this.config();
    return chainConfig.chain_name;
  }

  /**
   * Gets the asset configuration for a specific asset address on a specific chain.
   * 
   * @param {Address} assetAddress - The asset address
   * @returns {Promise<AssetConfig>} The asset configuration
   */
  async assetConfig(assetAddress: Address): Promise<Readonly<AssetConfig>> {
    const [_, chainConfig] = await this.config();

    logger.debug(`getting config for: ${assetAddress} on chain ${this.chainId}`);

    if (!chainConfig.supported_assets) {
      const err = `No supported assets found in config for chain ${this.chainId}`;
      logger.error(err);
      throw ConfigError.unsupportedAsset({message: err});
    }

    const assetConfig = chainConfig.supported_assets.find(
      asset => asset.asset_address === assetAddress
    );

    if (assetConfig === undefined) {
      const err = `Asset not supported: ${assetAddress} on chain ${this.chainId}`;
      logger.warn(err);
      throw ConfigError.unsupportedAsset({message: err});
    }

    return assetConfig;
  }

  /**
   * Checks if a chain ID is supported.
   * 
   * @param {number} chainId - The chain ID to check.
   * @returns {Promise<boolean>} - Whether the chain is supported.
   */
  async isChainSupported(chainId: ChainId): Promise<boolean> {
    const chains = await this.chainConfigList();
    return chains.some(chain => chain.chain_id === chainId);
  }

}

export class RelayerConfig {

  private configPathString: string;
  private configBackupPath: string | undefined = undefined;

  constructor() {
    this.configPathString = resolve(process.env["CONFIG_PATH"] || "./config.json");
    if (process.env["BACKUP_CONFIG_PATH"]) {
      this.configBackupPath = resolve(process.env["BACKUP_CONFIG_PATH"]);
    }
  }

  /**
   * Gets full configuration
   * 
   * @returns {Promise<RawConfig>} The raw configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  fullConfig(): Promise<RawConfig> {
    const cr = new ConfigReader(this.configPathString);
    return cr.parseConfig();
  }

  /**
   * Gets chain configuration for a specific chain
   * 
   * @param {ChainId} chainId - The chain ID
   * @returns {ReadOnly<ChainConfig>} The parsed chain configuration object
   * @throws {ConfigError} If the configuration is not initialized
   */
  chain(chainId: ChainId): ChainConfig {
    return new ChainConfig(this.configPathString, chainId);
  }

  /**
   * Update configuration values and save a copy of old config.
   * 
   * @param {UpdateConfigBody} values - The chain config updates 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  async updateConfig(values: UpdateConfigBody): Promise<SafeConfig> {
    const oldChainConfig = await this.fullConfig();

    const newChainConfig = this.mergeConfig(oldChainConfig, values);

    if (!this.isConfigEqual(oldChainConfig, newChainConfig)) {
      await this.saveConfig(oldChainConfig, newChainConfig);
    }
    return this.safeishConfig(newChainConfig);
  }

  /**
   * Delete assets from configuration and save a copy of old config.
   * 
   * @param {DeleteConfigBody} values - The chain_id and asset_addresses to delete 
   * @returns {Promise<VariableConfig>} The updated relayer variable configuration
   */
  async deleteConfig(values: DeleteConfigBody): Promise<SafeConfig> {
    const oldConfig = await this.fullConfig();
    const result = { ...oldConfig };

    const chainIndex = result.chains.findIndex(chain => chain.chain_id === values.chain_id);

    if (chainIndex === -1) {
      throw new ConfigError(`Chain with ID ${values.chain_id} not found in configuration`);
    }

    const assetAddressesToDelete = Array.isArray(values.asset_addresses)
      ? values.asset_addresses
      : [values.asset_addresses];

    const existingChain = result.chains[chainIndex];

    const updatedAssets = (existingChain!.supported_assets || []).filter(
      asset => !assetAddressesToDelete.includes(asset.asset_address)
    );

    const updatedChain = {
      ...existingChain,
      supported_assets: updatedAssets
    };

    const serializedChain = JSON.parse(JSONStringifyBigInt(updatedChain));
    const validatedChain = zRawChainConfig.parse(serializedChain);
    result.chains[chainIndex] = validatedChain;

    const serializedConfig = JSON.parse(JSONStringifyBigInt(result));
    const newConfig = zRawConfig.parse(serializedConfig);

    if (!this.isConfigEqual(oldConfig, newConfig)) {
      await this.saveConfig(oldConfig, newConfig);
    }
    return this.safeishConfig(newConfig);
  }

  /**
   * Saves config by backing up the old config and writing the new one
   * 
   * @param {Config} oldConfig - The old config to backup
   * @param {Config} newConfig - The new config to write
   * @returns {Promise<void>}
   */
  private async saveConfig(oldConfig: RawConfig, newConfig: RawConfig): Promise<void> {
    await this.writeConfigBackup(oldConfig, 'backup-config');
    await this.writeConfig(newConfig);
  }

  /**
   * Writes config to disk, excluding sensitive fields if env vars are set
   * 
   * @param {Config} config - The config to write
   * @returns {Promise<void>}
   */
  private async writeConfig(config: RawConfig): Promise<void> {
    await writeFile(resolve(this.configPathString), this.checkConfigVariables(config));
    logger.info('writeConfig completed for path:', this.configPathString);
  }

  /**
   * Writes a backup of the config to the backup directory if configured.
   * 
   * @param {Config} config - The config to backup
   * @param {string} backupFileName - The backup file name (without timestamp and extension)
   * @returns {Promise<void>}
   */
  private async writeConfigBackup(config: RawConfig, backupFileName: string): Promise<void> {
    if (!this.configBackupPath) {
      return; // no backup path configured, skip backup
    }

    const timestamp = Number(new Date());
    const fullBackupFileName = `${timestamp}-${backupFileName}.json`;
    const backupPath = resolve(this.configBackupPath, fullBackupFileName);
    await writeFile(backupPath, this.checkConfigVariables(config));
    logger.info(`Config backup saved to: ${backupPath}`);
  }

  /** 
   *  Checks if env secrets are set, and if they are inside a chain config, removes them.
   * */
  private checkConfigVariables(config: RawConfig): string {

    const chainConfigToWrite: Partial<RawChainConfig>[] = [...config.chains];

    // check which sensitive fields should be excluded due to env vars
    const envFeeReceiverAddress = process.env["FEE_RECIEVER_ADDRESS"];
    const envSignerPrivateKey = process.env["SIGNER_PRIVATE_KEY"];

    // remove sensitive fields from config if env vars are set
    config.chains.forEach((c, i) => {
      const chainValue = chainConfigToWrite[i];
      if (chainValue !== undefined) {
        if (envFeeReceiverAddress === c.fee_receiver_address) {
          delete chainValue.fee_receiver_address;
        }
        if (envSignerPrivateKey === c.signer_private_key) {
          delete chainValue.signer_private_key;
        }
      }
    });

    const configToWrite = { ...config, chains: chainConfigToWrite };

    return JSONStringifyBigInt(configToWrite);
  }

  /**
   * Remove sensitive values from config defaults object and all chain configurations
   *
   * @param {Config} config - The config value 
   * @returns {SafeConfig} The relayer configuration with secrets removed
   */
  private safeishConfig(config: RawConfig): SafeConfig {
    const {
      defaults,
      chains,
      ...safeConfig
    } = config;

    const safeDefaults = defaults ? {
      entrypoint_address: defaults.entrypoint_address
    } : undefined;

    const safeChains = chains.map(chain => {
      const {
        fee_receiver_address: _reciever,
        signer_private_key: _pkey,
        ...safeChain
      } = chain;
      return safeChain;
    });

    return {
      ...safeConfig,
      defaults: safeDefaults,
      chains: safeChains
    };
  }

  private isConfigEqual(previous: RawConfig, current: RawConfig): boolean {
    return Object.keys(previous).every((key) => {
      const prev = previous[key as keyof RawConfig];
      const curr = current[key as keyof RawConfig];
      if (Array.isArray(prev) && Array.isArray(curr)) {
        if (prev.length !== curr.length)
          return false;
        return prev.every((value, index) => value === curr[index]);
      } else if ((!Array.isArray(prev)) && (!Array.isArray(curr))) {
        return prev === curr;
      }
      else {
        const errorLog = `Unexpected config value found for when comparing key ${key}:= ${prev} vs ${curr}`;
        logger.error(errorLog);
        throw ConfigError.default(errorLog);
      }
    });
  }

  private mergeConfig(existing: RawConfig, updateBody: UpdateConfigBody): RawConfig {

    const { chain_id, ...updates } = updateBody;

    logger.debug(`merging config for chain_id ${updateBody.chain_id}`, { chain_id });

    if (!chain_id) {
      throw new ConfigError("chain_id is required for config updates");
    }

    const result = { ...existing };
    const chainIndex = result.chains.findIndex(chain => chain.chain_id === chain_id);

    if (chainIndex === -1) {
      throw new ConfigError(`Chain with ID ${chain_id} not found in configuration`);
    }

    const updatedChain = { ...result.chains[chainIndex] };

    const keys = Object.keys(updates) as (keyof typeof updates)[];

    for (const key of keys) {

      const value = updates[key];
      if (value === undefined)
        continue;

      if (key === 'supported_assets') {
        const value = updates[key]!; // we just asserted

        // merge assets by asset_address, replacing existing values or adding new assets
        const updatedAssets = updatedChain.supported_assets ? [...updatedChain.supported_assets] : [];
        value.forEach(newAsset => {
          const existingIndex = updatedAssets.findIndex(
            asset => asset.asset_address === newAsset.asset_address
          );
          if (existingIndex >= 0) {
            updatedAssets[existingIndex] = newAsset;
          } else {
            updatedAssets.push(newAsset);
          }
        });
        updatedChain.supported_assets = updatedAssets;
      }

    }

    logger.debug("parsing updated config", { ...updateBody });
    const serializedChain = JSON.parse(JSONStringifyBigInt(updatedChain));
    const validatedChain = zRawChainConfig.parse(serializedChain);
    result.chains[chainIndex] = validatedChain;
    logger.info("config successfully updated", { ...updateBody });

    return result;
  }
}

function warnings(config: z.infer<typeof zRawConfig>) {
  for (const chainConfig of config.chains) {
    const { chain_id: chainId } = chainConfig;

    // Log warnings for implicit defaults
    if (!chainConfig.fee_receiver_address && config.defaults?.fee_receiver_address) {
      logger.warn(`Using default fee_receiver_address for chain id: ${chainId}`, { chainId });
    }

    if (!chainConfig.signer_private_key && config.defaults?.signer_private_key) {
      logger.warn(`Using default signer_private_key for chain id: ${chainId}`, { chainId });
    }

    if (!chainConfig.entrypoint_address && config.defaults?.entrypoint_address) {
      logger.warn(`Using default entrypoint_address for chain id: ${chainId}`, { chainId });
    }

    if (!chainConfig.max_gas_price) {
      logger.warn(`No max_gas_price set for chain id: ${chainId}`, { chainId });
    }

    const { signer_private_key, ...publicConfig } = chainConfig;  // eslint-disable-line @typescript-eslint/no-unused-vars
    logger.debug(`Resolved config for ${chainId}`, {
      ...publicConfig,
      fee_receiver_address: config.defaults?.fee_receiver_address,
      entrypoint_address: config.defaults?.entrypoint_address,
    });
  }
}

const logger = createModuleLogger(RelayerConfig);
