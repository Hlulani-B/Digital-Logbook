import { Archives } from '../functions/archives.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Archives', () => {
  let archives;

  beforeEach(() => {
    archives = new Archives();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── archive_project ─────────────────────────────────────────
  it('should archive a project successfully', async () => {
    let chain;
    supabase.from.mockImplementation((tableName) => {
      chain = createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      return chain;
    });

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: true, message: 'Project archived successfully' });
    expect(supabase.from).toHaveBeenCalledWith('projects');
    expect(chain.update).toHaveBeenCalledWith({ archived: true });
  });

  it('should return failure when archiving a project fails', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
    );

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── unarchive_project ───────────────────────────────────────
  it('should unarchive a project successfully', async () => {
    let chain;
    supabase.from.mockImplementation((tableName) => {
      chain = createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      return chain;
    });

    const result = await archives.unarchive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: true, message: 'Project unarchived successfully' });
    expect(supabase.from).toHaveBeenCalledWith('projects');
    expect(chain.update).toHaveBeenCalledWith({ archived: false });
  });

  it('should return failure when unarchiving a project fails', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
    );

    const result = await archives.unarchive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── archive_entry ───────────────────────────────────────────
  it('should archive an entry successfully', async () => {
    let chain;
    supabase.from.mockImplementation((tableName) => {
      chain = createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      return chain;
    });

    const result = await archives.archive_entry('a@b.com', 'My Project', 'entry-data');

    expect(result).toEqual({ success: true, message: 'Entry archived successfully' });
    expect(supabase.from).toHaveBeenCalledWith('entries');
    expect(chain.update).toHaveBeenCalledWith({ archived: true });
  });

  it('should return failure when archiving an entry fails', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
    );

    const result = await archives.archive_entry('a@b.com', 'My Project', 'entry-data');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── unarchive_entry ─────────────────────────────────────────
  it('should unarchive an entry successfully', async () => {
    let chain;
    supabase.from.mockImplementation((tableName) => {
      chain = createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      return chain;
    });

    const result = await archives.unarchive_entry('a@b.com', 'My Project', 'entry-data');

    expect(result).toEqual({ success: true, message: 'Entry unarchived successfully' });
    expect(supabase.from).toHaveBeenCalledWith('entries');
    expect(chain.update).toHaveBeenCalledWith({ archived: false });
  });

  it('should return failure when unarchiving an entry fails', async () => {
    supabase.from.mockImplementation((tableName) =>
      createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
    );

    const result = await archives.unarchive_entry('a@b.com', 'My Project', 'entry-data');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  it('should handle unexpected thrown errors', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('Connection lost');
    });

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'Connection lost' });
  });
});
