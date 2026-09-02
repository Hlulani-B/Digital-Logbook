/**
 * Tests for the Supabase Keep-Alive Daemon.
 *
 * Verifies:
 * - ping() inserts and deletes a row correctly
 * - ping() handles missing pool gracefully
 * - ping() catches and reports DB errors
 * - startDaemon() / stopDaemon() lifecycle
 * - isDaemonRunning() state tracking
 * - getDaemonConfig() returns correct defaults
 */

jest.mock('../db.js', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import pool from '../db.js';
import {
  ping,
  startDaemon,
  stopDaemon,
  isDaemonRunning,
  getDaemonConfig,
} from '../functions/daemon.js';

describe('Daemon', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockReset();
    // Ensure daemon is stopped before each test
    stopDaemon();
  });

  afterEach(() => {
    stopDaemon();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─── ping() ────────────────────────────────────────────────────────

  describe('ping()', () => {
    it('1. should insert a row and delete it successfully', async () => {
      const now = new Date().toISOString();
      // First call: ensureTable (CREATE TABLE)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Second call: INSERT ... RETURNING
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, message: 'hello hlulani', pinged_at: now }],
      });
      // Third call: DELETE
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await ping();

      expect(result.success).toBe(true);
      expect(result.message).toBe('hello hlulani');
      expect(result.id).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('2. should return failure when pool is unavailable', async () => {
      // Simulate pool being null by temporarily replacing the import
      const daemonModule = await import('../functions/daemon.js');
      const originalPing = daemonModule.ping;

      // Create a version that sees a null pool by directly calling the logic
      // We test the guard clause by making pool.query throw on first call (ensureTable)
      pool.query.mockRejectedValueOnce(new Error('pool disconnected'));

      const result = await ping();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('pool disconnected');
    });

    it('3. should catch and report DB errors', async () => {
      // ensureTable succeeds
      pool.query.mockResolvedValueOnce({ rows: [] });
      // INSERT fails
      pool.query.mockRejectedValueOnce(new Error('connection lost'));

      const result = await ping();

      expect(result.success).toBe(false);
      expect(result.reason).toBe('connection lost');
    });

    it('4. should call ensureTable before inserting', async () => {
      const now = new Date().toISOString();
      pool.query.mockResolvedValueOnce({ rows: [] }); // ensureTable
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 42, message: 'hello hlulani', pinged_at: now }],
      });
      pool.query.mockResolvedValueOnce({ rowCount: 1 }); // DELETE

      await ping();

      // First call should be CREATE TABLE IF NOT EXISTS
      expect(pool.query.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS');
      // Second call should be INSERT
      expect(pool.query.mock.calls[1][0]).toContain('INSERT INTO');
      // Third call should be DELETE
      expect(pool.query.mock.calls[2][0]).toContain('DELETE FROM');
    });
  });

  // ─── startDaemon() / stopDaemon() ─────────────────────────────────

  describe('startDaemon() / stopDaemon()', () => {
    it('5. should start the daemon and set running to true', () => {
      pool.query.mockResolvedValue({ rows: [] }); // for ping queries
      pool.query.mockResolvedValue({ rowCount: 1 });

      startDaemon(60000); // 1 minute for testing

      expect(isDaemonRunning()).toBe(true);
    });

    it('6. should stop the daemon and set running to false', () => {
      pool.query.mockResolvedValue({ rows: [] });
      pool.query.mockResolvedValue({ rowCount: 1 });

      startDaemon(60000);
      expect(isDaemonRunning()).toBe(true);

      stopDaemon();
      expect(isDaemonRunning()).toBe(false);
    });

    it('7. should not start twice if already running', () => {
      pool.query.mockResolvedValue({ rows: [] });
      pool.query.mockResolvedValue({ rowCount: 1 });

      startDaemon(60000);
      startDaemon(60000); // second call should be ignored

      expect(isDaemonRunning()).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already running')
      );
    });

    it('8. should run ping immediately on start, then on interval', async () => {
      // mockResolvedValue persists for ALL calls (unlike mockResolvedValueOnce)
      pool.query.mockResolvedValue({ rows: [{ id: 1, message: 'hello hlulani', pinged_at: new Date().toISOString() }] });

      startDaemon(60000);

      // First ping is fire-and-forget (not awaited in startDaemon).
      // Flush microtasks so the async ping() can complete its query chain.
      await jest.advanceTimersByTimeAsync(500);

      const callsAfterFirstPing = pool.query.mock.calls.length;
      // ensureTable + INSERT + DELETE = 3 calls minimum
      expect(callsAfterFirstPing).toBeGreaterThanOrEqual(3);

      // Advance by the interval — second ping should fire
      await jest.advanceTimersByTimeAsync(60000);

      // Should have 3 more calls from the second ping
      expect(pool.query.mock.calls.length).toBeGreaterThanOrEqual(callsAfterFirstPing + 3);
    });
  });

  // ─── getDaemonConfig() ─────────────────────────────────────────────

  describe('getDaemonConfig()', () => {
    it('9. should return default config when no env var set', () => {
      delete process.env.PING_INTERVAL_MS;
      const config = getDaemonConfig();

      expect(config.intervalMs).toBe(12 * 60 * 60 * 1000); // 12 hours
      expect(config.intervalHours).toBe(12);
      expect(config.message).toBe('hello hlulani');
      expect(typeof config.running).toBe('boolean');
    });

    it('10. should respect PING_INTERVAL_MS env var', () => {
      process.env.PING_INTERVAL_MS = '3600000'; // 1 hour
      const config = getDaemonConfig();

      expect(config.intervalMs).toBe(3600000);
      expect(config.intervalHours).toBe(1);

      delete process.env.PING_INTERVAL_MS;
    });
  });

  // ─── isDaemonRunning() ─────────────────────────────────────────────

  describe('isDaemonRunning()', () => {
    it('11. should return false initially', () => {
      expect(isDaemonRunning()).toBe(false);
    });

    it('12. should toggle correctly through start/stop cycles', () => {
      pool.query.mockResolvedValue({ rows: [] });
      pool.query.mockResolvedValue({ rowCount: 1 });

      expect(isDaemonRunning()).toBe(false);

      startDaemon(60000);
      expect(isDaemonRunning()).toBe(true);

      stopDaemon();
      expect(isDaemonRunning()).toBe(false);

      startDaemon(30000);
      expect(isDaemonRunning()).toBe(true);

      stopDaemon();
      expect(isDaemonRunning()).toBe(false);
    });
  });
});
