/**
 * Project member management functions.
 * Handles adding, removing, and querying project members with role-based access.
 */

class Members {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Add a member to a project.
   * Only the project owner can add members.
   */
  async addMember(user_email, project_name, member_email, role) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      // Validate role
      const validRoles = ['admin', 'editor', 'viewer'];
      if (!validRoles.includes(role)) {
        return {
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        };
      }

      // Verify the caller is the project owner
      const { rows: projectRows } = await this.pool.query(
        `SELECT user_email FROM projects WHERE user_email = $1 AND project_name = $2`,
        [user_email, project_name]
      );

      if (projectRows.length === 0) {
        return { success: false, message: 'Project not found or you are not the owner' };
      }

      // Check if member already exists
      const { rows: existingRows } = await this.pool.query(
        `SELECT id FROM project_members 
         WHERE project_owner = $1 AND project_name = $2 AND member_email = $3 AND NOT deleted`,
        [user_email, project_name, member_email]
      );

      if (existingRows.length > 0) {
        // Re-activate if previously deleted
        await this.pool.query(
          `UPDATE project_members SET deleted = false, role = $4, created_at = now()
           WHERE project_owner = $1 AND project_name = $2 AND member_email = $3`,
          [user_email, project_name, member_email, role]
        );
      } else {
        await this.pool.query(
          `INSERT INTO project_members (project_owner, project_name, member_email, role)
           VALUES ($1, $2, $3, $4)`,
          [user_email, project_name, member_email, role]
        );
      }

      return { success: true, message: 'Member added successfully' };
    } catch (error) {
      console.error('[addMember] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Edit a member's role.
   * Only the project owner or admin can edit roles.
   */
  async editMember(user_email, project_name, member_email, new_role) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      const validRoles = ['admin', 'editor', 'viewer'];
      if (!validRoles.includes(new_role)) {
        return {
          success: false,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        };
      }

      // Check caller's role
      const callerRole = await this.getUserRole(user_email, project_name);
      if (callerRole !== 'owner' && callerRole !== 'admin') {
        return { success: false, message: 'Only owner or admin can edit member roles' };
      }

      const { rows } = await this.pool.query(
        `UPDATE project_members SET role = $4
         WHERE project_owner = $1 AND project_name = $2 AND member_email = $3 AND NOT deleted
         RETURNING id`,
        [user_email, project_name, member_email, new_role]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Member not found' };
      }

      return { success: true, message: 'Member role updated successfully' };
    } catch (error) {
      console.error('[editMember] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Remove a member from a project.
   * Only the project owner can remove members.
   */
  async removeMember(user_email, project_name, member_email) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      // Verify caller is owner
      const callerRole = await this.getUserRole(user_email, project_name);
      if (callerRole !== 'owner') {
        return { success: false, message: 'Only the project owner can remove members' };
      }

      const { rows } = await this.pool.query(
        `UPDATE project_members SET deleted = true
         WHERE project_owner = $1 AND project_name = $2 AND member_email = $3
         RETURNING id`,
        [user_email, project_name, member_email]
      );

      if (rows.length === 0) {
        return { success: false, message: 'Member not found' };
      }

      return { success: true, message: 'Member removed successfully' };
    } catch (error) {
      console.error('[removeMember] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all members of a project.
   */
  async getMembers(user_email, project_name) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      const { rows } = await this.pool.query(
        `SELECT member_email, role, created_at
         FROM project_members
         WHERE project_owner = $1 AND project_name = $2 AND NOT deleted
         ORDER BY created_at ASC`,
        [user_email, project_name]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.error('[getMembers] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get all projects a user is a member of.
   */
  async getMyProjects(user_email) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      const { rows } = await this.pool.query(
        `SELECT project_owner, project_name, role
         FROM project_members
         WHERE member_email = $1 AND NOT deleted
         ORDER BY created_at DESC`,
        [user_email]
      );

      return { success: true, data: rows };
    } catch (error) {
      console.error('[getMyProjects] FAILED:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get a user's role for a specific project.
   * Returns 'owner' if the user owns the project, otherwise their member role.
   */
  async getUserRole(user_email, project_name) {
    try {
      if (!this.pool) throw new Error('Database pool not initialized');

      // Check if user is the project owner
      const { rows: projectRows } = await this.pool.query(
        `SELECT user_email FROM projects WHERE user_email = $1 AND project_name = $2`,
        [user_email, project_name]
      );

      if (projectRows.length > 0) {
        return 'owner';
      }

      // Check membership
      const { rows: memberRows } = await this.pool.query(
        `SELECT role FROM project_members
         WHERE project_owner = (SELECT user_email FROM projects WHERE project_name = $2 LIMIT 1)
         AND project_name = $2 AND member_email = $1 AND NOT deleted`,
        [user_email, project_name]
      );

      if (memberRows.length > 0) {
        return memberRows[0].role;
      }

      return null; // No access
    } catch (error) {
      console.error('[getUserRole] FAILED:', error.message);
      return null;
    }
  }
}

module.exports = Members;
