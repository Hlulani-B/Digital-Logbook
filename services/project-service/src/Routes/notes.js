import express from 'express';
import { Notes } from '../functions/notes/notes_crud.js';

const router = express.Router();

let notes;
try {
  notes = new Notes();
} catch (err) {
  console.error('Failed to instantiate Notes handler:', err);
}

/**
 * Notes service endpoint.
 *
 * Input:
 *   function: 'add' | 'getByEntry' | 'view' | 'update' | 'delete'
 *   values: { ... }
 */
router.post('/notes', async (req, res) => {
  try {
    if (!notes) {
      return res.status(500).json({ success: false, error: 'Notes service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ success: false, error: 'Function not provided' });

    // Use the verified email from the JWT
    const userEmail = req.userEmail;
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'add': {
        const { entry_id, entry_type, value, email } = values;
        const ownerEmail = email || userEmail;
        if (!entry_id || !entry_type || value === undefined) {
          return res.status(400).json({ error: 'Missing required parameters: entry_id, entry_type, value' });
        }
        const result = await notes.addNote(ownerEmail, entry_id, entry_type, value);
        return res.json(result);
      }

      case 'getByEntry': {
        const { entry_id } = values;
        if (!entry_id) {
          return res.status(400).json({ error: 'Missing required parameter: entry_id' });
        }
        const result = await notes.getNotesByEntryID(entry_id);
        return res.json(result);
      }

      case 'view': {
        const { note_id } = values;
        if (!note_id) {
          return res.status(400).json({ error: 'Missing required parameter: note_id' });
        }
        const result = await notes.viewNote(note_id);
        return res.json(result);
      }

      case 'update': {
        const { note_id, new_value } = values;
        if (!note_id || new_value === undefined) {
          return res.status(400).json({ error: 'Missing required parameters: note_id, new_value' });
        }
        const result = await notes.updateNote(note_id, new_value);
        return res.json(result);
      }

      case 'delete': {
        const { note_id } = values;
        if (!note_id) {
          return res.status(400).json({ error: 'Missing required parameter: note_id' });
        }
        const result = await notes.deleteNote(note_id);
        return res.json(result);
      }

      default:
        return res.status(400).json({ error: `Unknown function: ${func}` });
    }
  } catch (err) {
    console.error('[/notes] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
