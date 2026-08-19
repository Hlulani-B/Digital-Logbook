import { Priority } from '../functions/priority.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');
jest.mock('../functions/ai.js', () => ({ AI: jest.fn() }));

describe('Priority', () => {
  let priority;

  beforeEach(() => {
    priority = new Priority();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should set priority to "Urgent and important" for value 0', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
    );

    const result = await priority.setPriority('a@b.com', 0, 'P1', 'entry-object');

    expect(result).toEqual({ success: true, message: 'Priority set to Urgent and important' });
    // The update call is made on the chain; inspect the mocked supabase.from invocation indirectly
    expect(supabase.from).toHaveBeenCalledWith('entries');
  });

  it('should set priority to "Urgent but not important" for value 1', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
    );

    const result = await priority.setPriority('a@b.com', '1', 'P1', 'entry-object');

    expect(result).toEqual({ success: true, message: 'Priority set to Urgent but not important' });
  });

  it('should set priority to "Not urgent, not important" for value 2', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
    );

    const result = await priority.setPriority('a@b.com', 2, 'P1', 'entry-object');

    expect(result).toEqual({ success: true, message: 'Priority set to Not urgent, not important' });
  });

  it('should remove priority for value 3', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
    );

    const result = await priority.setPriority('a@b.com', 3, 'P1', 'entry-object');

    expect(result).toEqual({ success: true, message: 'Priority set to none' });
  });

  it('should return failure for invalid priority value', async () => {
    const result = await priority.setPriority('a@b.com', 99, 'P1', 'entry-object');

    expect(result).toEqual({ success: false, message: 'Invalid priority value' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('should return failure when Supabase returns an error', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
    );

    const result = await priority.setPriority('a@b.com', 1, 'P1', 'entry-object');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  it('should handle unexpected thrown errors', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('Connection lost');
    });

    const result = await priority.setPriority('a@b.com', 0, 'P1', 'entry-object');

    expect(result).toEqual({ success: false, message: 'Connection lost' });
  });
});
