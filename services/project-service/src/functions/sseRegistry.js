/**
 * SSE connection registry for real-time event streaming.
 *
 * Maintains a map of userEmail → Set of SSE response objects so that
 * backend handlers can push events to connected frontend clients
 * the moment data is ready (e.g. after AI parsing completes).
 */

// Map<userEmail, Set<response>>
const connections = new Map();

/**
 * Register an SSE connection for a user.
 * @param {string} email - The user's email
 * @param {import('express').Response} res - The Express response object
 */
export function registerConnection(email, res) {
  if (!connections.has(email)) {
    connections.set(email, new Set());
  }
  connections.get(email).add(res);
  console.log(`[SSE] Client connected: ${email} (total: ${connections.get(email).size})`);
}

/**
 * Remove an SSE connection for a user.
 * @param {string} email - The user's email
 * @param {import('express').Response} res - The Express response object
 */
export function removeConnection(email, res) {
  const set = connections.get(email);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      connections.delete(email);
    }
  }
  console.log(`[SSE] Client disconnected: ${email}`);
}

/**
 * Send an SSE event to all connections for a user.
 * @param {string} email - The user's email
 * @param {string} event - The event name
 * @param {object} data - The data to send (will be JSON-stringified)
 */
export function sendToUser(email, event, data) {
  const set = connections.get(email);
  if (!set || set.size === 0) {
    console.log(`[SSE] No connections for ${email}, skipping event ${event}`);
    return 0;
  }

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;

  for (const res of set) {
    try {
      res.write(payload);
      sent++;
    } catch (err) {
      console.warn(`[SSE] Failed to write to client for ${email}:`, err.message);
      // Remove dead connection
      set.delete(res);
    }
  }

  if (set.size === 0) {
    connections.delete(email);
  }

  console.log(`[SSE] Sent event "${event}" to ${sent} client(s) for ${email}`);
  return sent;
}

/**
 * Get the number of active connections for a user.
 * @param {string} email - The user's email
 * @returns {number}
 */
export function getConnectionCount(email) {
  const set = connections.get(email);
  return set ? set.size : 0;
}

/**
 * Get total number of active connections across all users.
 * @returns {number}
 */
export function getTotalConnections() {
  let total = 0;
  for (const set of connections.values()) {
    total += set.size;
  }
  return total;
}

/**
 * Reset all connections. For testing only.
 */
export function _resetRegistry() {
  connections.clear();
}
