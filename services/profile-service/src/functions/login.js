/**
 * When user signs up or logs in, this function is called to check if the user exists in the database.
 * Returns an object with:
 *   - exists: whether the user row was found (regardless of deleted status)
 *   - deleted: whether the user is currently soft-deleted (in 30-day grace period)
 * Frontend uses this to decide: active user → dashboard, deleted user → auto-restore, new user → create-profile
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
        `SELECT email, deleted FROM users WHERE email = $1`,
        [email]
      );

      if (rows.length === 0) {
        return { exists: false, deleted: false };
      }

      const data = rows[0];
      return { exists: !!data, deleted: data?.deleted === true };
    } catch (error) {
      console.error(error);
      return { exists: false, deleted: false };
    }
  }
}
