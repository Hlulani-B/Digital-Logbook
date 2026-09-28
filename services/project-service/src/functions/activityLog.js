import pool from '../db.js';

/**
 * Activity log utility — records user actions to the activity_log table
 * so they can be displayed in a Facebook-style activity feed.
 *
 * All methods are fire-and-forget safe: they catch their own errors and
 * never throw, so a logging failure never breaks the main operation.
 */
export class ActivityLog {
  /**
   * Insert a single activity record.
   *
   * @param {string} user_email  - verified user email from the JWT
   * @param {string} action_type - machine-readable type, e.g. 'PROJECT_CREATED'
   * @param {string} entity_type - 'project' | 'entry' | 'field' | 'archive' | 'priority'
   * @param {string} entity_name - human-readable identifier (project name, field name, ...)
   * @param {object} details     - extra context stored as JSONB (optional)
   * @returns {Promise<void>}
   */
  static async log(user_email, action_type, entity_type, entity_name, details = {}) {
    try {
      if (!pool) {
        console.warn('[activityLog] Database pool not initialized — skipping log');
        return;
      }

      await pool.query(
        `INSERT INTO activity_log (user_email, action_type, entity_type, entity_name, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_email, action_type, entity_type, entity_name, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('[activityLog] Exception:', err.message);
    }
  }

  /**
   * Fetch recent activities for a user, newest first.
   *
   * @param {string} user_email - verified user email from the JWT
   * @param {number} limit     - max number of records to return (default 50)
   * @param {string} [search]  - optional case-insensitive text filter on entity_name and details
   * @returns {Promise<{success: boolean, message?: string, data?: array}>}
   */
  async getActivities(user_email, limit = 50, search = null) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      const hasSearch = search && search.trim();
      let query = `SELECT * FROM activity_log
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`;
      const params = [user_email];

      if (hasSearch) {
        params.push(`%${search.trim()}%`);
        query += ` AND (entity_name ILIKE $2 OR details::text ILIKE $2)`;
      }

      params.push(limit);
      query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

      const { rows } = await pool.query(query, params);

      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('[activityLog] getActivities failed:', error.message);
      return { success: false, message: error.message, data: [] };
    }
  }
}

/**
 * Convenience export for static logging — lets route handlers call
 * `logActivity(email, type, ...)` without instantiating the class.
 */
export const logActivity = ActivityLog.log;
