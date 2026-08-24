const request = require('supertest');
const express = require('express');
const { createApp, errorHandler } = require('../index');

describe('Auth Service', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  describe('GET /', () => {
    it('should return service health status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        service: 'auth-service',
        status: 'healthy',
      });
    });
  });

  describe('CORS', () => {
    it('should allow requests from known frontend origins', async () => {
      const origins = [
        'https://digital-logbook-bxgv.onrender.com',
        'https://digital-logbook-hlulani.onrender.com',
        'http://localhost:5173',
        'http://localhost:3000',
      ];

      for (const origin of origins) {
        const response = await request(app)
          .get('/')
          .set('Origin', origin)
          .expect(200);

        expect(response.headers['access-control-allow-origin']).toBe(origin);
        expect(response.headers['access-control-allow-credentials']).toBe('true');
      }
    });

    it('should reject requests from unknown origins', async () => {
      const response = await request(app)
        .get('/')
        .set('Origin', 'https://evil.example.com')
        .expect(200);

      // CORS callback returns null, false — no ACAO header should be set
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should handle OPTIONS preflight requests', async () => {
      const response = await request(app)
        .options('/')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type, Authorization')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });
  });

  describe('Global error handler', () => {
    it('should return 500 with CORS headers for thrown errors', async () => {
      // Build a minimal app with a throwing route and the exported error handler
      const testApp = express();
      testApp.get('/test-error', () => {
        throw new Error('forced error');
      });
      testApp.use(errorHandler);

      const response = await request(testApp)
        .get('/test-error')
        .set('Origin', 'http://localhost:5173')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Internal server error',
        message: 'forced error',
      });
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });
});
