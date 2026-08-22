import pool from '../db.js';
import { Archives } from '../functions/archives.js';

jest.mock('../db.js');

describe('Archives', () => {
  let archives;

  beforeEach(() => {
    archives = new Archives();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── archive_project ─────────────────────────────────────────
  it('should archive a project successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: true, message: 'Project archived successfully' });
  });

  it('should return failure when archiving a project fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('update failed'));

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── unarchive_project ───────────────────────────────────────
  it('should unarchive a project successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await archives.unarchive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: true, message: 'Project unarchived successfully' });
  });

  it('should return failure when unarchiving a project fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('update failed'));

    const result = await archives.unarchive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── archive_entry ───────────────────────────────────────────
  it('should archive an entry successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await archives.archive_entry('a@b.com', 'My Project', 1);

    expect(result).toEqual({ success: true, message: 'Entry archived successfully' });
  });

  it('should return failure when archiving an entry fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('update failed'));

    const result = await archives.archive_entry('a@b.com', 'My Project', 1);

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  // ─── unarchive_entry ─────────────────────────────────────────
  it('should unarchive an entry successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await archives.unarchive_entry('a@b.com', 'My Project', 1);

    expect(result).toEqual({ success: true, message: 'Entry unarchived successfully' });
  });

  it('should return failure when unarchiving an entry fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('update failed'));

    const result = await archives.unarchive_entry('a@b.com', 'My Project', 1);

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  it('should handle unexpected thrown errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await archives.archive_project('a@b.com', 'My Project');

    expect(result).toEqual({ success: false, message: 'Connection lost' });
  });

  // ─── getArchives ──────────────────────────────────────────────
  describe('getArchives', () => {
    it('should return archived entries for a project', async () => {
      const mockEntries = [{ entries: { title: 'Archived task' }, archived: true }];
      pool.query.mockResolvedValueOnce({ rows: mockEntries });

      const result = await archives.getArchives('a@b.com', 'My Project');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return all archived entries when no project specified', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await archives.getArchives('a@b.com');

      expect(result.success).toBe(true);
    });

    it('should return failure on error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await archives.getArchives('a@b.com', 'P1');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });
  });

  // ─── getUnarchived ────────────────────────────────────────────
  describe('getUnarchived', () => {
    it('should return unarchived entries for a project', async () => {
      const mockEntries = [{ entries: { title: 'Active task' }, archived: false }];
      pool.query.mockResolvedValueOnce({ rows: mockEntries });

      const result = await archives.getUnarchived('a@b.com', 'My Project');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should return all unarchived entries when no project specified', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await archives.getUnarchived('a@b.com');

      expect(result.success).toBe(true);
    });

    it('should return failure on error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await archives.getUnarchived('a@b.com', 'P1');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });
  });
});
