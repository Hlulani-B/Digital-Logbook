import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

/*
  entryPins
  ---------
  Private, per-page pinning for entries.

  Pins used to live inside the entry payload as a reserved `_pinned` key, so a
  pin made anywhere showed up everywhere and only "stuck" after a successful
  server round-trip. Pins are a per-page convenience, not entry data, so they
  now live in localStorage keyed by user + page scope:

    'dashboard'         — the main page
    'entries'           — the All Entries page (and its Kanban)
    'project:<name>'    — one individual project page

  Pinning on one page never affects another, and toggling is instant and
  offline-safe because nothing is written back to the entry.
*/

export type PinScope = 'dashboard' | 'entries' | `project:${string}`;

/** Scope for one individual project page. */
export function projectPinScope(projectName: string): PinScope {
  return `project:${projectName}`;
}

const KEY_PREFIX = 'dl_entry_pins';

const EMPTY_PINS: ReadonlySet<string> = new Set();

/** Decoded pin sets, keyed by storage key. */
const cache = new Map<string, Set<string>>();
/** Listeners per storage key — every mounted pin consumer re-renders on change. */
const listeners = new Map<string, Set<() => void>>();

function storageKey(email: string, scope: PinScope): string {
  return `${KEY_PREFIX}_${email}_${scope}`;
}

function emit(key: string) {
  const subs = listeners.get(key);
  if (!subs) return;
  for (const cb of [...subs]) cb();
}

// Cross-tab sync: another tab's pin change invalidates the cache and notifies.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key || !event.key.startsWith(`${KEY_PREFIX}_`)) return;
    cache.delete(event.key);
    emit(event.key);
  });
}

/** Pin ids for one user + page scope. Never shared between scopes. */
export function readPins(email: string | undefined, scope: PinScope): ReadonlySet<string> {
  if (!email) return EMPTY_PINS;
  const key = storageKey(email, scope);
  const hit = cache.get(key);
  if (hit) return hit;

  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) ids = parsed.map((id) => String(id));
    }
  } catch {
    ids = [];
  }
  const set = new Set(ids);
  cache.set(key, set);
  return set;
}

/** Flip one entry's pin in a scope and return the new set. Synchronous. */
export function toggleEntryPin(
  email: string,
  scope: PinScope,
  entryId: string | number
): ReadonlySet<string> {
  const key = storageKey(email, scope);
  const next = new Set(readPins(email, scope));
  const id = String(entryId);
  if (next.has(id)) next.delete(id);
  else next.add(id);

  cache.set(key, next);
  try {
    localStorage.setItem(key, JSON.stringify([...next]));
  } catch {
    /* Private mode / quota — the in-memory set still updates this session. */
  }
  emit(key);
  return next;
}

/** Subscribe to pin changes for one user + scope. Returns an unsubscribe. */
export function subscribeEntryPins(
  email: string | undefined,
  scope: PinScope,
  cb: () => void
): () => void {
  if (!email) return () => {};
  const key = storageKey(email, scope);
  let subs = listeners.get(key);
  if (!subs) {
    subs = new Set();
    listeners.set(key, subs);
  }
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export interface EntryPinApi {
  /** Ids currently pinned on this page. */
  pinned: ReadonlySet<string>;
  isPinned: (entryId: string | number) => boolean;
  /** Flip a pin. Returns the entry's new pinned state. */
  togglePin: (entryId: string | number) => boolean;
}

/** Subscribe to one page's pins. */
export function useEntryPins(email: string | undefined, scope: PinScope): EntryPinApi {
  const [, forceRender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!email) return;
    return subscribeEntryPins(email, scope, forceRender);
  }, [email, scope]);

  const pinned = email ? readPins(email, scope) : EMPTY_PINS;

  const isPinned = useCallback((entryId: string | number) => pinned.has(String(entryId)), [pinned]);

  const togglePin = useCallback(
    (entryId: string | number) => {
      if (!email) return false;
      const next = toggleEntryPin(email, scope, entryId);
      return next.has(String(entryId));
    },
    [email, scope]
  );

  return useMemo(() => ({ pinned, isPinned, togglePin }), [pinned, isPinned, togglePin]);
}

const PinScopeContext = createContext<EntryPinApi | null>(null);

/**
 * Makes one page's pins available to every descendant (cards, checklist,
 * board, table, kanban). Pages without a provider simply show no pin state —
 * which is what keeps each page's pins private.
 */
export function PinScopeProvider({
  email,
  scope,
  children,
}: {
  email: string | undefined;
  scope: PinScope;
  children: ReactNode;
}) {
  const api = useEntryPins(email, scope);
  return <PinScopeContext.Provider value={api}>{children}</PinScopeContext.Provider>;
}

/** The enclosing page's pin controls, or null outside a provider. */
export function useEntryPinScope(): EntryPinApi | null {
  return useContext(PinScopeContext);
}
