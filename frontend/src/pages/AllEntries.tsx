import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ProfileMenu } from '@/components/ProfileMenu';
import { SettingsPanel } from '@/components/SettingsPanel';
import { QuickEntryBar } from '@/components/QuickEntryBar';
import { addProject, getProjectsByEmail } from '@/functions/project/project.js';
import { addField } from '@/functions/project/fields.js';
import { sortUnarchivedEntries } from '@/functions/project/entries.js';
import { setPriority } from '@/functions/project/priority.js';
import { getProfile } from '@/functions/profile/profile.js';
import { checkUser } from '@/functions/profile/login.js';
import { cacheGet, cacheSet, CACHE_STORES } from '@/lib/cache';
import { EntryBox } from '@/pages/NewEntry';
import { ChecklistView } from '@/Templates/EntryTemplates/EntryChecklist';
import EntriesByDueDateBoard from '@/Templates/ProjectTemplates/EntriesByDueDateBoard';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';
import VoiceFeature from '@/pages/VoiceFeature';
import { askAI } from '@/functions/ai.js';
import { getToneInstruction } from '@/functions/tone';
import { getAiMessagesEnabled } from '@/functions/aiMessages';
import { FiArchive } from 'react-icons/fi';

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

function parseAIResponse(response: string): string {
  try {
    const parsed = JSON.parse(response);
    if (typeof parsed === 'string') return parsed;
    if (typeof parsed === 'object' && parsed !== null) {
      for (const key of ['message', 'instruction', 'response', 'text', 'content', 'reply']) {
        if (typeof parsed[key] === 'string') return parsed[key];
      }
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string') return val;
      }
    }
    return response;
  } catch {
    return response;
  }
}

export function AllEntriesPage() {
  const { user, signOut, deleteAccount, resetPassword } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'preferences' | 'account'>('profile');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('date');

  // Display mode: cards, checklist, board, or table
  const [displayMode, setDisplayMode] = useState<'cards' | 'checklist' | 'board' | 'table'>('cards');

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false);

  // Voice recorder
  const [voiceOpen, setVoiceOpen] = useState(false);

  // AI-generated messages
  const [aiEmptyMessage, setAiEmptyMessage] = useState('No entries to show right now.');
  const [aiPlaceholder, setAiPlaceholder] = useState('What are you working on?');

  // New project modal
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [projectFields, setProjectFields] = useState<{ field_name: string; data_type: 'text' | 'number' | 'date' | 'boolean'; is_required: boolean }[]>([]);

  // Project settings panel
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

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
      const cachedEntries = await cacheGet(CACHE_STORES.ENTRIES);
      const cachedProjects = await cacheGet(CACHE_STORES.PROJECTS);
      if (cachedEntries) setEntries(cachedEntries as Entry[]);
      if (cachedProjects) setProjects(cachedProjects as Project[]);

      // Fetch fresh data
      const [projRes, entRes] = await Promise.all([
        getProjectsByEmail(email),
        cacheGet(CACHE_STORES.ENTRIES),
      ]);

      const projs = projRes?.data || projRes || [];
      const ents = entRes || [];

      setProjects(projs);
      setEntries(sortUnarchivedEntries(ents));

      // Update cache
      await cacheSet(CACHE_STORES.ENTRIES, ents);
      await cacheSet(CACHE_STORES.PROJECTS, projs);
    } catch (err) {
      console.error('[AllEntries] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => { loadData(); }, [loadData]);

  // User info
  const fullDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const preferredName = profileUsername?.trim() || fullDisplayName;
  const avatarUrl = profileAvatar || undefined;

  const openSettings = (tab: 'profile' | 'preferences' | 'account' = 'profile') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await signOut(); } catch {} finally { setLoggingOut(false); }
  };

  const handleSetPriority = async (entryId: string, priority: 'low' | 'medium' | 'high') => {
    if (!email) return;
    await setPriority(email, entryId, priority);
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

  // AI empty message
  useEffect(() => {
    if (!getAiMessagesEnabled()) return;
    if (!loading && filteredEntries.length === 0 && !searchQuery) {
      (async () => {
        const tone = getToneInstruction();
        const result = await askAI(
          `Generate a motivating message for when there are no entries to show. Make it 3-4 sentences long. If the tone is casual or cynical, roast the user playfully and be funny. ${tone}`
        );
        if (result?.response) {
          setAiEmptyMessage(parseAIResponse(result.response));
        }
      })();
    }
  }, [loading, filteredEntries.length, searchQuery]);

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

  // Close drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setFabOpen(false);
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="dash-layout">
      <div className={drawerOpen ? 'drawer-backdrop' : 'd-none'} onClick={() => setDrawerOpen(false)} />

      <nav className="dash-nav">
        <div className="dash-nav-inner">
          <div className="nav-left-group">
            <button className="nav-icon-btn" onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="nav-logo-badge">
              <span>DL</span>
            </div>
          </div>

          <div className="nav-right-group">
            <div className="nav-user">
              <ProfileMenu
                displayName={preferredName}
                email={user?.email || ''}
                avatarUrl={avatarUrl}
                onManageProfile={() => openSettings('profile')}
                onSettings={() => openSettings('preferences')}
                onSignOut={handleLogout}
                signingOut={loggingOut}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Drawer */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
      <aside className={`drawer ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">Navigation</span>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="drawer-content">
          <button className={`drawer-item`} onClick={() => { window.location.href = '/dashboard'; setDrawerOpen(false); }}>
            Dashboard
          </button>
          <button className={`drawer-item active`} onClick={() => { setDrawerOpen(false); }}>
            My Entries
          </button>
          <button className={`drawer-item`} onClick={() => { window.location.href = '/calendar'; setDrawerOpen(false); }}>
            Calendar
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-header-section">
          <h1 className="dash-title">My Entries</h1>
          <p className="dash-subtitle">All your tasks in one place</p>
        </div>

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
            <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)' }} />
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
                  {searchQuery ? `No entries match "${searchQuery}". Try a different search term.` : aiEmptyMessage}
                </p>
              </div>
            ) : displayMode === 'checklist' ? (
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
            ) : displayMode === 'board' ? (
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
            ) : displayMode === 'table' ? (
              <ProjectTaskTable
                rows={filteredEntries}
                viewMode="entry"
                onUpdate={async (id: string) => {
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

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
        onProfileUpdated={() => {
          loadData();
          getProfile(email).then((res) => {
            const data = res?.data || res;
            if (data?.avatar_url) setProfileAvatar(data.avatar_url);
          });
        }}
        onDeleteAccount={async () => {
          try {
            await deleteAccount();
            await signOut();
          } catch (err) {
            console.error('Delete account failed:', err);
          }
        }}
        onResetPassword={async () => {
          if (!user?.email) return;
          try {
            await resetPassword(user.email);
          } catch (err) {
            console.error('Password reset failed:', err);
          }
        }}
      />
    </div>
  );
}
