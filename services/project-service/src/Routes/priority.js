import express from 'express';
import { Priority } from '../functions/priority.js';

const router = express.Router();
const priority = new Priority();
/**
 * input:
 *     function
 *  values("set")
 */
router.post('/priority', async (req, res) => {
    const { function: func, values } = req.body;
    if (!func) return res.status(400).json({ error: 'Function not provided' });
    switch (func) {
        case "set": {
            const { user_email, priorityValue, project_name, entry_object } = values;
            const result = await priority.setPriority(user_email, priorityValue, project_name, entry_object);
            return res.json(result);
        }
        default:
            return res.status(400).json({ error: 'Invalid function' });
    }
});

export default router;