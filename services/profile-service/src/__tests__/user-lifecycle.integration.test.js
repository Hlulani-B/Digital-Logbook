/**
 * Integration tests for the profile-service user lifecycle.
 *
 * Tests that Login, Email, Username, and Profile modules work together:
 * - Sign up (Email) → check user (Login) → update username → get profile
 * - Username conflict resolution across modules
 * - Soft-delete flow: deleteProfile cascades across all user data
 * - Deleted user detection via Login.checkUser
 */

import pool from '../db.js';
import { mockClient } from '../__mocks__/db.js';

jest.mock('../db.js');

let Login, Email, Username, Profile;

beforeEach(async () => {
  pool.query.mockReset();
  mockClient.query.mockReset();
  mockClient.release.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});

  const loginMod = await import('../functions/login.js');
  const profileMod = await import('../functions/profile.js');
  Login = loginMod.Login;
  Email = profileMod.Email;
  Username = profileMod.Username;
  Profile = profileMod.Profile;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('User Lifecycle Integration', () => {
  it('sign up → check user → update username → get profile', async () => {
    const email = 'newuser@test.com';

    // Step 1: Sign up — Email.email() inserts user with default username
    pool.query.mockResolvedValueOnce({ rows: [] }); // INSERT succeeds
    const emailFn = new Email();
    const signupResult = await emailFn.email(email);
    expect(signupResult.success).toBe(true);

    // Verify the INSERT was called with the correct default username
    const insertCall = pool.query.mock.calls[0];
    expect(insertCall[0]).toContain('INSERT INTO users');
    expect(insertCall[1][1]).toBe('newuser'); // default username from email prefix

    // Step 2: Check user — Login.checkUser() finds the user
    pool.query.mockResolvedValueOnce({
      rows: [{ email, deleted: false, deletion_scheduled_at: null }],
    });
    const login = new Login();
    const checkResult = await login.checkUser(email);
    expect(checkResult.exists).toBe(true);
    expect(checkResult.deleted).toBe(false);

    // Step 3: Update username — Username.username() checks availability then updates
    pool.query.mockResolvedValueOnce({ rows: [] }); // SELECT for uniqueness — no conflict
    pool.query.mockResolvedValueOnce({ rows: [] }); // UPDATE succeeds
    const usernameFn = new Username();
    const updateResult = await usernameFn.username(email, 'cool_name');
    expect(updateResult.success).toBe(true);

    // Step 4: Get profile — Profile.getProfile() returns updated user
    pool.query.mockResolvedValueOnce({
      rows: [{ email, username: 'cool_name', name: 'newuser', avatar: null }],
    });
    const profileFn = new Profile();
    const profileResult = await profileFn.getProfile(email);
    expect(profileResult.success).toBe(true);
    expect(profileResult.data.username).toBe('cool_name');
  });

  it('username conflict prevents update while another user has the name', async () => {
    // Step 1: Try to set username — another user already has it
    pool.query.mockResolvedValueOnce({
      rows: [{ username: 'taken_name' }], // SELECT finds existing user
    });

    const usernameFn = new Username();
    const result = await usernameFn.username('user@test.com', 'taken_name');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Username not available');

    // Step 2: Verify the UPDATE was NOT called (only SELECT ran)
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toContain('SELECT');
  });

  it('soft-delete flow: deleteProfile cascades then Login detects deleted user', async () => {
    const email = 'deleteme@test.com';

    // Step 1: Delete profile — cascades across all tables in a transaction
    mockClient.query.mockResolvedValue({ rows: [] }); // All queries succeed
    mockClient.query.mockImplementation((query) => {
      // Track the transaction sequence
      if (query === 'BEGIN') return Promise.resolve({});
      if (query.includes('COMMIT')) return Promise.resolve({});
      return Promise.resolve({ rows: [] });
    });

    const profileFn = new Profile();
    const deleteResult = await profileFn.deleteProfile(email);
    expect(deleteResult.success).toBe(true);

    // Verify transaction: BEGIN → 5 UPDATEs → COMMIT
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

    // Verify all 5 tables were soft-deleted
    const updateCalls = mockClient.query.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('UPDATE')
    );
    expect(updateCalls.length).toBe(5); // entries, fields, projects, activity_log, users

    // Verify release was called on the client
    expect(mockClient.release).toHaveBeenCalled();

    // Step 2: Login.checkUser() detects the deleted user
    pool.query.mockResolvedValueOnce({
      rows: [{ email, deleted: true, deletion_scheduled_at: '2026-10-07T00:00:00Z' }],
    });
    const login = new Login();
    const checkResult = await login.checkUser(email);
    expect(checkResult.exists).toBe(true);
    expect(checkResult.deleted).toBe(true);
    expect(checkResult.deletion_scheduled_at).toBe('2026-10-07T00:00:00Z');
  });

  it('sign up with special characters generates safe default username', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const emailFn = new Email();
    const result = await emailFn.email('user.name+tag@example.com');
    expect(result.success).toBe(true);

    // Verify the generated username is sanitized
    const insertCall = pool.query.mock.calls[0];
    const defaultUsername = insertCall[1][1];
    expect(defaultUsername).toMatch(/^[a-z0-9_]+$/);
    expect(defaultUsername).toBe('user_name_2btag');
  });
});
