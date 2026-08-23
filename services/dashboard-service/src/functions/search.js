import pool from '../db.js';

export class Search {
  async searchAll(user_email, keyword) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT * FROM entries
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [user_email]
      );

      const lowerKeyword = keyword.toLowerCase();
      const results = rows.filter((row) =>
        JSON.stringify(row.entries).toLowerCase().includes(lowerKeyword)
      );

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async searchProject(user_email, project_name, keyword) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT * FROM entries
         WHERE user_email = $1 AND project_name = $2 AND (deleted = false OR deleted IS NULL)`,
        [user_email, project_name]
      );

      const lowerKeyword = keyword.toLowerCase();
      const results = rows.filter((row) =>
        JSON.stringify(row.entries).toLowerCase().includes(lowerKeyword)
      );

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async searchProjects(user_email, keyword) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows: projects } = await pool.query(
        `SELECT * FROM projects
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [user_email]
      );

      const lowerKeyword = keyword.toLowerCase();
      const matchingProjects = projects.filter((project) =>
        project.project_name.toLowerCase().includes(lowerKeyword)
      );

      const results = [];
      for (const project of matchingProjects) {
        const { rows: entries } = await pool.query(
          `SELECT * FROM entries
           WHERE user_email = $1 AND project_name = $2 AND (deleted = false OR deleted IS NULL)`,
          [user_email, project.project_name]
        );

        results.push(...entries);
      }

      return { success: true, message: 'Entries retrieved successfully', data: results };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
