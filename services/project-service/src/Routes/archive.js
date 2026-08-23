import express from 'express';
import { Archives } from '../functions/archives.js';
import { logActivity } from '../functions/activityLog.js';

const router = express.Router();

// Instantiate class safely
let archives;
try {
  archives = new Archives();
} catch (err) {
  console.error('Failed to instantiate Archives handler:', err);
}

/**
 * input:
 *     function
 *  values("archive_project","unarchive_project","archive_entry","unarchive_entry","getArchives","getUnarchived","getArchivedProjects","getUnarchivedProjects")
 */
router.post('/archive', async (req, res) => {
  try {
    if (!archives) {
      return res.status(500).json({ error: 'Archives service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'archive_project': {
        const { project_name } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await archives.archive_project(user_email, project_name);
        if (result.success) {
          await logActivity(user_email, 'PROJECT_ARCHIVED', 'project', project_name);
        }
        return res.json(result);
      }
      case 'unarchive_project': {
        const { project_name } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await archives.unarchive_project(user_email, project_name);
        if (result.success) {
          await logActivity(user_email, 'PROJECT_UNARCHIVED', 'project', project_name);
        }
        return res.json(result);
      }
      case 'archive_entry': {
        const { project_name, entry_id } = values;
        if (!project_name || !entry_id) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await archives.archive_entry(user_email, project_name, entry_id);
        if (result.success) {
          await logActivity(user_email, 'ENTRY_ARCHIVED', 'entry', String(entry_id), { project_name, entry_id });
        }
        return res.json(result);
      }
      case 'unarchive_entry': {
        const { project_name, entry_id } = values;
        if (!project_name || !entry_id) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await archives.unarchive_entry(user_email, project_name, entry_id);
        if (result.success) {
          await logActivity(user_email, 'ENTRY_UNARCHIVED', 'entry', String(entry_id), { project_name, entry_id });
        }
        return res.json(result);
      }
      case 'getArchives': {
        const { project_name } = values;
        const result = await archives.getArchives(user_email, project_name || null);
        return res.json(result);
      }
      case 'getUnarchived': {
        const { project_name } = values;
        const result = await archives.getUnarchived(user_email, project_name || null);
        return res.json(result);
      }
      case 'getArchivedProjects': {
        const { user_email } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await archives.getArchivedProjects(user_email);
        return res.json(result);
      }
      case 'getUnarchivedProjects': {
        const { user_email } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await archives.getUnarchivedProjects(user_email);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/archive:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});

export default router;
