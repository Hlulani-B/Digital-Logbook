/**
 * Supabase Keep-Alive Daemon
 *
 * Supabase free-tier projects are paused after prolonged inactivity.
 * This daemon periodically inserts a row into the `health_ping` table
 * and immediately deletes it, keeping the database active.
 *
 * The daemon runs once every 12 hours (configurable via PING_INTERVAL_MS).
 * Each ping:
 *   1. Ensures the health_ping table exists (idempotent CREATE TABLE)
 *   2. INSERTs "hello hlulani" with a timestamp
 *   3. DELETEs the row immediately after
 *
 * This is a lightweight operation — one INSERT + one DELETE every 12 hours.
 */

import pool from '../db.js';

// Default: every 12 hours (Supabase pauses after 7 days, so 12h is very safe)
const DEFAULT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const PING_MESSAGE = 'hello hlulani';

let timer = null;
let running = false;

/**
 * Ensure the health_ping table exists.
 * This is idempotent — safe to call on every ping.
 */
async function ensureTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.health_ping (
      id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      message     TEXT        NOT NULL DEFAULT 'hello hlulani',
      pinged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Execute a single ping: insert "hello hlulani", then delete it.
 * @returns {object} Result with success status and details
 */
export async function ping() {
  if (!pool) {
    console.warn('[Daemon] No database pool available, skipping ping');
    return { success: false, reason: 'no_pool' };
  }

  try {
    // Ensure table exists (idempotent)
    await ensureTable();

    // Insert the ping
    const insertResult = await pool.query(
      `INSERT INTO public.health_ping (message) VALUES ($1) RETURNING id, message, pinged_at`,
      [PING_MESSAGE]
    );
    const row = insertResult.rows[0];

    // Delete the ping immediately
    await pool.query(`DELETE FROM public.health_ping WHERE id = $1`, [row.id]);

    console.log(`[Daemon] Ping successful: id=${row.id}, message="${row.message}", at=${row.pinged_at}`);
    return { success: true, id: row.id, message: row.message, pinged_at: row.pinged_at };
  } catch (err) {
    console.error('[Daemon] Ping failed:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Start the daemon. Runs a ping immediately, then on the configured interval.
 * @param {number} [intervalMs] - Override interval (default: 12 hours)
 */
export function startDaemon(intervalMs) {
  const interval = intervalMs || parseInt(process.env.PING_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;

  if (running) {
    console.warn('[Daemon] Already running, skipping start');
    return;
  }

  running = true;
  console.log(`[Daemon] Starting — ping every ${interval / 1000}s (${interval / 3600000}h)`);

  // Run first ping immediately
  ping();

  // Schedule recurring pings
  timer = setInterval(() => {
    ping();
  }, interval);

  // Don't keep the process alive just for the daemon (allows graceful shutdown)
  if (timer.unref) {
    timer.unref();
  }
}

/**
 * Stop the daemon.
 */
export function stopDaemon() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  console.log('[Daemon] Stopped');
}

/**
 * Check if the daemon is currently running.
 * @returns {boolean}
 */
export function isDaemonRunning() {
  return running;
}

/**
 * Get the daemon's configuration (interval, message).
 * @returns {object}
 */
export function getDaemonConfig() {
  const interval = parseInt(process.env.PING_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
  return {
    intervalMs: interval,
    intervalHours: interval / 3600000,
    message: PING_MESSAGE,
    running,
  };
}
