import { request, PROJECT_URL } from '@/lib/api';

/**
 * Fetch the user's notification feed (due-soon / overdue) plus the
 * unread count for the bell badge. Not cached locally — notifications
 * are time-sensitive, so the bell polls this directly.
 */
export async function getNotifications(email) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({ function: 'get', values: { email } }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[getNotifications] Failed:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Full notification history for the /notifications page — read and
 * unread rows, newest first, paginated. `total` supports a
 * "showing X of Y" / load-more UI. Optional filters for unread-only
 * and type (due_soon / overdue).
 */
export async function getNotificationHistory(email, limit = 50, offset = 0, filters = {}) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({
        function: 'history',
        values: { email, limit, offset, ...filters },
      }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[getNotificationHistory] Failed:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationRead(email, id) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({ function: 'markRead', values: { email, id } }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[markNotificationRead] Failed:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Mark every notification in the user's feed as read.
 */
export async function markAllNotificationsRead(email) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({ function: 'markAllRead', values: { email } }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[markAllNotificationsRead] Failed:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Snooze a notification — hides it until the snooze expires, then it
 * re-appears as unread. Duration: '1h', '4h', or 'tomorrow'.
 */
export async function snoozeNotification(email, id, duration) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({ function: 'snooze', values: { email, id, duration } }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[snoozeNotification] Failed:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Dismiss a notification — removes it from all feeds without marking
 * the underlying entry as done. Row is pruned after 30 days.
 */
export async function dismissNotification(email, id) {
  try {
    const result = await request(`${PROJECT_URL}/service/notifications`, {
      method: 'POST',
      body: JSON.stringify({ function: 'dismiss', values: { email, id } }),
      timeoutMs: 30_000,
    });
    return result;
  } catch (err) {
    console.error('[dismissNotification] Failed:', err);
    return { success: false, message: err.message };
  }
}
