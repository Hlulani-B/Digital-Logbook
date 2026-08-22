import { supabase } from '../supabase.js';

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
      if (!supabase) {
        console.warn('[activityLog] Supabase client not initialized — skipping log');
        return;
      }

      const { error } = await supabase
        .from('activity_log')
        .insert({ user_email, action_type, entity_type, entity_name, details });

      if (error) {
        console.error('[activityLog] Failed to insert:', error.message);
      }
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
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data, error } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_email', user_email)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, data: data || [] };
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
