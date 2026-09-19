/**
 * Member management routes.
 * Handles adding, editing, removing, and querying project members.
 */

const express = require('express');
const router = express.Router();

// Lazy-load Members class to avoid circular dependencies
let MembersInstance = null;
function getMembers(pool) {
  if (!MembersInstance) {
    const Members = require('../functions/members');
    MembersInstance = new Members(pool);
  }
  return MembersInstance;
}

/**
 * POST /service/member
 * Body: { function: 'add' | 'edit' | 'remove' | 'get' | 'myProjects', values: {...} }
 */
router.post('/member', async (req, res) => {
  try {
    const { function: func, values } = req.body;
    const pool = req.app.locals.pool;
    const members = getMembers(pool);
    const user_email = req.userEmail;

    if (!func) {
      return res.status(400).json({ success: false, message: 'Missing function parameter' });
    }

    switch (func) {
      case 'add': {
        const { project_name, member_email, role } = values || {};
        if (!project_name || !member_email || !role) {
          return res
            .status(400)
            .json({
              success: false,
              message: 'Missing required fields: project_name, member_email, role',
            });
        }
        const result = await members.addMember(user_email, project_name, member_email, role);
        return res.json(result);
      }

      case 'edit': {
        const { project_name, member_email, new_role } = values || {};
        if (!project_name || !member_email || !new_role) {
          return res
            .status(400)
            .json({
              success: false,
              message: 'Missing required fields: project_name, member_email, new_role',
            });
        }
        const result = await members.editMember(user_email, project_name, member_email, new_role);
        return res.json(result);
      }

      case 'remove': {
        const { project_name, member_email } = values || {};
        if (!project_name || !member_email) {
          return res
            .status(400)
            .json({
              success: false,
              message: 'Missing required fields: project_name, member_email',
            });
        }
        const result = await members.removeMember(user_email, project_name, member_email);
        return res.json(result);
      }

      case 'get': {
        const { project_name } = values || {};
        if (!project_name) {
          return res
            .status(400)
            .json({ success: false, message: 'Missing required field: project_name' });
        }
        const result = await members.getMembers(user_email, project_name);
        return res.json(result);
      }

      case 'myProjects': {
        const result = await members.getMyProjects(user_email);
        return res.json(result);
      }

      default:
        return res.status(400).json({ success: false, message: `Unknown function: ${func}` });
    }
  } catch (error) {
    console.error('[member route] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
