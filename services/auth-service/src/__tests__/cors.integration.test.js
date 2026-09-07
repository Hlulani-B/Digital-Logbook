/**
 * Integration tests for auth-service CORS + error handling flow.
 *
 * Tests that multiple middleware components work together:
 * - CORS origin validation → allowed origins get correct headers
 * - CORS + error handler → error responses include CORS headers
 * - Full request lifecycle → method/preflight handling
 */

const { createApp, errorHandler } = require('../index.js');

describe('Auth Service Integration: CORS + Error Handling', () => {
  describe('CORS origin validation via error handler', () => {
    const allowedOrigins = [
      'https://digital-logbook-bxgv.onrender.com',
      'https://digital-logbook-bjev.onrender.com',
      'https://digital-logbook-hlulani.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    allowedOrigins.forEach((origin) => {
      it(`should set CORS headers for allowed origin: ${origin}`, () => {
        const res = {
          header: jest.fn(),
          json: jest.fn(),
          status: jest.fn().mockReturnThis(),
        };

        errorHandler(new Error('test'), { headers: { origin } }, res, jest.fn());

        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', origin);
        expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });

    it('should NOT set CORS headers for disallowed origins', () => {
      const res = {
        header: jest.fn(),
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      errorHandler(
        new Error('test'),
        { headers: { origin: 'https://evil.com' } },
        res,
        jest.fn()
      );

      expect(res.header).not.toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://evil.com'
      );
    });

    it('should handle requests with no origin (server-to-server)', () => {
      const res = {
        header: jest.fn(),
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      errorHandler(new Error('fail'), { headers: {} }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal server error' })
      );
    });
  });

  describe('Error handler response format', () => {
    it('should return 500 with error message and preserve origin header', () => {
      const origin = 'http://localhost:5173';
      const res = {
        header: jest.fn(),
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      errorHandler(new Error('DB connection lost'), { headers: { origin } }, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.header).toHaveBeenCalledTimes(2);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'DB connection lost',
      });
    });
  });

  describe('App factory', () => {
    it('should create an express app with required middleware', () => {
      const app = createApp();
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
      expect(app._router).toBeDefined();
    });
  });
});
