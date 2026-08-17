import express from 'express';
import { Entries } from '../functions/entries.js';

const router = express.Router();

// Instantiate class safely
let entries;
try {
  entries = new Entries();
} catch (err) {
  console.error('Failed to instantiate Entries handler:', err);
}

/**
 * input:
 *     function
 *  values("add","update","delete","get","getAll","sort")
 */
router.post('/entry', async (req, res) => {
  try {
    if (!entries) {
      return res.status(500).json({ error: 'Entries service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case "add": {
        const { project_name, entry_object, due_date } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.addEntry(user_email, project_name, entry_object, due_date);
        return res.json(result);
      }
      case "update": {
        const { project_name, old_entry, new_entry } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.updateEntry(user_email, project_name, old_entry, new_entry);
        return res.json(result);
      }
      case "delete": {
        const { project_name, entry } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.deleteEntry(user_email, project_name, entry);
        return res.json(result);
      }
      case "get": {
        const { project_name } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.getEntries(user_email, project_name);
        return res.json(result);
      }
      case "getAll": {
        const result = await entries.getAllEntries(user_email);
        return res.json(result);
      }
      case "sort": {
        const { project_name, sort_type } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.sortEntries(user_email, project_name, sort_type);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/entry:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});

export default router;
