/**
 * Per-user preferences — a small synchronous key/value store backed by the
 * local SQLite `user_preferences` table (see lib/cache.js), keyed by the
 * logged-in user's email so a preference set on a shared browser/device never
 * leaks to the next account.
 *
 * The in-memory snapshot is what makes getPref() usable synchronously (theme
 * init runs before React mounts), while setPref() updates the snapshot and
 * fires PREFERENCES_CHANGED_EVENT synchronously, then persists the whole row
 * in the background. AuthContext drives the lifecycle: initPreferences(email)
 * on sign-in and session restore, resetPreferences() on sign-out — the stored
 * row itself is wiped by clearUserCache at the same time, so the next person
 * on this device starts from defaults.
 */

import { useSyncExternalStore } from 'react';
import { CACHE_STORES, getSharedDB, persistDB } from '@/lib/cache.js';

/** Fired (same tab) whenever the active preference snapshot changes. */
export const PREFERENCES_CHANGED_EVENT = 'dl-preferences-changed';

// Legacy shared localStorage key from before preferences became per-user. It
// is migrated into the signing-in user's row once, then consumed so a later
// account on this device never inherits it.
const LEGACY_AI_MESSAGES_KEY = 'dl_ai_messages';

// UPSERT rather than INSERT OR REPLACE: the row is keyed by user_email, and
// "INSERT OR REPLACE" would delete-and-recreate it on every save.
const UPSERT_SQL = `INSERT INTO ${CACHE_STORES.USER_PREFERENCES} (user_email, data, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(user_email) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at;`;

type Preferences = Record<string, unknown>;

// Defaults for keys whose consumers cast the hook result without a runtime
// fallback (sort controls read `usePref(key) as 'priority' | 'date'`), so an
// unset preference still behaves like the UI's documented default.
const DEFAULT_PREFERENCES: Preferences = {
  allentries_sort_by: 'date',
  dashboard_sort_by: 'date',
};

// Snapshot of the active user's preferences. Replaced wholesale by
// initPreferences/resetPreferences and mutated key-by-key by setPref; values
// are primitives (theme strings, booleans, view names), so subscribers can
// compare snapshots by value.
let prefs: Preferences = {};
let currentUserEmail: string | null = null;

function notify() {
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
}

function readPref(key: string): unknown {
  return key in prefs ? prefs[key] : DEFAULT_PREFERENCES[key];
}

/**
 * Read a preference synchronously from the active user's snapshot.
 * Returns undefined for keys that were never set — callers apply defaults.
 */
export function getPref(key: string): unknown {
  return readPref(key);
}

/**
 * Update a preference. The snapshot and change event are synchronous so open
 * surfaces react immediately; the SQLite row write happens in the background
 * (each write stores the full snapshot, so the newest one wins).
 */
export async function setPref(key: string, value: unknown): Promise<void> {
  prefs[key] = value;
  notify();
  await persistSnapshot();
}

async function persistSnapshot(): Promise<void> {
  if (!currentUserEmail) {
    // Nobody signed in yet (e.g. a pre-login theme change): memory only —
    // there is no row to attribute the preference to.
    return;
  }
  try {
    const db = await getSharedDB();
    db.run(UPSERT_SQL, [currentUserEmail, JSON.stringify(prefs), Date.now()]);
    persistDB(db);
  } catch (err) {
    console.warn('[Preferences] Failed to persist preference:', err);
  }
}

/**
 * Load the given user's preference row into the snapshot and make them the
 * active account. Fires the change event so every listener re-reads.
 */
export async function initPreferences(email: string): Promise<void> {
  let loaded: Preferences = {};
  try {
    const db = await getSharedDB();
    const result = db.exec(
      `SELECT data FROM ${CACHE_STORES.USER_PREFERENCES} WHERE user_email = ?`,
      [email]
    );
    if (result.length > 0 && result[0].values.length > 0) {
      const raw = result[0].values[0][0];
      if (typeof raw === 'string') {
        loaded = (JSON.parse(raw) as Preferences | null) ?? {};
      }
    }
  } catch (err) {
    console.warn('[Preferences] Failed to load preferences for user:', err);
  }

  // One-time migration of the legacy shared key: fold it into this account's
  // preferences unless they already hold a newer choice, and consume the key
  // so it can never be re-applied for anyone else on this device.
  const legacyValue = localStorage.getItem(LEGACY_AI_MESSAGES_KEY);
  if (legacyValue !== null) {
    localStorage.removeItem(LEGACY_AI_MESSAGES_KEY);
    if (loaded['ai_messages_enabled'] === undefined) {
      loaded['ai_messages_enabled'] = legacyValue !== 'false';
    }
    currentUserEmail = email;
    prefs = loaded;
    notify();
    await persistSnapshot();
    return;
  }

  currentUserEmail = email;
  prefs = loaded;
  notify();
}

/**
 * Drop back to defaults (sign-out / account switch). Clears only the
 * in-memory snapshot — clearing the stored row is clearUserCache's job, so
 * signing back in still finds the user's saved choices.
 */
export function resetPreferences(): void {
  currentUserEmail = null;
  prefs = {};
  notify();
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange);
}

/**
 * Reactive read of a preference — components using this hook re-render
 * whenever the active snapshot changes (setPref, sign-in, sign-out).
 */
export function usePref(key: string): unknown {
  return useSyncExternalStore(
    subscribe,
    () => readPref(key),
    () => readPref(key)
  );
}
