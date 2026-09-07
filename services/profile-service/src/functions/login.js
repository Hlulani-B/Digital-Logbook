/**
 * When user signs up or logs in, this function is called to check if the user exists in the database.
 * Returns an object with:
 *   - exists: whether the user row was found (regardless of deleted status)
 *   - deleted: whether the user is currently soft-deleted (in 30-day grace period)
 *   - deletion_scheduled_at: ISO timestamp when deletion was scheduled (null if not scheduled)
 * Frontend uses this to decide: active user → dashboard, deleted user → restore prompt, new user → create-profile
 */
import pool from '../db.js';

export class Login {
  async checkUser(email) {
    try {
      if (!pool) {
        console.error('Database pool not initialized');
        return { exists: false, deleted: false };
      }

      const { rows } = await pool.query(
        `SELECT email, deleted, deletion_scheduled_at FROM users WHERE email = $1`,
        [email]
      );

      if (rows.length === 0) {
        return { exists: false, deleted: false, deletion_scheduled_at: null };
      }

      const data = rows[0];
      return {
        exists: !!data,
        deleted: data?.deleted === true,
        deletion_scheduled_at: data?.deletion_scheduled_at || null,
      };
    } catch (error) {
      console.error(error);
      return { exists: false, deleted: false };
    }
  }
}
