/**
 * Tracks the last few entries ("tasks") the user has created in the app.
 *
 * A "created" event is fired when the user successfully creates a new entry
 * via quick add, manual add, or voice entry. The Dashboard renders the stored
 * items as a "Recently created" quick-jump list.
 *
 * Storage shape: a JSON array of `RecentlyCreatedEntry`, newest first, capped
 * at MAX_ITEMS. The list is deduplicated by entryId so re-creating doesn't
 * create duplicates.
 */

const STORAGE_KEY = 'recentlyCreatedEntries.v1';
const MAX_ITEMS = 5;

export interface RecentlyCreatedEntry {
  entryId: string;
  projectName: string;
  title: string;
  createdAt: string; // ISO timestamp
}

function isRecentlyCreatedEntry(value: unknown): value is RecentlyCreatedEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.entryId === 'string' &&
    typeof v.projectName === 'string' &&
    typeof v.title === 'string' &&
    typeof v.createdAt === 'string'
  );
}

export function getRecentlyCreated(): RecentlyCreatedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentlyCreatedEntry).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function trackCreatedEntry(input: {
  entryId: string;
  projectName: string;
  title: string;
}): void {
  if (typeof window === 'undefined') return;
  if (!input.entryId) return;
  const current = getRecentlyCreated();
  const next: RecentlyCreatedEntry[] = [
    {
      entryId: input.entryId,
      projectName: input.projectName,
      title: input.title,
      createdAt: new Date().toISOString(),
    },
    ...current.filter((c) => c.entryId !== input.entryId),
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('recentlyCreatedChanged'));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

export function clearRecentlyCreated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('recentlyCreatedChanged'));
  } catch {
    /* ignore */
  }
}
