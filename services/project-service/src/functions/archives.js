import pool from '../db.js';

export class Archives {
  async archive_project(user_email, project_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      // Archive the project only. Entries keep their own individual archive
      // state so an individually archived entry stays archived after the
      // project is restored. Active views hide a project's entries through
      // the project's archived flag (effective archived-project names).
      await pool.query('BEGIN');
      await pool.query(
        `UPDATE projects SET archived = true
         WHERE user_email = $1 AND project_name = $2`,
        [user_email, project_name]
      );
      await pool.query('COMMIT');

      console.log('Project archived successfully');
      return { success: true, message: 'Project archived successfully' };
    } catch (error) {
      await pool.query('ROLLBACK').catch(() => {});
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async unarchive_project(user_email, project_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      // Restore the project flag only. Individual entry archive states must
      // survive a project archive/restore cycle — clearing them here is what
      // made individually archived entries reappear in active views.
      await pool.query('BEGIN');
      await pool.query(
        `UPDATE projects SET archived = false
         WHERE user_email = $1 AND project_name = $2`,
        [user_email, project_name]
      );
      await pool.query('COMMIT');

      console.log('Project unarchived successfully');
      return { success: true, message: 'Project unarchived successfully' };
    } catch (error) {
      await pool.query('ROLLBACK').catch(() => {});
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async archive_entry(user_email, project_name, entry_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      await pool.query(
        `UPDATE entries SET archived = true
         WHERE id = $1 AND user_email = $2 AND project_name = $3`,
        [entry_id, user_email, project_name]
      );

      console.log('Entry archived successfully');
      return { success: true, message: 'Entry archived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async unarchive_entry(user_email, project_name, entry_id) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      await pool.query(
        `UPDATE entries SET archived = false
         WHERE id = $1 AND user_email = $2 AND project_name = $3`,
        [entry_id, user_email, project_name]
      );

      console.log('Entry unarchived successfully');
      return { success: true, message: 'Entry unarchived successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getArchives(user_email, project_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      let query = `SELECT * FROM entries WHERE user_email = $1 AND archived = true`;
      const params = [user_email];

      if (project_name) {
        params.push(project_name);
        query += ` AND project_name = $${params.length}`;
      }

      const { rows } = await pool.query(query, params);

      return { success: true, data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getUnarchived(user_email, project_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      let query = `SELECT * FROM entries WHERE user_email = $1 AND (archived = false OR archived IS NULL)`;
      const params = [user_email];

      if (project_name) {
        params.push(project_name);
        query += ` AND project_name = $${params.length}`;
      }

      const { rows } = await pool.query(query, params);

      return { success: true, data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getArchivedProjects(user_email) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT project_name, description, created_at, archived FROM projects
         WHERE user_email = $1 AND archived = true
         ORDER BY created_at DESC`,
        [user_email]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getUnarchivedProjects(user_email) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT project_name, created_at, archived FROM projects
         WHERE user_email = $1 AND (archived = false OR archived IS NULL)
         ORDER BY created_at DESC`,
        [user_email]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
