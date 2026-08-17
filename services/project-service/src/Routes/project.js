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

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case "add": {
        const { project_name, description } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.addProject(user_email, project_name, description);
        if (!result.success) {
          const clientError = /already exists|foreign key|violates check/i.test(result.message || '');
          return res.status(clientError ? 400 : 500).json(result);
        }
        return res.json(result);
      }
      case "edit": {
        const { new_project_name, old_project_name } = values;
        if (!new_project_name || !old_project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.editProjectName(user_email, new_project_name, old_project_name);
        return res.json(result);
      }
      case "delete": {
        const { project_name } = values;
        if (!project_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await project.deleteProject(user_email, project_name);
        return res.json(result);
      }
      case "getProjects": {
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
