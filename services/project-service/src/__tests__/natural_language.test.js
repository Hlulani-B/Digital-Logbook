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
      expect(result.message).toContain('Could not fetch projects');
    });

    it('should successfully match an existing project and create entry', async () => {
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
        matched: 1,
        project: 'WebApp',
        fields: { description: 'Fixed login bug', status: 'in progress' },
        new_fields: [],
        priority: 0,
        due_date: '2026-08-20',
        comment: 'Nice work squashing that bug!',
      }));

      const result = await nl.entry('test@example.com', 'Fixed login bug for WebApp, urgent, due Aug 20');

      expect(result.success).toBe(true);
      expect(result.project).toBe('WebApp');
      expect(result.fields.description).toBe('Fixed login bug');
      expect(result.priority).toBe('Urgent and important');
      expect(result.due_date).toBe('2026-08-20');
      expect(result.comment).toBe('Nice work squashing that bug!');
      expect(result.created_new_project).toBe(false);
    });

    it('should create a new project when AI says matched=0', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web application', archived: false },
      ];

      const mockFields = [
        { field_name: 'description', data_type: 'text', is_required: true },
      ];

      let projectInserted = false;
      let fieldsInserted = [];
      let entryInserted = false;

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
            insertData: (data) => { projectInserted = true; return [{ id: 99, ...data }]; },
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: mockFields },
            insertData: (data) => { fieldsInserted.push(data); return [{ id: 100 + fieldsInserted.length, ...data }]; },
          }).from(tableName);
        }
        if (tableName === 'entries') {
          return createMockSupabaseClient({
            entries: { data: [{ id: 200 }] },
            insertData: (data) => { entryInserted = true; return [{ id: 200, ...data }]; },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      AI.mockResolvedValue(JSON.stringify({
        matched: 0,
        project: 'DatabaseMigration',
        fields: { description: 'Migrated user data', notes: 'Took 3 hours' },
        new_fields: [
          { field_name: 'description', data_type: 'text', is_required: true },
          { field_name: 'notes', data_type: 'text', is_required: false },
        ],
        priority: 1,
        due_date: null,
        comment: 'Big migration done — brave work!',
      }));

      const result = await nl.entry('test@example.com', 'Migrated all user data to the new database');

      expect(result.success).toBe(true);
      expect(result.project).toBe('DatabaseMigration');
      expect(result.created_new_project).toBe(true);
      expect(result.new_fields).toHaveLength(2);
      expect(result.fields.description).toBe('Migrated user data');
      expect(result.priority).toBe('Urgent but not important');
      expect(result.comment).toBe('Big migration done — brave work!');
      expect(projectInserted).toBe(true);
      expect(fieldsInserted).toHaveLength(2);
      expect(entryInserted).toBe(true);
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

    it('should return failure when AI claims match but project not found', async () => {
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
        matched: 1,
        project: 'NonExistentProject',
        fields: { description: 'something' },
        new_fields: [],
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'did something');

      expect(result.success).toBe(false);
      expect(result.message).toContain('claimed a match');
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
        matched: 1,
        project: 'WebApp',
        fields: { description: 'Updated docs' },
        new_fields: [],
        priority: null,
        due_date: null,
        comment: 'Docs always need updating!',
      }));

      const result = await nl.entry('test@example.com', 'Updated some docs');

      expect(result.success).toBe(true);
      expect(result.priority).toBeNull();
      expect(result.due_date).toBeNull();
      expect(result.comment).toBe('Docs always need updating!');
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

      // AI tries to match OldProject which is archived, so matched=1 but project not in filtered list
      AI.mockResolvedValue(JSON.stringify({
        matched: 1,
        project: 'OldProject',
        fields: { description: 'old stuff' },
        new_fields: [],
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'did old stuff');

      expect(result.success).toBe(false);
      expect(result.message).toContain('claimed a match');
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

      AI.mockResolvedValue('```json\n{"matched":1,"project":"WebApp","fields":{"description":"test"},"new_fields":[],"priority":null,"due_date":null,"comment":"nice"}\n```');

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

    it('should return failure when AI says matched=0 but no project name', async () => {
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
        matched: 0,
        project: null,
        fields: {},
        new_fields: [],
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'random stuff');

      expect(result.success).toBe(false);
      expect(result.message).toContain('could not determine a project');
    });

    it('should return failure when new project creation fails', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects, error: { message: 'Project already exists' } },
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
        matched: 0,
        project: 'WebApp', // Already exists
        fields: { description: 'test' },
        new_fields: [],
        priority: null,
        due_date: null,
      }));

      const result = await nl.entry('test@example.com', 'test entry');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create new project');
    });

    it('should handle new_fields with missing field_name gracefully', async () => {
      const mockProjects = [];

      let fieldsInserted = [];

      supabase.from.mockImplementation((tableName) => {
        if (tableName === 'projects') {
          return createMockSupabaseClient({
            projects: { data: mockProjects },
            insertData: (data) => [{ id: 99, ...data }],
          }).from(tableName);
        }
        if (tableName === 'fields') {
          return createMockSupabaseClient({
            fields: { data: [] },
            insertData: (data) => { fieldsInserted.push(data); return [{ id: 100 + fieldsInserted.length, ...data }]; },
          }).from(tableName);
        }
        if (tableName === 'entries') {
          return createMockSupabaseClient({
            entries: { data: [{ id: 200 }] },
          }).from(tableName);
        }
        return createMockSupabaseClient({}).from(tableName);
      });

      AI.mockResolvedValue(JSON.stringify({
        matched: 0,
        project: 'NewProject',
        fields: { description: 'test' },
        new_fields: [
          { field_name: 'description', data_type: 'text', is_required: true },
          { data_type: 'text', is_required: false }, // missing field_name
          { field_name: 'notes', data_type: 'text', is_required: false },
        ],
        priority: null,
        due_date: null,
        comment: 'Fresh start!',
      }));

      const result = await nl.entry('test@example.com', 'started a new project');

      expect(result.success).toBe(true);
      // Should only insert 2 fields (the one with field_name)
      expect(fieldsInserted).toHaveLength(2);
    });
  });
});
