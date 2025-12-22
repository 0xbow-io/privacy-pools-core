import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { INVALID_ERROR_PARAMS } from '../inputs/errors.js';
import { getAddress } from "viem";
import { App } from 'supertest/types.js';
import { originalConfig } from '../inputs/originalConfig.js';

const VALID_API_KEY = 'test-key-123';

describe('Config Auth Middleware', () => {
  const VALID_CONFIG = originalConfig;
  const ETH_ASSET = VALID_CONFIG.chains[1].supported_assets[0]!;
  const VALID_ASSET_ADDRESS = getAddress(ETH_ASSET.asset_address);
  const VALID_ENTRYPOINT_ADDRESS = getAddress(VALID_CONFIG.defaults.entrypoint_address);
  
  const VALID_CONFIG_PAYLOAD = {
    entrypoint_address: VALID_ENTRYPOINT_ADDRESS,
    quote_expiration_time: 60,
    max_gas_price: '1000000000000000000',
    supported_assets: [
      {
        asset_address: VALID_ASSET_ADDRESS,
        asset_name: 'ETH',
        fee_bps: '100',
        min_withdraw_amount: '1000000000000000000',
      },
    ],
  };

  const VALID_DELETE_PAYLOAD = {
    asset_addresses: VALID_ASSET_ADDRESS
  };

  let app: App;
  
  beforeAll(async () => {
    app = await createApp();
  });

  describe.concurrent('PATCH /config authentication', () => {
    it('rejects request without api-key header', async () => {
      const response = await request(app)
        .patch('/config')
        .send(VALID_CONFIG_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
      expect(response.body.details.message).toBe('Missing api-key header');
    });

    it('rejects request with invalid api-key', async () => {
      const response = await request(app)
        .patch('/config')
        .set('x-api-key', 'invalid')
        .send(VALID_CONFIG_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
      expect(response.body.details.message).toBe('Invalid api-key');
    });

    it('rejects request with empty api-key', async () => {
      const response = await request(app)
        .patch('/config')
        .set('x-api-key', '')
        .send(VALID_CONFIG_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
      expect(response.body.details.message).toBe('Invalid api-key');
    });

  });

  describe.concurrent('DELETE /config authentication', () => {
    it('rejects request without api-key header', async () => {
      const response = await request(app)
        .delete('/config')
        .send(VALID_DELETE_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
      expect(response.body.details.message).toBe('Missing api-key header');
    });

    it('rejects request with invalid api-key', async () => {
      const response = await request(app)
        .delete('/config')
        .set('x-api-key', 'wrongkey')
        .send(VALID_DELETE_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_PARAMS.code);
      expect(response.body.message).toBe(INVALID_ERROR_PARAMS.message);
      expect(response.body.details.message).toBe('Invalid api-key');
    });

  });

  describe.concurrent('case sensitivity and edge cases', () => {
    it('rejects uppercase API key', async () => {
      const response = await request(app)
        .patch('/config')
        .set('x-api-key', VALID_API_KEY.toUpperCase())
        .send(VALID_CONFIG_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.details.message).toBe('Invalid api-key');
    });

    it('rejects mixed case API key', async () => {
      const mixedCase = VALID_API_KEY.charAt(0).toUpperCase() + VALID_API_KEY.slice(1).toLowerCase();
      const response = await request(app)
        .patch('/config')
        .set('x-api-key', mixedCase)
        .send(VALID_CONFIG_PAYLOAD);

      expect(response.status).toBe(400);
      expect(response.body.details.message).toBe('Invalid api-key');
    });

  });

});
