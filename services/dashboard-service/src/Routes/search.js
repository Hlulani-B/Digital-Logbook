import express from 'express';
import { Search } from '../functions/search.js';

const router = express.Router();

// Instantiate class safely
let search;
try {
  search = new Search();
} catch (err) {
  console.error('Failed to instantiate Search handler:', err);
}

/**
 * input:
 *     function
 *  values("searchAll","searchProject","searchProjects")
 */
router.post('/search', async (req, res) => {
  try {
    if (!search) {
      return res.status(500).json({ error: 'Search service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    switch (func) {
      case "searchAll": {
        const { user_email, keyword } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await search.searchAll(user_email, keyword);
        return res.json(result);
      }
      case "searchProject": {
        const { user_email, project_name, keyword } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await search.searchProject(user_email, project_name, keyword);
        return res.json(result);
      }
      case "searchProjects": {
        const { user_email, keyword } = values;
        if (!user_email) return res.status(400).json({ error: 'Missing user_email' });
        const result = await search.searchProjects(user_email, keyword);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/search:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});

export default router;
