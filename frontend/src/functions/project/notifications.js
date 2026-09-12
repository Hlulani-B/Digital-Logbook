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
