import express from 'express';
import { Search } from '../functions/search.js';

const router = express.Router();
const search = new Search();
/**
 * input:
 *     function
 *  values("searchAll","searchProject","searchProjects")
 */
router.post('/search', async (req, res) => {
    const { function: func, values } = req.body;
    if (!func) return res.status(400).json({ error: 'Function not provided' });
    switch (func) {
        case "searchAll": {
            const { user_email, keyword } = values;
            const result = await search.searchAll(user_email, keyword);
            return res.json(result);
        }
        case "searchProject": {
            const { user_email, project_name, keyword } = values;
            const result = await search.searchProject(user_email, project_name, keyword);
            return res.json(result);
        }
        case "searchProjects": {
            const { user_email, keyword } = values;
            const result = await search.searchProjects(user_email, keyword);
            return res.json(result);
        }
        default:
            return res.status(400).json({ error: 'Invalid function' });
    }
});

export default router;