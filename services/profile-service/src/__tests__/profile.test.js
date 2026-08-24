import pool from '../db.js';
import { Username, Email, Name, Avatar, Profile } from '../functions/profile.js';

jest.mock('../db.js');

describe('Profile service functions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    pool.query.mockReset();
    pool.connect.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Username ────────────────────────────────────────────────
  describe('Username', () => {
    it('should update username when it is available', async () => {
      // Q1: check username availability (empty = available)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q2: update username
      pool.query.mockResolvedValueOnce({ rows: [] });

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result).toEqual({ success: true, message: 'Username updated successfully' });
    });

    it('should reject username when it is taken', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ username: 'newuser' }] });

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result).toEqual({ success: false, message: 'Username not available' });
    });

    it('should return failure on error', async () => {
      pool.query.mockRejectedValueOnce(new Error('db error'));

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result.success).toBe(false);
      expect(result.message).toBe('db error');
    });
  });

  // ─── Email ───────────────────────────────────────────────────
  describe('Email', () => {
    it('should insert a new email successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const email = new Email();
      const result = await email.email('a@b.com');

      expect(result).toEqual({ success: true, message: 'Email added successfully' });
    });

    it('should return failure when insert fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('duplicate key'));

      const email = new Email();
      const result = await email.email('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('duplicate key');
    });
  });

  // ─── Name ────────────────────────────────────────────────────
  describe('Name', () => {
    it('should update name successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const name = new Name();
      const result = await name.name('a@b.com', 'New Name');

      expect(result).toEqual({ success: true, message: 'Name updated successfully' });
    });

    it('should return failure when update fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('update failed'));

      const name = new Name();
      const result = await name.name('a@b.com', 'New Name');

      expect(result.success).toBe(false);
      expect(result.message).toBe('update failed');
    });
  });

  // ─── Avatar ──────────────────────────────────────────────────
  describe('Avatar', () => {
    it('should update avatar successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const avatar = new Avatar();
      const result = await avatar.avatar('a@b.com', 'http://avatar.url');

      expect(result).toEqual({ success: true, message: 'Avatar updated successfully' });
    });

    it('should return failure when update fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('update failed'));

      const avatar = new Avatar();
      const result = await avatar.avatar('a@b.com', 'http://avatar.url');

      expect(result.success).toBe(false);
      expect(result.message).toBe('update failed');
    });
  });

  // ─── Profile ─────────────────────────────────────────────────
  describe('Profile', () => {
    it('should fetch a profile successfully', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ email: 'a@b.com', username: 'user', name: 'Name' }],
      });

      const profile = new Profile();
      const result = await profile.getProfile('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ email: 'a@b.com', username: 'user', name: 'Name' });
    });

    it('should return failure when get profile query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('not found'));

      const profile = new Profile();
      const result = await profile.getProfile('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('not found');
    });

    it('should return user not found when no rows returned', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const profile = new Profile();
      const result = await profile.getProfile('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found');
    });

    it('should delete profile and related rows successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const profile = new Profile();
      const result = await profile.deleteProfile('a@b.com');

      expect(result).toEqual({ success: true, message: 'Profile deleted successfully' });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return failure when delete fails and rollback', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // entries
          .mockResolvedValueOnce({ rows: [] }) // fields
          .mockResolvedValueOnce({ rows: [] }) // projects
          .mockRejectedValueOnce(new Error('delete failed')), // activity_log fails
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const profile = new Profile();
      const result = await profile.deleteProfile('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('delete failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
