import { Username, Email, Name, Avatar, Profile } from '../functions/profile.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Profile service functions', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Username ────────────────────────────────────────────────
  describe('Username', () => {
    it('should update username when it is available', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result).toEqual({ success: true, message: 'Username updated successfully' });
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    it('should reject username when it is taken', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ username: 'newuser' }] } }).from(tableName)
      );

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result).toEqual({ success: false, message: 'Username not available' });
    });

    it('should return failure on error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'db error' } } }).from(tableName)
      );

      const username = new Username();
      const result = await username.username('a@b.com', 'newuser');

      expect(result.success).toBe(false);
      expect(result.message).toBe('db error');
    });
  });

  // ─── Email ───────────────────────────────────────────────────
  describe('Email', () => {
    it('should insert a new email successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const email = new Email();
      const result = await email.email('a@b.com');

      expect(result).toEqual({ success: true, message: 'Email added successfully' });
    });

    it('should return failure when insert fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'duplicate key' } } }).from(tableName)
      );

      const email = new Email();
      const result = await email.email('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('duplicate key');
    });
  });

  // ─── Name ────────────────────────────────────────────────────
  describe('Name', () => {
    it('should update name successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const name = new Name();
      const result = await name.name('a@b.com', 'New Name');

      expect(result).toEqual({ success: true, message: 'Name updated successfully' });
    });

    it('should return failure when update fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
      );

      const name = new Name();
      const result = await name.name('a@b.com', 'New Name');

      expect(result.success).toBe(false);
      expect(result.message).toBe('update failed');
    });
  });

  // ─── Avatar ──────────────────────────────────────────────────
  describe('Avatar', () => {
    it('should update avatar successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const avatar = new Avatar();
      const result = await avatar.avatar('a@b.com', 'http://avatar.url');

      expect(result).toEqual({ success: true, message: 'Avatar updated successfully' });
    });

    it('should return failure when update fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
      );

      const avatar = new Avatar();
      const result = await avatar.avatar('a@b.com', 'http://avatar.url');

      expect(result.success).toBe(false);
      expect(result.message).toBe('update failed');
    });
  });

  // ─── Profile ─────────────────────────────────────────────────
  describe('Profile', () => {
    it('should fetch a profile successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: { email: 'a@b.com', username: 'user', name: 'Name' } } }).from(tableName)
      );

      const profile = new Profile();
      const result = await profile.getProfile('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ email: 'a@b.com', username: 'user', name: 'Name' });
    });

    it('should return failure when get profile fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'not found' } } }).from(tableName)
      );

      const profile = new Profile();
      const result = await profile.getProfile('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('not found');
    });

    it('should delete profile and related rows successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const profile = new Profile();
      const result = await profile.deleteProfile('a@b.com');

      expect(result).toEqual({ success: true, message: 'Profile deleted successfully' });
      expect(supabase.from).toHaveBeenCalledWith('entries');
      expect(supabase.from).toHaveBeenCalledWith('fields');
      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    it('should return failure when delete fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'delete failed' } } }).from(tableName)
      );

      const profile = new Profile();
      const result = await profile.deleteProfile('a@b.com');

      expect(result.success).toBe(false);
      expect(result.message).toBe('delete failed');
    });
  });
});
