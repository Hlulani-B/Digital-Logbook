/**
 * Action Dispatcher
 * 
 * Maps queued action strings to their corresponding function implementations.
 * Used by the queue processor to execute offline actions when connectivity returns.
 */

import * as entries from '../functions/project/entries';
import * as project from '../functions/project/project';
import * as archives from '../functions/project/archives';
import * as priority from '../functions/project/priority';
import * as profile from '../functions/profile/profile';

/**
 * Map of action names to their handler functions.
 * Each handler receives the payload object and calls the appropriate function.
 */
const actionMap = {
  // Entries
  addEntry: (payload) =>
    entries.addEntry(
      payload.user_email,
      payload.project_name,
      payload.entry_object,
      payload.due_date,
      payload.priority,
      payload.status,
      payload.started_at,
      payload.ended_at,
      payload.duration
    ),

  updateEntry: (payload) =>
    entries.updateEntry(
      payload.user_email,
      payload.project_name,
      payload.entry_id,
      payload.new_entry,
      payload.due_date,
      payload.priority,
      payload.status,
      payload.started_at,
      payload.ended_at,
      payload.duration,
      payload.summary
    ),

  deleteEntry: (payload) =>
    entries.deleteEntry(payload.user_email, payload.project_name, payload.entry),

  deleteEntryById: (payload) =>
    entries.deleteEntryById(payload.user_email, payload.entry_id),

  // Projects
  addProject: (payload) =>
    project.addProject(payload.user_email, payload.project_name, payload.description),

  editProjectName: (payload) =>
    project.editProjectName(
      payload.user_email,
      payload.new_project_name,
      payload.old_project_name
    ),

  deleteProject: (payload) =>
    project.deleteProject(payload.user_email, payload.project_name),

  // Archives
  archiveProject: (payload) =>
    archives.archiveProject(payload.user_email, payload.project_name),

  unarchiveProject: (payload) =>
    archives.unarchiveProject(payload.user_email, payload.project_name),

  archiveEntry: (payload) =>
    archives.archiveEntry(payload.user_email, payload.project_name, payload.entry_id),

  unarchiveEntry: (payload) =>
    archives.unarchiveEntry(payload.user_email, payload.project_name, payload.entry_id),

  // Priority
  setPriority: (payload) =>
    priority.setPriority(
      payload.user_email,
      payload.priorityValue,
      payload.project_name,
      payload.entry_id
    ),

  // Profile
  updateUsername: (payload) =>
    profile.updateUsername(payload.email, payload.username),

  updateName: (payload) =>
    profile.updateName(payload.email, payload.new_name),

  updateAvatar: (payload) =>
    profile.updateAvatar(payload.email, payload.avatarUrl),
};

/**
 * Dispatch a queued action by calling its corresponding function.
 * @param {object} queueEntry - The queue entry with action and payload
 * @returns {Promise<any>} The result of the action
 * @throws {Error} If the action is unknown
 */
export async function dispatchAction(queueEntry) {
  const handler = actionMap[queueEntry.action];
  if (!handler) {
    throw new Error(`Unknown action: ${queueEntry.action}`);
  }
  return handler(queueEntry.payload);
}

/**
 * Get a list of all registered action names.
 * @returns {string[]} Array of action names
 */
export function getRegisteredActions() {
  return Object.keys(actionMap);
}
