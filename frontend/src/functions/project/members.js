/**
 * Project member management API functions.
 */

import { callService } from '@/lib/api';

/**
 * Add a member to a project.
 */
export async function addMember(project_name, member_email, role) {
  return callService('member', 'add', {
    project_name,
    member_email,
    role,
  });
}

/**
 * Edit a member's role.
 */
export async function editMember(project_name, member_email, new_role) {
  return callService('member', 'edit', {
    project_name,
    member_email,
    new_role,
  });
}

/**
 * Remove a member from a project.
 */
export async function removeMember(project_name, member_email) {
  return callService('member', 'remove', {
    project_name,
    member_email,
  });
}

/**
 * Get all members of a project.
 */
export async function getMembers(project_name) {
  return callService('member', 'get', {
    project_name,
  });
}

/**
 * Get all projects the current user is a member of.
 */
export async function getMyProjects() {
  return callService('member', 'myProjects', {});
}
