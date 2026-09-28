/**
 * Tests that profile route handlers log activity events to the activity_log table
 * after successful profile operations (username, name, avatar, email, delete).
 */

import pool from '../db.js';

jest.mock('../db.js');

let router;

beforeEach(async () => {
  pool.query.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  // Dynamic import to get fresh module after mocks
  const mod = await import('../Routes/profile.js');
  router = mod.default;
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Helper: invoke the router's POST /profile handler */
function handle(body) {
  const req = { body, userEmail: 'a@b.com' };
  const res = {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
  };
  // Find the POST /profile handler (first handler registered on the router)
  const layer = router.stack.find(
    (l) => l.route && l.route.path === '/profile' && l.route.methods.post
  );
  const handler = layer.route.stack[0].handle;
  return handler(req, res).then(() => res);
}

describe('Profile activity logging', () => {
  it('logs PROFILE_USERNAME_UPDATED after successful username change', async () => {
    // Q1: check username availability → empty = available
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q2: UPDATE users SET username
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q3: INSERT INTO activity_log
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await handle({
      function: 'username',
      values: { email: 'a@b.com', username: 'newname' },
    });

    expect(res._json.success).toBe(true);
    // The third query should be the activity log INSERT
    const activityCall = pool.query.mock.calls[2];
    expect(activityCall[0]).toContain('INSERT INTO activity_log');
    expect(activityCall[1][1]).toBe('PROFILE_USERNAME_UPDATED');
    // entity_name is the new username, 'profile' is hardcoded in SQL
    expect(activityCall[1][2]).toBe('newname');
  });

  it('logs PROFILE_CREATED after successful sign-up', async () => {
    // Q1: INSERT INTO users
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q2: INSERT INTO activity_log
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await handle({
      function: 'email',
      values: { email: 'new@user.com' },
    });

    expect(res._json.success).toBe(true);
    const activityCall = pool.query.mock.calls[1];
    expect(activityCall[0]).toContain('INSERT INTO activity_log');
    expect(activityCall[1][1]).toBe('PROFILE_CREATED');
  });

  it('logs PROFILE_NAME_UPDATED after successful name change', async () => {
    // Q1: UPDATE users SET name
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q2: INSERT INTO activity_log
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await handle({
      function: 'name',
      values: { email: 'a@b.com', new_name: 'Jane Doe' },
    });

    expect(res._json.success).toBe(true);
    const activityCall = pool.query.mock.calls[1];
    expect(activityCall[1][1]).toBe('PROFILE_NAME_UPDATED');
    // params: [email, action_type, entity_name, details_json]
    expect(JSON.parse(activityCall[1][3])).toEqual({ new_name: 'Jane Doe' });
  });

  it('logs PROFILE_AVATAR_UPDATED after successful avatar change', async () => {
    // Q1: UPDATE users SET avatar
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q2: INSERT INTO activity_log
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await handle({
      function: 'avatar',
      values: { email: 'a@b.com', url: 'http://avatar.url/pic.png' },
    });

    expect(res._json.success).toBe(true);
    const activityCall = pool.query.mock.calls[1];
    expect(activityCall[1][1]).toBe('PROFILE_AVATAR_UPDATED');
  });

  it('does NOT log activity when profile operation fails', async () => {
    // Username is taken → failure
    pool.query.mockResolvedValueOnce({ rows: [{ username: 'taken' }] });

    const res = await handle({
      function: 'username',
      values: { email: 'a@b.com', username: 'taken' },
    });

    expect(res._json.success).toBe(false);
    // Only 1 query (the availability check) — no activity INSERT
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('activity log failure does not break the response', async () => {
    // Q1: UPDATE users SET name → success
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Q2: INSERT INTO activity_log → fails
    pool.query.mockRejectedValueOnce(new Error('activity log db error'));

    const res = await handle({
      function: 'name',
      values: { email: 'a@b.com', new_name: 'Jane' },
    });

    // The main operation still succeeds
    expect(res._json.success).toBe(true);
  });
});
