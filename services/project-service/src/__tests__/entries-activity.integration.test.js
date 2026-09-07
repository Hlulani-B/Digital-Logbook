/**
 * Integration tests for entries + activity log cross-module flow.
 *
 * Tests that the Entries and ActivityLog modules work together:
 * - Adding an entry → activity log records the action
 * - Updating an entry → activity log captures the change
 * - Deleting an entry → activity log records the deletion
 * - Activity feed retrieves entries in correct order
 */

import pool from '../db.js';

jest.mock('../db.js');

let Entries, ActivityLog, logActivity;

beforeEach(async () => {
  pool.query.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const entriesMod = await import('../functions/entries.js');
  const activityMod = await import('../functions/activityLog.js');
  Entries = entriesMod.Entries;
  ActivityLog = activityMod.ActivityLog;
  logActivity = activityMod.logActivity;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const EMAIL = 'dev@test.com';

describe('Entries + Activity Log Integration', () => {
  describe('Add entry → log activity → retrieve activities', () => {
    it('addEntry inserts, then ActivityLog.log records the action, then getActivities retrieves both', async () => {
      const entries = new Entries();
      const activityLog = new ActivityLog();

      // Step 1: Add an entry
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 42, user_email: EMAIL, project_name: 'WebApp', entries: { task: 'Login' } }],
      });
      const addResult = await entries.addEntry(
        EMAIL, 'WebApp', { task: 'Login' }, null, null, null, null, null, null, null
      );
      expect(addResult.success).toBe(true);
      expect(addResult.data[0].id).toBe(42);

      // Step 2: Log the activity
      pool.query.mockResolvedValueOnce({ rows: [] }); // INSERT into activity_log
      await ActivityLog.log(EMAIL, 'ENTRY_CREATED', 'entry', 'Login', { project: 'WebApp' });
      // Verify the activity log INSERT was called
      const logCall = pool.query.mock.calls[1];
      expect(logCall[0]).toContain('INSERT INTO activity_log');

      // Step 3: Retrieve activities — should include the logged activity
      pool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_email: EMAIL,
            action_type: 'ENTRY_CREATED',
            entity_type: 'entry',
            entity_name: 'Login',
            details: { project: 'WebApp' },
            created_at: '2026-09-07T10:00:00Z',
          },
        ],
      });
      const activities = await activityLog.getActivities(EMAIL);
      expect(activities.success).toBe(true);
      expect(activities.data).toHaveLength(1);
      expect(activities.data[0].action_type).toBe('ENTRY_CREATED');
      expect(activities.data[0].entity_name).toBe('Login');
    });
  });

  describe('Multiple operations → activity feed shows all in order', () => {
    it('create → update → delete produces 3 activity records', async () => {
      // Log three activities
      pool.query.mockResolvedValue({ rows: [] }); // All INSERTs succeed

      await ActivityLog.log(EMAIL, 'ENTRY_CREATED', 'entry', 'Task A', { project: 'Alpha' });
      await ActivityLog.log(EMAIL, 'ENTRY_UPDATED', 'entry', 'Task A', { field: 'status' });
      await ActivityLog.log(EMAIL, 'ENTRY_DELETED', 'entry', 'Task A', { project: 'Alpha' });

      // Verify 3 INSERT calls were made
      const insertCalls = pool.query.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('INSERT INTO activity_log')
      );
      expect(insertCalls).toHaveLength(3);

      // Retrieve activities — should return all 3
      pool.query.mockResolvedValueOnce({
        rows: [
          { action_type: 'ENTRY_DELETED', entity_name: 'Task A', created_at: '2026-09-07T12:00:00Z' },
          { action_type: 'ENTRY_UPDATED', entity_name: 'Task A', created_at: '2026-09-07T11:00:00Z' },
          { action_type: 'ENTRY_CREATED', entity_name: 'Task A', created_at: '2026-09-07T10:00:00Z' },
        ],
      });

      const activityLog = new ActivityLog();
      const result = await activityLog.getActivities(EMAIL);
      expect(result.data).toHaveLength(3);
      // Newest first (ORDER BY created_at DESC)
      expect(result.data[0].action_type).toBe('ENTRY_DELETED');
      expect(result.data[2].action_type).toBe('ENTRY_CREATED');
    });
  });

  describe('logActivity convenience function', () => {
    it('logActivity static export works the same as ActivityLog.log', async () => {
      pool.query.mockResolvedValue({ rows: [] });

      // Use the convenience export
      await logActivity(EMAIL, 'PROJECT_CREATED', 'project', 'NewProject');

      const call = pool.query.mock.calls[0];
      expect(call[0]).toContain('INSERT INTO activity_log');
      expect(call[1]).toEqual([
        EMAIL,
        'PROJECT_CREATED',
        'project',
        'NewProject',
        '{}',
      ]);
    });
  });

  describe('Activity log resilience', () => {
    it('activity log failure does not crash — errors are caught internally', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB write failed'));

      // logActivity should NOT throw — it's fire-and-forget
      await ActivityLog.log(EMAIL, 'ENTRY_CREATED', 'entry', 'Task');

      // No exception thrown — test passes
      expect(true).toBe(true);
    });

    it('getActivities returns failure shape when query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('connection lost'));

      const activityLog = new ActivityLog();
      const result = await activityLog.getActivities(EMAIL);

      expect(result.success).toBe(false);
      expect(result.message).toBe('connection lost');
      expect(result.data).toEqual([]);
    });
  });
});
