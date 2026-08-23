import pool from '../db.js';
import { Entries } from '../functions/entries.js';

jest.mock('../db.js');
jest.mock('../functions/ai.js', () => ({ AI: jest.fn() }));

describe('Entries', () => {
  let entries;

  beforeEach(() => {
    entries = new Entries();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── addEntry ────────────────────────────────────────────────
  describe('addEntry', () => {
    it('should add a new entry successfully', async () => {
      const insertedRow = { id: 1, entries: 'new-entry', user_email: 'a@b.com', project_name: 'P1' };
      pool.query.mockResolvedValueOnce({ rows: [insertedRow] });

      const result = await entries.addEntry('a@b.com', 'P1', 'new-entry', '2026-08-20T00:00:00Z');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entry added successfully');
      expect(result.data).toEqual([insertedRow]);
    });

    it('should add entry and return inserted data', async () => {
      const insertedData = { id: 2, entries: 'new-entry', user_email: 'a@b.com', project_name: 'P1' };
      pool.query.mockResolvedValueOnce({ rows: [insertedData] });

      const result = await entries.addEntry('a@b.com', 'P1', 'new-entry', null);

      expect(result).toEqual({ success: true, message: 'Entry added successfully', data: [insertedData] });
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('insert failed'));

      const result = await entries.addEntry('a@b.com', 'P1', 'entry', null);

      expect(result).toEqual({ success: false, message: 'insert failed' });
    });
  });

  // ─── updateEntry ─────────────────────────────────────────────
  describe('updateEntry', () => {
    it('should update an existing entry', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, entries: 'new-entry' }] });

      const result = await entries.updateEntry('a@b.com', 'P1', 1, 'new-entry');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, entries: 'new-entry' }]);
    });

    it('should return failure when no entry matches', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await entries.updateEntry('a@b.com', 'P1', 999, 'new-entry');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Entry not found');
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('update failed'));

      const result = await entries.updateEntry('a@b.com', 'P1', 1, 'new-entry');

      expect(result).toEqual({ success: false, message: 'update failed' });
    });
  });

  // ─── getEntries ──────────────────────────────────────────────
  describe('getEntries', () => {
    it('should retrieve entries for a user and project', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, entries: 'entry-1' }] });

      const result = await entries.getEntries('a@b.com', 'P1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ id: 1, entries: 'entry-1' }]);
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('select failed'));

      const result = await entries.getEntries('a@b.com', 'P1');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });
  });

  // ─── getAllEntries ───────────────────────────────────────────
  describe('getAllEntries', () => {
    it('should retrieve all entries for a user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, entries: 'entry-1' }, { id: 2, entries: 'entry-2' }] });

      const result = await entries.getAllEntries('a@b.com');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('select failed'));

      const result = await entries.getAllEntries('a@b.com');

      expect(result).toEqual({ success: false, message: 'select failed' });
    });
  });

  // ─── deleteEntry ─────────────────────────────────────────────
  describe('deleteEntry', () => {
    it('should delete an existing entry', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, entries: 'entry-to-delete' }] });

      const result = await entries.deleteEntry('a@b.com', 'P1', 'entry-to-delete');

      expect(result).toEqual({ success: true, message: 'Entry deleted successfully' });
    });

    it('should return failure when no entry matches', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await entries.deleteEntry('a@b.com', 'P1', 'missing-entry');

      expect(result).toEqual({ success: false, message: 'Entry not found. Something went wrong' });
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('delete failed'));

      const result = await entries.deleteEntry('a@b.com', 'P1', 'entry');

      expect(result).toEqual({ success: false, message: 'delete failed' });
    });
  });

  // ─── sortEntries ─────────────────────────────────────────────
  describe('sortEntries', () => {
    it('should sort by due date ascending (sort_type 0)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ due_date: '2026-08-10' }, { due_date: '2026-08-01' }] });

      const result = await entries.sortEntries('a@b.com', 'P1', 0);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should sort by priority (sort_type 1)', async () => {
      const rows = [
        { priority: 'Not urgent, not important', id: 1 },
        { priority: 'Urgent and important', id: 2 },
        { priority: 'Urgent but not important', id: 3 },
      ];
      pool.query.mockResolvedValueOnce({ rows });

      const result = await entries.sortEntries('a@b.com', 'P1', 1);

      expect(result.data).toEqual([
        { priority: 'Urgent and important', id: 2 },
        { priority: 'Urgent but not important', id: 3 },
        { priority: 'Not urgent, not important', id: 1 },
      ]);
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('order failed'));

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
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 0);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should return failure on error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await entries.sortArchivedEntries('a@b.com', 'P1', 0);

      expect(result).toEqual({ success: false, message: 'query failed' });
    });
  });

  // ─── updateEntry edge cases ──────────────────────────────────
  describe('updateEntry edge cases', () => {
    it('should return "No changes" when no fields are provided', async () => {
      const result = await entries.updateEntry('a@b.com', 'P1', 'entry-1');

      expect(result).toEqual({ success: true, message: 'No changes to update' });
    });
  });

  // ─── sortUnarchivedEntries default case ──────────────────────
  describe('sortUnarchivedEntries default case', () => {
    it('should return data as-is for unknown sort_type', async () => {
      const mockData = [{ id: 1, due_date: '2024-01-01' }];
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await entries.sortUnarchivedEntries('a@b.com', 'P1', 99);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  // ─── deleteEntryById ─────────────────────────────────────────
  describe('deleteEntryById', () => {
    it('should soft-delete an entry by id', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await entries.deleteEntryById('a@b.com', 42);

      expect(result).toEqual({ success: true, message: 'Entry deleted successfully' });
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('delete by id failed'));

      const result = await entries.deleteEntryById('a@b.com', 42);

      expect(result).toEqual({ success: false, message: 'delete by id failed' });
    });
  });
});
