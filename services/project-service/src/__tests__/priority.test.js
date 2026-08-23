import pool from '../db.js';
import { Priority, Natural_language } from '../functions/priority.js';

jest.mock('../db.js');
jest.mock('../functions/ai.js', () => ({ AI: jest.fn() }));

import { AI } from '../functions/ai.js';

describe('Priority', () => {
  let priority;

  beforeEach(() => {
    priority = new Priority();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    pool.query.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should set priority to "Urgent and important" for value 0', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await priority.setPriority('a@b.com', 0, 'P1', 1);

    expect(result).toEqual({ success: true, message: 'Priority set to Urgent and important' });
  });

  it('should set priority to "Urgent but not important" for value 1', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await priority.setPriority('a@b.com', '1', 'P1', 1);

    expect(result).toEqual({ success: true, message: 'Priority set to Urgent but not important' });
  });

  it('should set priority to "Not urgent, not important" for value 2', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await priority.setPriority('a@b.com', 2, 'P1', 1);

    expect(result).toEqual({ success: true, message: 'Priority set to Not urgent, not important' });
  });

  it('should remove priority for value 3', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await priority.setPriority('a@b.com', 3, 'P1', 1);

    expect(result).toEqual({ success: true, message: 'Priority set to none' });
  });

  it('should return failure for invalid priority value', async () => {
    const result = await priority.setPriority('a@b.com', 99, 'P1', 1);

    expect(result).toEqual({ success: false, message: 'Invalid priority value' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('should return failure when db returns an error', async () => {
    pool.query.mockRejectedValueOnce(new Error('update failed'));

    const result = await priority.setPriority('a@b.com', 1, 'P1', 1);

    expect(result).toEqual({ success: false, message: 'update failed' });
  });

  it('should handle unexpected thrown errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await priority.setPriority('a@b.com', 0, 'P1', 1);

    expect(result).toEqual({ success: false, message: 'Connection lost' });
  });
});

// ─── Natural_language (priority.js version) ────────────────────────

describe('Natural_language (priority)', () => {
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

  it('should return failure when getProjectsByEmail fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB error'));

    const result = await nl.entry('test@example.com', 'Fixed a bug');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not fetch projects');
  });

  it('should return failure when no projects exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await nl.entry('test@example.com', 'Fixed a bug');

    expect(result.success).toBe(false);
    expect(result.message).toContain('No projects found');
  });

  it('should return failure when AI returns invalid JSON', async () => {
    const mockProjects = [
      { project_name: 'WebApp', description: 'Main app', archived: false },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockProjects });
    pool.query.mockResolvedValueOnce({ rows: [] }); // fields for WebApp

    AI.mockResolvedValue('not json at all');

    const result = await nl.entry('test@example.com', 'did some stuff');

    expect(result.success).toBe(false);
    expect(result.message).toContain('invalid JSON');
  });

  it('should return failure when AI claims a project not in the list', async () => {
    const mockProjects = [
      { project_name: 'WebApp', description: 'Main app', archived: false },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockProjects });
    pool.query.mockResolvedValueOnce({ rows: [] }); // fields

    AI.mockResolvedValue(JSON.stringify({
      project: 'NonExistent',
      fields: { description: 'test' },
    }));

    const result = await nl.entry('test@example.com', 'did something');

    expect(result.success).toBe(false);
    expect(result.message).toContain('could not match');
  });

  it('should successfully match a project and create an entry', async () => {
    const mockProjects = [
      { project_name: 'WebApp', description: 'Main app', archived: false },
    ];
    pool.query.mockResolvedValueOnce({ rows: mockProjects });
    pool.query.mockResolvedValueOnce({ rows: [] }); // fields
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // insert entry

    AI.mockResolvedValue(JSON.stringify({
      project: 'WebApp',
      fields: { description: 'Fixed login bug' },
    }));

    const result = await nl.entry('test@example.com', 'Fixed login bug in WebApp');

    expect(result.success).toBe(true);
    expect(result.project).toBe('WebApp');
  });

  it('should handle unexpected thrown errors', async () => {
    pool.query.mockRejectedValueOnce(new Error('Unexpected DB failure'));

    const result = await nl.entry('test@example.com', 'anything');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unexpected DB failure');
  });
});
