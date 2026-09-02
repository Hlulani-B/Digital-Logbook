/**
 * React hook that connects SSE events to IndexedDB cache and UI updates.
 *
 * When the backend finishes parsing a natural language entry, it pushes
 * the structured data via SSE. This hook listens for those events and:
 * 1. Writes the new entry data straight into IndexedDB
 * 2. Calls the provided onEntry callback so the UI can update immediately
 *
 * Usage:
 *   useSSEEntries({ onEntry: (data) => refetchEntries() });
 */

import { useEffect, useRef } from 'react';
import { connectSSE, onSSEEvent } from '@/lib/sse';
import { CACHE_STORES, cacheDelete } from '@/lib/cache';
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

      if (data.multi && data.results) {
        // Multi-entry: invalidate all-entries and projects cache
        await cacheDelete(CACHE_STORES.ALL_ENTRIES, email);
        await cacheDelete(CACHE_STORES.PROJECTS, email);

        // Invalidate entries cache for each affected project
        const allEntries = [
          ...(data.results.old || []),
          ...(data.results.new || []),
        ];
        for (const e of allEntries) {
          if (e.project_name) {
            await cacheDelete(CACHE_STORES.ENTRIES, `${email}:${e.project_name}`);
          }
        }
      } else if (data.project) {
        // Single entry: invalidate specific cache keys
        const cacheKey = `${email}:${data.project}`;
        await cacheDelete(CACHE_STORES.ENTRIES, cacheKey);
        await cacheDelete(CACHE_STORES.ALL_ENTRIES, email);

        // If a new project was created, invalidate projects cache too
        if (data.created_new_project) {
          await cacheDelete(CACHE_STORES.PROJECTS, email);
        }
      }

      // Notify caller so UI can update
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
