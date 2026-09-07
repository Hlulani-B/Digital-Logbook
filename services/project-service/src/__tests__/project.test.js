import pool from '../db.js';
import { Project } from '../functions/project.js';

jest.mock('../db.js');

describe('Project', () => {
  let project;

  beforeEach(() => {
    project = new Project();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
    pool.connect.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── addProject ──────────────────────────────────────────────
  describe('addProject', () => {
    it('should add a project successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await project.addProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: true, message: 'Project added successfully' });
    });

    it('should add a project with a description', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await project.addProject('a@b.com', 'My Project', 'A test project');

      expect(result).toEqual({ success: true, message: 'Project added successfully' });
    });

    it('should return a clear error when the project name is a duplicate', async () => {
      const err = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      pool.query.mockRejectedValueOnce(err);

      const result = await project.addProject('a@b.com', 'My Project');

      expect(result).toEqual({
        success: false,
        message: 'A project with this name already exists for your account.',
      });
    });

    it('should return failure when db returns an error', async () => {
      pool.query.mockRejectedValueOnce(new Error('duplicate key value'));

      const result = await project.addProject('a@b.com', 'Existing Project');

      expect(result).toEqual({ success: false, message: 'duplicate key value' });
    });

    it('should handle unexpected thrown errors', async () => {
      pool.query.mockRejectedValueOnce(new Error('Network failure'));

      const result = await project.addProject('a@b.com', 'Test');

      expect(result).toEqual({ success: false, message: 'Network failure' });
    });
  });

  // ─── editProjectName ─────────────────────────────────────────
  describe('editProjectName', () => {
    it('should update entries, fields and project name successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const result = await project.editProjectName('a@b.com', 'New Name', 'Old Name');

      expect(result).toEqual({ success: true, message: 'Project name updated successfully' });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return failure when entries update fails', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('entries update failed')),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const result = await project.editProjectName('a@b.com', 'New', 'Old');

      expect(result).toEqual({ success: false, message: 'entries update failed' });
    });
  });

  // ─── getProjectsByEmail ──────────────────────────────────────
  describe('getProjectsByEmail', () => {
    it('should return projects for a user', async () => {
      const mockProjects = [
        { project_name: 'P1', description: 'd1', created_at: '2026-01-01', archived: false },
      ];
      pool.query.mockResolvedValueOnce({ rows: mockProjects });

      const result = await project.getProjectsByEmail('a@b.com');

      expect(result).toEqual({ success: true, projects: mockProjects });
    });

    it('should return empty array when no projects exist', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await project.getProjectsByEmail('a@b.com');

      expect(result).toEqual({ success: true, projects: [] });
    });
  });

  // ─── deleteProject ───────────────────────────────────────────
  describe('deleteProject', () => {
    it('should delete entries, fields and project successfully', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      };
      pool.connect.mockResolvedValueOnce(mockClient);

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: true, message: 'Project deleted successfully' });
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should handle unexpected thrown errors', async () => {
      pool.connect.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await project.deleteProject('a@b.com', 'My Project');

      expect(result).toEqual({ success: false, message: 'Connection lost' });
    });
  });
});
