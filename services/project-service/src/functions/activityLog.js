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
   * @param {number} limit      - max number of records to return (default 50)
   * @param {number} [offset=0] - number of records to skip (for pagination)
   * @returns {Promise<{success: boolean, message?: string, data?: array, has_more?: boolean}>}
   */
  async getActivities(user_email, limit = 50, offset = 0) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      // Fetch one extra row to determine whether more pages exist
      const fetchLimit = limit + 1;
      const { rows } = await pool.query(
        `SELECT * FROM activity_log
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [user_email, fetchLimit, offset]
      );

      const has_more = rows.length > limit;
      const data = has_more ? rows.slice(0, limit) : rows;

      return { success: true, data, has_more };
    } catch (error) {
      console.error('[activityLog] getActivities failed:', error.message);
      return { success: false, message: error.message, data: [], has_more: false };
    }
  }
}

/**
 * Convenience export for static logging — lets route handlers call
 * `logActivity(email, type, ...)` without instantiating the class.
 */
export const logActivity = ActivityLog.log;
