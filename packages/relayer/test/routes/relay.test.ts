import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { privacyPoolRelayer } from '../../src/services/index.js';
import { INVALID_ERROR_BODY } from '../inputs/errors.js';
import { relayProof } from '../inputs/proof.js';
import { App } from 'supertest/types.js';
import { QuoteResponse } from '../../src/quote/index.js';
import { PrintableSignedFeeCommitment } from '../../src/interfaces/index.js';
import { originalConfig } from '../inputs/originalConfig.js';
import { getAddress } from 'viem';

vi.mock('../../src/services/index.ts', async (ori) => {
  const mod = await ori(); // type is inferred
  return {
    ...mod,
    privacyPoolRelayer: {
      handleRelay: vi.fn().mockResolvedValue({ value: "resolved" })
    },
  };
});

describe.each(originalConfig.chains)('Relay Route - Chain $chain_name ($chain_id)', (chainConfig) => {

  const VALID_CHAIN_ID = chainConfig.chain_id;
  const VALID_ASSET = chainConfig.supported_assets[0]!;
  const VALID_RECIPIENT = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

  const validRelayPayload = (withdrawalData: BigNumberish[], feeCommitment?: PrintableSignedFeeCommitment ) => {
    let obj = {
      withdrawal: {
        processooor: "0x248be73ad9087517e4624c29ce4ac84a76c8b479",
        data: withdrawalData,  // encoded RelayData
      },
      publicSignals: relayProof.publicSignals,
      proof: relayProof.proof,
      scope: "914252416149542018943135422021350408877910118150300123819183553188073868709",
      chainId: VALID_CHAIN_ID,
    };

    if (feeCommitment) { 
        return { ...obj, feeCommitment};
    } else { return obj; }
  };

  const VALID_QUOTE_PAYLOAD = {
    chainId: VALID_CHAIN_ID,
    amount: "10000",
    asset: VALID_ASSET.asset_address,
    recipient: VALID_RECIPIENT,
    extraGas: true
  };
  let app: App;

  beforeAll(async () => {
    app = await createApp();
  });

  describe.concurrent('crappy-path', () => {

    it('should handle relay route with empty data', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should validate request body structure', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .send({ invalidField: 'test' });

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send('invalid json');
      expect(response.status).toBe(400);
    });
 
    type RelayContext = {
      quote: QuoteResponse
    }

    beforeEach<RelayContext>(async (context: RelayContext) => {
      const res = await request(app)
        .post('/relayer/quote')
        .set('Content-Type', 'application/json')
        .send(VALID_QUOTE_PAYLOAD);
      context.quote = res.body as QuoteResponse;
    })


    it<RelayContext>('should expect a withdrawal object', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { withdrawal, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });
    
    it<RelayContext>('should expect publicSignals field', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { publicSignals, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'publicSignals: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it<RelayContext>('should expect proof field', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { proof, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'proof: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it<RelayContext>('should expect scope field', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { scope, ...relayPayload} = validPayload;

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'scope: Invalid input'; // TODO: Interesting error, maybe should be Required

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it<RelayContext>('should expect withdrawal processor field', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { withdrawal: {data, processooor: _}, ...payload} = validPayload;
      const relayPayload = { ...payload, withdrawal: {data}} 

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal.processooor: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    it<RelayContext>('should expect withdrawal data field', async ({quote}) => {
      const validPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)
      const { withdrawal: {data: _, processooor}, ...payload} = validPayload;
      const relayPayload = { ...payload, withdrawal: {processooor}} 

      const res = await request(app)
        .post('/relayer/request')
        .set('Content-Type', 'application/json')
        .send(relayPayload);

      const detailsMessage = 'withdrawal.data: Required';

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(INVALID_ERROR_BODY.code);
      expect(res.body.message).toBe(INVALID_ERROR_BODY.message);
      expect(res.body.details.message).toBe(detailsMessage);
    });

    describe.concurrent('happy-path', () => {
      it<RelayContext>('should handle relay with full payload', async ({quote}) => {
        const relayPayload = validRelayPayload(quote.feeCommitment!.withdrawalData, quote.feeCommitment)

        const relay = await request(app)
          .post('/relayer/request')
          .set('Content-Type', 'application/json')
          .send(relayPayload);

        expect(privacyPoolRelayer.handleRelay).toBeCalled();
        expect(relay.body).toStrictEqual({ value: "resolved" });

      });

      it<RelayContext>('should handle relay without feeCommitment', async ({quote}) => {
        const relayPayload = validRelayPayload(quote.feeCommitment!.withdrawalData)

        const res = await request(app)
          .post('/relayer/request')
          .set('Content-Type', 'application/json')
          .send(relayPayload);

        expect(res.status).toBe(200);
      });
    });
  });
});
