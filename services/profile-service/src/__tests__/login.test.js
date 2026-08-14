import { Login } from '../functions/login.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Login', () => {
  let login;

  beforeEach(() => {
    login = new Login();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true when user exists', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { data: { email: 'a@b.com' } } }).from(tableName)
    );

    const result = await login.checkUser('a@b.com');

    expect(result).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('users');
  });

  it('should return false when user does not exist', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { code: 'PGRST116', message: 'No rows found' } } }).from(tableName)
    );

    const result = await login.checkUser('missing@b.com');

    expect(result).toBe(false);
  });

  it('should return false on unexpected error', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'connection failed' } } }).from(tableName)
    );

    const result = await login.checkUser('a@b.com');

    expect(result).toBe(false);
  });
});
