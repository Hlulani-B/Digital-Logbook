import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import { QuickEntryBar } from '@/components/QuickEntryBar';
import { getProjectsByEmail } from '@/functions/project/project.js';
import { sortUnarchivedEntries } from '@/functions/project/entries.js';
import { setPriority } from '@/functions/project/priority.js';
import { checkUser } from '@/functions/profile/login.js';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { EntryBox } from '@/pages/NewEntry';
import { ChecklistView } from '@/Templates/EntryTemplates/EntryChecklist';
import EntriesByDueDateBoard from '@/Templates/ProjectTemplates/EntriesByDueDateBoard';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';
import VoiceFeature from '@/pages/VoiceFeature';

type Entry = Record<string, unknown>;

export function AllEntriesPage() {
  const { user, signOut } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('date');

  // Display mode: cards, checklist, board, or table
  const [displayMode, setDisplayMode] = useState<'cards' | 'checklist' | 'board' | 'table'>('cards');

  // Data state
  const [entries, setEntries] = useState<Entry[]>([]);
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  // Voice recorder
  const [voiceOpen, setVoiceOpen] = useState(false);

  // AI placeholder
  const [aiPlaceholder, setAiPlaceholder] = useState('What are you working on?');

  const email = user?.email || '';

  // Safety check for deleted accounts
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await checkUser(email);
        if (!cancelled && result.exists && result.deleted) {
          try { await signOut(); } catch {}
        }
      } catch (err) {
        console.error('AllEntries deleted-check failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [email, signOut]);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      // Load from cache first
      const cachedEntries = await cacheGet(CACHE_STORES.ENTRIES, email);
      if (cachedEntries?.data) setEntries(cachedEntries.data as Entry[]);

      // Fetch fresh data
      const [projRes, entRes] = await Promise.all([
        getProjectsByEmail(email),
        sortUnarchivedEntries(email, null, 0),
      ]);

      const ents = entRes?.data || entRes || [];
      const projs = projRes?.data || projRes || [];
      setEntries(ents as Entry[]);
      setProjects(projs as Array<Record<string, unknown>>);

      // Update cache
      await cacheSet(CACHE_STORES.ENTRIES, email, { success: true, data: ents });
      await cacheSet(CACHE_STORES.PROJECTS, email, { success: true, data: projs });
    } catch (err) {
      console.error('[AllEntries] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSetPriority = async (entryId: string, projectName: string, priorityValue: string) => {
    if (!email) return;
    await setPriority(email, entryId, projectName, priorityValue);
    loadData();
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const summary = (e.summary as string) || '';
        const project = (e.project_name as string) || '';
        return summary.toLowerCase().includes(q) || project.toLowerCase().includes(q);
      });
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

    return filtered;
  }, [entries, searchQuery, sortBy]);

  // AI placeholder
  useEffect(() => {
    const placeholders = [
      'What are you working on?',
      'What did you just finish?',
      'Working on anything exciting?',
      "What's your current task?",
      'Tell me about your progress...',
    ];
    setAiPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
  }, []);

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      <NavBar
        projects={projects}
        entries={entries}
        activeView="all"
      />

      <main className="dash-main">
        <Header title="My Entries" entries={entries} projects={projects} />

        {/* Search bar */}
        <div className="feed-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Filter entries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="feed-search-input"
          />
        </div>

        {/* Display mode + Sort controls */}
        <div className="feed-controls-row">
          <div className="feed-view-toggle">
            <button className={`feed-view-btn ${displayMode === 'cards' ? 'active' : ''}`} onClick={() => setDisplayMode('cards')}>Cards</button>
            <button className={`feed-view-btn ${displayMode === 'checklist' ? 'active' : ''}`} onClick={() => setDisplayMode('checklist')}>Checklist</button>
            <button className={`feed-view-btn ${displayMode === 'board' ? 'active' : ''}`} onClick={() => setDisplayMode('board')}>Board</button>
            <button className={`feed-view-btn ${displayMode === 'table' ? 'active' : ''}`} onClick={() => setDisplayMode('table')}>Table</button>
          </div>
          <div className="feed-sort-group">
            <span className="feed-sort-label">Sort:</span>
            <button className={`sort-btn ${sortBy === 'date' ? 'active' : ''}`} onClick={() => setSortBy('date')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Date
            </button>
            <button className={`sort-btn ${sortBy === 'priority' ? 'active' : ''}`} onClick={() => setSortBy('priority')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Priority
            </button>
          </div>
        </div>

        {/* Quick Entry Bar */}
        <QuickEntryBar
          onEntryCreated={() => loadData()}
          onVoiceOpen={() => setVoiceOpen(true)}
          placeholder={aiPlaceholder}
        />

        {/* Loading */}
        {loading && (
          <div className="feed-loading">
            <div className="animate-spin spinner-circle" style={{ width: 24, height: 24 }} />
            <p>Loading entries...</p>
          </div>
        )}

        {/* Entries feed */}
        {!loading && (
          <div className="entries-feed">
            {filteredEntries.length === 0 ? (
              <div className="empty-state animate-in">
                <div className="empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h2 className="empty-title">{searchQuery ? 'No results found' : 'No entries yet'}</h2>
                <p className="empty-desc">
                  {searchQuery ? `No entries match "${searchQuery}". Try a different search term.` : 'No entries to show right now.'}
                </p>
              </div>
            ) : displayMode === 'checklist' ? (
              <div className="allentries-checklist-grid">
              <ChecklistView
                entries={filteredEntries.map((r) => ({
                  id: r.id as string,
                  user_email: r.user_email as string,
                  project_name: r.project_name as string,
                  summary: (r.summary as string) || null,
                  due_date: (r.due_date as string) || null,
                  status: (r.status as 'up_next' | 'in_motion' | 'done_and_dusted') || 'up_next',
                  entries: r.entries as Record<string, unknown> | string | null,
                  started_at: (r.started_at as string) || null,
                }))}
                onUpdated={() => loadData()}
                onDelete={() => loadData()}
              />
              </div>
            ) : displayMode === 'board' ? (
              <div className="allentries-board-grid">
              <EntriesByDueDateBoard
                entries={filteredEntries.map((r) => ({
                  id: r.id as string,
                  user_email: r.user_email as string,
                  project_name: r.project_name as string,
                  summary: (r.summary as string) || null,
                  due_date: (r.due_date as string) || null,
                  status: (r.status as 'up_next' | 'in_motion' | 'done_and_dusted') || 'up_next',
                  entries: r.entries as Record<string, unknown> | string | null,
                  started_at: (r.started_at as string) || null,
                }))}
                onUpdated={() => loadData()}
                onDelete={() => loadData()}
              />
              </div>
            ) : displayMode === 'table' ? (
              <ProjectTaskTable
                rows={filteredEntries}
                onUpdate={async () => {
                  await loadData();
                }}
                onDeleteSelected={async () => {
                  await loadData();
                }}
              />
            ) : (
              filteredEntries.map((row, i) => (
                <EntryBox
                  key={`entry-${row.id || i}`}
                  entry={row as any}
                  onUpdated={() => loadData()}
                  onPriorityChanged={handleSetPriority}
                  onDelete={() => loadData()}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Voice Feature */}
      {voiceOpen && <VoiceFeature onClose={() => setVoiceOpen(false)} onEntryCreated={() => { loadData(); setVoiceOpen(false); }} />}
    </div>
  );
}
