import pool from '../db.js';
import { ActivityLog, logActivity } from '../functions/activityLog.js';

jest.mock('../db.js');

describe('ActivityLog', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── log() (static) ──────────────────────────────────────────

  describe('log', () => {
    it('should insert an activity record successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await ActivityLog.log('a@b.com', 'PROJECT_CREATED', 'project', 'MyProject');

      expect(pool.query).toHaveBeenCalled();
    });

    it('should pass details object to the insert', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const details = { extra: 'info' };
      await ActivityLog.log('a@b.com', 'ENTRY_ADDED', 'entry', 'test-entry', details);

      expect(pool.query).toHaveBeenCalled();
      // Verify the details are serialized as JSON
      const call = pool.query.mock.calls[0];
      expect(call[1][4]).toBe(JSON.stringify(details));
    });

    it('should catch and log unexpected exceptions', async () => {
      pool.query.mockRejectedValueOnce(new Error('Network failure'));

      // Should not throw
      await ActivityLog.log('a@b.com', 'PROJECT_CREATED', 'project', 'MyProject');

      expect(console.error).toHaveBeenCalledWith('[activityLog] Exception:', 'Network failure');
    });
  });

  // ─── getActivities() ──────────────────────────────────────────

  describe('getActivities', () => {
    let activityLog;

    beforeEach(() => {
      activityLog = new ActivityLog();
    });

    it('should return activities for a user', async () => {
      const mockActivities = [
        { action_type: 'PROJECT_CREATED', entity_name: 'P1' },
        { action_type: 'ENTRY_ADDED', entity_name: 'E1' },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockActivities });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return empty array when no activities exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('query failed');
      expect(result.data).toEqual([]);
    });

    it('should handle unexpected thrown errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection lost');
    });
  });

  // ─── getDigest() ──────────────────────────────────────────────

  describe('getDigest', () => {
    let activityLog;

    beforeEach(() => {
      activityLog = new ActivityLog();
    });

    it('should return digest with total, categories, topProjects, topEntries', async () => {
      // Mock 4 queries: count, categories, topProjects, topEntries
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 10 }] })
        .mockResolvedValueOnce({
          rows: [
            { category: 'projects', count: 5 },
            { category: 'entries', count: 5 },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ project_name: 'P1', count: 3 }] })
        .mockResolvedValueOnce({ rows: [{ entity_name: 'E1', count: 2 }] });

      const result = await activityLog.getDigest('a@b.com', 'daily');

      expect(result.success).toBe(true);
      expect(result.data.period).toBe('daily');
      expect(result.data.total).toBe(10);
      expect(result.data.categories).toHaveLength(2);
      expect(result.data.topProjects).toHaveLength(1);
      expect(result.data.topEntries).toHaveLength(1);
    });

    it('should use 7 days interval for weekly period', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await activityLog.getDigest('a@b.com', 'weekly');

      // Check that the first query uses '7 days' interval
      const firstCallParams = pool.query.mock.calls[0][1];
      expect(firstCallParams[1]).toBe('7 days');
    });

    it('should use 1 day interval for daily period', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await activityLog.getDigest('a@b.com', 'daily');

      const firstCallParams = pool.query.mock.calls[0][1];
      expect(firstCallParams[1]).toBe('1 day');
    });

    it('should return failure when db query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('connection lost'));

      const result = await activityLog.getDigest('a@b.com', 'daily');

      expect(result.success).toBe(false);
      expect(result.message).toBe('connection lost');
      expect(result.data).toBeNull();
    });
  });

  // ─── logActivity (convenience export) ─────────────────────────

  describe('logActivity', () => {
    it('should be the same function as ActivityLog.log', () => {
      expect(logActivity).toBe(ActivityLog.log);
    });
  });
});
