import { Natural_language } from '../functions/entries.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');
jest.mock('../functions/ai.js', () => ({
  AI: jest.fn(),
}));

// Import AI after mocking
import { AI } from '../functions/ai.js';

describe('Natural_language', () => {
  let nl;

  beforeEach(() => {
    nl = new Natural_language();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    supabase.from.mockReset();
    AI.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── entry() ─────────────────────────────────────────────────

  describe('entry', () => {
    it('should return failure when user has no projects', async () => {
      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      const result = await nl.entry('test@example.com', 'Fixed login bug');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No projects found');
    });

    it('should return failure when getProjectsByEmail fails', async () => {
      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { error: { message: 'DB connection failed' } },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      const result = await nl.entry('test@example.com', 'Fixed login bug');

      expect(result.success).toBe(false);
    });

    it('should successfully parse and create an entry from natural language', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web application', archived: false },
        { project_name: 'MobileApp', description: 'Mobile app project', archived: false },
      ];

      const mockFields = [
        { field_name: 'description', data_type: 'text', is_required: true },
        { field_name: 'status', data_type: 'text', is_required: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: mockFields },
          }).from(tableName);
        }
        // entries table (insert)
        return createMockSupabaseClient({
          entries: { data: [{ id: 1, entries: { description: 'Fixed login bug' } }] },
        }).from(tableName);
      });

      AI.mockResolvedValue(JSON.stringify({
        project: 'WebApp',
        fields: { description: 'Fixed login bug', status: 'in progress' },
        priority: 0,
        due_date: '2026-08-20',
      }));

      const result = await nl.entry('test@example.com', 'Fixed login bug for WebApp, urgent, due Aug 20');

      expect(result.success).toBe(true);
      expect(result.project).toBe('WebApp');
      expect(result.fields.description).toBe('Fixed login bug');
      expect(result.priority).toBe('Urgent and important');
      expect(result.due_date).toBe('2026-08-20');
    });

    it('should return failure when AI returns invalid JSON', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      AI.mockResolvedValue('this is not json at all');

      const result = await nl.entry('test@example.com', 'did some stuff');

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid JSON');
    });

    it('should return failure when AI matches a non-existent project', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      AI.mockResolvedValue(JSON.stringify({
        project: 'NonExistentProject',
        fields: { description: 'something' },
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'did something');

      expect(result.success).toBe(false);
      expect(result.message).toContain('could not match');
    });

    it('should handle null priority and due_date from AI', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({
          entries: { data: [{ id: 2 }] },
        }).from(tableName);
      });

      AI.mockResolvedValue(JSON.stringify({
        project: 'WebApp',
        fields: { description: 'Updated docs' },
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'Updated some docs');

      expect(result.success).toBe(true);
      expect(result.priority).toBeNull();
      expect(result.due_date).toBeNull();
    });

    it('should filter out archived projects', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Active', archived: false },
        { project_name: 'OldProject', description: 'Archived', archived: true },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      // AI tries to match OldProject which is archived
      AI.mockResolvedValue(JSON.stringify({
        project: 'OldProject',
        fields: { description: 'old stuff' },
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'did old stuff');

      expect(result.success).toBe(false);
      expect(result.message).toContain('could not match');
    });

    it('should strip markdown code blocks from AI response', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
          }).from(tableName);
        }
        return createMockSupabaseClient({
          entries: { data: [{ id: 3 }] },
        }).from(tableName);
      });

      AI.mockResolvedValue('```json\n{"project":"WebApp","fields":{"description":"test"},"priority":null,"due_date":null}\n```');

      const result = await nl.entry('test@example.com', 'did some stuff');

      expect(result.success).toBe(true);
      expect(result.project).toBe('WebApp');
    });

    it('should handle errors thrown during processing', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected DB failure');
      });

      const result = await nl.entry('test@example.com', 'anything');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unexpected DB failure');
    });
  });
});
