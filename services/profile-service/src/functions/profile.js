import pool from '../db.js';

/**
 * Handles username checks and updates.
 * If the username already exists in the users table, the update is rejected.
 */
export class Username {
  async username(email, username) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      const { rows } = await pool.query(`SELECT username FROM users WHERE username = $1`, [
        username,
      ]);

      if (rows.length > 0) {
        return { success: false, message: 'Username not available' };
      }

      await pool.query(`UPDATE users SET username = $1 WHERE email = $2`, [username, email]);

      return { success: true, message: 'Username updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Inserts a new user's email during sign-up.
 * Generates a default username from the email prefix to satisfy NOT NULL constraint.
 */
export class Email {
  async email(email) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      // Generate a default username from the email prefix (before @)
      // Dots become underscores; other special chars are hex-encoded
      const defaultUsername = email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, (char) => {
          if (char === '.') return '_';
          return char.charCodeAt(0).toString(16);
        });

      await pool.query(`INSERT INTO users (email, username, name) VALUES ($1, $2, $3)`, [
        email,
        defaultUsername,
        defaultUsername,
      ]);

      return { success: true, message: 'Email added successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Updates a user's display name.
 */
export class Name {
  async name(email, new_name) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      await pool.query(`UPDATE users SET name = $1 WHERE email = $2`, [new_name, email]);

      return { success: true, message: 'Name updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Updates a user's avatar URL.
 */
export class Avatar {
  async avatar(email, url) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      await pool.query(`UPDATE users SET avatar = $1 WHERE email = $2`, [url, email]);

      return { success: true, message: 'Avatar updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Persists the user's email-notification preference. Mirrors the
 * SettingsPanel "Email notifications" toggle so the due-date email
 * sender (project-service) can honour it server-side.
 */
export class EmailNotifications {
  async setEmailNotifications(email, enabled) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      await pool.query(`UPDATE users SET email_notifications = $1 WHERE email = $2`, [
        Boolean(enabled),
        email,
      ]);

      return { success: true, message: 'Notification preference updated' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Persists the user's notification lead-time preference.
 * Controls when the due_soon notification fires relative to the entry's
 * due date (e.g. 1 hour, 24 hours, 48 hours, 1 week before).
 */
const VALID_LEAD_TIMES = ['1 hour', '24 hours', '48 hours', '1 week'];

export class NotificationLeadTime {
  async set(email, leadTime) {
    try {
      if (!pool) return { success: false, message: 'Database not connected' };
      if (!VALID_LEAD_TIMES.includes(leadTime)) {
        return { success: false, message: `Invalid lead time: ${leadTime}` };
      }
      await pool.query(`UPDATE users SET notification_lead_time = $1::interval WHERE email = $2`, [
        leadTime,
        email,
      ]);
      return { success: true, message: 'Notification lead time updated' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }

  async get(email) {
    try {
      if (!pool) return { success: false, message: 'Database not connected' };
      const { rows } = await pool.query(
        `SELECT notification_lead_time FROM users WHERE email = $1`,
        [email]
      );
      if (rows.length === 0) return { success: false, message: 'User not found' };
      // PostgreSQL returns intervals as strings like '24:00:00' or '7 days'
      const raw = rows[0].notification_lead_time;
      return { success: true, data: { leadTime: raw } };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Persists the user's timer abandonment notification preference.
 * Controls whether email notifications are sent when a timer is left
 * running for >2 hours or paused for >30 minutes.
 */
export class TimerAbandonmentNotifications {
  async set(email, enabled) {
    try {
      if (!pool) return { success: false, message: 'Database not connected' };
      await pool.query(`UPDATE users SET timer_abandonment_notifications = $1 WHERE email = $2`, [
        Boolean(enabled),
        email,
      ]);
      return { success: true, message: 'Timer abandonment notification preference updated' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Aggregates read/delete operations for a user profile.
 */
export class Profile {
  async getProfile(email) {
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      const { rows } = await pool.query(
        `SELECT * FROM users
         WHERE email = $1
         LIMIT 1`,
        [email]
      );

      if (rows.length === 0) {
        return { success: false, message: 'User not found' };
      }

      return { success: true, data: rows[0] };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }

  async deleteProfile(email) {
    let client;
    try {
      if (!pool) {
        return { success: false, message: 'Database not connected' };
      }

      client = await pool.connect();
      await client.query('BEGIN');

      // Soft-delete all entries for this user
      await client.query(
        `UPDATE entries SET deleted = true WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [email]
      );

      // Soft-delete all fields for this user
      await client.query(
        `UPDATE fields SET deleted = true WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [email]
      );

      // Soft-delete all projects for this user
      await client.query(
        `UPDATE projects SET deleted = true WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [email]
      );

      // Soft-delete all activity logs for this user
      await client.query(
        `UPDATE activity_log SET deleted = true WHERE user_email = $1 AND (deleted = false OR deleted IS NULL)`,
        [email]
      );

      // Soft-delete the user account
      await client.query(
        `UPDATE users SET deleted = true WHERE email = $1 AND (deleted = false OR deleted IS NULL)`,
        [email]
      );

      await client.query('COMMIT');

      return { success: true, message: 'Profile deleted successfully' };
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      console.error(error);
      return { success: false, message: error.message };
    } finally {
      if (client) client.release();
    }
  }
}
