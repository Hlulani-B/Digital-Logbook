/**
 * Queue Processor
 * 
 * Processes the offline action queue when connectivity is restored.
 * Executes actions in FIFO order, with retry logic and progress callbacks.
 */

import { getQueue, removeFromQueue, updateQueueEntry } from './offlineQueue';
import { dispatchAction } from './actionDispatcher';

const MAX_ATTEMPTS = 3;

/**
 * Process all pending actions in the offline queue.
 * Called when connectivity is restored.
 * 
 * @param {Function} onProgress - Callback for progress updates
 * @param {object} onProgress.progress - Progress object with type, action, message
 * @returns {Promise<object>} Summary of processing results
 */
export async function processQueue(onProgress) {
  // Don't process if offline
  if (!navigator.onLine) {
    console.log('[QueueProcessor] Offline, skipping queue processing');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    console.log('[QueueProcessor] Queue is empty');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`[QueueProcessor] Processing ${queue.length} queued actions`);
  onProgress?.({ type: 'start', total: queue.length });

  let succeeded = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      // Execute the action
      const result = await dispatchAction(entry);

      // Check if the action succeeded
      if (result?.success !== false) {
        // Success: remove from queue
        await removeFromQueue(entry.id);
        succeeded++;
        onProgress?.({
          type: 'success',
          action: entry.action,
          message: formatActionMessage(entry),
        });
      } else {
        // Action returned failure
        throw new Error(result?.message || 'Action failed');
      }
    } catch (error) {
      console.error(`[QueueProcessor] Action ${entry.action} failed:`, error);

      // Increment attempts
      entry.attempts = (entry.attempts || 0) + 1;

      if (entry.attempts >= MAX_ATTEMPTS) {
        // Max retries reached: remove from queue
        await removeFromQueue(entry.id);
        failed++;
        onProgress?.({
          type: 'failed',
          action: entry.action,
          message: `Failed after ${MAX_ATTEMPTS} attempts: ${formatActionMessage(entry)}`,
        });
      } else {
        // Update attempts counter, keep in queue for retry
        await updateQueueEntry(entry);
        onProgress?.({
          type: 'retry',
          action: entry.action,
          message: `Retry ${entry.attempts}/${MAX_ATTEMPTS}: ${formatActionMessage(entry)}`,
        });
      }
    }
  }

  onProgress?.({ type: 'complete', succeeded, failed });

  console.log(`[QueueProcessor] Done: ${succeeded} succeeded, ${failed} failed`);
  return { processed: queue.length, succeeded, failed };
}

/**
 * Format a human-readable message for an action.
 * @param {object} entry - Queue entry
 * @returns {string} Human-readable message
 */
function formatActionMessage(entry) {
  const { action, payload } = entry;
  const projectName = payload?.project_name;
  const email = payload?.user_email || payload?.email;

  const messages = {
    // Entries
    addEntry: projectName ? `Saved entry to ${projectName}` : 'Saved entry',
    updateEntry: projectName ? `Updated entry in ${projectName}` : 'Updated entry',
    deleteEntry: projectName ? `Deleted entry from ${projectName}` : 'Deleted entry',
    deleteEntryById: 'Deleted entry',

    // Projects
    addProject: projectName ? `Created project ${projectName}` : 'Created project',
    editProjectName: payload?.new_project_name
      ? `Renamed project to ${payload.new_project_name}`
      : 'Renamed project',
    deleteProject: projectName ? `Deleted project ${projectName}` : 'Deleted project',
    setProjectColor: projectName
      ? `Updated colour for ${projectName}`
      : 'Updated project colour',

    // Archives
    archiveProject: projectName ? `Archived ${projectName}` : 'Archived project',
    unarchiveProject: projectName ? `Unarchived ${projectName}` : 'Unarchived project',
    archiveEntry: projectName ? `Archived entry in ${projectName}` : 'Archived entry',
    unarchiveEntry: projectName ? `Unarchived entry in ${projectName}` : 'Unarchived entry',

    // Priority
    setPriority: projectName
      ? `Set priority in ${projectName}`
      : 'Set priority',

    // Fields (columns)
    addField: payload?.field_name
      ? projectName
        ? `Added column "${payload.field_name}" to ${projectName}`
        : `Added column "${payload.field_name}"`
      : 'Saved column',
    editField: payload?.field_name
      ? projectName
        ? `Updated column "${payload.field_name}" in ${projectName}`
        : `Updated column "${payload.field_name}"`
      : 'Updated column',

    // Profile
    updateUsername: email ? `Updated username for ${email}` : 'Updated username',
    updateName: email ? `Updated name for ${email}` : 'Updated name',
    updateAvatar: email ? `Updated avatar for ${email}` : 'Updated avatar',
  };

  return messages[action] || `${action} synced`;
}

/**
 * Check if there are pending actions in the queue.
 * @returns {Promise<boolean>} True if queue has pending actions
 */
export async function hasPendingActions() {
  const queue = await getQueue();
  return queue.length > 0;
}

/**
 * Get the count of pending actions.
 * @returns {Promise<number>} Number of pending actions
 */
export async function getPendingCount() {
  const queue = await getQueue();
  return queue.length;
}
