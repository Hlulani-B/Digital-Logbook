import { Notifications } from '../functions/notifications/notifications.js';
import pool from '../db.js';

jest.mock('../db.js', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

let notifications;

beforeEach(() => {
  notifications = new Notifications();
  pool.query.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── getNotifications ──────────────────────────────────────────────────
describe('getNotifications', () => {
  it('returns notifications with unread count', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            entry_id: 'e1',
            project_name: 'P1',
            entry_title: 'Task A',
            type: 'due_soon',
            due_at: '2030-01-01T00:00:00Z',
            read: false,
            created_at: '2029-12-31T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: 1 }] });

    const result = await notifications.getNotifications('a@b.com');

    expect(result.success).toBe(true);
    expect(result.data.notifications).toHaveLength(1);
    expect(result.data.unreadCount).toBe(1);
  });

  it('requires an email', async () => {
    const result = await notifications.getNotifications('');

    expect(result.success).toBe(false);
    expect(result.message).toContain('email is required');
  });

  it('returns unreadCount 0 when count query returns nothing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const result = await notifications.getNotifications('a@b.com');

    expect(result.success).toBe(true);
    expect(result.data.unreadCount).toBe(0);
  });
});

// ─── getHistory ────────────────────────────────────────────────────────
describe('getHistory', () => {
  it('returns paginated rows plus total', async () => {
    const rows = [
      { id: 'n1', read: true },
      { id: 'n2', read: false },
    ];
    pool.query.mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows: [{ count: 7 }] });

    const result = await notifications.getHistory('a@b.com', 50, 0);

    expect(result.success).toBe(true);
    expect(result.data.notifications).toHaveLength(2);
    expect(result.data.total).toBe(7);
    expect(result.data.limit).toBe(50);
    expect(result.data.offset).toBe(0);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), [
      'a@b.com',
      50,
      0,
    ]);
  });

  it('clamps limit to the 1..200 range', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const over = await notifications.getHistory('a@b.com', 99999, 0);
    expect(over.data.limit).toBe(200);

    pool.query.mockReset();
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });
    const under = await notifications.getHistory('a@b.com', 0, 0);
    expect(under.data.limit).toBe(1);
  });

  it('defaults a non-numeric offset to 0 and limit to 50', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: 0 }] });

    const result = await notifications.getHistory('a@b.com', 'abc', 'xyz');

    expect(result.data.limit).toBe(50);
    expect(result.data.offset).toBe(0);
  });

  it('requires an email', async () => {
    const result = await notifications.getHistory('');

    expect(result.success).toBe(false);
    expect(result.message).toContain('email is required');
  });
});

// ─── markRead ──────────────────────────────────────────────────────────
describe('markRead', () => {
  it('marks a notification as read', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const result = await notifications.markRead('a@b.com', 'n1');

    expect(result.success).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.notifications'),
      ['n1', 'a@b.com']
    );
  });

  it('returns not found when the row does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 0 });

    const result = await notifications.markRead('a@b.com', 'missing');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('requires email and id', async () => {
    const result = await notifications.markRead('', '');

    expect(result.success).toBe(false);
  });
});

// ─── markAllRead ───────────────────────────────────────────────────────
describe('markAllRead', () => {
  it('marks all user notifications as read', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 3 });

    const result = await notifications.markAllRead('a@b.com');

    expect(result.success).toBe(true);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SET read = true'), [
      'a@b.com',
    ]);
  });

  it('requires an email', async () => {
    const result = await notifications.markAllRead('');

    expect(result.success).toBe(false);
  });
});

// ─── sendPendingEmails ─────────────────────────────────────────────────
describe('sendPendingEmails', () => {
  function mockFetchOk() {
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  }

  it('fails when Brevo env vars are missing', async () => {
    const result = await notifications.sendPendingEmails();

    expect(result.success).toBe(false);
    expect(result.message).toContain('BREVO_API_KEY');
  });

  it('sends one email per pending enabled notification', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
    mockFetchOk();

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            user_email: 'a@b.com',
            project_name: 'P1',
            entry_title: 'Task A',
            type: 'due_soon',
            due_at: '2030-01-01T00:00:00Z',
            email_enabled: true,
          },
          {
            id: 'n2',
            user_email: 'a@b.com',
            project_name: 'P1',
            entry_title: 'Task B',
            type: 'overdue',
            due_at: '2029-01-01T00:00:00Z',
            email_enabled: true,
          },
        ],
      })
      // emailed=true updates for n1, n2
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await notifications.sendPendingEmails();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(2);
    expect(result.skipped).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'api-key': 'test-key' }),
      })
    );
  });

  it('skips opted-out users without sending', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
    mockFetchOk();

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            user_email: 'opt@out.com',
            project_name: 'P1',
            entry_title: 'Task A',
            type: 'due_soon',
            due_at: '2030-01-01T00:00:00Z',
            email_enabled: false,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await notifications.sendPendingEmails();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not mark emailed when Brevo rejects', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('bad request') });

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 'n1',
          user_email: 'a@b.com',
          project_name: 'P1',
          entry_title: 'Task A',
          type: 'due_soon',
          due_at: '2030-01-01T00:00:00Z',
          email_enabled: true,
        },
      ],
    });

    const result = await notifications.sendPendingEmails();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
    // Only the SELECT ran — no emailed=true UPDATE for the rejected row
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('falls back to email_enabled=true when users row is missing (LEFT JOIN null)', async () => {
    process.env.BREVO_API_KEY = 'test-key';
    process.env.BREVO_SENDER_EMAIL = 'sender@example.com';
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'n1',
            user_email: 'ghost@example.com',
            project_name: null,
            entry_title: null,
            type: 'overdue',
            due_at: '2029-01-01T00:00:00Z',
            email_enabled: null, // COALESCE in SQL should prevent this, but guard anyway
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const result = await notifications.sendPendingEmails();

    expect(result.success).toBe(true);
    // null treated as enabled (send to user, better than silently dropping)
    expect(result.sent).toBe(1);
  });
});
