import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { ASSET_NOT_SUPPORTED_ERROR_BODY, INVALID_ERROR_BODY, INVALID_ERROR_PARAMS } from '../inputs/errors.js';
import { App } from 'supertest/types.js';
import { createApp } from '../../src/app.js';
import { originalConfig } from '../inputs/originalConfig.js';
import { JSONStringifyBigInt } from '../../src/utils.js';
import { getAddress } from 'viem';

// mock readConfig to return our test data instead of reading from filesystem
vi.mock('node:fs/promises', () => ({
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockImplementation(() => {
    // adapt TestConfig to RawConfig format by adding defaults
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


describe.each(originalConfig.chains)('Details Route - Chain $chain_name ($chain_id)', (chainConfig) => {

  const VALID_CHAIN_ID = chainConfig.chain_id; 
  const VALID_RECIEVER_ADDRESS = chainConfig.fee_receiver_address; 
  const VALID_MAX_GAS_PRICE = chainConfig.max_gas_price; 

  const VALID_ASSET = chainConfig.supported_assets[0];
  
  let app: App;
  beforeAll(async () => {
    app = await createApp();
  });

  describe.concurrent('happy-path', () => {
    it('should handle valid request', async () => {
      const call = `/relayer/details?chainId=${VALID_CHAIN_ID}&assetAddress=${VALID_ASSET.asset_address}`;
      const response = await request(app).get(call);

      expect(response.status).toBe(200);

      expect(response.body.chainId).toBe(VALID_CHAIN_ID);
      expect(response.body.feeReceiverAddress).toBe(getAddress(VALID_RECIEVER_ADDRESS));
      expect(response.body.maxGasPrice).toBe(VALID_MAX_GAS_PRICE.toString());
      expect(response.body.minWithdrawAmount).toBe(VALID_ASSET.min_withdraw_amount.toString());
      expect(response.body.feeBPS).toBe(VALID_ASSET.fee_bps.toString());
      expect(response.body.assetAddress).toBe(getAddress(VALID_ASSET.asset_address));
    });
  });

  describe.concurrent('crappy-path', () => {
    it('should reject post request', async () => {
      const response = await request(app)
        .post('/relayer/details').send();

      expect(response.status).toBe(404);
    });

    it('should expect an asset', async () => {
      const response = await request(app)
        .get(`/relayer/details?chainId=${VALID_CHAIN_ID}`);

      const detailsMessage = `assetAddress: Required`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.details.message).toBe(detailsMessage);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
    });

    it('should expect an chainId', async () => {
      const response = await request(app)
        .get(`/relayer/details?assetAddress=${VALID_ASSET.asset_address}`);

      const detailsMessage = `chainId: Invalid input`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.details.message).toBe(detailsMessage);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
    });

    it('should validate short asset address', async () => {
      const response = await request(app)
        .get(`/relayer/details?chainId=${VALID_CHAIN_ID}&assetAddress`);

      const detailsMessage = 
        `assetAddress: Invalid
assetAddress: String must contain exactly 42 character(s)`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.details.message).toBe(detailsMessage);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
    });

    it('should validate long asset address', async () => {
      const response = await request(app)
        .get(`/relayer/details?chainId=${VALID_CHAIN_ID}&assetAddress="0000000001000000000200000000030000000004000000000500000000060000000007"`);

      const detailsMessage = 
        `assetAddress: Invalid
assetAddress: String must contain exactly 42 character(s)`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.details.message).toBe(detailsMessage);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
    });

    it('should fail if asset is not configured', async () => {
      const asset = "0x88889999aaAAbbBBCCccDDddEEeefFFf11112222";
      const response = await request(app)
        .get(`/relayer/details?chainId=${VALID_CHAIN_ID}&assetAddress=${asset}`);

      const detailsMessage = `Asset not supported: ${getAddress(asset)} on chain ${VALID_CHAIN_ID}`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(ASSET_NOT_SUPPORTED_ERROR_BODY.code);
      expect(response.body.details.message).toBe(detailsMessage);
      expect(response.body.message).toBe(ASSET_NOT_SUPPORTED_ERROR_BODY.message);
    });
  });
});
