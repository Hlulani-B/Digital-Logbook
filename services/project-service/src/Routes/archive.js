import express from 'express';
import { Archives } from '../functions/archives.js';

const router = express.Router();
const archives = new Archives();

/**
 * input:
 *     function
 *  values("archive_project","unarchive_project","archive_entry","unarchive_entry")
 */
router.post('/archive', async (req, res) => {
  const { function: func, values } = req.body;
  if (!func) return res.status(400).json({ error: 'Function not provided' });

  switch (func) {
    case 'archive_project': {
      const { user_email, project_name } = values;
      const result = await archives.archive_project(user_email, project_name);
      return res.json(result);
    }
    case 'unarchive_project': {
      const { user_email, project_name } = values;
      const result = await archives.unarchive_project(user_email, project_name);
      return res.json(result);
    }
    case 'archive_entry': {
      const { user_email, project_name, entry } = values;
      const result = await archives.archive_entry(user_email, project_name, entry);
      return res.json(result);
    }
    case 'unarchive_entry': {
      const { user_email, project_name, entry } = values;
      const result = await archives.unarchive_entry(user_email, project_name, entry);
      return res.json(result);
    }
    default:
      return res.status(400).json({ error: 'Invalid function' });
  }
});

export default router;
