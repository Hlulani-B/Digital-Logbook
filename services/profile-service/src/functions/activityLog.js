import pool from '../db.js';

/**
 * Activity log utility for profile-service — records user actions to the
 * activity_log table so they can be displayed in the activity feed.
 *
 * All methods are fire-and-forget safe: they catch their own errors and
 * never throw, so a logging failure never breaks the main operation.
 */

/**
 * Insert a single activity record.
 *
 * @param {string} user_email  - verified user email
 * @param {string} action_type - machine-readable type, e.g. 'NOTIFICATION_EMAIL_TOGGLED'
 * @param {string} entity_type - 'notification' | 'profile'
 * @param {string} entity_name - human-readable identifier (optional)
 * @param {object} details     - extra context stored as JSONB (optional)
 * @returns {Promise<void>}
 */
export async function logActivity(user_email, action_type, entity_type, entity_name, details = {}) {
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
