/**
 * Project-level authorization middleware.
 * Resolves the user's role for a specific project and attaches it to req.userRole.
 */

import { pool } from '../config.js';

/**
 * Middleware that resolves the user's role for a project.
 * Expects project_name in req.body.values.project_name.
 * Attaches req.userRole = 'owner' | 'admin' | 'editor' | 'viewer' | null
 */
export async function requireProjectAccess(req, res, next) {
  try {
    const projectName = req.body?.values?.project_name || req.body?.values?.table_name;
    const userEmail = req.userEmail;

    if (!projectName) {
      return res.status(400).json({ success: false, message: 'Missing project context' });
    }

    if (!userEmail) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Check if user is the project owner
    const { rows: projectRows } = await pool.query(
      `SELECT user_email FROM projects WHERE user_email = $1 AND project_name = $2`,
      [userEmail, projectName]
    );

    if (projectRows.length > 0) {
      req.userRole = 'owner';
      return next();
    }

    // Check membership
    const { rows: memberRows } = await pool.query(
      `SELECT role FROM project_members
       WHERE project_owner = (SELECT user_email FROM projects WHERE project_name = $2 LIMIT 1)
       AND project_name = $2 AND member_email = $1 AND NOT deleted`,
      [userEmail, projectName]
    );

    if (memberRows.length > 0) {
      req.userRole = memberRows[0].role;
      return next();
    }

    // No access
    req.userRole = null;
    return res.status(403).json({ success: false, message: 'Access denied to this project' });
  } catch (error) {
    console.error('[requireProjectAccess] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Helper function to get user role for a project (used in route handlers).
 */
export async function getUserRole(userEmail, projectName) {
  try {
    // Check if user is the project owner
    const { rows: projectRows } = await pool.query(
      `SELECT user_email FROM projects WHERE user_email = $1 AND project_name = $2`,
      [userEmail, projectName]
    );

    if (projectRows.length > 0) {
      return 'owner';
    }

    // Check membership
    const { rows: memberRows } = await pool.query(
      `SELECT role FROM project_members
       WHERE project_owner = (SELECT user_email FROM projects WHERE project_name = $2 LIMIT 1)
       AND project_name = $2 AND member_email = $1 AND NOT deleted`,
      [userEmail, projectName]
    );

    if (memberRows.length > 0) {
      return memberRows[0].role;
    }

    return null;
  } catch (error) {
    console.error('[getUserRole] Error:', error.message);
    return null;
  }
}
