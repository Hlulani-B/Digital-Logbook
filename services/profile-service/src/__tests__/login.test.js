import pool from '../db.js';

jest.mock('../db.js');

describe('Login', () => {
  let Login;

  beforeEach(async () => {
    pool.query.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Re-import after mock is set up
    const mod = await import('../functions/login.js');
    Login = mod.Login;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return exists=true, deleted=false when active user exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ email: 'a@b.com', deleted: false }] });

    const login = new Login();
    const result = await login.checkUser('a@b.com');

    expect(result.exists).toBe(true);
    expect(result.deleted).toBe(false);
  });

  it('should return exists=true, deleted=true when soft-deleted user exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ email: 'a@b.com', deleted: true }] });

    const login = new Login();
    const result = await login.checkUser('a@b.com');

    expect(result.exists).toBe(true);
    expect(result.deleted).toBe(true);
  });

  it('should return exists=false when user does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const login = new Login();
    const result = await login.checkUser('missing@b.com');

    expect(result.exists).toBe(false);
    expect(result.deleted).toBe(false);
  });

  it('should return exists=false on unexpected error', async () => {
    pool.query.mockRejectedValueOnce(new Error('connection failed'));

    const login = new Login();
    const result = await login.checkUser('a@b.com');

    expect(result.exists).toBe(false);
    expect(result.deleted).toBe(false);
  });
});
