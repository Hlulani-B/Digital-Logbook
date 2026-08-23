import pool from '../db.js';

export class Project {
  async addProject(user_email, project_name, description) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      await pool.query(
        `INSERT INTO projects (user_email, project_name, description)
         VALUES ($1, $2, $3)`,
        [user_email, project_name, description]
      );

      console.log('Project added successfully');
      return { success: true, message: 'Project added successfully' };
    } catch (error) {
      // 23505 = unique_violation (e.g. duplicate project name for this user)
      if (error.code === '23505') {
        return { success: false, message: 'A project with this name already exists for your account.' };
      }
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async editProjectName(user_email, new_project_name, old_project_name) {
    // Also update all the project entries and custom fields that have this project name
    let client;
    try {
      if (!pool) throw new Error('Database pool not initialized');
      client = await pool.connect();

      await client.query('BEGIN');

      // Update related entries first
      await client.query(
        `UPDATE entries SET project_name = $1
         WHERE project_name = $2 AND user_email = $3`,
        [new_project_name, old_project_name, user_email]
      );

      // Update the custom fields tied to this project (table_name == project_name)
      await client.query(
        `UPDATE fields SET table_name = $1
         WHERE table_name = $2 AND user_email = $3`,
        [new_project_name, old_project_name, user_email]
      );

      // Then update the project record
      await client.query(
        `UPDATE projects SET project_name = $1
         WHERE project_name = $2 AND user_email = $3`,
        [new_project_name, old_project_name, user_email]
      );

      await client.query('COMMIT');

      console.log('Project name updated successfully');
      return { success: true, message: 'Project name updated successfully' };
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.log(error);
      return { success: false, message: error.message };
    } finally {
      if (client) client.release();
    }
  }

  async getProjectsByEmail(user_email) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT project_name, description, created_at, archived
         FROM projects
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)
         ORDER BY created_at DESC`,
        [user_email]
      );

      return { success: true, projects: rows || [] };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async deleteProject(user_email, project_name) {
    // When deleting a project, soft-delete all of its entries and custom fields
    let client;
    try {
      if (!pool) throw new Error('Database pool not initialized');
      client = await pool.connect();

      await client.query('BEGIN');

      // Soft-delete entries for this project
      await client.query(
        `UPDATE entries SET deleted = true
         WHERE project_name = $1 AND user_email = $2 AND (deleted = false OR deleted IS NULL)`,
        [project_name, user_email]
      );

      // Soft-delete custom fields tied to this project
      await client.query(
        `UPDATE fields SET deleted = true
         WHERE table_name = $1 AND user_email = $2 AND (deleted = false OR deleted IS NULL)`,
        [project_name, user_email]
      );

      // Soft-delete the project itself
      await client.query(
        `UPDATE projects SET deleted = true
         WHERE project_name = $1 AND user_email = $2 AND (deleted = false OR deleted IS NULL)`,
        [project_name, user_email]
      );

      await client.query('COMMIT');

      console.log('Project soft-deleted successfully');
      return { success: true, message: 'Project deleted successfully' };
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.log(error);
      return { success: false, message: error.message };
    } finally {
      if (client) client.release();
    }
  }
}
