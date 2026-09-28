import express from 'express';
import {
  Username,
  Email,
  Name,
  Avatar,
  Profile,
  EmailNotifications,
  NotificationLeadTime,
  TimerAbandonmentNotifications,
} from '../functions/profile.js';
import pool from '../db.js';

const router = express.Router();

/**
 * Fire-and-forget activity log helper.
 * Inserts directly into the shared activity_log table — same DB as project-service.
 */
async function logProfileActivity(user_email, action_type, entity_name, details = {}) {
  try {
    if (!pool) return;
    await pool.query(
      `INSERT INTO activity_log (user_email, action_type, entity_type, entity_name, details)
       VALUES ($1, $2, 'profile', $3, $4)`,
      [user_email, action_type, entity_name, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('[profile] activity log failed:', err.message);
  }
}

// Instantiate classes safely
let username,
  email,
  name,
  avatar,
  profile,
  emailNotifications,
  notificationLeadTime,
  timerAbandonmentNotifications;
try {
  username = new Username();
  email = new Email();
  name = new Name();
  avatar = new Avatar();
  profile = new Profile();
  emailNotifications = new EmailNotifications();
  notificationLeadTime = new NotificationLeadTime();
  timerAbandonmentNotifications = new TimerAbandonmentNotifications();
} catch (err) {
  console.error('Failed to instantiate profile handlers:', err);
}

/**
 * input:
 *     function
 *  values("username","email","name","avatar","getProfile","deleteProfile")
 */
router.post('/profile', async (req, res) => {
  try {
    const { function: func, values = {} } = req.body || {};

    if (!func) {
      return res.status(400).json({ error: 'Function not provided' });
    }

    switch (func) {
      case 'username': {
        const { email: userEmail, username: userName } = values;
        if (!userEmail || !userName)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await username.username(userEmail, userName);
        if (result.success) {
          await logProfileActivity(userEmail, 'PROFILE_USERNAME_UPDATED', userName, {
            new_username: userName,
          });
        }
        return res.json(result);
      }
      case 'email': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await email.email(userEmail);
        if (result.success) {
          await logProfileActivity(userEmail, 'PROFILE_CREATED', userEmail, { source: 'sign-up' });
        }
        return res.json(result);
      }
      case 'name': {
        const { email: userEmail, new_name } = values;
        if (!userEmail || !new_name)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await name.name(userEmail, new_name);
        if (result.success) {
          await logProfileActivity(userEmail, 'PROFILE_NAME_UPDATED', new_name, { new_name });
        }
        return res.json(result);
      }
      case 'avatar': {
        const { email: userEmail, url } = values;
        if (!userEmail || !url)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await avatar.avatar(userEmail, url);
        if (result.success) {
          await logProfileActivity(userEmail, 'PROFILE_AVATAR_UPDATED', userEmail, {
            avatar_url: url,
          });
        }
        return res.json(result);
      }
      case 'getProfile': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await profile.getProfile(userEmail);
        return res.json(result);
      }
      case 'emailNotifications': {
        const { email: userEmail, enabled } = values;
        if (!userEmail || typeof enabled !== 'boolean') {
          return res.status(400).json({ error: 'Missing email parameter or enabled flag' });
        }

        const result = await emailNotifications.setEmailNotifications(userEmail, enabled);
        return res.json(result);
      }
      case 'notificationLeadTime': {
        const { email: userEmail, leadTime } = values;
        if (!userEmail || !leadTime) {
          return res.status(400).json({ error: 'Missing email or leadTime parameter' });
        }
        const result = await notificationLeadTime.set(userEmail, leadTime);
        return res.json(result);
      }
      case 'getNotificationLeadTime': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });
        const result = await notificationLeadTime.get(userEmail);
        return res.json(result);
      }
      case 'timerAbandonmentNotifications': {
        const { email: userEmail, enabled } = values;
        if (!userEmail || typeof enabled !== 'boolean') {
          return res.status(400).json({ error: 'Missing email parameter or enabled flag' });
        }
        const result = await timerAbandonmentNotifications.set(userEmail, enabled);
        return res.json(result);
      }
      case 'deleteProfile': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await profile.deleteProfile(userEmail);
        if (result.success) {
          await logProfileActivity(userEmail, 'PROFILE_DELETED', userEmail, {
            deleted_at: new Date().toISOString(),
          });
        }
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/profile:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
