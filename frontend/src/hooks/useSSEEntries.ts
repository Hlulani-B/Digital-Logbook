/**
 * React hook that connects SSE events to IndexedDB cache and UI updates.
 *
 * When the backend finishes parsing a natural language entry, it pushes
 * the structured data via SSE. This hook listens for those events and:
 * 1. Invalidates the affected IndexedDB rows in ONE batch (the parsed entry
 *    itself lives on the server, so we drop the stale local rows and let the
 *    next read refill them) and notifies each subscribed page exactly once
 * 2. Calls the provided onEntry callback for any caller-specific follow-up
 *
 * The batched invalidation is deliberate: firing a separate cacheDelete per
 * store made a single SSE event fan out into several concurrent page reloads,
 * which raced each other in IndexedDB. cacheDeleteMany collapses that to one
 * reload per subscribed page.
 *
 * Usage:
 *   useSSEEntries({ onEntry: (data) => refetchEntries() });
 */

import { useEffect, useRef } from 'react';
import { connectSSE, onSSEEvent } from '@/lib/sse';
import { CACHE_STORES, cacheDeleteMany } from '@/lib/cache';
import { useAuth } from '@/context/AuthContext';

interface SSEEntryData {
  success?: boolean;
  project?: string;
  fields?: Record<string, unknown>;
  priority?: string | null;
  due_date?: string | null;
  comment?: string | null;
  multi?: boolean;
  results?: {
    old?: Array<{ project_name: string; fields?: Record<string, unknown> }>;
    new?: Array<{ project_name: string; fields?: Record<string, unknown> }>;
  };
  created_new_project?: boolean;
  project_only?: boolean;
  summary?: string | null;
  error?: string;
}

interface UseSSEEntriesOptions {
  onEntry?: (data: SSEEntryData) => void;
  enabled?: boolean;
}

export function useSSEEntries({ onEntry, enabled = true }: UseSSEEntriesOptions = {}) {
  const { user } = useAuth();
  const onEntryRef = useRef(onEntry);
  onEntryRef.current = onEntry;

  useEffect(() => {
    // Only connect if user is logged in and SSE is enabled
    const email = user?.email;
    if (!email || !enabled) return;

    // Establish SSE connection
    connectSSE();

    // Listen for entry_parsed events
    const unsubParsed = onSSEEvent('entry_parsed', async (data: SSEEntryData) => {
      console.log('[useSSEEntries] entry_parsed received:', data);

      // Collect every stale row this event invalidates, then drop them in ONE
      // batched delete. cacheDeleteMany notifies each subscribed page exactly
      // once regardless of how many of these keys it watches, so the reload is
      // no longer fanned out into several concurrent, racing loadData() calls.
      const stale: Array<{ store: string; key: string }> = [];

      if (data.multi && data.results) {
        // Multi-entry: invalidate all-entries and projects cache
        stale.push({ store: CACHE_STORES.ALL_ENTRIES, key: email });
        stale.push({ store: CACHE_STORES.PROJECTS, key: email });

        // Invalidate entries cache for each affected project
        const allEntries = [...(data.results.old || []), ...(data.results.new || [])];
        for (const e of allEntries) {
          if (e.project_name) {
            stale.push({ store: CACHE_STORES.ENTRIES, key: `${email}:${e.project_name}` });
          }
        }
      } else if (data.project) {
        // Single entry: invalidate the per-project list and the all-entries rollup
        stale.push({ store: CACHE_STORES.ENTRIES, key: `${email}:${data.project}` });
        stale.push({ store: CACHE_STORES.ALL_ENTRIES, key: email });

        // If a new project was created, invalidate projects cache too
        if (data.created_new_project) {
          stale.push({ store: CACHE_STORES.PROJECTS, key: email });
        }
      }

      await cacheDeleteMany(stale);

      // Notify caller so UI can react to the specific payload (side effects only —
      // the data reload itself is driven by the batched cache invalidation above).
      if (onEntryRef.current) {
        onEntryRef.current(data);
      }
    });

    // Listen for entry_error events
    const unsubError = onSSEEvent('entry_error', (data: SSEEntryData) => {
      console.warn('[useSSEEntries] entry_error received:', data);
      // Notify caller of the error
      if (onEntryRef.current) {
        onEntryRef.current({ success: false, error: data.error });
      }
    });

    return () => {
      unsubParsed();
      unsubError();
      // Don't disconnect SSE on unmount — it's shared across the app
      // Only disconnect on sign-out (handled by AuthContext)
    };
  }, [user?.email, enabled]);
}
