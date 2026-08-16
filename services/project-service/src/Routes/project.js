import express from 'express';
import { Project } from '../functions/project.js';

const router = express.Router();

// Instantiate class safely
let project;
try {
  project = new Project();
} catch (err) {
  console.error('Failed to instantiate Project handler:', err);
}

/**
 * input:
 *     function
 *  values("add","edit","delete")
 */
router.post('/project', async (req, res) => {
  try {
    if (!project) {
      return res.status(500).json({ error: 'Project service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    switch (func) {
      case "add": {
        const { user_email, project_name } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.addProject(user_email, project_name);
        return res.json(result);
      }
      case "edit": {
        const { user_email, new_project_name, old_project_name } = values;
        if (!user_email || !new_project_name || !old_project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.editProjectName(user_email, new_project_name, old_project_name);
        return res.json(result);
      }
      case "delete": {
        const { user_email, project_name } = values;
        if (!user_email || !project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.deleteProject(user_email, project_name);
        return res.json(result);
      }
      case "getProjects": {
        const { user_email } = values;
        if (!user_email) return res.status(400).json({ error: 'user_email is required' });
        const result = await project.getProjectsByEmail(user_email);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/project:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      details: error.message 
    });
  }
});

export default router;
