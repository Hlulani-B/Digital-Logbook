import { Search } from '../functions/search.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Search', () => {
  let search;

  beforeEach(() => {
    search = new Search();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('searchAll', () => {
    it('should return matching entries', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
        { entries: { title: 'Signup Flow', status: 'pending' } },
        { entries: { title: 'Dashboard View', status: 'done' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchAll('a@b.com', 'login');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entries retrieved successfully');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.title).toBe('Login Feature');
    });

    it('should return empty array when no entries match keyword', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
        { entries: { title: 'Signup Flow', status: 'pending' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchAll('a@b.com', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return empty array when no entries exist', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await search.searchAll('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should match keyword case-insensitively', async () => {
      const mockData = [
        { entries: { title: 'LOGIN feature', status: 'done' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchAll('a@b.com', 'LOGIN');

      expect(result.data).toHaveLength(1);
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'query failed' } } }).from(tableName)
      );

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });

  describe('searchProject', () => {
    it('should return matching entries for a specific project', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
        { entries: { title: 'Signup Flow', status: 'pending' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entries retrieved successfully');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.title).toBe('Login Feature');
    });

    it('should return empty array when no entries match in project', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchProject('a@b.com', 'ProjectA', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return empty array when project has no entries', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should match keyword case-insensitively', async () => {
      const mockData = [
        { entries: { title: 'LOGIN feature', status: 'done' } },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockData } }).from(tableName)
      );

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.data).toHaveLength(1);
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'query failed' } } }).from(tableName)
      );

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });

  describe('searchProjects', () => {
    it('should return entries from projects matching keyword', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
        { project_name: 'Beta Project' },
        { project_name: 'Gamma App' },
      ];

      const alphaEntries = [
        { entries: { title: 'Alpha task 1' } },
        { entries: { title: 'Alpha task 2' } },
      ];
      const betaEntries = [
        { entries: { title: 'Beta task 1' } },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({ projects: { data: mockProjects } }).from(tableName);
        }
        if (tableName === 'entries') {
          const resolveForProject = (projectName) => {
            if (projectName === 'Alpha Project') return { data: alphaEntries, error: null };
            if (projectName === 'Beta Project') return { data: betaEntries, error: null };
            return { data: [], error: null };
          };
          const chain = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn()
              .mockImplementation(() => {
                const secondEq = {
                  eq: jest.fn().mockImplementation((key, value) => ({
                    then: jest.fn((resolve) => resolve(resolveForProject(value))),
                  })),
                  then: jest.fn((resolve) => resolve({ data: [], error: null })),
                };
                return secondEq;
              }),
            then: jest.fn((resolve) => resolve({ data: [], error: null })),
          };
          return chain;
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      const result = await search.searchProjects('a@b.com', 'project');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Entries retrieved successfully');
      expect(result.data).toHaveLength(3);
    });

    it('should return empty array when no projects match keyword', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
        { project_name: 'Beta Project' },
      ];

      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: mockProjects } }).from(tableName)
      );

      const result = await search.searchProjects('a@b.com', 'nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should return empty array when no projects exist', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName)
      );

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should match project names case-insensitively', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({ projects: { data: mockProjects } }).from(tableName);
        }
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn((resolve) => resolve({ data: [{ entries: { title: 'task' } }], error: null })),
        };
        return chain;
      });

      const result = await search.searchProjects('a@b.com', 'ALPHA');

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should return failure when projects query fails', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'projects query failed' } } }).from(tableName)
      );

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'projects query failed' });
    });

    it('should return failure when entries query fails for a matching project', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({ projects: { data: mockProjects } }).from(tableName);
        }
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn((resolve) => resolve({ data: null, error: { message: 'entries query failed' } })),
        };
        return chain;
      });

      const result = await search.searchProjects('a@b.com', 'Alpha');

      expect(result).toEqual({ success: false, message: 'entries query failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });
});
