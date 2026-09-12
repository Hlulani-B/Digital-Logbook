import express from 'express';
import { Notifications } from '../functions/notifications/notifications.js';

const router = express.Router();

let notifications;
try {
  notifications = new Notifications();
} catch (err) {
  console.error('Failed to instantiate Notifications handler:', err);
}

/**
 * Notifications service endpoint (JWT-protected user functions).
 *
 * Input:
 *   function: 'get' | 'markRead' | 'markAllRead'
 *   values: { ... }
 */
router.post('/notifications', async (req, res) => {
  try {
    if (!notifications) {
      return res.status(500).json({ success: false, error: 'Notifications service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ success: false, error: 'Function not provided' });

    // Use the verified email from the JWT
    const userEmail = req.userEmail;
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'get': {
        const result = await notifications.getNotifications(userEmail);
        return res.json(result);
      }

      case 'markRead': {
        const { id } = values;
        if (!id) {
          return res.status(400).json({ error: 'Missing required parameter: id' });
        }
        const result = await notifications.markRead(userEmail, id);
        if (!result.success) {
          return res.status(404).json(result);
        }
        return res.json(result);
      }

      case 'markAllRead': {
        const result = await notifications.markAllRead(userEmail);
        return res.json(result);
      }

      default:
        return res.status(400).json({ error: `Unknown function: ${func}` });
    }
  } catch (err) {
    console.error('[/notifications] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Send any pending notification emails (due-soon / overdue).
 *
 * Invoked WITHOUT a user JWT: the caller is the hourly pg_cron job
 * (pg_net HTTP poke, migration 011), which has no user token. Idempotent
 * and safe to trigger at any frequency — rows are marked emailed = true
 * as they are sent (or skipped for opted-out users), so repeats are no-ops.
 */
export async function sendPendingHandler(req, res) {
  try {
    if (!notifications) {
      return res.status(500).json({ success: false, error: 'Notifications service uninitialized' });
    }
    const result = await notifications.sendPendingEmails();
    if (!result.success) {
      return res.status(500).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[/notifications/sendPending] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

export default router;
