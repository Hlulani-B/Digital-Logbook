import { Entries } from '../functions/entries.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');
jest.mock('../functions/ai.js', () => ({ AI: jest.fn() }));

describe('Entries', () => {
  let entries;

  beforeEach(() => {
    entries = new Entries();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── addEntry ────────────────────────────────────────────────
  describe('addEntry', () => {
    it('should add a new entry successfully', async () => {
      const existingEntry = { entries: 'other-entry', user_email: 'a@b.com', project_name: 'P1' };
      supabase.from.mockImplementation((tableName) => {
        const mock = createMockSupabaseClient({
          entries: {
            data: [existingEntry],
            error: null,
          },
        }).from(tableName);
        return mock;
      });

      const result = await entries.addEntry('a@b.com', 'P1', 'new-entry', '2026-08-20T00:00:00Z');

      expect(result).toEqual({
        success: true,
        message: 'Entry added successfully',
        data: [{ entries: 'other-entry', user_email: 'a@b.com', project_name: 'P1' }],
      });
      expect(supabase.from).toHaveBeenCalledWith('entries');
    });

    it('should add entry and return inserted data', async () => {
      const insertedData = { entries: 'new-entry', user_email: 'a@b.com', project_name: 'P1' };
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({
          entries: { data: [insertedData] },
        }).from(tableName)
      );

      const result = await entries.addEntry('a@b.com', 'P1', 'new-entry', null);

      expect(result).toEqual({ success: true, message: 'Entry added successfully', data: [insertedData] });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'insert failed' } } }).from(tableName)
      );

      const result = await entries.addEntry('a@b.com', 'P1', 'entry', null);

      expect(result).toEqual({ success: false, message: 'insert failed' });
    });
  });

  // ─── updateEntry ─────────────────────────────────────────────
  describe('updateEntry', () => {
    it('should update an existing entry', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ id: 1, entries: 'new-entry' }] } }).from(tableName)
      );

      const result = await entries.updateEntry('a@b.com', 'P1', 'old-entry', 'new-entry');

      expect(result).toEqual({
        success: true,
        message: 'Entry updated successfully',
        data: [{ id: 1, entries: 'new-entry' }],
      });
    });

    it('should return failure when no entry matches', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await entries.updateEntry('a@b.com', 'P1', 'missing-entry', 'new-entry');

      expect(result).toEqual({ success: false, message: 'Entry not found. Check that the entry exists and belongs to this user/project.' });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'update failed' } } }).from(tableName)
      );

      const result = await entries.updateEntry('a@b.com', 'P1', 'old-entry', 'new-entry');

      expect(result).toEqual({ success: false, message: 'update failed' });
    });
  });

  // ─── getEntries ──────────────────────────────────────────────
  describe('getEntries', () => {
    it('should retrieve entries for a user and project', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ id: 1, entries: 'entry-1' }] } }).from(tableName)
      );

      const result = await entries.getEntries('a@b.com', 'P1');

      expect(result).toEqual({
        success: true,
        message: 'Entries retrieved successfully',
        data: [{ id: 1, entries: 'entry-1' }],
      });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'select failed' } } }).from(tableName)
      );

      const result = await entries.getEntries('a@b.com', 'P1');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });
  });

  // ─── getAllEntries ───────────────────────────────────────────
  describe('getAllEntries', () => {
    it('should retrieve all entries for a user across projects', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ id: 1, entries: 'entry-1' }, { id: 2, entries: 'entry-2' }] } }).from(tableName)
      );

      const result = await entries.getAllEntries('a@b.com');

      expect(result).toEqual({
        success: true,
        message: 'All entries retrieved successfully',
        data: [{ id: 1, entries: 'entry-1' }, { id: 2, entries: 'entry-2' }],
      });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'select failed' } } }).from(tableName)
      );

      const result = await entries.getAllEntries('a@b.com');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });
  });

  // ─── deleteEntry ─────────────────────────────────────────────
  describe('deleteEntry', () => {
    it('should delete an existing entry', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ id: 1, entries: 'entry-to-delete' }] } }).from(tableName)
      );

      const result = await entries.deleteEntry('a@b.com', 'P1', 'entry-to-delete');

      expect(result).toEqual({ success: true, message: 'Entry deleted successfully' });
    });

    it('should return failure when no entry matches', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await entries.deleteEntry('a@b.com', 'P1', 'missing-entry');

      expect(result).toEqual({ success: false, message: 'Entry not found. Something went wrong' });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'delete failed' } } }).from(tableName)
      );

      const result = await entries.deleteEntry('a@b.com', 'P1', 'entry');

      expect(result).toEqual({ success: false, message: 'delete failed' });
    });
  });

  // ─── sortEntries ─────────────────────────────────────────────
  describe('sortEntries', () => {
    it('should sort by due date ascending (sort_type 0)', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ due_date: '2026-08-10' }, { due_date: '2026-08-01' }] } }).from(tableName)
      );

      const result = await entries.sortEntries('a@b.com', 'P1', 0);

      expect(result).toEqual({
        success: true,
        message: 'Unarchived entries sorted successfully',
        data: [{ due_date: '2026-08-10' }, { due_date: '2026-08-01' }],
      });
    });

    it('should sort by priority (sort_type 1)', async () => {
      const rows = [
        { priority: 'Not urgent, not important', id: 1 },
        { priority: 'Urgent and important', id: 2 },
        { priority: 'Urgent but not important', id: 3 },
      ];
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: rows } }).from(tableName)
      );

      const result = await entries.sortEntries('a@b.com', 'P1', 1);

      expect(result.data).toEqual([
        { priority: 'Urgent and important', id: 2 },
        { priority: 'Urgent but not important', id: 3 },
        { priority: 'Not urgent, not important', id: 1 },
      ]);
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'order failed' } } }).from(tableName)
      );

      const result = await entries.sortEntries('a@b.com', 'P1', 0);

      expect(result).toEqual({ success: false, message: 'order failed' });
    });
  });

  // ─── sortArchivedEntries ─────────────────────────────────────
  describe('sortArchivedEntries', () => {
    it('should sort archived entries by due_date (sort_type=0)', async () => {
      const mockData = [
        { id: 1, due_date: '2024-03-01', archived: true },
        { id: 2, due_date: '2024-01-01', archived: true },
      ];
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 0);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledWith('entries');
    });

    it('should sort archived entries by priority (sort_type=1)', async () => {
      const mockData = [
        { id: 1, priority: 'Not urgent, not important' },
        { id: 2, priority: 'Urgent and important' },
        { id: 3, priority: 'Urgent but not important' },
      ];
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 1);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { id: 2, priority: 'Urgent and important' },
        { id: 3, priority: 'Urgent but not important' },
        { id: 1, priority: 'Not urgent, not important' },
      ]);
    });

    it('should return data as-is for unknown sort_type', async () => {
      const mockData = [{ id: 1, due_date: '2024-01-01' }];
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 99);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should return failure on error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'query failed' } } }).from(tableName)
      );

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 0);

      expect(result).toEqual({ success: false, message: 'query failed' });
    });
  });

  // ─── updateEntry edge cases ──────────────────────────────────
  describe('updateEntry edge cases', () => {
    it('should return "No changes" when no fields are provided', async () => {
      const result = await entries.updateEntry('entry-1', 'a@b.com', 'P1');

      expect(result).toEqual({ success: true, message: 'No changes to update' });
    });
  });

  // ─── sortUnarchivedEntries default case ──────────────────────
  describe('sortUnarchivedEntries default case', () => {
    it('should return data as-is for unknown sort_type', async () => {
      const mockData = [{ id: 1, due_date: '2024-01-01' }];
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await entries.sortUnarchivedEntries('a@b.com', 'P1', 99);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  // ─── deleteEntryById ─────────────────────────────────────────
  describe('deleteEntryById', () => {
    it('should soft-delete an entry by id', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ id: 42, deleted: true }] } }).from(tableName)
      );

      const result = await entries.deleteEntryById('a@b.com', 42);

      expect(result).toEqual({ success: true, message: 'Entry deleted successfully' });
      expect(supabase.from).toHaveBeenCalledWith('entries');
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'delete by id failed' } } }).from(tableName)
      );

      const result = await entries.deleteEntryById('a@b.com', 42);

      expect(result).toEqual({ success: false, message: 'delete by id failed' });
    });
  });
});
