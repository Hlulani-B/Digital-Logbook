import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ProfileMenu } from '@/components/ProfileMenu';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Stats } from '@/components/Stats';
import { ProjectSettingsPanel } from '@/components/ProjectSettingsPanel';
import { QuickEntryBar } from '@/components/QuickEntryBar';
import { ActivityFeed } from '@/components/ActivityFeed';
import { ActivitySummary } from '@/components/ActivitySummary';
import { addProject, getProjectsByEmail } from '@/functions/project/project.js';
import { addField } from '@/functions/project/fields.js';
import { sortUnarchivedEntries } from '@/functions/project/entries.js';
import { getArchives } from '@/functions/project/archives.js';
import { setPriority } from '@/functions/project/priority.js';
import { getProfile } from '@/functions/profile/profile.js';
import { checkUser } from '@/functions/profile/login.js';
import { dueSoon } from '@/functions/dashboard.js';
import { searchAll, searchProject, searchProjects } from '@/functions/dashboard/search.js';
import { EntryBox } from '@/pages/NewEntry';
import { AddEntry } from '@/pages/AddEntry';
import VoiceFeature from '@/pages/VoiceFeature';
import { askAI } from '@/functions/ai.js';
import { getToneInstruction } from '@/functions/tone';
import { entryDurationMs, formatTimer } from '@/functions/dashboard/stats.js';
import { useNow } from '@/hooks/useNow';
import { FiArchive, FiX } from 'react-icons/fi';

/** Parse AI response — handles JSON {"message":"..."}, {"instruction":"..."}, etc. or plain text */
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
type Project = Record<string, unknown>;

type ProjectFieldDraft = {
  field_name: string;
  data_type: 'text' | 'number' | 'date' | 'boolean';
  is_required: boolean;
};

type DashboardProps = {
  defaultView?: string;
};

export function Dashboard({ defaultView = 'all' }: DashboardProps) {
  const { user, signOut, deleteAccount, resetPassword } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'preferences' | 'account'>('profile');
  const navigate = useNavigate();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<'all' | 'recent' | 'drafts' | 'archives' | string>(
    defaultView
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('date');

  // View mode: "due-soon" shows only entries due within 3 days, "all-entries" shows everything
  const [viewMode, setViewMode] = useState<'due-soon' | 'all-entries'>('due-soon');

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueSoonRows, setDueSoonRows] = useState<Entry[]>([]);
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  // Archive state
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [archivedEntries, setArchivedEntries] = useState<Entry[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [localArchived, setLocalArchived] = useState<Set<string>>(new Set());
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false);

  // Voice recorder
  const [voiceOpen, setVoiceOpen] = useState(false);

  // AI-generated messages
  const [aiGreeting, setAiGreeting] = useState('');
  const [showGreetingToast, setShowGreetingToast] = useState(false);

  // Derived early so the deleted-account safety check can use it.
  const email = user?.email || '';

  // Safety check: soft-deleted accounts should not access the dashboard.
  // They are redirected to the sign-in restore prompt.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await checkUser(email);
        if (!cancelled && result.exists && result.deleted) {
          try {
            await signOut();
          } catch {
            /* best effort */
          }
          const scheduled = result.deletion_scheduled_at || new Date().toISOString();
          navigate(
            `/signin?restore_email=${encodeURIComponent(email)}&restore_scheduled_at=${encodeURIComponent(scheduled)}`,
            { replace: true }
          );
        }
      } catch (err) {
        console.error('Dashboard deleted-check failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, navigate, signOut]);
  const [aiEmptyMessage, setAiEmptyMessage] = useState('No entries to show right now.');
  const [aiPlaceholder, setAiPlaceholder] = useState('What are you working on?');

  // New project modal
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [projectFields, setProjectFields] = useState<ProjectFieldDraft[]>([]);

  // New entry modal
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntryProject, setNewEntryProject] = useState('');

  // Project settings panel
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Load data — always fetch sorted to reflect current sortBy
  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const sortType = sortBy === 'priority' ? 1 : 0;
      const project =
        activeView !== 'all' &&
        activeView !== 'recent' &&
        activeView !== 'drafts' &&
        activeView !== 'archives'
          ? activeView
          : null;

      const [projectsRes, entriesRes, dueSoonRes] = await Promise.allSettled([
        getProjectsByEmail(email),
        sortUnarchivedEntries(email, project, sortType),
        dueSoon(email, null),
      ]);
      // Read localStorage archived set (DB UPDATE is blocked by RLS)
      let localArch = new Set<string>();
      try {
        const raw = localStorage.getItem(`dl_archived_${email}`);
        if (raw) localArch = new Set(JSON.parse(raw));
      } catch {}
      setLocalArchived(localArch);

      if (projectsRes.status === 'fulfilled') {
        const allProjects = (projectsRes.value?.projects || []) as Project[];
        // Merge DB archived flag with localStorage archived set
        const merged = allProjects.map((p) => ({
          ...p,
          archived: p.archived === true || localArch.has(p.project_name as string),
        }));
        setProjects(merged);
        setArchivedProjects(merged.filter((p) => p.archived));
      } else {
        console.error('Failed to load projects:', projectsRes.reason);
      }
      if (entriesRes.status === 'fulfilled') {
        setEntries(entriesRes.value?.data || []);
      } else {
        console.error('Failed to load entries:', entriesRes.reason);
      }
      if (dueSoonRes.status === 'fulfilled') {
        setDueSoonRows(dueSoonRes.value?.data || []);
      } else {
        console.error('Failed to load due soon:', dueSoonRes.reason);
      }
    } catch (err) {
      console.error('[Dashboard] loadData exception:', err);
    } finally {
      setLoading(false);
    }
  }, [email, sortBy, activeView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load archived entries when archives view is active
  useEffect(() => {
    if (activeView !== 'archives' || !email) return;
    (async () => {
      try {
        const result = await getArchives(email, null);
        if (result?.success !== false) {
          setArchivedEntries(result?.data || []);
        }
      } catch (err) {
        console.error('Failed to load archived entries:', err);
      }
    })();
  }, [activeView, email]);

  // AI-generated greeting — shown as a toast
  useEffect(() => {
    if (!loading && projects.length > 0) {
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      const entryCount = entries.length;
      const dueCount = dueSoonRows.length;

      (async () => {
        const tone = getToneInstruction();
        const result = await askAI(
          `Generate a ${timeOfDay} greeting for a user with ${entryCount} entries and ${dueCount} due soon. Make it 3-4 sentences long. If the tone is casual or cynical, roast the user playfully and be funny — tease them about their productivity, their procrastination, or their life choices. Be witty and entertaining. ${tone}`
        );
        if (result.success && result.response) {
          const msg = parseAIResponse(result.response);
          setAiGreeting(msg);
          setShowGreetingToast(true);
        }
      })();
    } else if (!loading) {
      setAiGreeting("Welcome! Let's get you started.");
      setShowGreetingToast(true);
    }
  }, [loading, projects, entries, dueSoonRows]);

  // Auto-dismiss greeting toast after 30 seconds
  useEffect(() => {
    if (showGreetingToast) {
      const t = setTimeout(() => setShowGreetingToast(false), 30000);
      return () => clearTimeout(t);
    }
  }, [showGreetingToast]);

  // Rotating AI placeholder for quick entry
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

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setFabOpen(false);
        setSearchOpen(false);
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close project menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered entries — uses provided sort/search/archive functions
  const filteredEntries = useMemo(() => {
    // If search results are available, use them
    if (searchResults !== null) return searchResults;

    // Otherwise use all entries (unarchived)
    let filtered = [...entries];

    if (activeView === 'recent') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((e) => new Date(e.created_at as string) >= weekAgo);
    } else if (activeView !== 'all' && activeView !== 'drafts' && activeView !== 'archives') {
      filtered = filtered.filter((e) => e.project_name === activeView);
    }

    // Apply "due soon" view filter: only entries with due_date within 3 days
    if (viewMode === 'due-soon') {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((e) => {
        if (!e.due_date) return false;
        const due = new Date(e.due_date as string);
        if (isNaN(due.getTime())) return false;
        return due >= now && due <= threeDaysFromNow;
      });
    }

    return filtered;
  }, [entries, activeView, searchResults, viewMode]);

  // In-progress entries (started but not ended). Drives the live dashboard timer.
  const inProgressEntries = useMemo(
    () => entries.filter((e) => e.started_at && !e.ended_at),
    [entries]
  );
  // Tick every second only while a task is running.
  const liveNow = useNow(1000, inProgressEntries.length > 0);
  const primaryTimer = useMemo(() => {
    if (inProgressEntries.length === 0) return null;
    const first = inProgressEntries[0];
    return {
      projectName: (first.project_name as string) || 'Unknown',
      elapsed: formatTimer(entryDurationMs(first, liveNow)),
      extraCount: inProgressEntries.length - 1,
    };
  }, [inProgressEntries, liveNow]);

  // AI-generated empty state message
  useEffect(() => {
    if (!loading && filteredEntries.length === 0) {
      (async () => {
        const tone = getToneInstruction();
        const result = await askAI(
          `Generate a motivating message for when there are no entries to show. Make it 3-4 sentences long. If the tone is casual or cynical, roast the user playfully and be funny — tease them about being lazy, having nothing to do, or wasting their day. Be witty and entertaining. ${tone}`
        );
        if (result.success && result.response) {
          setAiEmptyMessage(parseAIResponse(result.response));
        }
      })();
    }
  }, [loading, filteredEntries.length]);

  // Search using provided search functions
  useEffect(() => {
    if (!searchQuery.trim() || !email) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // Run both entry search and project name search in parallel
      const isProjectView =
        activeView !== 'all' &&
        activeView !== 'recent' &&
        activeView !== 'drafts' &&
        activeView !== 'archives';
      const entrySearch = isProjectView
        ? searchProject(email, activeView, searchQuery.trim())
        : searchAll(email, searchQuery.trim());
      const projectSearch = searchProjects(email, searchQuery.trim());

      const [entryResult, projectResult] = await Promise.all([entrySearch, projectSearch]);

      if (!cancelled) {
        // Merge results, deduplicating by entry id
        const entryRows = entryResult?.data || [];
        const projectRows = projectResult?.data || [];
        const seen = new Set();
        const merged = [...entryRows, ...projectRows].filter((row: Entry) => {
          if (seen.has(row.id as string)) return false;
          seen.add(row.id as string);
          return true;
        });
        setSearchResults(merged);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, activeView, email]);

  // User info
  const fullDisplayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const preferredName = (() => {
    // Priority: profile-service username > localStorage preferred name > full name
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
  // Profile-service avatar/username take priority over Google/OAuth profile data
  const avatarUrl = profileAvatar || user?.user_metadata?.avatar_url;
  const provider = user?.app_metadata?.provider || 'email';

  // Load avatar and username from profile-service (fallback for users who set profile before Supabase sync)
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
          if (avatar) {
            setProfileAvatar(avatar);
          }
          if (username) {
            setProfileUsername(username);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Logout error:', err);
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // deleteAccount now signs the user out; ProtectedRoute will redirect to /signin.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const openSettings = (tab: 'profile' | 'preferences' | 'account') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const resetProjectForm = () => {
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectError(null);
    setProjectFields([]);
  };

  const addProjectField = () => {
    setProjectFields((prev) => [
      ...prev,
      { field_name: '', data_type: 'text', is_required: false },
    ]);
  };

  const removeProjectField = (index: number) => {
    setProjectFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateProjectField = (index: number, updates: Partial<ProjectFieldDraft>) => {
    setProjectFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !email) return;

    // Validate fields before creating project
    const nonEmptyFields = projectFields.filter((f) => f.field_name.trim());
    if (nonEmptyFields.length > 0) {
      // Check for duplicate field names (case-insensitive)
      const fieldNames = nonEmptyFields.map((f) => f.field_name.trim().toLowerCase());
      const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        const uniqueDuplicates = [...new Set(duplicates)];
        setNewProjectError(`Duplicate field names found: ${uniqueDuplicates.join(', ')}`);
        return;
      }
    }

    setCreatingProject(true);
    setNewProjectError(null);

    try {
      const projectName = newProjectName.trim();
      await addProject(email, projectName, newProjectDescription.trim() || undefined);

      // Save any non-empty project fields (best-effort after project is created)
      if (nonEmptyFields.length > 0) {
        const results = await Promise.allSettled(
          nonEmptyFields.map((f) =>
            addField(email, projectName, f.field_name.trim(), f.data_type, f.is_required)
          )
        );
        const failures = results
          .map((r, i) => (r.status === 'rejected' ? nonEmptyFields[i].field_name : null))
          .filter((name): name is string => Boolean(name));
        if (failures.length > 0) {
          window.alert(
            `Project created, but these fields could not be saved: ${failures.join(', ')}`
          );
        }
      }

      setNewProjectOpen(false);
      resetProjectForm();
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      console.error('Failed to create project:', err);
      setNewProjectError(message);
    } finally {
      setCreatingProject(false);
    }
  };

  // Archive project — uses localStorage (DB UPDATE blocked by RLS)
  const handleArchiveProject = async (projectName: string) => {
    if (!email) {
      setArchiveError('Cannot archive: no email');
      return;
    }
    setArchiveError(null);
    // Update local state immediately for instant UI feedback
    setProjects((prev) =>
      prev.map((p) => (p.project_name === projectName ? { ...p, archived: true } : p))
    );
    const project = projects.find((p) => p.project_name === projectName);
    if (project) {
      setArchivedProjects((prev) => [...prev, { ...project, archived: true }]);
    }
    // Save to localStorage for persistence across reloads
    const next = new Set(localArchived);
    next.add(projectName);
    setLocalArchived(next);
    try {
      localStorage.setItem(`dl_archived_${email}`, JSON.stringify([...next]));
    } catch {}
    // Best-effort DB update (will silently fail due to RLS, that's OK)
    try {
      const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const anonJwt = import.meta.env.VITE_SUPABASE_ANON_JWT;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/rest/v1/projects?user_email=eq.${encodeURIComponent(email)}&project_name=eq.${encodeURIComponent(projectName)}`;
      await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: anonJwt || apiKey,
          Authorization: `Bearer ${anonJwt || apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ archived: true }),
      });
    } catch {}
  };

  const handleUnarchiveProject = async (projectName: string) => {
    if (!email) return;
    setArchiveError(null);
    try {
      const { unarchiveProject } = await import('@/functions/project/archives.js');
      const result = await unarchiveProject(email, projectName);
      if (result?.success === false)
        throw new Error(result.message || 'Failed to unarchive project');
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Failed to unarchive project');
      return;
    }
    // Update local state
    setProjects((prev) =>
      prev.map((p) => (p.project_name === projectName ? { ...p, archived: false } : p))
    );
    setArchivedProjects((prev) => prev.filter((p) => p.project_name !== projectName));
    const next = new Set(localArchived);
    next.delete(projectName);
    setLocalArchived(next);
    try {
      localStorage.setItem(`dl_archived_${email}`, JSON.stringify([...next]));
    } catch {}
  };

  const PRIORITY_LABELS: Record<string, string> = {
    '0': 'Urgent and important',
    '1': 'Urgent but not important',
    '2': 'Not urgent, not important',
  };

  const handleSetPriority = async (entryId: string, projectName: string, priorityValue: string) => {
    if (!email) return;
    try {
      const priorityLabel = priorityValue === '3' ? null : PRIORITY_LABELS[priorityValue];
      const result = await setPriority(email, priorityValue, projectName, entryId);
      if (result?.success === false) {
        console.error('Failed to set priority:', result.message);
        return;
      }
      // Update the entry in local state
      setEntries((prev: Entry[]) =>
        prev.map((e: Entry) => (e.id === entryId ? { ...e, priority: priorityLabel } : e))
      );
    } catch (err) {
      console.error('Failed to set priority:', err);
    }
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      {/* Top Navigation */}
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
                  placeholder="Search entries..."
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

      {/* Left Drawer Overlay */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Left Drawer */}
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
            className={`drawer-item ${activeView === 'all' ? 'active' : ''}`}
            onClick={() => {
              navigate('/dashboard/all');
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
            <span className="drawer-badge">{entries.length}</span>
          </button>
          <button
            className={`drawer-item ${activeView === 'archives' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('archives');
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
            className={`drawer-item ${activeView === 'activity' ? 'active' : ''}`}
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
            {projects
              .filter((p) => !p.archived)
              .map((project) => {
                const name = project.project_name as string;
                const count = entries.filter((e) => e.project_name === name).length;
                return (
                  <div
                    key={name}
                    className={`drawer-item ${activeView === name ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
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
            {projects.filter((p) => !p.archived).length === 0 && (
              <p className="drawer-empty">No projects yet. Create one below.</p>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          <button
            className="btn-primary drawer-new-btn"
            onClick={() => {
              setNewProjectOpen(true);
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
        {/* AI Greeting Toast */}
        {showGreetingToast && aiGreeting && (
          <div className="ai-toast animate-in">
            <p>{aiGreeting}</p>
          </div>
        )}

        {/* Feed Header */}
        <div className="feed-header animate-in">
          <div className="feed-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 className="feed-title">
                {activeView === 'all'
                  ? 'Dashboard'
                  : activeView === 'recent'
                    ? 'Recent'
                    : activeView === 'drafts'
                      ? 'Drafts'
                      : activeView === 'archives'
                        ? 'Archives'
                        : activeView === 'activity'
                          ? 'Activity Log'
                          : activeView}
              </h1>
              {/* Project settings three-dots menu - only show for specific projects */}
              {activeView !== 'all' &&
                activeView !== 'recent' &&
                activeView !== 'drafts' &&
                activeView !== 'archives' &&
                activeView !== 'activity' && (
                  <div
                    className="project-menu-wrap"
                    ref={projectMenuRef}
                    style={{ position: 'relative' }}
                  >
                    <button
                      type="button"
                      className="entry-box__menu-btn"
                      onClick={() => setProjectMenuOpen((v) => !v)}
                      aria-label="Project settings"
                      aria-expanded={projectMenuOpen}
                      style={{ position: 'static' }}
                    >
                      ⋯
                    </button>
                    {projectMenuOpen && (
                      <div
                        className="entry-box__menu"
                        style={{ top: '100%', right: 'auto', left: 0 }}
                      >
                        <button
                          type="button"
                          className="entry-box__menu-item"
                          onClick={() => {
                            setProjectSettingsOpen(true);
                            setProjectMenuOpen(false);
                          }}
                        >
                          Project Settings
                        </button>
                        <button
                          type="button"
                          className="entry-box__menu-item"
                          onClick={() => {
                            handleArchiveProject(activeView);
                            setProjectMenuOpen(false);
                          }}
                          style={{
                            color: 'var(--text-secondary, #6b7280)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <FiArchive size={16} /> Archive Project
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
            {searchQuery && (
              <p className="feed-subtitle">
                {filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''} for "
                {searchQuery}"
              </p>
            )}
            <Stats entries={entries} projects={projects} dueSoonCount={dueSoonRows.length} />
          </div>
        </div>

        {/* Live running-timer banner — shows when a task is in progress */}
        {primaryTimer && activeView !== 'activity' && activeView !== 'archives' && (
          <div className="dash-timer-banner animate-in" role="status" aria-live="polite">
            <span className="dash-timer-dot" />
            <span className="dash-timer-label">Timer running</span>
            <span className="dash-timer-project">{primaryTimer.projectName}</span>
            <span className="dash-timer-elapsed">{primaryTimer.elapsed}</span>
            {primaryTimer.extraCount > 0 && (
              <span className="dash-timer-extra">+{primaryTimer.extraCount} more</span>
            )}
          </div>
        )}

        {/* Search bar inline for mobile */}
        {activeView === 'activity' ? (
          <>
            <ActivitySummary />
            <ActivityFeed />
          </>
        ) : activeView === 'archives' ? (
          <div className="entries-feed">
            {archiveError && (
              <div className="auth-error" style={{ marginBottom: '1rem' }}>
                {archiveError}
              </div>
            )}

            {/* Archived Projects */}
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                marginBottom: '0.75rem',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FiArchive size={16} /> Archived Projects
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                ({archivedProjects.length})
              </span>
            </h2>
            {archivedProjects.length === 0 ? (
              <p style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1.5rem' }}>
                No archived projects
              </p>
            ) : (
              archivedProjects.map((project, i) => {
                const name = project.project_name as string;
                return (
                  <div
                    key={`archived-${name}-${i}`}
                    className="glass"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem 1.25rem',
                      borderRadius: '0.85rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <FiArchive size={18} style={{ opacity: 0.6 }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '0.98rem', opacity: 0.7 }}>
                      {name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #6b7280)' }}>
                      Archived (read-only)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUnarchiveProject(name)}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      ↩ Unarchive
                    </button>
                  </div>
                );
              })
            )}

            {/* Archived Entries */}
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 600,
                marginTop: '1.5rem',
                marginBottom: '0.75rem',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <FiArchive size={16} /> Archived Entries
              <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                ({archivedEntries.length})
              </span>
            </h2>
            {archivedEntries.length === 0 ? (
              <div className="empty-state animate-in">
                <div className="empty-icon">
                  <FiArchive size={40} />
                </div>
                <h2 className="empty-title">No archived entries</h2>
                <p className="empty-desc">Archive an entry from the ⋯ menu to see it here.</p>
              </div>
            ) : (
              archivedEntries.map((row, i) => (
                <EntryBox
                  key={`archived-entry-${row.id || i}`}
                  entry={row as any}
                  onUpdated={() => loadData()}
                  onPriorityChanged={handleSetPriority}
                  onArchiveToggled={(entryId, isArchived) => {
                    if (!isArchived) {
                      setArchivedEntries((prev) => prev.filter((e) => e.id !== entryId));
                    }
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <>
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
                placeholder="Filter entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="feed-search-input"
              />
            </div>

            {/* View + Sort controls */}
            <div className="feed-controls-row">
              <div className="feed-view-toggle">
                <button
                  className={`feed-view-btn ${viewMode === 'due-soon' ? 'active' : ''}`}
                  onClick={() => setViewMode('due-soon')}
                >
                  Due Soon
                </button>
                <button
                  className={`feed-view-btn ${viewMode === 'all-entries' ? 'active' : ''}`}
                  onClick={() => setViewMode('all-entries')}
                >
                  All Entries
                </button>
              </div>
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

            {/* Quick Entry Bar - Natural Language */}
            <QuickEntryBar
              onEntryCreated={() => {
                loadData();
              }}
              onVoiceOpen={() => setVoiceOpen(true)}
              placeholder={aiPlaceholder}
            />

            {/* Loading */}
            {loading && (
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

            {/* Entries feed — always shown (filtered by viewMode + sort) */}
            {!loading && !searchQuery && (
              <div className="entries-feed">
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
                        {viewMode === 'due-soon' ? (
                          <>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </>
                        ) : (
                          <>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </>
                        )}
                      </svg>
                    </div>
                    <h2 className="empty-title">
                      {viewMode === 'due-soon' ? 'Nothing due soon' : 'No entries to show'}
                    </h2>
                    <p className="empty-desc">
                      {viewMode === 'due-soon'
                        ? 'No entries are due within the next 3 days. Switch to "All Entries" to see everything.'
                        : aiEmptyMessage}
                    </p>
                  </div>
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

            {/* Search Results — only when searching */}
            {!loading && searchQuery && (
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
                      No entries match "{searchQuery}". Try a different search term.
                    </p>
                  </div>
                ) : (
                  <div className="entries-feed">
                    {filteredEntries.map((row, i) => (
                      <EntryBox
                        key={`search-${row.id || i}`}
                        entry={row as any}
                        onUpdated={() => loadData()}
                        onPriorityChanged={handleSetPriority}
                        onDelete={() => loadData()}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* FAB */}
      <div className="fab-container">
        {fabOpen && (
          <div className="fab-menu">
            <button
              className="fab-menu-item"
              onClick={() => {
                setNewEntryOpen(true);
                setFabOpen(false);
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              New Entry
            </button>
            <button
              className="fab-menu-item"
              onClick={() => {
                setNewProjectOpen(true);
                setFabOpen(false);
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
              New Project
            </button>
          </div>
        )}
        <button
          className={`fab ${fabOpen ? 'fab-open' : ''}`}
          onClick={() => setFabOpen(!fabOpen)}
          aria-label="Quick actions"
        >
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

      {/* New Project Modal */}
      {newProjectOpen && (
        <div className="modal-overlay" onClick={() => setNewProjectOpen(false)}>
          <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">New Project</h2>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="field-input"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              className="field-input"
              rows={3}
              style={{ resize: 'vertical', minHeight: '60px' }}
            />

            {/* Project Fields */}
            <div className="project-fields-section" style={{ marginTop: '1rem' }}>
              <h3
                className="project-fields-title"
                style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.5rem' }}
              >
                Project Fields
              </h3>
              {projectFields.length === 0 && (
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    margin: '0 0 0.5rem',
                  }}
                >
                  No fields defined. Add fields to build the entry form for this project.
                </p>
              )}
              {projectFields.map((field, index) => (
                <div
                  key={index}
                  className="project-field-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Field name"
                    value={field.field_name}
                    onChange={(e) => updateProjectField(index, { field_name: e.target.value })}
                    className="field-input"
                  />
                  <select
                    value={field.data_type}
                    onChange={(e) =>
                      updateProjectField(index, {
                        data_type: e.target.value as ProjectFieldDraft['data_type'],
                      })
                    }
                    className="field-input"
                    style={{ width: 'auto' }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={field.is_required}
                      onChange={(e) => updateProjectField(index, { is_required: e.target.checked })}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => removeProjectField(index)}
                    title="Remove field"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-secondary"
                onClick={addProjectField}
                style={{ marginTop: '0.25rem' }}
              >
                + Add Another Project Field
              </button>
            </div>

            {newProjectError && (
              <div className="auth-error" style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}>
                {newProjectError}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setNewProjectOpen(false);
                  resetProjectForm();
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateProject}
                disabled={creatingProject || !newProjectName.trim()}
              >
                {creatingProject ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {newEntryOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setNewEntryOpen(false);
            setNewEntryProject('');
          }}
        >
          <div className="modal-card glass modal-card-wide" onClick={(e) => e.stopPropagation()}>
            {!newEntryProject ? (
              <>
                <h2 className="modal-title">New Entry</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Select a project:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {projects
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <button
                        key={p.project_name as string}
                        className="drawer-item"
                        onClick={() => setNewEntryProject(p.project_name as string)}
                        style={{ textAlign: 'left', justifyContent: 'flex-start' }}
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
                        {p.project_name as string}
                      </button>
                    ))}
                  {projects.filter((p) => !p.archived).length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      No projects yet. Create one first.
                    </p>
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setNewEntryOpen(false);
                      setNewEntryProject('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <AddEntry
                user_email={email}
                project_name={newEntryProject}
                onAdded={() => {
                  setNewEntryOpen(false);
                  setNewEntryProject('');
                  loadData();
                }}
                onCancel={() => {
                  setNewEntryOpen(false);
                  setNewEntryProject('');
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Voice Feature Modal */}
      {voiceOpen && (
        <VoiceFeature
          onClose={() => setVoiceOpen(false)}
          onEntryCreated={() => {
            setVoiceOpen(false);
            loadData();
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
        onDeleteAccount={handleDeleteAccount}
        onResetPassword={resetPassword}
        deleting={deleting}
        deleteError={deleteError}
      />

      {/* Project Settings Panel */}
      <ProjectSettingsPanel
        open={projectSettingsOpen}
        projectName={activeView}
        userEmail={email}
        onClose={() => setProjectSettingsOpen(false)}
        onProjectUpdated={() => {
          setActiveView('all');
          loadData();
        }}
        onProjectDeleted={() => {
          setActiveView('all');
          loadData();
        }}
      />
    </div>
  );
}
