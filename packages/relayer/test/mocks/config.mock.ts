import { vi } from 'vitest';
import { originalConfig } from '../inputs/originalConfig.js';
import { JSONStringifyBigInt } from '../../src/utils.js';

// Mock readConfig to return our test data instead of reading from filesystem
vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation(() => {
    // Adapt TestConfig to RawConfig format by adding defaults
    const adaptedConfig = {
      ...originalConfig,
      defaults: {
        fee_receiver_address: originalConfig.chains[0].fee_receiver_address,
        signer_private_key: originalConfig.chains[0].signer_private_key,
        entrypoint_address: originalConfig.chains[0].entrypoint_address
      }
    };
    return Promise.resolve(JSONStringifyBigInt(adaptedConfig));
  }),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));