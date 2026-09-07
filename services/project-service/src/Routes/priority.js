import express from 'express';
import { Priority } from '../functions/priority.js';
import { logActivity } from '../functions/activityLog.js';

const router = express.Router();

// Instantiate class safely
let priority;
try {
  priority = new Priority();
} catch (err) {
  console.error('Failed to instantiate Priority handler:', err);
}

/**
 * input:
 *     function
 *  values("set")
 */
router.post('/priority', async (req, res) => {
  try {
    if (!priority) {
      return res.status(500).json({ error: 'Priority service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'set': {
        const { priorityValue, project_name, entry_id } = values;
        if (!project_name || !entry_id)
          return res.status(400).json({ error: 'Missing required parameters' });
        const result = await priority.setPriority(
          user_email,
          priorityValue,
          project_name,
          entry_id
        );
        if (result.success) {
          await logActivity(user_email, 'PRIORITY_SET', 'entry', String(entry_id), {
            project_name,
            entry_id,
            priority: priorityValue,
          });
        }
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/priority:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
