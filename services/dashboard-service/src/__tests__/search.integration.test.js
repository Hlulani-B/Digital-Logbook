/**
 * Integration tests for the dashboard-service search flow.
 *
 * Tests that searchAll, searchProject, and searchProjects work together
 * as a unified search experience:
 * - Global search (searchAll) returns entries across all projects
 * - Project-scoped search (searchProject) narrows to one project
 * - Project name search (searchProjects) finds entries via project name matching
 * - Combined flow: global search → scoped refinement
 */

import pool from '../db.js';

jest.mock('../db.js');

let Search;

beforeEach(async () => {
  pool.query.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const mod = await import('../functions/search.js');
  Search = mod.Search;
});

afterEach(() => {
  jest.restoreAllMocks();
});

const EMAIL = 'searcher@test.com';

describe('Dashboard Search Integration', () => {
  describe('Global → scoped search refinement', () => {
    it('searchAll finds entries, then searchProject narrows to one project', async () => {
      const search = new Search();

      // Step 1: Global search for "bug" across all entries
      pool.query.mockResolvedValueOnce({
        rows: [
          { entries: { title: 'Fix login bug', project: 'WebApp' } },
          { entries: { title: 'Fix CSS bug', project: 'WebApp' } },
          { entries: { title: 'Report bug', project: 'MobileApp' } },
        ],
      });
      const globalResult = await search.searchAll(EMAIL, 'bug');
      expect(globalResult.success).toBe(true);
      expect(globalResult.data).toHaveLength(3);

      // Step 2: Refine search to WebApp project only
      pool.query.mockResolvedValueOnce({
        rows: [
          { entries: { title: 'Fix login bug', project: 'WebApp' } },
          { entries: { title: 'Fix CSS bug', project: 'WebApp' } },
        ],
      });
      const scopedResult = await search.searchProject(EMAIL, 'WebApp', 'bug');
      expect(scopedResult.success).toBe(true);
      expect(scopedResult.data).toHaveLength(2);
      // All results should be from WebApp
      scopedResult.data.forEach((row) => {
        expect(row.entries.project).toBe('WebApp');
      });
    });
  });

  describe('searchProjects cross-entity flow', () => {
    it('finds projects by name, then fetches all their entries', async () => {
      const search = new Search();

      // Step 1: Search for projects matching "app"
      pool.query.mockResolvedValueOnce({
        rows: [
          { project_name: 'WebApp' },
          { project_name: 'MobileApp' },
        ],
      });

      // Step 2: Fetch entries for WebApp
      pool.query.mockResolvedValueOnce({
        rows: [
          { entries: { task: 'Login page' } },
          { entries: { task: 'Dashboard' } },
        ],
      });

      // Step 3: Fetch entries for MobileApp
      pool.query.mockResolvedValueOnce({
        rows: [
          { entries: { task: 'Push notifications' } },
        ],
      });

      const result = await search.searchProjects(EMAIL, 'app');
      expect(result.success).toBe(true);
      // Should have entries from BOTH matching projects
      expect(result.data).toHaveLength(3);
      // Verify pool.query was called 3 times: projects + 2 entry queries
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    it('returns empty when project name matches but project has no entries', async () => {
      const search = new Search();

      pool.query.mockResolvedValueOnce({
        rows: [{ project_name: 'EmptyProject' }],
      });
      // The project matches but has no entries
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await search.searchProjects(EMAIL, 'empty');
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('Keyword matching across data shapes', () => {
    it('matches keyword in nested JSON fields, not just top-level', async () => {
      const search = new Search();

      // Entries have nested JSON — keyword "urgent" is inside fields.priority
      pool.query.mockResolvedValueOnce({
        rows: [
          { entries: { task: 'Setup CI', fields: { priority: 'urgent' } } },
          { entries: { task: 'Write docs', fields: { priority: 'low' } } },
        ],
      });

      const result = await search.searchAll(EMAIL, 'urgent');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entries.fields.priority).toBe('urgent');
    });

    it('searchAll and searchProject return consistent results for same data', async () => {
      const search = new Search();
      const mockEntries = [
        { entries: { task: 'Shared task' } },
      ];

      // searchAll
      pool.query.mockResolvedValueOnce({ rows: mockEntries });
      const allResult = await search.searchAll(EMAIL, 'shared');

      // searchProject for the same data
      pool.query.mockResolvedValueOnce({ rows: mockEntries });
      const projectResult = await search.searchProject(EMAIL, 'Project1', 'shared');

      // Both should find the same entry
      expect(allResult.data).toHaveLength(1);
      expect(projectResult.data).toHaveLength(1);
      expect(allResult.data[0]).toEqual(projectResult.data[0]);
    });
  });

  describe('Error handling across search methods', () => {
    it('searchAll fails gracefully, searchProjects also fails with same error pattern', async () => {
      const search = new Search();

      // searchAll with DB error
      pool.query.mockRejectedValueOnce(new Error('connection timeout'));
      const allResult = await search.searchAll(EMAIL, 'test');
      expect(allResult.success).toBe(false);

      // searchProjects with DB error
      pool.query.mockRejectedValueOnce(new Error('connection timeout'));
      const projectsResult = await search.searchProjects(EMAIL, 'test');
      expect(projectsResult.success).toBe(false);

      // Both should return the same error shape
      expect(allResult.message).toBe(projectsResult.message);
    });
  });
});
