import express from 'express';
import { ActivityLog } from '../functions/activityLog.js';

const router = express.Router();

// Instantiate class safely (for instance methods like getActivities)
let activityLog;
try {
  activityLog = new ActivityLog();
} catch (err) {
  console.error('Failed to instantiate ActivityLog handler:', err);
}

/**
 * input:
 *     function
 *  values("getActivities")
 */
router.post('/activity', async (req, res) => {
  try {
    if (!activityLog) {
      return res.status(500).json({ error: 'Activity log service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'getActivities': {
        const limit = values.limit || 50;
        const result = await activityLog.getActivities(user_email, limit);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/activity:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
});

export default router;
