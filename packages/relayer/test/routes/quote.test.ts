import request from 'supertest';
import { App } from 'supertest/types.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { ASSET_NOT_SUPPORTED_ERROR_BODY, INVALID_ERROR_BODY } from '../inputs/errors.js';
import { originalConfig } from '../inputs/originalConfig.js';
import { getAddress } from 'viem';

describe.each(originalConfig.chains)('Quote Route - Chain $chain_name ($chain_id)', (chainConfig) => {

  const VALID_CHAIN_ID = chainConfig.chain_id;
  const VALID_ASSET = chainConfig.supported_assets[0]!;
  const VALID_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"; 
  const NATIVE_TOKEN_ADDRESS = chainConfig.supported_assets
    .find(v => v.asset_name === chainConfig.native_currency.symbol)!
    .asset_address;

  let app: App;

  beforeAll(async () => {
    app = await createApp();
  });

  describe.concurrent('happy-path', () => {
    it('handles valid request', async () => {

      const call = {
        chainId: VALID_CHAIN_ID,
        asset: VALID_ASSET.asset_address,
        amount: "1234",
        extraGas: false,
        recipient: VALID_RECIPIENT 
      };

      const response = await request(app).post('/relayer/quote').send(call);

      expect(response.status).toBe(200); 
      expect(response.body.baseFeeBPS).toBeDefined();
      expect(response.body.feeBPS).toBeDefined();
      expect(response.body.feeCommitment).toBeDefined();
      expect(response.body.feeCommitment.expiration).toBeDefined();
      expect(response.body.feeCommitment.withdrawalData).toBeDefined();
      expect(response.body.feeCommitment.amount).toBe(call.amount);
      expect(response.body.feeCommitment.extraGas).toBe(call.extraGas);
      expect(response.body.feeCommitment.signedRelayerCommitment).toBeDefined();
      expect(response.body.detail).toBeDefined();
      expect(response.body.detail.relayTxCost).toBeDefined();
    });

    it('handles valid request with no recipient', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          amount: "1234",
          extraGas: false
      });

      expect(response.status).toBe(200);
      expect(response.body.baseFeeBPS).toBeDefined();
      expect(response.body.feeBPS).toBeDefined();
      expect(response.body.feeCommitment).toBeUndefined();
      expect(response.body.detail).toBeDefined();
      expect(response.body.detail.relayTxCost).toBeDefined();
    });

    it('handles valid request with number amount', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          extraGas: true,
          amount: 1234
      });

      expect(response.status).toBe(200);
      expect(response.body.baseFeeBPS).toBeDefined();
      expect(response.body.feeBPS).toBeDefined();
      expect(response.body.feeCommitment).toBeUndefined();
      expect(response.body.detail).toBeDefined();
      expect(response.body.detail.relayTxCost).toBeDefined();
    });

    it('handles disabling extraGas for native asset', async () => {
      const amount = "1234";
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: NATIVE_TOKEN_ADDRESS,
          extraGas: true,
          amount,
          recipient: VALID_RECIPIENT 
        });
      expect(response.status).toBe(200);
      expect(response.body.baseFeeBPS).toBeDefined();
      expect(response.body.feeBPS).toBeDefined();
      expect(response.body.feeCommitment).toBeDefined();
      expect(response.body.feeCommitment.expiration).toBeDefined();
      expect(response.body.feeCommitment.withdrawalData).toBeDefined();
      expect(response.body.feeCommitment.amount).toBe(amount);
      expect(response.body.feeCommitment.extraGas).toBeFalsy();
      expect(response.body.feeCommitment.signedRelayerCommitment).toBeDefined();
      expect(response.body.detail).toBeDefined();
      expect(response.body.detail.relayTxCost).toBeDefined();
    });

  });

  describe.concurrent('crappy-path', () => {
    it('rejects get request', async () => {
      const response = await request(app)
        .get('/relayer/quote');

      expect(response.status).toBe(404);
    });

    it('handles request with empty data', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({});

      const messageBody = "chainId: Invalid input\namount: Invalid input\nasset: Required";

      expect(response.status).toBe(400);

      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(messageBody);
    });

    it('handles request with no asset', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          extraGas: true,
          amount: "1234"
        });

      const detailsMessage = "asset: Required";

      expect(response.status).toBe(400);

      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

    it('handles request with no extraGas', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          amount: "1234"
        });

      expect(response.status).toBe(200); // extraGas is optional

      expect(response.body.feeCommitment).toBeDefined();
      expect(response.body.detail).toBeDefined();
    });

    it('handles request with no amount', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          extraGas: true,
        });

      const detailsMessage = "amount: Invalid input";


      expect(response.status).toBe(400);

      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

    it('handles request with small address value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: "0",
          extraGas: true,
          amount: "1234"
        });

      expect(response.status).toBe(400);

      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
    });

    it('handles request with large address value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: "0000000001000000000200000000030000000004000000000500000000060000000007",
          extraGas: true,
          amount: "1234"
        });

      expect(response.status).toBe(400);

      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
    });

    it('validates request body structure', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send("{invalidField: 333}");

      const detailsMessage = "chainId: Invalid input\namount: Invalid input\nasset: Required";

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

    it('rejects malformed JSON', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      const jsonError = {
        message: "Invalid JSON format",
        details: "Unexpected token 'i', \"invalid json\" is not valid JSON"
      };

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(jsonError.message);
      expect(response.body.body).toBe(jsonError.details);
    });

    it('handles value for non configured asset', async () => {
      const asset = "0x88889999aaAAbbBBCCccDDddEEeefFFf11112222";
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset,
          extraGas: true,
          amount: "1234"
        });

      const detailsMessage = `Asset not supported: ${getAddress(asset)} on chain ${VALID_CHAIN_ID}`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(ASSET_NOT_SUPPORTED_ERROR_BODY.code);
      expect(response.body.message).toBe(ASSET_NOT_SUPPORTED_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

    it('handles asset with number value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: 4,
          extraGas: true,
          amount: "1234"
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBeDefined();
    });

    it('rejects asset invalid regex value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: "0xthisshouldnotworkbtw",
          extraGas: true,
          amount: "1234"
        });

      const message = `asset: Invalid\nasset: String must contain exactly 42 character(s)`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(message);
    });

    it('rejects extraGas number value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          extraGas: 0,
          amount: "1234"
        });

      const detailsMessage = `extraGas: Expected boolean, received number`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

    it('rejects amount string value', async () => {
      const response = await request(app)
        .post('/relayer/quote')
        .send({
          chainId: VALID_CHAIN_ID,
          asset: VALID_ASSET.asset_address,
          extraGas: true,
          amount: "oopsie"
        });

      const detailsMessage = `amount: Expected bigint, received string`;

      expect(response.status).toBe(400);
      expect(response.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(response.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(response.body.details.message).toBe(detailsMessage);
    });

  });
});
