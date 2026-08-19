import { ActivityLog, logActivity } from '../functions/activityLog.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('ActivityLog', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── log() (static) ──────────────────────────────────────────

  describe('log', () => {
    it('should insert an activity record successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      await ActivityLog.log('a@b.com', 'PROJECT_CREATED', 'project', 'MyProject');

      expect(supabase.from).toHaveBeenCalledWith('activity_log');
    });

    it('should pass details object to the insert', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const details = { extra: 'info' };
      await ActivityLog.log('a@b.com', 'ENTRY_ADDED', 'entry', 'test-entry', details);

      expect(supabase.from).toHaveBeenCalledWith('activity_log');
    });

    it('should log error message when insert returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'insert failed' } } }).from(tableName)
      );

      // Should not throw — fire-and-forget
      await ActivityLog.log('a@b.com', 'PROJECT_CREATED', 'project', 'MyProject');

      expect(console.error).toHaveBeenCalledWith(
        '[activityLog] Failed to insert:', 'insert failed'
      );
    });

    it('should catch and log unexpected exceptions', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Network failure');
      });

      // Should not throw
      await ActivityLog.log('a@b.com', 'PROJECT_CREATED', 'project', 'MyProject');

      expect(console.error).toHaveBeenCalledWith(
        '[activityLog] Exception:', 'Network failure'
      );
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

      supabase.from.mockImplementation((tableName) => {
        const chain = createMockSupabaseClient({ [tableName]: { data: mockActivities } }).from(tableName);
        chain.limit = jest.fn().mockReturnThis();
        return chain;
      });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('activity_log');
    });

    it('should return empty array when no activities exist', async () => {
      supabase.from.mockImplementation((tableName) => {
        const chain = createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
        chain.limit = jest.fn().mockReturnThis();
        return chain;
      });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) => {
        const chain = createMockSupabaseClient({ [tableName]: { error: { message: 'query failed' } } }).from(tableName);
        chain.limit = jest.fn().mockReturnThis();
        return chain;
      });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('query failed');
      expect(result.data).toEqual([]);
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await activityLog.getActivities('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection lost');
    });
  });

  // ─── logActivity (convenience export) ─────────────────────────

  describe('logActivity', () => {
    it('should be the same function as ActivityLog.log', () => {
      expect(logActivity).toBe(ActivityLog.log);
    });
  });
});
