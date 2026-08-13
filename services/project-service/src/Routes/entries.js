import express from 'express';
import { Entries } from '../functions/entries.js';

const router = express.Router();
const entries = new Entries();
/**
 * input:
 *     function
 *  values("add","update","delete","get","sort")
 */
router.post('/entry', async (req, res) => {
    const { function: func, values } = req.body;
    if (!func) return res.status(400).json({ error: 'Function not provided' });
    switch (func) {
        case "add": {
            const { user_email, project_name, entry_object, due_date } = values;
            const result = await entries.addEntry(user_email, project_name, entry_object, due_date);
            return res.json(result);
        }
        case "update": {
            const { user_email, project_name, old_entry, new_entry } = values;
            const result = await entries.updateEntry(user_email, project_name, old_entry, new_entry);
            return res.json(result);
        }
        case "delete": {
            const { user_email, project_name, entry } = values;
            const result = await entries.deleteEntry(user_email, project_name, entry);
            return res.json(result);
        }
        case "get": {
            const { user_email, project_name } = values;
            const result = await entries.getEntries(user_email, project_name);
            return res.json(result);
        }
        case "sort": {
            const { user_email, project_name, sort_type } = values;
            const result = await entries.sortEntries(user_email, project_name, sort_type);
            return res.json(result);
        }
        default:
            return res.status(400).json({ error: 'Invalid function' });
    }
});

export default router;