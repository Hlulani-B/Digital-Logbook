import express from 'express';
import { Entries, Natural_language } from '../functions/entries.js';
import { logActivity } from '../functions/activityLog.js';

const router = express.Router();

// Instantiate class safely
let entries;
let nlEntry;
try {
  entries = new Entries();
  nlEntry = new Natural_language();
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
      return res.status(500).json({ success: false, error: 'Entries service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ success: false, error: 'Function not provided' });

    console.log(`[/entry] func=${func}, values keys=${Object.keys(values).join(',')}`);

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'add': {
        const {
          project_name,
          entry_object,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration,
        } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.addEntry(
          user_email,
          project_name,
          entry_object,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration
        );
        if (result.success) {
          const entrySummary =
            typeof entry_object === 'string'
              ? entry_object.slice(0, 100)
              : JSON.stringify(entry_object).slice(0, 100);
          await logActivity(user_email, 'ENTRY_ADDED', 'entry', entrySummary, {
            project_name,
            due_date,
            priority,
          });
        }
        return res.json(result);
      }
      case 'update': {
        const {
          project_name,
          entry_id,
          new_entry,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration,
        } = values;
        if (!project_name || !entry_id)
          return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.updateEntry(
          user_email,
          project_name,
          entry_id,
          new_entry,
          due_date,
          priority,
          status,
          started_at,
          ended_at,
          duration
        );
        if (result.success) {
          const entrySummary = new_entry
            ? typeof new_entry === 'string'
              ? new_entry.slice(0, 100)
              : JSON.stringify(new_entry).slice(0, 100)
            : project_name;
          await logActivity(user_email, 'ENTRY_UPDATED', 'entry', entrySummary, {
            project_name,
            entry_id,
          });
        }
        return res.json(result);
      }
      case 'delete': {
        const { project_name, entry } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.deleteEntry(user_email, project_name, entry);
        if (result.success) {
          const entrySummary = typeof entry === 'string' ? entry.slice(0, 100) : 'entry';
          await logActivity(user_email, 'ENTRY_DELETED', 'entry', entrySummary, { project_name });
        }
        return res.json(result);
      }
      case 'deleteById': {
        const { entry_id } = values;
        if (!entry_id) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.deleteEntryById(user_email, entry_id);
        if (result.success) {
          await logActivity(user_email, 'ENTRY_DELETED', 'entry', entry_id, { entry_id });
        }
        return res.json(result);
      }
      case 'get': {
        const { project_name } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await entries.getEntries(user_email, project_name);
        return res.json(result);
      }
      case 'getAll': {
        const result = await entries.getAllEntries(user_email);
        return res.json(result);
      }
      case 'sortUnarchived': {
        const { project_name, sort_type } = values;
        const result = await entries.sortUnarchivedEntries(
          user_email,
          project_name || null,
          sort_type
        );
        return res.json(result);
      }
      case 'sortArchived': {
        const { project_name, sort_type } = values;
        const result = await entries.sortArchivedEntries(
          user_email,
          project_name || null,
          sort_type
        );
        return res.json(result);
      }
      default:
        return res.status(400).json({ success: false, error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/entry:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});

/**
 * Natural language entry endpoint.
 * POST /service/natural-language-entry
 * Body: { "text": "Fixed login bug for WebApp, urgent, due tomorrow" }
 */
router.post('/natural-language-entry', async (req, res) => {
  try {
    if (!nlEntry) {
      return res
        .status(500)
        .json({ success: false, error: 'Natural language handler uninitialized' });
    }

    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Text is required' });
    }

    const result = await nlEntry.entry(user_email, text);
    if (result.success) {
      if (result.multi) {
        // matched=3: log each entry separately
        const allEntries = [
          ...(result.results.old || []).map((e) => ({
            project_name: e.project_name,
            fields: e.fields,
          })),
          ...(result.results.new || []).map((e) => ({
            project_name: e.project_name,
            fields: e.fields,
          })),
        ];
        for (const e of allEntries) {
          await logActivity(user_email, 'ENTRY_ADDED', 'entry', text.slice(0, 100), {
            project_name: e.project_name,
            source: 'natural-language',
            priority: result.priority,
            due_date: result.due_date,
          });
        }
      } else {
        await logActivity(user_email, 'ENTRY_ADDED', 'entry', text.slice(0, 100), {
          project_name: result.project,
          source: 'natural-language',
          priority: result.priority,
          due_date: result.due_date,
        });
      }
    }
    return res.json(result);
  } catch (error) {
    console.error('Error in /natural-language-entry:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
