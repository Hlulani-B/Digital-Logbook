import express from 'express';
import { Project } from '../functions/project.js';

const router = express.Router();
const project = new Project();
/**
 * input:
 *     function
 *  values("add","edit","delete")
 */
router.post('/project', async (req, res) => {
    const { function: func, values } = req.body;
    if (!func) return res.status(400).json({ error: 'Function not provided' });
    switch (func) {
        case "add": {
            const { user_email, project_name } = values;
            const result = await project.addProject(user_email, project_name);
            return res.json(result);
        }
        case "edit": {
            const { user_email, new_project_name, old_project_name } = values;
            const result = await project.editProjectName(user_email, new_project_name, old_project_name);
            return res.json(result);
        }
        case "delete": {
            const { user_email, project_name } = values;
            const result = await project.deleteProject(user_email, project_name);
            return res.json(result);
        }
        default:
            return res.status(400).json({ error: 'Invalid function' });
    }
});

export default router;