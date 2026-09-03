import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ProfileMenu } from '@/components/ProfileMenu';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ProjectSettingsPanel } from '@/components/ProjectSettingsPanel';
import { AddEntry } from '@/pages/AddEntry';
import VoiceFeature from '@/pages/VoiceFeature';
import { EntryBox } from '@/pages/NewEntry';
import { sortUnarchivedEntries, updateEntry, deleteEntryById } from '@/functions/project/entries.js';
import { cacheGet, cacheSet, CACHE_STORES, cacheSubscribe } from '@/lib/cache';
import { setPriority } from '@/functions/project/priority.js';
import { getProjectsByEmail } from '@/functions/project/project.js';
import { getProfile } from '@/functions/profile/profile.js';
import { searchEntriesInProject } from '@/functions/project/search.js';
import { addNaturalLanguageEntry } from '@/functions/project/natural_language.js';
import { archiveProject } from '@/functions/project/archives.js';
import { getToneInstruction } from '@/functions/tone';
import { askAI } from '@/functions/ai.js';
import { getAiMessagesEnabled } from '@/functions/aiMessages';
import { FiMic, FiArchive } from 'react-icons/fi';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';

/** Parse AI response — handles JSON or plain text */
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

type Entry = Record<string, unknown>;

const PRIORITY_LABELS: Record<string, string> = {
  '0': 'Urgent and important',
  '1': 'Urgent but not important',
  '2': 'Not urgent, not important',
};

// Reverse map: friendly label → raw value (for dropdown display)
const PRIORITY_TO_RAW: Record<string, string> = Object.fromEntries(
  Object.entries(PRIORITY_LABELS).map(([k, v]) => [v, k]),
);

/** Normalize any priority value to the friendly label the DB expects */
function toFriendlyPriority(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  if (val === '3') return null;
  if (PRIORITY_LABELS[val]) return PRIORITY_LABELS[val]; // raw "0"→label
  return val; // already a friendly label
}

export function ProjectDetailPage() {
  const { projectName } = useParams<{ projectName: string }>();
  const navigate = useNavigate();
  const { user, signOut, resetPassword } = useAuth();
  const email = user?.email || '';

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'preferences' | 'account'>('profile');
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<{ project_name: string }[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  // Data
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // Sort
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('date');

  // IndexedDB-first entries loading — show cache immediately, only load if no cache
  const sortType = sortBy === 'priority' ? 1 : 0;
  const cacheKey = projectName ? `${email}:${projectName}` : email;
  const cacheStore = projectName ? CACHE_STORES.ENTRIES : CACHE_STORES.ALL_ENTRIES;

  // Read from IndexedDB immediately
  useEffect(() => {
    if (!email || !projectName) return;
    let cancelled = false;
    
    // 1. Read from cache immediately
    (async () => {
      const cached = await cacheGet(cacheStore, cacheKey);
      if (!cancelled) {
        const data = cached?.data !== undefined ? cached.data : cached;
        const entriesData = (data as Entry[]) || [];
        setEntries(entriesData);
        // Only show loading if no cached data exists
        setLoading(entriesData.length === 0);
      }
    })();

    // 2. Subscribe to cache changes
    const unsubscribe = cacheSubscribe(cacheStore, cacheKey, ((newData: Entry[]) => {
      if (!cancelled) {
        setEntries(newData || []);
        setLoading(false); // Data arrived, stop loading
      }
    }) as (data: any) => void);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [cacheStore, cacheKey]);

  // Fetch from server in background
  useEffect(() => {
    if (!email || !projectName) return;
    setLoading(true); // Show loading while fetching from server
    (async () => {
      await sortUnarchivedEntries(email, projectName, sortType);
      setLoading(false); // Data arrived from server
    })();
  }, [email, projectName, sortType]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [_searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Quick entry
  const [quickText, setQuickText] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickMessage, setQuickMessage] = useState('');
  const [quickMessageType, setQuickMessageType] = useState<'success' | 'error'>('success');

  // New entry modal
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  // View mode: table or cards — default to cards on mobile
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => window.innerWidth < 600 ? 'cards' : 'table');

  // Voice
  const [voiceOpen, setVoiceOpen] = useState(false);

  // AI placeholder
  const [aiPlaceholder, setAiPlaceholder] = useState(
    "Type what you worked on — we'll log it automatically..."
  );

  // AI empty message
  const [aiEmptyMessage, setAiEmptyMessage] = useState(
    'No entries to show yet. Add your first entry above!'
  );

  // Refresh entries from server (called after add/update/delete)
  const loadEntries = useCallback(async () => {
    if (!email || !projectName) return;
    // The hook will automatically pick up the cache changes
    await sortUnarchivedEntries(email, projectName, sortType);
  }, [email, projectName, sortType]);

  // Load all projects for the drawer
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getProjectsByEmail(email);
        if (!cancelled && result?.success) {
          setAllProjects(
            (result.projects || []).filter((p: Record<string, unknown>) => !p.archived)
          );
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Load profile
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getProfile(email);
        const profileData = result?.data || result;
        const avatar = (profileData as Record<string, unknown>)?.avatar as string;
        const username = (profileData as Record<string, unknown>)?.username as string;
        if (!cancelled) {
          if (avatar) setProfileAvatar(avatar);
          if (username) setProfileUsername(username);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  // AI-generated placeholder that describes what quick add is
  useEffect(() => {
    if (!getAiMessagesEnabled()) return;
    (async () => {
      const result = await askAI(
        `Generate a short, friendly placeholder text (max 50 chars) for a "Quick Add" input field in a project logbook app. The user is on the "${projectName}" project page. The placeholder should briefly tell the user what quick add does — it lets them type a natural language description of what they worked on and the system automatically creates a log entry for this project. Make it feel like a hint, not a command. Examples of good tone: "Describe what you worked on..." or "Type what you did and we'll log it...". Return ONLY the placeholder text, nothing else — no quotes, no JSON, no explanation.`
      );
      if (result.success && result.response) {
        const msg = parseAIResponse(result.response)
          .replace(/^["']|["']$/g, '')
          .trim();
        if (msg && msg.length <= 80) {
          setAiPlaceholder(msg);
        }
      }
    })();
  }, [projectName]);

  // AI empty message
  useEffect(() => {
    if (!getAiMessagesEnabled()) return;
    if (!loading && filteredEntries.length === 0 && !searchQuery) {
      (async () => {
        const tone = getToneInstruction();
        const result = await askAI(
          `Generate a motivating message for when a project has no entries to show. Make it 2-3 sentences. The project is "${projectName}". If the tone is casual or cynical, roast the user playfully. ${tone}`
        );
        if (result.success && result.response) {
          setAiEmptyMessage(parseAIResponse(result.response));
        }
      })();
    }
  }, [loading, projectName, searchQuery]);

  // Search within this project only
  useEffect(() => {
    if (!searchQuery.trim() || !email || !projectName) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (async () => {
      const result = await searchEntriesInProject(email, projectName, searchQuery.trim());
      if (!cancelled) {
        setSearchResults(result?.data || []);
        setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, email, projectName]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewEntryOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Split entries: due soon (within 3 days) at top, rest at bottom
  const { dueSoonEntries, otherEntries } = useMemo(() => {
    const source = searchResults !== null ? searchResults : entries;
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const dueSoon: Entry[] = [];
    const other: Entry[] = [];

    for (const entry of source) {
      if (entry.due_date) {
        const due = new Date(entry.due_date as string);
        if (!isNaN(due.getTime()) && due >= now && due <= threeDaysFromNow) {
          dueSoon.push(entry);
          continue;
        }
      }
      other.push(entry);
    }

    return { dueSoonEntries: dueSoon, otherEntries: other };
  }, [entries, searchResults]);

  const filteredEntries =
    searchResults !== null ? searchResults : [...dueSoonEntries, ...otherEntries];

  // Priority handler
  const handleSetPriority = async (
    entryId: string,
    _projectName: string,
    priorityValue: string
  ) => {
    if (!email || !projectName) return;
    try {
      const priorityLabel = priorityValue === '3' ? null : PRIORITY_LABELS[priorityValue];
      // Update local state immediately for instant UI
      setEntries((prev: Entry[]) =>
        prev.map((e: Entry) => (e.id === entryId ? { ...e, priority: priorityLabel } : e))
      );
      // Call server to save priority
      const result = await setPriority(email, priorityValue, projectName, entryId);
      if (result?.success === false) {
        console.error('Failed to set priority:', result.message);
        return;
      }
      // Update IndexedDB cache so it persists across reloads
      const cacheKey = `${email}:${projectName}`;
      const cached = await cacheGet(CACHE_STORES.ENTRIES, cacheKey);
      if (cached) {
        const currentData = cached.data || cached;
        const updatedData = Array.isArray(currentData)
          ? currentData.map((e: Entry) => (e.id === entryId ? { ...e, priority: priorityLabel } : e))
          : currentData;
        await cacheSet(CACHE_STORES.ENTRIES, cacheKey, { success: true, data: updatedData });
      }
      // Also update all-entries cache
      const cachedAll = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
      if (cachedAll) {
        const currentAll = cachedAll.data || cachedAll;
        const updatedAll = Array.isArray(currentAll)
          ? currentAll.map((e: Entry) => (e.id === entryId ? { ...e, priority: priorityLabel } : e))
          : currentAll;
        await cacheSet(CACHE_STORES.ALL_ENTRIES, email, { success: true, data: updatedAll });
      }
    } catch (err) {
      console.error('Failed to set priority:', err);
    }
  };

  // Quick entry submit — auto-append project name
  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || quickLoading || !projectName) return;

    setQuickLoading(true);
    setQuickMessage('');

    // Concatenate project context so the NLP engine knows which project
    const enrichedText = `${quickText.trim()} — this entry belongs to project ${projectName}`;
    const result = await addNaturalLanguageEntry(enrichedText);

    setQuickLoading(false);

    if (result.success) {
      setQuickText('');
      const isProjectOnly = (result.data as Record<string, unknown>)?.project_only === true;
      if (isProjectOnly) {
        const projName = ((result.data as Record<string, unknown>)?.project as string) || '';
        setQuickMessage(`Project "${projName}" created!`);
      } else {
        setQuickMessage('Entry created!');
      }
      setQuickMessageType('success');
      await loadEntries();
    } else {
      setQuickMessage(result.message || 'Failed to create entry');
      setQuickMessageType('error');
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuickSubmit(e);
    }
  };

  // Auto-dismiss quick message
  useEffect(() => {
    if (quickMessage) {
      const t = setTimeout(() => setQuickMessage(''), 15000);
      return () => clearTimeout(t);
    }
  }, [quickMessage]);

  // User info
  const fullDisplayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const preferredName = (() => {
    if (profileUsername?.trim()) return profileUsername.trim();
    if (!user?.id) return fullDisplayName;
    try {
      const raw = localStorage.getItem(`dl_settings_profile_${user.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.preferredName?.trim()) return parsed.preferredName.trim();
      }
    } catch {}
    return fullDisplayName;
  })();
  const avatarUrl = profileAvatar || user?.user_metadata?.avatar_url;
  const provider = user?.app_metadata?.provider || 'email';

  // Archive project — uses localStorage (DB UPDATE blocked by RLS)
  const handleArchiveProject = async (projName: string) => {
    if (!email) return;
    // Update local state immediately for instant UI feedback
    setAllProjects((prev) => prev.filter((p) => p.project_name !== projName));
    try {
      await archiveProject(email, projName);
    } catch (err) {
      console.error('Failed to archive project:', err);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const openSettings = (tab: 'profile' | 'preferences' | 'account') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      {/* Top Navigation — identical to Dashboard */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-left-group">
            <button
              className="nav-hamburger"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label="Toggle menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              className="nav-home-btn"
              onClick={() => navigate('/dashboard')}
              aria-label="Go to dashboard"
            >
              <div className="nav-logo">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  <path d="M8 7h6" />
                  <path d="M8 11h4" />
                </svg>
              </div>
              <span className="nav-title">Digital Logbook</span>
            </button>
          </div>

          <div className="nav-right-group">
            {searchOpen ? (
              <div className="nav-search-inline">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder={`Search in ${projectName}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="nav-search-input"
                />
                <button
                  className="nav-search-close"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                className="nav-icon-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
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

      {/* Drawer Overlay */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Navigation Drawer */}
      <aside className={`drawer ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">Navigation</span>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="drawer-section">
          <p className="drawer-section-title">Views</p>
          <button
            className="drawer-item"
            onClick={() => {
              navigate('/dashboard');
              setDrawerOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home
          </button>
          <button
            className="drawer-item"
            onClick={() => {
              navigate('/dashboard/archives');
              setDrawerOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
            </svg>
            Archives
          </button>
          <button
            className="drawer-item"
            onClick={() => {
              navigate('/stats');
              setDrawerOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            My Stats
          </button>
          <button
            className="drawer-item"
            onClick={() => {
              navigate('/dashboard/activity');
              setDrawerOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Activity Log
          </button>
        </div>
        <div className="drawer-section drawer-projects">
          <p className="drawer-section-title">Projects</p>
          <div className="drawer-project-list">
            {allProjects.map((p) => {
              const name = p.project_name as string;
              const count = entries.filter((e) => e.project_name === name).length;
              return (
                <div
                  key={name}
                  className={`drawer-item ${name === projectName ? 'active' : ''}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/project/${encodeURIComponent(name)}`);
                      setDrawerOpen(false);
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    {name}
                    <span className="drawer-badge">{count}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveProject(name)}
                    title="Archive project"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(139, 115, 85, 0.3)',
                      color: 'var(--text-secondary, #6b7280)',
                      borderRadius: '0.4rem',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <FiArchive size={12} />
                    Archive
                  </button>
                </div>
              );
            })}
            {allProjects.length === 0 && <p className="drawer-empty">No projects found.</p>}
          </div>
        </div>
        <div className="drawer-footer">
          <button
            className="btn-primary drawer-new-btn"
            onClick={() => {
              navigate('/dashboard');
              setDrawerOpen(false);
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              navigate('/projects');
              setDrawerOpen(false);
            }}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            Manage Projects
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dash-main">
        {/* Project heading + settings on same line */}
        <div className="feed-header animate-in">
          <div className="feed-header-row">
            <h1 className="feed-title">{projectName}</h1>
            <button
              className="btn-secondary project-settings-btn"
              onClick={() => setProjectSettingsOpen(true)}
            >
              Project Settings
            </button>
          </div>
          {searchQuery && (
            <p className="feed-subtitle">
              {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''} for "
              {searchQuery}"
            </p>
          )}
        </div>

        {/* Search bar inline for mobile */}
        <div className="feed-search-bar">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={`Search in ${projectName}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="feed-search-input"
          />
        </div>

        {/* Sort controls + view toggle */}
        <div className="feed-controls-row">
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

          {/* View toggle — Table / Cards */}
          <div className="view-toggle-group">
            <span className="feed-sort-label">View:</span>
            <button
              className={`sort-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Table
            </button>
            <button
              className={`sort-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              Cards
            </button>
          </div>
        </div>

        {/* Quick Entry Bar — scoped to this project */}
        <div className="quick-entry-bar">
          <form className="quick-entry-form" onSubmit={handleQuickSubmit}>
            <div className="quick-entry-input-wrap">
              <svg
                className="quick-entry-icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <input
                type="text"
                className="quick-entry-input"
                placeholder={aiPlaceholder}
                value={quickText}
                onChange={(e) => setQuickText(e.target.value)}
                onKeyDown={handleQuickKeyDown}
                disabled={quickLoading}
              />
              <button
                type="button"
                className="quick-entry-voice"
                onClick={() => setVoiceOpen(true)}
                aria-label="Voice entry"
                title="Record a voice entry"
              >
                <FiMic size={16} />
              </button>
              <button
                type="submit"
                className="quick-entry-submit"
                disabled={quickLoading || !quickText.trim()}
              >
                {quickLoading ? (
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </form>
          {quickMessage && (
            <div className={`quick-entry-message ${quickMessageType}`}>{quickMessage}</div>
          )}
        </div>

        {/* Loading — only show if no cached data */}
        {loading && entries.length === 0 && (
          <div className="feed-loading">
            <div
              className="animate-spin"
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
              }}
            />
            <p>Loading entries...</p>
          </div>
        )}

        {/* Search results */}
        {searchQuery && (
          <>
            {filteredEntries.length === 0 ? (
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
                <h2 className="empty-title">No results found</h2>
                <p className="empty-desc">
                  No entries in {projectName} match "{searchQuery}".
                </p>
              </div>
            ) : (
              <div className="entries-feed">
                {filteredEntries.map((row, i) => (
                  <EntryBox
                    key={`search-${row.id || i}`}
                    entry={row as any}
                    onUpdated={() => loadEntries()}
                    onPriorityChanged={handleSetPriority}
                    onDelete={() => loadEntries()}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* All entries */}
        {!searchQuery && (
          <div className="project-content">
            {entries.length === 0 ? (
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <line x1="9" y1="14" x2="15" y2="14" />
                  </svg>
                </div>
                <h2 className="empty-title">No entries yet</h2>
                <p className="empty-desc">{aiEmptyMessage}</p>
              </div>
            ) : viewMode === 'table' ? (
              <ProjectTaskTable
                rows={entries}
                viewMode="entry"
                onUpdate={async (id: string, patch: Record<string, any>) => {
                  console.log('[onUpdate] Called with id:', id, 'patch:', patch);
                  // Find the entry being updated
                  const row = entries.find((r) => r.id === id);
                  if (!row || !email) {
                    console.log('[onUpdate] Missing row or email:', { row: !!row, email: !!email });
                    return;
                  }
                  // Map priority from raw value to friendly label for database
                  const mappedPatch = { ...patch };
                  if (patch.priority !== undefined) {
                    mappedPatch.priority = toFriendlyPriority(patch.priority);
                  }
                  // Always normalize priority to friendly label before sending to DB
                  const dbPriority = toFriendlyPriority(mappedPatch.priority ?? row.priority);
                  // Update local state immediately for instant UI
                  setEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...mappedPatch } : r)));
                  try {
                    console.log('[onUpdate] Calling updateEntry with mapped patch:', mappedPatch, 'dbPriority:', dbPriority);
                    const result = await updateEntry(
                      email,
                      row.project_name,
                      id,
                      mappedPatch.entries ?? row.entries,
                      mappedPatch.due_date !== undefined ? mappedPatch.due_date : row.due_date,
                      dbPriority,
                      mappedPatch.status !== undefined ? mappedPatch.status : row.status,
                      row.started_at,
                      row.ended_at,
                      row.duration,
                    );
                    console.log('[onUpdate] updateEntry result:', result);
                    // If server returned failure, rollback local state
                    if (result && !result.success) {
                      console.warn('[onUpdate] Server returned failure, rolling back UI:', (result as any).message);
                      setEntries((prev) => prev.map((r) => (r.id === id ? row : r)));
                    }
                    // No need to call loadEntries() - updateEntry already updated the cache
                  } catch (err) {
                    console.error('[onUpdate] Update failed:', err);
                    // Rollback local state on failure
                    setEntries((prev) => prev.map((r) => (r.id === id ? row : r)));
                  }
                }}
                projectNames={projectName ? [projectName] : undefined}
                onDeleteSelected={async (ids: string[]) => {
                  if (!email) return;
                  // Optimistic: remove from local state immediately
                  setEntries((prev) => prev.filter((r) => !ids.includes(r.id)));
                  // Delete each entry on the server
                  for (const id of ids) {
                    try {
                      await deleteEntryById(email, id);
                    } catch (err) {
                      console.error('[onDeleteSelected] Failed to delete', id, err);
                    }
                  }
                }}
              />
            ) : (
              <div className="entries-grid">
                {entries.map((row, i) => (
                  <EntryBox
                    key={`entry-${row.id || i}`}
                    entry={row as any}
                    onUpdated={() => loadEntries()}
                    onPriorityChanged={handleSetPriority}
                    onDelete={() => loadEntries()}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FAB — only New Entry (project is already known) */}
      <div className="fab-container">
        <button className="fab" onClick={() => setNewEntryOpen(true)} aria-label="New entry">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="fab-label">New</span>
        </button>
      </div>

      {/* New Entry Modal — project is pre-set */}
      {newEntryOpen && (
        <div className="modal-overlay" onClick={() => setNewEntryOpen(false)}>
          <div className="modal-card glass modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <AddEntry
              user_email={email}
              project_name={projectName!}
              onAdded={() => {
                setNewEntryOpen(false);
                loadEntries();
              }}
              onCancel={() => setNewEntryOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Voice Feature Modal */}
      {voiceOpen && (
        <VoiceFeature
          onClose={() => setVoiceOpen(false)}
          onEntryCreated={() => {
            setVoiceOpen(false);
            loadEntries();
          }}
        />
      )}

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        initialTab={settingsTab}
        userId={user?.id || ''}
        displayName={fullDisplayName}
        email={user?.email || ''}
        avatarUrl={avatarUrl}
        provider={provider}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={async () => {}}
        onResetPassword={resetPassword}
        deleting={false}
        deleteError={null}
      />

      {/* Project Settings Panel */}
      <ProjectSettingsPanel
        open={projectSettingsOpen}
        projectName={projectName!}
        userEmail={email}
        onClose={() => setProjectSettingsOpen(false)}
        onProjectUpdated={() => {
          navigate('/dashboard');
        }}
        onProjectDeleted={() => {
          navigate('/dashboard');
        }}
        onProjectArchived={() => {
          navigate('/dashboard');
        }}
      />
    </div>
  );
}
