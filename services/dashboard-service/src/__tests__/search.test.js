import { Search } from '../functions/search.js';
import { supabase } from '../supabase.js';
import { createMockChain } from '../__mocks__/supabaseMock.js';

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

  // Helper: creates a mock chain that resolves with given data/error and tracks calls
  function mockQuery({ data = [], error = null } = {}) {
    const chain = {
      select: jest.fn(),
      eq: jest.fn(),
      or: jest.fn(),
      then: jest.fn((resolve) => resolve({ data, error })),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    return chain;
  }

  describe('searchAll', () => {
    it('1. should return matching entries', async () => {
      const mockData = [
        { entries: { title: 'Login Feature', status: 'done' } },
        { entries: { title: 'Signup Flow', status: 'pending' } },
        { entries: { title: 'Dashboard View', status: 'done' } },
      ];
      supabase.from.mockReturnValue(mockQuery({ data: mockData }));

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
      supabase.from.mockReturnValue(mockQuery({ data: mockData }));

      const result = await search.searchAll('a@b.com', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('3. should return empty array when no entries exist', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [] }));

      const result = await search.searchAll('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('4. should match keyword case-insensitively', async () => {
      const mockData = [{ entries: { title: 'LOGIN feature' } }];
      supabase.from.mockReturnValue(mockQuery({ data: mockData }));

      const result = await search.searchAll('a@b.com', 'LOGIN');

      expect(result.data).toHaveLength(1);
    });

    it('5. should return failure when Supabase returns an error', async () => {
      supabase.from.mockReturnValue(mockQuery({ error: { message: 'query failed' } }));

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('6. should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Connection lost'); });

      const result = await search.searchAll('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('7. should call supabase with correct chain', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [] }));

      await search.searchAll('a@b.com', 'test');

      expect(supabase.from).toHaveBeenCalledWith('entries');
    });
  });

  describe('searchProject', () => {
    it('8. should return matching entries for a specific project', async () => {
      const mockData = [
        { entries: { title: 'Login Feature' } },
        { entries: { title: 'Signup Flow' } },
      ];
      supabase.from.mockReturnValue(mockQuery({ data: mockData }));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.title).toBe('Login Feature');
    });

    it('9. should return empty array when no entries match in project', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [{ entries: { title: 'Login' } }] }));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'dashboard');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('10. should return empty array when project has no entries', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [] }));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('11. should match keyword case-insensitively', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [{ entries: { title: 'LOGIN feature' } }] }));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'login');

      expect(result.data).toHaveLength(1);
    });

    it('12. should return failure when Supabase returns an error', async () => {
      supabase.from.mockReturnValue(mockQuery({ error: { message: 'query failed' } }));

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'query failed' });
    });

    it('13. should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Connection lost'); });

      const result = await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('14. should call supabase with correct chain', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [] }));

      await search.searchProject('a@b.com', 'ProjectA', 'test');

      expect(supabase.from).toHaveBeenCalledWith('entries');
    });
  });

  describe('searchProjects', () => {
    it('15. should return entries from projects matching keyword', async () => {
      const mockProjects = [
        { project_name: 'Alpha Project' },
        { project_name: 'Beta Project' },
        { project_name: 'Gamma App' },
      ];

      let fromCallCount = 0;
      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return mockQuery({ data: mockProjects });
        }
        // entries table — return different data based on call order
        fromCallCount++;
        if (fromCallCount === 2) {
          // Alpha Project entries
          return mockQuery({ data: [{ entries: { title: 'Alpha task 1' } }, { entries: { title: 'Alpha task 2' } }] });
        }
        // Beta Project entries
        return mockQuery({ data: [{ entries: { title: 'Beta task 1' } }] });
      });

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
      supabase.from.mockReturnValue(mockQuery({ data: mockProjects }));

      const result = await search.searchProjects('a@b.com', 'nonexistent');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('17. should return empty array when no projects exist', async () => {
      supabase.from.mockReturnValue(mockQuery({ data: [] }));

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('18. should match project names case-insensitively', async () => {
      const mockProjects = [{ project_name: 'Alpha Project' }];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') return mockQuery({ data: mockProjects });
        return mockQuery({ data: [{ entries: { title: 'task' } }] });
      });

      const result = await search.searchProjects('a@b.com', 'ALPHA');

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('19. should return failure when projects query fails', async () => {
      supabase.from.mockReturnValue(mockQuery({ error: { message: 'projects query failed' } }));

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'projects query failed' });
    });

    it('20. should return failure when entries query fails for a matching project', async () => {
      const mockProjects = [{ project_name: 'Alpha Project' }];
      let callCount = 0;

      supabase.from.mockImplementation((tableName) => {
        callCount++;
        if (tableName === 'projects') return mockQuery({ data: mockProjects });
        // entries query fails
        return mockQuery({ error: { message: 'entries query failed' } });
      });

      const result = await search.searchProjects('a@b.com', 'Alpha');

      expect(result).toEqual({ success: false, message: 'entries query failed' });
    });

    it('21. should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => { throw new Error('Connection lost'); });

      const result = await search.searchProjects('a@b.com', 'test');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });

    it('22. should call both projects and entries tables', async () => {
      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') return mockQuery({ data: [{ project_name: 'TestProject' }] });
        return mockQuery({ data: [] });
      });

      await search.searchProjects('a@b.com', 'test');

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(supabase.from).toHaveBeenCalledWith('entries');
    });
  });
});
