import { Search } from '../functions/search.js';
import pool from '../db.js';

jest.mock('../db.js');

describe('Search', () => {
  let search;

  beforeEach(() => {
    search = new Search();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchAll', () => {
    it('1. should return matching entries', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
        { entries: { title: 'Signup Flow', status: 'pending' } },
        { entries: { title: 'Dashboard View', status: 'done' } },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await search.searchAll('a@b.com', 'login');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entries retrieved successfully');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.title).toBe('Login Feature');
    });

    it('2. should return empty array when no entries match keyword', async () => {
      const mockData = [
        { entries: { title: 'Login Feature' } },
        { entries: { title: 'Signup Flow' } },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await search.searchAll('a@b.com', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('3. should return empty array when no entries exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await search.searchAll('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('4. should match keyword case-insensitively', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'LOGIN feature' } }] });

      const result = await search.searchAll('a@b.com', 'LOGIN');

      expect(result.data).toHaveLength(1);
    });

    it('5. should return failure when database returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('6. should handle unexpected thrown errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('7. should call pool.query with correct SQL', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await search.searchAll('a@b.com', 'test');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM entries'),
        ['a@b.com']
      );
    });
  });

  describe('searchProject', () => {
    it('8. should return matching entries for a specific project', async () => {
      const mockData = [
        { entries: { title: 'Login Feature' } },
        { entries: { title: 'Signup Flow' } },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockData });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.title).toBe('Login Feature');
    });

    it('9. should return empty array when no entries match in project', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'Login' } }] });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('10. should return empty array when project has no entries', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('11. should match keyword case-insensitively', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'LOGIN feature' } }] });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.data).toHaveLength(1);
    });

    it('12. should return failure when database returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('query failed'));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('13. should handle unexpected thrown errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('14. should call pool.query with correct SQL', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM entries'),
        ['a@b.com', 'ProjectA']
      );
    });
  });

  describe('searchProjects', () => {
    it('15. should return entries from projects matching keyword', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
        { project_name: 'Beta Project' },
        { project_name: 'Gamma App' },
      ];

      // Q1: get projects
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: entries for Alpha Project
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'Alpha task 1' } }, { entries: { title: 'Alpha task 2' } }] });
      // Q3: entries for Beta Project
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'Beta task 1' } }] });

      const result = await search.searchProjects('a@b.com', 'project');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entries retrieved successfully');
      expect(result.data).toHaveLength(3);
    });

    it('16. should return empty array when no projects match keyword', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
        { project_name: 'Beta Project' },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockProjects });

      const result = await search.searchProjects('a@b.com', 'nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('17. should return empty array when no projects exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('18. should match project names case-insensitively', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ project_name: 'Alpha Project' }] });
      pool.query.mockResolvedValueOnce({ rows: [{ entries: { title: 'task' } }] });

      const result = await search.searchProjects('a@b.com', 'ALPHA');

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('19. should return failure when projects query fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('projects query failed'));

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'projects query failed' });
    });

    it('20. should return failure when entries query fails for a matching project', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ project_name: 'Alpha Project' }] });
      pool.query.mockRejectedValueOnce(new Error('entries query failed'));

      const result = await search.searchProjects('a@b.com', 'Alpha');

      expect(result).toEqual({ success: false, message: 'entries query failed' });
    });

    it('21. should handle unexpected thrown errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('22. should call pool.query for both projects and entries', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ project_name: 'TestProject' }] });
      pool.query.mockResolvedValueOnce({ rows: [] });

      await search.searchProjects('a@b.com', 'test');

      expect(pool.query).toHaveBeenCalledTimes(2);
      expect(pool.query).toHaveBeenNthCalledWith(1, expect.stringContaining('SELECT * FROM projects'), ['a@b.com']);
      expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT * FROM entries'), ['a@b.com', 'TestProject']);
    });
  });
});
