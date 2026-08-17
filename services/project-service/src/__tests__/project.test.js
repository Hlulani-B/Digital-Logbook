import { Project } from '../functions/project.js';
import { supabase } from '../supabase.js';
import { createMockSupabaseClient } from '../__mocks__/supabaseMock.js';

jest.mock('../supabase.js');

describe('Project', () => {
  let project;

  beforeEach(() => {
    project = new Project();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    supabase.from.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── addProject ──────────────────────────────────────────────
  describe('addProject', () => {
    it('should add a project successfully', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ user_email: 'a@b.com', project_name: 'My Project' }] } }).from(tableName)
      );

      const result = await project.addProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: true, message: 'Project added successfully' });
      expect(supabase.from).toHaveBeenCalledWith('projects');
    });

    it('should add a project with a description', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { data: [{ user_email: 'a@b.com', project_name: 'My Project', description: 'A test project' }] } }).from(tableName)
      );

      const result = await project.addProject('a@b.com', 'My Project', 'A test project');

      expect(result).toEqual({ success: true, message: 'Project added successfully' });
    });

    it('should return a clear error when the project name is a duplicate', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { code: '23505', message: 'duplicate key value violates unique constraint' } } }).from(tableName)
      );

      const result = await project.addProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'A project with this name already exists for your account.' });
    });

    it('should return failure when Supabase returns an error', async () => {
      supabase.from.mockImplementation((tableName) =>
        createMockSupabaseClient({ [tableName]: { error: { message: 'duplicate key value' } } }).from(tableName)
      );

      const result = await project.addProject('a@b.com', 'Existing Project');

      expect(result).toEqual({ success: false, message: 'duplicate key value' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Network failure');
      });

      const result = await project.addProject('a@b.com', 'Test');

      expect(result).toEqual({ success: false, message: 'Network failure' });
    });
  });

  // ─── editProjectName ─────────────────────────────────────────
  describe('editProjectName', () => {
    it('should update entries, fields and project name successfully', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        return createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      });

      const result = await project.editProjectName('a@b.com', 'New Name', 'Old Name');

      expect(result).toEqual({ success: true, message: 'Project name updated successfully' });
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'entries');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'fields');
      expect(supabase.from).toHaveBeenNthCalledWith(3, 'projects');
      expect(callCount).toBe(3);
    });

    it('should return failure when entries update fails', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { error: { message: 'entries update failed' } } }).from(tableName);
        }
        return createMockSupabaseClient().from(tableName);
      });

      const result = await project.editProjectName('a@b.com', 'New', 'Old');

      expect(result).toEqual({ success: false, message: 'entries update failed' });
      expect(supabase.from).toHaveBeenCalledWith('entries');
    });

    it('should return failure when fields update fails after entries succeed', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { data: [] } }).from(tableName);
        }
        if (callCount === 2) {
          return createMockSupabaseClient({ fields: { error: { message: 'fields update failed' } } }).from(tableName);
        }
        return createMockSupabaseClient().from(tableName);
      });

      const result = await project.editProjectName('a@b.com', 'New', 'Old');

      expect(result).toEqual({ success: false, message: 'fields update failed' });
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'fields');
    });

    it('should return failure when projects update fails after entries and fields succeed', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { data: [] } }).from(tableName);
        }
        if (callCount === 2) {
          return createMockSupabaseClient({ fields: { data: [] } }).from(tableName);
        }
        return createMockSupabaseClient({ projects: { error: { message: 'projects update failed' } } }).from(tableName);
      });

      const result = await project.editProjectName('a@b.com', 'New', 'Old');

      expect(result).toEqual({ success: false, message: 'projects update failed' });
    });
  });

  // ─── deleteProject ───────────────────────────────────────────
  describe('deleteProject', () => {
    it('should delete entries, fields and project successfully', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        return createMockSupabaseClient({ [tableName]: { data: [] } }).from(tableName);
      });

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: true, message: 'Project deleted successfully' });
      expect(supabase.from).toHaveBeenNthCalledWith(1, 'entries');
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'fields');
      expect(supabase.from).toHaveBeenNthCalledWith(3, 'projects');
      expect(callCount).toBe(3);
    });

    it('should return failure when entries delete fails', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { error: { message: 'entries delete failed' } } }).from(tableName);
        }
        return createMockSupabaseClient().from(tableName);
      });

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'entries delete failed' });
    });

    it('should return failure when fields delete fails after entries succeed', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { data: [] } }).from(tableName);
        }
        if (callCount === 2) {
          return createMockSupabaseClient({ fields: { error: { message: 'fields delete failed' } } }).from(tableName);
        }
        return createMockSupabaseClient().from(tableName);
      });

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'fields delete failed' });
      expect(supabase.from).toHaveBeenNthCalledWith(2, 'fields');
    });

    it('should return failure when projects delete fails after entries and fields succeed', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((tableName) => {
        callCount += 1;
        if (callCount === 1) {
          return createMockSupabaseClient({ entries: { data: [] } }).from(tableName);
        }
        if (callCount === 2) {
          return createMockSupabaseClient({ fields: { data: [] } }).from(tableName);
        }
        return createMockSupabaseClient({ projects: { error: { message: 'projects delete failed' } } }).from(tableName);
      });

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'projects delete failed' });
    });

    it('should handle unexpected thrown errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Connection lost');
      });

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });
});
