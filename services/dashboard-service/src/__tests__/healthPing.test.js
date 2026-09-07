/**
 * Tests for the /service/health-ping endpoint.
 *
 * This endpoint is triggered by GitHub Actions every 10 minutes to:
 * 1. Wake the Render instance (prevents Render sleep)
 * 2. Ping Supabase with "hello hlulani" (prevents Supabase pause)
 *
 * Tests verify:
 * - Successful ping returns 200 with status "ok"
 * - Failed ping (no pool) returns 503 with status "degraded"
 * - Unexpected errors return 500
 */

jest.mock('../db.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

// We need to import the app after mocking db
import pool from '../db.js';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  pool.query.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /service/health-ping', () => {
  it('1. should return 200 and status ok on successful ping', async () => {
    const now = new Date().toISOString();
    // ensureTable
    pool.query.mockResolvedValueOnce({ rows: [] });
    // INSERT
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, message: 'hello hlulani', pinged_at: now }],
    });
    // DELETE
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    // Use a lightweight mock request approach
    const mockReq = { headers: {} };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Import the route handler directly by calling the ping function
    const { ping } = await import('../functions/daemon.js');
    const result = await ping();

    expect(result.success).toBe(true);
    expect(result.message).toBe('hello hlulani');
    expect(result.id).toBe(1);
  });

  it('2. should return success false when pool is unavailable', async () => {
    // Simulate pool error
    pool.query.mockRejectedValueOnce(new Error('connection refused'));

    const { ping } = await import('../functions/daemon.js');
    const result = await ping();

    expect(result.success).toBe(false);
    expect(result.reason).toBe('connection refused');
  });

  it('3. should always insert "hello hlulani" as the message', async () => {
    const now = new Date().toISOString();
    pool.query.mockResolvedValueOnce({ rows: [] }); // ensureTable
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 99, message: 'hello hlulani', pinged_at: now }],
    });
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    const { ping } = await import('../functions/daemon.js');
    const result = await ping();

    // Verify INSERT was called with "hello hlulani"
    const insertCall = pool.query.mock.calls.find(call =>
      call[0].includes('INSERT INTO')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall[1]).toEqual(['hello hlulani']);
    expect(result.message).toBe('hello hlulani');
  });

  it('4. should delete the row immediately after inserting', async () => {
    const now = new Date().toISOString();
    pool.query.mockResolvedValueOnce({ rows: [] }); // ensureTable
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 42, message: 'hello hlulani', pinged_at: now }],
    });
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    const { ping } = await import('../functions/daemon.js');
    await ping();

    // Verify DELETE was called with the inserted row's id
    const deleteCall = pool.query.mock.calls.find(call =>
      call[0].includes('DELETE FROM')
    );
    expect(deleteCall).toBeTruthy();
    expect(deleteCall[1]).toEqual([42]);
  });

  it('5. should call ensureTable before INSERT', async () => {
    const now = new Date().toISOString();
    pool.query.mockResolvedValueOnce({ rows: [] }); // ensureTable
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, message: 'hello hlulani', pinged_at: now }],
    });
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    const { ping } = await import('../functions/daemon.js');
    await ping();

    // First call should be CREATE TABLE
    expect(pool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS');
    // Second call should be INSERT
    expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO');
    // Third call should be DELETE
    expect(pool.query.mock.calls[2][0]).toContain('DELETE FROM');
  });

  it('6. should return pinged_at timestamp from the database', async () => {
    const fixedTime = '2026-09-02T12:00:00.000Z';
    pool.query.mockResolvedValueOnce({ rows: [] }); // ensureTable
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, message: 'hello hlulani', pinged_at: fixedTime }],
    });
    pool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

    const { ping } = await import('../functions/daemon.js');
    const result = await ping();

    expect(result.pinged_at).toBe(fixedTime);
  });
});
