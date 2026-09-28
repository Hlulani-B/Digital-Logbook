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
   * @returns {Promise<{success: boolean, message?: string, data?: array}>}
   */
  async getActivities(user_email, limit = 50) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      const { rows } = await pool.query(
        `SELECT * FROM activity_log
         WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)
         ORDER BY created_at DESC
         LIMIT $2`,
        [user_email, limit]
      );

      return { success: true, data: rows || [] };
    } catch (error) {
      console.error('[activityLog] getActivities failed:', error.message);
      return { success: false, message: error.message, data: [] };
    }
  }

  /**
   * Generate a digest summary for a given period.
   *
   * @param {string} user_email - verified user email from the JWT
   * @param {string} period     - 'daily' | 'weekly' (default 'daily')
   * @returns {Promise<{success: boolean, data?: object, message?: string}>}
   */
  async getDigest(user_email, period = 'daily') {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      const interval = period === 'weekly' ? '7 days' : '1 day';

      // 1. Total count in period
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM activity_log
         WHERE user_email = $1
           AND (deleted = false OR deleted IS NULL)
           AND created_at >= NOW() - $2::interval`,
        [user_email, interval]
      );
      const total = countResult.rows[0]?.total || 0;

      // 2. Breakdown by action category (prefix grouping)
      const categoryResult = await pool.query(
        `SELECT
           CASE
             WHEN action_type LIKE 'PROJECT_%' THEN 'projects'
             WHEN action_type LIKE 'ENTRY_%'   THEN 'entries'
             WHEN action_type LIKE 'FIELD_%'   THEN 'fields'
             WHEN action_type LIKE 'TIMER_%'   THEN 'timer'
             WHEN action_type LIKE 'PROFILE_%' THEN 'profile'
             WHEN action_type = 'PRIORITY_SET' THEN 'priority'
             ELSE 'other'
           END AS category,
           COUNT(*)::int AS count
         FROM activity_log
         WHERE user_email = $1
           AND (deleted = false OR deleted IS NULL)
           AND created_at >= NOW() - $2::interval
         GROUP BY category
         ORDER BY count DESC`,
        [user_email, interval]
      );

      // 3. Top projects by activity count
      const topProjectsResult = await pool.query(
        `SELECT
           COALESCE(details->>'project_name', entity_name) AS project_name,
           COUNT(*)::int AS count
         FROM activity_log
         WHERE user_email = $1
           AND (deleted = false OR deleted IS NULL)
           AND created_at >= NOW() - $2::interval
           AND (action_type LIKE 'PROJECT_%' OR action_type LIKE 'ENTRY_%')
         GROUP BY project_name
         ORDER BY count DESC
         LIMIT 5`,
        [user_email, interval]
      );

      // 4. Top entries by activity count
      const topEntriesResult = await pool.query(
        `SELECT entity_name, COUNT(*)::int AS count
         FROM activity_log
         WHERE user_email = $1
           AND (deleted = false OR deleted IS NULL)
           AND created_at >= NOW() - $2::interval
           AND action_type LIKE 'ENTRY_%'
         GROUP BY entity_name
         ORDER BY count DESC
         LIMIT 5`,
        [user_email, interval]
      );

      return {
        success: true,
        data: {
          period,
          total,
          categories: categoryResult.rows || [],
          topProjects: topProjectsResult.rows || [],
          topEntries: topEntriesResult.rows || [],
        },
      };
    } catch (error) {
      console.error('[activityLog] getDigest failed:', error.message);
      return { success: false, message: error.message, data: null };
    }
  }
}

/**
 * Convenience export for static logging — lets route handlers call
 * `logActivity(email, type, ...)` without instantiating the class.
 */
export const logActivity = ActivityLog.log;
