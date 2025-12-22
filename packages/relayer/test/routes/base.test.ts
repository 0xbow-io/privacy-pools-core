import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { App } from 'supertest/types.js';


describe.concurrent('Base Route', () => {

  let app: App;
  beforeAll(async () => { 
    app = await createApp();
  });

  describe.concurrent('GET /', () => {
    it('should return method not available message', async () => {
      const response = await request(app)
        .get('/')
        .expect(405);

      expect(response.body).toEqual({
        error: "Method not available, try '/details', '/relay', '/quote'",
      });
    });
  });
});
