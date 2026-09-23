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
import * as notes from '../functions/project/notes';
import { addFieldSync, editFieldSync } from '../functions/project/fields';

/**
 * Map of action names to their handler functions.
 * Each handler receives the payload object and calls the appropriate function.
 */
const actionMap = {
  // Entries — replay uses the server-only variants: the optimistic row is
  // already on screen, so re-running the public function would append a second
  // one and return before the POST had been retried.
  addEntry: (payload) => entries.addEntrySync(payload),

  updateEntry: (payload) => entries.updateEntrySync(payload),

  deleteEntry: (payload) =>
    entries.deleteEntry(payload.user_email, payload.project_name, payload.entry),

  deleteEntryById: (payload) => entries.deleteEntryById(payload.user_email, payload.entry_id),

  // Notes — without these the dispatcher threw "Unknown action" for every
  // offline note, and the queue processor dropped it after MAX_ATTEMPTS, so a
  // note created offline never reached the server and vanished on the next
  // refresh.
  addNote: (payload) => notes.addNoteSync(payload),

  updateNote: (payload) => notes.updateNoteSync(payload),

  deleteNote: (payload) => notes.deleteNoteSync(payload),

  // Projects
  addProject: (payload) =>
    project.addProject(payload.user_email, payload.project_name, payload.description),

  editProjectName: (payload) =>
    project.editProjectName(payload.user_email, payload.new_project_name, payload.old_project_name),

  deleteProject: (payload) => project.deleteProject(payload.user_email, payload.project_name),

  setProjectColor: (payload) =>
    project.setProjectColor(payload.user_email, payload.project_name, payload.color),

  // Archives
  archiveProject: (payload) => archives.archiveProject(payload.user_email, payload.project_name),

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

  // Fields — replay uses the server-only variants so a retry never re-queues.
  addField: (payload) => addFieldSync(payload),

  editField: (payload) => editFieldSync(payload),

  // Profile
  updateUsername: (payload) => profile.updateUsername(payload.email, payload.username),

  updateName: (payload) => profile.updateName(payload.email, payload.new_name),

  updateAvatar: (payload) => profile.updateAvatar(payload.email, payload.avatarUrl),
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
