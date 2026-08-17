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
 *  values("add","update","delete","get","getAll","sortUnarchived","sortArchived")
 */
router.post('/entry', async (req, res) => {
  try {
    if (!entries) {
      return res.status(500).json({ error: 'Entries service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    switch (func) {
      case "add": {
        const { user_email, project_name, entry_object, due_date } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.addEntry(user_email, project_name, entry_object, due_date);
        return res.json(result);
      }
      case "update": {
        const { user_email, project_name, old_entry, new_entry } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.updateEntry(user_email, project_name, old_entry, new_entry);
        return res.json(result);
      }
      case "delete": {
        const { user_email, project_name, entry } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.deleteEntry(user_email, project_name, entry);
        return res.json(result);
      }
      case "get": {
        const { user_email, project_name } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.getEntries(user_email, project_name);
        return res.json(result);
      }
      case "getAll": {
        const { user_email } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await entries.getAllEntries(user_email);
        return res.json(result);
      }
      case "sortUnarchived": {
        const { user_email, project_name, sort_type } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await entries.sortUnarchivedEntries(user_email, project_name || null, sort_type);
        return res.json(result);
      }
      case "sortArchived": {
        const { user_email, project_name, sort_type } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await entries.sortArchivedEntries(user_email, project_name || null, sort_type);
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
