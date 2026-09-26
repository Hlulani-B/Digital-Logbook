import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import { QuickEntryBar } from '@/components/QuickEntryBar';
import { EntrySearchBar } from '@/components/SearchFilters';
import { matchesTextQuery, pinFirst } from '@/lib/entryFilters';
import { setPriority } from '@/functions/project/priority.js';
import { checkUser } from '@/functions/profile/login.js';
import { cacheGet, cacheSubscribe, CACHE_STORES } from '@/lib/cache';
import { syncAllData } from '@/CacheFunctions';
import { trackCreatedEntry } from '@/lib/recentlyCreated';
import { EntryBox } from '@/pages/NewEntry';
import { ChecklistView } from '@/Templates/EntryTemplates/EntryChecklist';
import EntriesByDueDateBoard from '@/Templates/ProjectTemplates/EntriesByDueDateBoard';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';
import VoiceFeature from '@/pages/VoiceFeature';
import { type EntryPayload } from '@/lib/entryPayload';
import { buildProjectColorMap, resolveProjectColor } from '@/lib/projectColorMap';

type Entry = Record<string, unknown>;

interface ToolbarDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface ToolbarDropdownProps<T extends string> {
  value: T;
  options: Array<ToolbarDropdownOption<T>>;
  onChange: (value: T) => void;
}

/**
 * Compact toolbar dropdown (View / Sort style). Shows the active option on
 * the trigger and closes on outside click or Escape.
 */
function ToolbarDropdown<T extends string>({ value, options, onChange }: ToolbarDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="toolbar-dropdown" ref={rootRef}>
      <button
        type="button"
        className="toolbar-dropdown__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="toolbar-dropdown__value">{currentLabel}</span>
        <svg
          className="toolbar-dropdown__chevron"
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="toolbar-dropdown__menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`toolbar-dropdown__option ${
                option.value === value ? 'is-active' : ''
              }`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AllEntriesPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state - persist in localStorage
  const [sortBy, setSortBy] = useState<'priority' | 'date'>(() => {
    const saved = localStorage.getItem('allentries-sort-by');
    if (saved === 'priority' || saved === 'date') return saved;
    return 'date';
  });

  useEffect(() => {
    localStorage.setItem('allentries-sort-by', sortBy);
  }, [sortBy]);

  // Display mode: cards, checklist, board, or table
  // Persist in localStorage so it survives refresh
  const [displayMode, setDisplayMode] = useState<'cards' | 'checklist' | 'board' | 'table'>(() => {
    const saved = localStorage.getItem('allentries-display-mode');
    if (saved === 'cards' || saved === 'checklist' || saved === 'board' || saved === 'table') {
      return saved;
    }
    return 'cards';
  });

  // Save display mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('allentries-display-mode', displayMode);
  }, [displayMode]);

  // Data state
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  // Voice recorder
  const [voiceOpen, setVoiceOpen] = useState(false);

  // Static placeholder for quick entry (no AI) — kept in sync with the home page
  const aiPlaceholder = 'Capture quick entry';

  const email = user?.email || '';

  // Safety check for deleted accounts
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await checkUser(email);
        if (!cancelled && result.exists && result.deleted) {
          try {
            await signOut();
          } catch {}
        }
      } catch (err) {
        console.error('AllEntries deleted-check failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, signOut]);

  // Load data — read ONLY from IndexedDB. Mutations update it directly.
  // Guard against overlapping calls: mount effect + two cacheSubscribe
  // listeners + SSE onEntry can all fire loadData within the same tick.
  const loadSeq = useRef(0);

  const loadData = useCallback(async () => {
    if (!email) return;
    const seq = ++loadSeq.current;
    try {
      const [cachedEntries, cachedProjects] = await Promise.all([
        cacheGet(CACHE_STORES.ALL_ENTRIES, email),
        cacheGet(CACHE_STORES.PROJECTS, email),
      ]);
      if (seq !== loadSeq.current) return;
      // Render whatever is cached immediately (zero spinner). Projects are stored
      // under `.projects` by the sync layer but `.data` by some getters, so read
      // both shapes here the way Dashboard does.
      const applyRows = (
        eRow: Record<string, unknown> | null,
        pRow: Record<string, unknown> | null
      ) => {
        if (eRow?.data) {
          const next = (Array.isArray(eRow.data) ? eRow.data : []) as Entry[];
          // Never commit an empty list over a populated one — a concurrent read
          // can catch the row mid-invalidation and return [].
          setEntries((prev) => (next.length === 0 && prev.length > 0 ? prev : next));
        }
        const rawProjects = pRow?.data || pRow?.projects;
        if (rawProjects) {
          const next = (Array.isArray(rawProjects) ? rawProjects : []) as typeof projects;
          setProjects((prev) => (next.length === 0 && prev.length > 0 ? prev : next));
        }
      };

      applyRows(cachedEntries, cachedProjects);

      // A missing row (never synced, or just invalidated by a mutation/SSE event)
      // must be refilled from the server — independent of whether the other row
      // is present. Only fires when there is no optimistic row to clobber.
      const rowsMissing = !cachedEntries || !cachedProjects;
      if (rowsMissing) {
        if (!navigator.onLine) return;
        setLoading(true);
        // force: bypass the 10s throttle so an invalidated cache always refills.
        await syncAllData(email, { force: true });
        const [freshEntries, freshProjects] = await Promise.all([
          cacheGet(CACHE_STORES.ALL_ENTRIES, email),
          cacheGet(CACHE_STORES.PROJECTS, email),
        ]);
        if (seq !== loadSeq.current) return;
        applyRows(freshEntries, freshProjects);
      }
    } catch (err) {
      console.error('[AllEntries] loadData error:', err);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Shared reload ref for every subscription so a batched cache invalidation
  // (cacheDeleteMany) triggers exactly one reload, not one per store.
  const reload = useCallback(() => {
    void loadData();
  }, [loadData]);

  // Subscribe to cache changes — re-load when syncAllData writes new data
  useEffect(() => {
    if (!email) return;
    const unsubs = [
      cacheSubscribe(CACHE_STORES.ALL_ENTRIES, email, reload),
      cacheSubscribe(CACHE_STORES.PROJECTS, email, reload),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [email, reload]);

  const handleSetPriority = async (entryId: string, projectName: string, priorityValue: string) => {
    if (!email) return;
    await setPriority(email, priorityValue, projectName, entryId);
    loadData();
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Apply search filter — summary, project name and every field value
    if (searchQuery.trim()) {
      filtered = filtered.filter((e) => matchesTextQuery(e, searchQuery));
    }

    // Apply sort
    if (sortBy === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort((a, b) => {
        const pa = priorityOrder[(a.priority as 'high' | 'medium' | 'low') || 'medium'];
        const pb = priorityOrder[(b.priority as 'high' | 'medium' | 'low') || 'medium'];
        return pa - pb;
      });
    } else {
      filtered.sort((a, b) => {
        const da = new Date((a.due_date as string) || (a.created_at as string) || 0);
        const db = new Date((b.due_date as string) || (b.created_at as string) || 0);
        return db.getTime() - da.getTime();
      });
    }

    return pinFirst(filtered);
  }, [entries, searchQuery, sortBy]);

  const colorMap = useMemo(
    () => buildProjectColorMap(projects as Array<Record<string, unknown>>),
    [projects]
  );

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      <NavBar entries={entries} activeView="all" />

      <main className="dash-main">
        <Header title="My Entries" entries={entries} projects={projects} />

        {/* Search bar beside the AI quick-add bar */}
        <div className="search-ai-row">
          <EntrySearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search entries..."
          />

          {/* Quick Entry Bar */}
          <div className="search-ai-row__ai">
            <QuickEntryBar
              onEntryCreated={(info) => {
                loadData();
                // Track every created entry (single OR multi) in "Recently created".
                for (const item of info?.created ?? []) {
                  trackCreatedEntry(item);
                }
                // Navigate only when there's exactly one unambiguous target.
                if ((info?.created?.length ?? 0) === 1 && info?.projectName) {
                  navigate(`/project/${encodeURIComponent(info.projectName)}`);
                }
              }}
              onVoiceOpen={() => setVoiceOpen(true)}
              placeholder={aiPlaceholder}
            />
          </div>
        </div>

        {/* Page switcher: Entries / Projects */}
        <div className="page-switcher-row">
          <div
            className="feed-view-toggle"
            role="group"
            aria-label="Switch between entries and projects"
          >
            <button
              type="button"
              className="feed-view-btn active"
              aria-current="page"
              onClick={() => navigate('/entries')}
              title="Browse all entries"
            >
              Entries
            </button>
            <button
              type="button"
              className="feed-view-btn"
              onClick={() => navigate('/dashboard')}
              title="Back to projects"
            >
              Projects
            </button>
          </div>
        </div>

        {/* View + Sort controls */}
        <div className="feed-controls-row">
          <div className="feed-view-group">
            <span className="feed-view-label">View:</span>
            <ToolbarDropdown
              value={displayMode}
              onChange={setDisplayMode}
              options={[
                { value: 'cards', label: 'Cards' },
                { value: 'checklist', label: 'Checklist' },
                { value: 'board', label: 'Board' },
                { value: 'table', label: 'Table' },
              ]}
            />
            <div className="feed-sort-group">
              <span className="feed-sort-label">Sort:</span>
              <button
                className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`}
                onClick={() => setSortBy('date')}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Date
              </button>
              <button
                className={`sort-btn ${sortBy === 'priority' ? 'active' : ''}`}
                onClick={() => setSortBy('priority')}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
                Priority
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="feed-loading">
            <div className="animate-spin spinner-circle" style={{ width: 24, height: 24 }} />
            <p>Loading entries...</p>
          </div>
        )}

        {/* Entries feed */}
        {!loading && filteredEntries.length === 0 && (
          <div className="entries-feed">
            <div className="empty-state animate-in">
              <div className="empty-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h2 className="empty-title">{searchQuery ? 'No results found' : 'No entries yet'}</h2>
              <p className="empty-desc">
                {searchQuery
                  ? `No entries match "${searchQuery}". Try a different search term.`
                  : 'No entries to show right now.'}
              </p>
            </div>
          </div>
        )}
        {!loading && filteredEntries.length > 0 && displayMode === 'board' && (
          <div className="allentries-board-grid">
            <EntriesByDueDateBoard
              entries={filteredEntries.map((r) => ({
                id: r.id as string,
                user_email: r.user_email as string,
                project_name: r.project_name as string,
                summary: (r.summary as string) || null,
                due_date: (r.due_date as string) || null,
                status: (r.status as 'up_next' | 'in_motion' | 'done_and_dusted') || 'up_next',
                entries: r.entries as EntryPayload,
                started_at: (r.started_at as string) || null,
              }))}
              onUpdated={() => loadData()}
              onDelete={() => loadData()}
              colorMap={colorMap}
            />
          </div>
        )}
        {!loading && filteredEntries.length > 0 && displayMode === 'checklist' && (
          <div className="allentries-checklist-grid">
            <ChecklistView
              entries={filteredEntries.map((r) => ({
                id: r.id as string,
                user_email: r.user_email as string,
                project_name: r.project_name as string,
                summary: (r.summary as string) || null,
                due_date: (r.due_date as string) || null,
                status: (r.status as 'up_next' | 'in_motion' | 'done_and_dusted') || 'up_next',
                entries: r.entries as EntryPayload,
                started_at: (r.started_at as string) || null,
              }))}
              onUpdated={() => loadData()}
              onDelete={() => loadData()}
              colorMap={colorMap}
            />
          </div>
        )}
        {!loading && filteredEntries.length > 0 && displayMode === 'table' && (
          <ProjectTaskTable
            rows={filteredEntries}
            onUpdate={async () => {
              await loadData();
            }}
            onDeleteSelected={async () => {
              await loadData();
            }}
            colorMap={colorMap}
          />
        )}
        {!loading && filteredEntries.length > 0 && displayMode === 'cards' && (
          <div className="entries-feed">
            {filteredEntries.map((row, i) => (
              <EntryBox
                key={`entry-${row.id || i}`}
                entry={row as any}
                onUpdated={() => loadData()}
                onPriorityChanged={handleSetPriority}
                onDelete={() => loadData()}
                projectColor={resolveProjectColor(
                  (row.project_name as string) || '',
                  buildProjectColorMap(projects as Array<Record<string, unknown>>)
                )}
              />
            ))}
          </div>
        )}
      </main>

      {/* Voice Feature */}
      {voiceOpen && (
        <VoiceFeature
          onClose={() => setVoiceOpen(false)}
          onEntryCreated={(info) => {
            loadData();
            setVoiceOpen(false);
            // Mirror the QuickEntryBar behaviour: track every created entry.
            for (const item of info?.created ?? []) {
              trackCreatedEntry(item);
            }
          }}
        />
      )}
    </div>
  );
}
