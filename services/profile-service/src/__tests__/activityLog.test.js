import pool from '../db.js';
import { logActivity } from '../functions/activityLog.js';

jest.mock('../db.js');

describe('activityLog (profile-service)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logActivity', () => {
    it('should insert a notification activity record', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await logActivity(
        'test@example.com',
        'NOTIFICATION_EMAIL_TOGGLED',
        'notification',
        'email_notifications',
        { enabled: true }
      );

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[1][0]).toBe('test@example.com');
      expect(call[1][1]).toBe('NOTIFICATION_EMAIL_TOGGLED');
      expect(call[1][2]).toBe('notification');
      expect(call[1][3]).toBe('email_notifications');
      expect(call[1][4]).toBe(JSON.stringify({ enabled: true }));
    });

    it('should log NOTIFICATION_LEAD_TIME_CHANGED with leadTime details', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await logActivity(
        'test@example.com',
        'NOTIFICATION_LEAD_TIME_CHANGED',
        'notification',
        'notification_lead_time',
        { leadTime: '24 hours' }
      );

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[1][1]).toBe('NOTIFICATION_LEAD_TIME_CHANGED');
      expect(call[1][4]).toBe(JSON.stringify({ leadTime: '24 hours' }));
    });

    it('should log NOTIFICATION_TIMER_ABANDONMENT_TOGGLED', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await logActivity(
        'test@example.com',
        'NOTIFICATION_TIMER_ABANDONMENT_TOGGLED',
        'notification',
        'timer_abandonment_notifications',
        { enabled: false }
      );

      expect(pool.query).toHaveBeenCalled();
      const call = pool.query.mock.calls[0];
      expect(call[1][1]).toBe('NOTIFICATION_TIMER_ABANDONMENT_TOGGLED');
    });

    it('should catch and log unexpected exceptions', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw
      await logActivity(
        'test@example.com',
        'NOTIFICATION_EMAIL_TOGGLED',
        'notification',
        'email_notifications',
        { enabled: true }
      );

      expect(console.error).toHaveBeenCalledWith('[activityLog] Exception:', 'Database error');
    });
  });
});
