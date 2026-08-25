import { Natural_language } from '../functions/entries.js';
import pool from '../db.js';

jest.mock('../db.js');
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
    pool.query.mockReset();
    AI.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── entry() ─────────────────────────────────────────────────

  describe('entry', () => {
    it('should return failure when getProjectsByEmail fails', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB connection failed'));

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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: mockFields });
      // Q3: getFields for MobileApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q4: addEntry
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, entries: { description: 'Fixed login bug' } }] });

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
      expect(result.due_date).toBe('2026-08-20'); // getDate parses "Aug 20"
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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: mockFields });
      // Q3: addProject('DatabaseMigration')
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
      // Q4: addField description
      pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });
      // Q5: addField notes
      pool.query.mockResolvedValueOnce({ rows: [{ id: 102 }] });
      // Q6: addEntry
      pool.query.mockResolvedValueOnce({ rows: [{ id: 200 }] });

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
    });

    it('should return failure when AI returns invalid JSON', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });

      AI.mockResolvedValue('this is not json at all');

      const result = await nl.entry('test@example.com', 'did some stuff');

      expect(result.success).toBe(false);
      expect(result.message).toContain('invalid JSON');
    });

    it('should return failure when AI claims match but project not found', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });

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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addEntry
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp (only non-archived project)
      pool.query.mockResolvedValueOnce({ rows: [] });

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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addEntry
      pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });

      AI.mockResolvedValue('```json\n{"matched":1,"project":"WebApp","fields":{"description":"test"},"new_fields":[],"priority":null,"due_date":null,"comment":"nice"}\n```');

      const result = await nl.entry('test@example.com', 'did some stuff');

      expect(result.success).toBe(true);
      expect(result.project).toBe('WebApp');
    });

    it('should handle errors thrown during processing', async () => {
      pool.query.mockRejectedValueOnce(new Error('Unexpected DB failure'));

      const result = await nl.entry('test@example.com', 'anything');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unexpected DB failure');
    });

    it('should return failure when AI says matched=0 but no project name', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });

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

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addProject fails
      pool.query.mockRejectedValueOnce(new Error('Project already exists'));

      AI.mockResolvedValue(JSON.stringify({
        matched: 0,
        project: 'NewProject',
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

      // Q1: getProjectsByEmail (empty)
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q2: addProject
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
      // Q3: addField description
      pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });
      // Q4: addField notes (skips the one without field_name)
      pool.query.mockResolvedValueOnce({ rows: [{ id: 102 }] });
      // Q5: addEntry
      pool.query.mockResolvedValueOnce({ rows: [{ id: 200 }] });

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
      // 5 total queries: getProjectsByEmail + addProject + 2 addField + addEntry
      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    // ─── matched=2: project-only creation ─────────────────────────────

    it('should create only a project (no entry) when matched=2', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addProject('WebsiteRedesign')
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 2,
        project: 'WebsiteRedesign',
        fields: {},
        new_fields: [],
        priority: null,
        due_date: null,
        comment: 'Created project WebsiteRedesign for you!',
      }));

      const result = await nl.entry('test@example.com', 'create a project called WebsiteRedesign');

      expect(result.success).toBe(true);
      expect(result.project).toBe('WebsiteRedesign');
      expect(result.project_only).toBe(true);
      expect(result.created_new_project).toBe(true);
      expect(result.fields).toEqual({});
      expect(result.priority).toBeNull();
      expect(result.due_date).toBeNull();
      expect(result.comment).toBe('Created project WebsiteRedesign for you!');
      // 3 queries: getProjectsByEmail + getFields + addProject (no addEntry)
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('should return failure when matched=2 but no project name', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 2,
        project: null,
        fields: {},
        new_fields: [],
        priority: null,
      }));

      const result = await nl.entry('test@example.com', 'create a project');

      expect(result.success).toBe(false);
      expect(result.message).toContain('could not determine a project name');
    });

    it('should return failure when matched=2 and project creation fails', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addProject fails
      pool.query.mockRejectedValueOnce(new Error('Duplicate project'));

      AI.mockResolvedValue(JSON.stringify({
        matched: 2,
        project: 'WebApp',
        fields: {},
        new_fields: [],
        priority: null,
      }));

      const result = await nl.entry('test@example.com', 'create a project called WebApp');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create project');
    });

    it('should create project with fields when matched=2 and new_fields provided', async () => {
      const mockProjects = [];

      // Q1: getProjectsByEmail (empty)
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: addProject('MobileApp')
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
      // Q3: addField platform
      pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });
      // Q4: addField version
      pool.query.mockResolvedValueOnce({ rows: [{ id: 102 }] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 2,
        project: 'MobileApp',
        fields: {},
        new_fields: [
          { field_name: 'platform', data_type: 'text', is_required: true },
          { field_name: 'version', data_type: 'text', is_required: false },
        ],
        priority: null,
        comment: 'Created MobileApp with platform and version fields!',
      }));

      const result = await nl.entry('test@example.com', 'make a new project for MobileApp with platform and version fields');

      expect(result.success).toBe(true);
      expect(result.project).toBe('MobileApp');
      expect(result.project_only).toBe(true);
      expect(result.created_new_project).toBe(true);
      expect(result.new_fields).toHaveLength(2);
      // 4 queries: getProjectsByEmail + addProject + 2x addField (no addEntry)
      expect(pool.query).toHaveBeenCalledTimes(4);
    });

    // ─── matched=3: multi-project entries ─────────────────────────────

    it('should add entries to multiple existing projects when matched=3 with only old entries', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
        { project_name: 'MobileApp', description: 'Mobile app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [{ field_name: 'description', data_type: 'text', is_required: true }] });
      // Q3: getFields for MobileApp
      pool.query.mockResolvedValueOnce({ rows: [{ field_name: 'description', data_type: 'text', is_required: true }] });
      // Q4: addEntry to WebApp
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Q5: addEntry to MobileApp
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [
          { WebApp: { description: 'Fixed login bug' } },
          { MobileApp: { description: 'Updated splash screen' } },
        ],
        new: [],
        priority: null,
        comment: 'Added entries to WebApp and MobileApp!',
      }));

      const result = await nl.entry('test@example.com', 'add login bug fix to WebApp and splash screen update to MobileApp');

      expect(result.success).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.results.old).toHaveLength(2);
      expect(result.results.new).toHaveLength(0);
      expect(result.results.old[0].project_name).toBe('WebApp');
      expect(result.results.old[1].project_name).toBe('MobileApp');
      expect(result.comment).toBe('Added entries to WebApp and MobileApp!');
      expect(result.created_new_project).toBe(false);
      // 5 queries: getProjectsByEmail + 2x getFields + 2x addEntry
      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    it('should create new projects and add entries when matched=3 with only new entries', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addProject('DevOps')
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
      // Q4: addField tool for DevOps
      pool.query.mockResolvedValueOnce({ rows: [{ id: 101 }] });
      // Q5: addEntry to DevOps
      pool.query.mockResolvedValueOnce({ rows: [{ id: 200 }] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [],
        new: [
          {
            project_name: 'DevOps',
            fields: { description: 'Setup CI pipeline' },
            new_fields: [{ field_name: 'tool', data_type: 'text', is_required: false }],
          },
        ],
        priority: null,
        comment: 'Created DevOps and added your first entry!',
      }));

      const result = await nl.entry('test@example.com', 'create a DevOps project and setup CI pipeline');

      expect(result.success).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.results.old).toHaveLength(0);
      expect(result.results.new).toHaveLength(1);
      expect(result.results.new[0].project_name).toBe('DevOps');
      expect(result.created_new_project).toBe(true);
      // 5 queries: getProjectsByEmail + getFields + addProject + addField + addEntry
      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed old and new entries when matched=3', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [{ field_name: 'description', data_type: 'text', is_required: true }] });
      // Q3: addEntry to WebApp (old)
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // Q4: addProject('Research') (new)
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
      // Q5: addEntry to Research
      pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [{ WebApp: { description: 'Fixed login bug' } }],
        new: [{ project_name: 'Research', fields: { description: 'Read 3 papers' }, new_fields: [] }],
        priority: null,
        comment: 'Added to WebApp and created Research for you!',
      }));

      const result = await nl.entry('test@example.com', 'add login bug fix to WebApp and start a Research project with paper reading notes');

      expect(result.success).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.results.old).toHaveLength(1);
      expect(result.results.new).toHaveLength(1);
      expect(result.results.old[0].project_name).toBe('WebApp');
      expect(result.results.new[0].project_name).toBe('Research');
      expect(result.created_new_project).toBe(true);
      // 5 queries: getProjectsByEmail + getFields + addEntry(WebApp) + addProject(Research) + addEntry(Research)
      expect(pool.query).toHaveBeenCalledTimes(5);
    });

    it('should skip old entries for non-existent projects in matched=3', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addEntry to WebApp (succeeds)
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // NonExistent project is skipped (no query)

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [
          { WebApp: { description: 'Fixed bug' } },
          { NonExistent: { description: 'something' } },
        ],
        new: [],
        priority: null,
        comment: 'Added to WebApp.',
      }));

      const result = await nl.entry('test@example.com', 'add bug fix to WebApp and something to NonExistent');

      expect(result.success).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.results.old).toHaveLength(1);
      expect(result.results.errors).toHaveLength(1);
      expect(result.results.errors[0]).toContain('NonExistent');
      expect(result.results.errors[0]).toContain('not found');
    });

    it('should return failure when all matched=3 entries fail', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });
      // Q3: addEntry to WebApp fails
      pool.query.mockRejectedValueOnce(new Error('DB error'));
      // Q4: addProject('DevOps') fails
      pool.query.mockRejectedValueOnce(new Error('Duplicate project'));

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [{ WebApp: { description: 'test' } }],
        new: [{ project_name: 'DevOps', fields: { description: 'test' }, new_fields: [] }],
        priority: null,
      }));

      const result = await nl.entry('test@example.com', 'add stuff everywhere');

      expect(result.success).toBe(false);
      expect(result.message).toContain('DB error');
      expect(result.message).toContain('Duplicate project');
    });

    it('should handle matched=3 with empty old and new arrays', async () => {
      const mockProjects = [
        { project_name: 'WebApp', description: 'Main web app', archived: false },
      ];

      // Q1: getProjectsByEmail
      pool.query.mockResolvedValueOnce({ rows: mockProjects });
      // Q2: getFields for WebApp
      pool.query.mockResolvedValueOnce({ rows: [] });

      AI.mockResolvedValue(JSON.stringify({
        matched: 3,
        old: [],
        new: [],
        priority: null,
        comment: 'Nothing to add.',
      }));

      const result = await nl.entry('test@example.com', 'add nothing');

      expect(result.success).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.results.old).toHaveLength(0);
      expect(result.results.new).toHaveLength(0);
    });
  });
});
