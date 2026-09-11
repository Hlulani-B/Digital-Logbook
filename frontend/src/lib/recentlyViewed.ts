/**
 * Tracks the last few entries ("tasks") the user has viewed in the app.
 *
 * A "view" is fired when the user opens an entry's detail surface — the notes
 * panel, or the checklist / entry card edit dialog. The Dashboard renders the
 * stored items as a "Recently viewed" quick-jump list.
 *
 * Storage shape: a JSON array of `RecentlyViewedEntry`, newest first, capped
 * at MAX_ITEMS. The list is deduplicated by entryId so re-viewing an entry
 * bubbles it to the top instead of creating a duplicate row.
 */

const STORAGE_KEY = 'recentlyViewedEntries.v1';
const MAX_ITEMS = 5;

export interface RecentlyViewedEntry {
  entryId: string;
  projectName: string;
  title: string;
  viewedAt: string; // ISO timestamp
}

function isRecentlyViewedEntry(value: unknown): value is RecentlyViewedEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.entryId === 'string' &&
    typeof v.projectName === 'string' &&
    typeof v.title === 'string' &&
    typeof v.viewedAt === 'string'
  );
}

export function getRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentlyViewedEntry).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function trackViewedEntry(input: {
  entryId: string;
  projectName: string;
  title: string;
}): void {
  if (typeof window === 'undefined') return;
  if (!input.entryId) return;
  const current = getRecentlyViewed();
  const next: RecentlyViewedEntry[] = [
    {
      entryId: input.entryId,
      projectName: input.projectName,
      title: input.title,
      viewedAt: new Date().toISOString(),
    },
    ...current.filter((c) => c.entryId !== input.entryId),
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('recentlyViewedChanged'));
  } catch {
    /* storage full or blocked — silently ignore */
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('recentlyViewedChanged'));
  } catch {
    /* ignore */
  }
}
