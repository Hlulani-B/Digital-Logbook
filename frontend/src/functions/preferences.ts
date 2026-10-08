/**
 * Per-user preferences store backed by the local SQLite cache.
 *
 * Preferences are kept in the `user_preferences` table (one row per email,
 * `data` column holds a JSON object of key/value pairs).  The module exposes
 * both a synchronous in-memory API (`getPref` / `setPref`) for use inside
 * hooks and event handlers, and a React hook (`usePref`) built on
 * `useSyncExternalStore` so components re-render when a value changes.
 *
 * Initialisation is triggered by AuthContext when a user signs in; the row is
 * wiped on sign-out so the next account on a shared device starts from defaults.
 */

import { useSyncExternalStore } from 'react';
import { getSharedDB, CACHE_STORES, persistDB } from '@/lib/cache';

/** Window event fired whenever any preference value changes. */
export const PREFERENCES_CHANGED_EVENT = 'preferences-changed';

// ── In-memory snapshot (authoritative for reads) ────────────

let currentUserEmail: string | null = null;
let prefs: Record<string, unknown> = {};

const subscribers = new Set<() => void>();

function notify() {
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  subscribers.forEach((fn) => fn());
}

// ── DB helpers ──────────────────────────────────────────────

async function loadFromDB(email: string): Promise<Record<string, unknown>> {
  try {
    const db = await getSharedDB();
    const result = db.exec(
      `SELECT data FROM ${CACHE_STORES.USER_PREFERENCES} WHERE user_email = ?`,
      [email]
    );
    if (result.length > 0 && result[0].values.length > 0) {
      const raw = result[0].values[0][0];
      return typeof raw === 'string' ? JSON.parse(raw) : {};
    }
  } catch {
    // Table may not exist yet in very old snapshots; fall through to empty.
  }
  return {};
}

async function saveToDB(email: string, data: Record<string, unknown>): Promise<void> {
  try {
    const db = await getSharedDB();
    db.run(
      `INSERT OR REPLACE INTO ${CACHE_STORES.USER_PREFERENCES} (user_email, data, updated_at) VALUES (?, ?, ?)`,
      [email, JSON.stringify(data), Date.now()]
    );
    persistDB(db);
  } catch (err) {
    console.warn('[Preferences] Failed to persist:', err);
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Load (or create) the preference row for `email`.  Called by AuthContext on
 * sign-in; safe to call multiple times — subsequent calls simply re-read.
 */
export async function initPreferences(email: string): Promise<void> {
  currentUserEmail = email;
  prefs = await loadFromDB(email);
  notify();
}

/**
 * Return the current value for `key`, or `undefined` when not set.
 * Synchronous — reads from the in-memory snapshot.
 */
export function getPref(key: string): unknown {
  return prefs[key];
}

/**
 * Update `key` to `value`, persist to SQLite, and notify subscribers.
 * Returns a promise but callers typically fire-and-forget (`void setPref(...)`).
 */
export async function setPref(key: string, value: unknown): Promise<void> {
  prefs = { ...prefs, [key]: value };
  if (currentUserEmail) {
    await saveToDB(currentUserEmail, prefs);
  }
  notify();
}

/**
 * Clear the in-memory snapshot and (when possible) the DB row.  Called by
 * AuthContext on sign-out so the next user starts from defaults.
 */
export async function resetPreferences(): Promise<void> {
  const email = currentUserEmail;
  currentUserEmail = null;
  prefs = {};
  if (email) {
    try {
      const db = await getSharedDB();
      db.run(`DELETE FROM ${CACHE_STORES.USER_PREFERENCES} WHERE user_email = ?`, [email]);
      persistDB(db);
    } catch {
      // Best-effort; the in-memory wipe already happened.
    }
  }
  notify();
}

// ── React hook ──────────────────────────────────────────────

/**
 * Subscribe to a single preference value.  Re-renders the component whenever
 * that key changes (or when the active user changes via initPreferences /
 * resetPreferences).
 */
export function usePref(key: string): unknown {
  return useSyncExternalStore(
    (onStoreChange) => {
      subscribers.add(onStoreChange);
      return () => {
        subscribers.delete(onStoreChange);
      };
    },
    () => prefs[key],
    () => prefs[key]
  );
}
