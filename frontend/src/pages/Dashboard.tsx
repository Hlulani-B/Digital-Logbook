import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProfileMenu } from "@/components/ProfileMenu";
import { SettingsPanel } from "@/components/SettingsPanel";
import { addProject, getProjectsByEmail } from "@/functions/project/project.js";
import { getAllEntries, sortUnarchivedEntries, sortArchivedEntries } from "@/functions/project/entries.js";
import { archiveProject, unarchiveProject } from "@/functions/project/archives.js";
import { dueSoon } from "@/functions/dashboard.js";
import { searchAll, searchProject } from "@/functions/dashboard/search.js";
import { EntryBox } from "@/pages/NewEntry";
import { AddEntry } from "@/pages/AddEntry";

type Entry = Record<string, unknown>;
type Project = Record<string, unknown>;

export function Dashboard() {
  const { user, signOut, deleteAccount, resetPassword } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "preferences" | "account">("profile");
  const navigate = useNavigate();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<"all" | "recent" | "drafts" | "archives" | string>("all");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<"priority" | "date">("date");

  // View mode: "due-soon" shows only entries due within 3 days, "all-entries" shows everything
  const [viewMode, setViewMode] = useState<"due-soon" | "all-entries">("due-soon");

  // Stats panel
  const [statsOpen, setStatsOpen] = useState(false);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueSoonRows, setDueSoonRows] = useState<Entry[]>([]);
  const [searchResults, setSearchResults] = useState<Entry[] | null>(null);
  const [archiveRows, setArchiveRows] = useState<Entry[]>([]);

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false);

  // New project modal
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);

  // New entry modal
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntryProject, setNewEntryProject] = useState("");

  const email = user?.email || "";

  // Load data — always fetch sorted to reflect current sortBy
  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const sortType = sortBy === "priority" ? 1 : 0;
      const project = (activeView !== "all" && activeView !== "recent" && activeView !== "drafts" && activeView !== "archives") ? activeView : null;

      const [projectsRes, entriesRes, dueSoonRes] = await Promise.allSettled([
        getProjectsByEmail(email),
        sortUnarchivedEntries(email, project, sortType),
        dueSoon(email, null),
      ]);
      if (projectsRes.status === "fulfilled") {
        setProjects(projectsRes.value?.projects || []);
      } else {
        console.error("Failed to load projects:", projectsRes.reason);
      }
      if (entriesRes.status === "fulfilled") {
        setEntries(entriesRes.value?.data || []);
      } else {
        console.error("Failed to load entries:", entriesRes.reason);
      }
      if (dueSoonRes.status === "fulfilled") {
        setDueSoonRows(dueSoonRes.value?.data || []);
      } else {
        console.error("Failed to load due soon:", dueSoonRes.reason);
      }

      // Also fetch archived rows for archive view
      if (activeView === "archives") {
        try {
          const archiveData = await sortArchivedEntries(email, project, sortType);
          setArchiveRows(archiveData?.data || []);
        } catch (archiveErr) {
          console.error("Failed to load archives:", archiveErr);
        }
      }
    } catch (err) {
      console.error("[Dashboard] loadData exception:", err);
    } finally {
      setLoading(false);
    }
  }, [email, sortBy, activeView]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  // Close drawer on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setFabOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered entries — uses provided sort/search/archive functions
  const filteredEntries = useMemo(() => {
    // If search results are available, use them
    if (searchResults !== null) return searchResults;

    // If archive view, use archiveRows
    if (activeView === "archives") return archiveRows;

    // Otherwise use all entries (unarchived)
    let filtered = [...entries];

    if (activeView === "recent") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((e) => new Date(e.created_at as string) >= weekAgo);
    } else if (activeView !== "all" && activeView !== "drafts" && activeView !== "archives") {
      filtered = filtered.filter((e) => e.project_name === activeView);
    }

    // Apply "due soon" view filter: only entries with due_date within 3 days
    if (viewMode === "due-soon") {
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
  }, [entries, activeView, searchResults, archiveRows, viewMode]);

  // Search using provided search functions
  useEffect(() => {
    if (!searchQuery.trim() || !email) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const result = (activeView !== "all" && activeView !== "recent" && activeView !== "drafts" && activeView !== "archives")
        ? await searchProject(email, activeView, searchQuery.trim())
        : await searchAll(email, searchQuery.trim());
      if (!cancelled) {
        setSearchResults(result?.data || []);
      }
    })();
    return () => { cancelled = true; };
  }, [searchQuery, activeView, email]);

  // User info
  const fullDisplayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "User";
  const preferredName = (() => {
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
  const avatarUrl = user?.user_metadata?.avatar_url;
  const provider = user?.app_metadata?.provider || "email";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate("/signin");
    } catch (err) {
      console.error("Logout error:", err);
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate("/signin");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  const openSettings = (tab: "profile" | "preferences" | "account") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !email) return;
    setCreatingProject(true);
    setNewProjectError(null);
    try {
      await addProject(email, newProjectName.trim(), newProjectDescription.trim() || undefined);
      setNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      console.error("Failed to create project:", err);
      setNewProjectError(message);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleArchiveProject = async (projectName: string) => {
    if (!email) return;
    try {
      await archiveProject(email, projectName);
      await loadData();
    } catch (err) {
      console.error("Failed to archive project:", err);
    }
  };

  const handleUnarchiveProject = async (projectName: string) => {
    if (!email) return;
    try {
      await unarchiveProject(email, projectName);
      await loadData();
    } catch (err) {
      console.error("Failed to unarchive project:", err);
    }
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      {/* Top Navigation */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-left-group">
            <button className="nav-hamburger" onClick={() => setDrawerOpen(!drawerOpen)} aria-label="Toggle menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="nav-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h6" />
                <path d="M8 11h4" />
              </svg>
            </div>
            <span className="nav-title">Digital Logbook</span>
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
                <button className="nav-search-close" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button className="nav-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
            <div className="nav-user">
              <ProfileMenu
                displayName={preferredName}
                email={user?.email || ""}
                avatarUrl={avatarUrl}
                onManageProfile={() => openSettings("profile")}
                onSettings={() => openSettings("preferences")}
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
      <aside className={`drawer ${drawerOpen ? "drawer-open" : ""}`}>
        <div className="drawer-header">
          <span className="drawer-title">Navigation</span>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="drawer-section">
          <p className="drawer-section-title">Views</p>
          <button className={`drawer-item ${activeView === "all" ? "active" : ""}`} onClick={() => { setActiveView("all"); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            All Entries
            <span className="drawer-badge">{entries.length}</span>
          </button>
          <button className={`drawer-item ${activeView === "recent" ? "active" : ""}`} onClick={() => { setActiveView("recent"); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Recent
          </button>
          <button className={`drawer-item ${activeView === "drafts" ? "active" : ""}`} onClick={() => { setActiveView("drafts"); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Drafts
          </button>
          <button className="drawer-item" onClick={() => {}} style={{ opacity: 0.6, cursor: "default" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            My Stats
          </button>
        </div>

        <div className="drawer-section">
          <p className="drawer-section-title">Archive</p>
          <button className={`drawer-item ${activeView === "archives" ? "active" : ""}`} onClick={() => { setActiveView("archives"); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
            Archived Projects
            <span className="drawer-badge">{projects.filter((p) => p.archived).length}</span>
          </button>
          {projects.filter((p) => p.archived).map((project) => {
            const name = project.project_name as string;
            const count = entries.filter((e) => e.project_name === name).length;
            return (
              <button
                key={name}
                className={`drawer-item drawer-item-archived ${activeView === name ? "active" : ""}`}
                onClick={() => { setActiveView(name); setDrawerOpen(false); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                {name}
                <span className="drawer-badge">{count}</span>
                <span
                  className="drawer-item-action"
                  onClick={(e) => { e.stopPropagation(); handleUnarchiveProject(name); }}
                  title="Unarchive project"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                </span>
              </button>
            );
          })}
        </div>

        <div className="drawer-section drawer-projects">
          <p className="drawer-section-title">Projects</p>
          <div className="drawer-project-list">
            {projects.filter((p) => !p.archived).map((project) => {
              const name = project.project_name as string;
              const count = entries.filter((e) => e.project_name === name).length;
              return (
                <button
                  key={name}
                  className={`drawer-item ${activeView === name ? "active" : ""}`}
                  onClick={() => { setActiveView(name); setDrawerOpen(false); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  {name}
                  <span className="drawer-badge">{count}</span>
                  <span
                    className="drawer-item-action"
                    onClick={(e) => { e.stopPropagation(); handleArchiveProject(name); }}
                    title="Archive project"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
                  </span>
                </button>
              );
            })}
            {projects.filter((p) => !p.archived).length === 0 && (
              <p className="drawer-empty">No projects yet</p>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          <button className="btn-primary drawer-new-btn" onClick={() => { setNewProjectOpen(true); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dash-main">
        {/* Feed Header */}
        <div className="feed-header animate-in">
          <div className="feed-header-row">
            <div>
              <h1 className="feed-title">
                {activeView === "all" ? "All Entries" : activeView === "recent" ? "Recent" : activeView === "drafts" ? "Drafts" : activeView === "archives" ? "Archived Projects" : activeView}
              </h1>
              {searchQuery && (
                <p className="feed-subtitle">
                  {filteredEntries.length} result{filteredEntries.length !== 1 ? "s" : ""} for "{searchQuery}"
                </p>
              )}
            </div>
            <div className="feed-stats-box">
              {statsOpen ? (
                <div className="feed-stats-panel">
                  <div className="feed-stats-panel-header">
                    <span className="feed-stats-panel-title">Quick Stats</span>
                    <button className="feed-stats-panel-close" onClick={() => setStatsOpen(false)} aria-label="Close stats">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="feed-stats-panel-body">
                    <div className="feed-stat-item">
                      <span className="feed-stat-value">{entries.length}</span>
                      <span className="feed-stat-label">Total Entries</span>
                    </div>
                    <div className="feed-stat-item">
                      <span className="feed-stat-value">{projects.length}</span>
                      <span className="feed-stat-label">Projects</span>
                    </div>
                    <div className="feed-stat-item">
                      <span className="feed-stat-value">{dueSoonRows.length}</span>
                      <span className="feed-stat-label">Due Soon</span>
                    </div>
                  </div>
                </div>
              ) : (
                <button className="feed-stats-btn" onClick={() => setStatsOpen(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  View Stats
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search bar inline for mobile */}
        <div className="feed-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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
              className={`feed-view-btn ${viewMode === "due-soon" ? "active" : ""}`}
              onClick={() => setViewMode("due-soon")}
            >
              Due Soon
            </button>
            <button
              className={`feed-view-btn ${viewMode === "all-entries" ? "active" : ""}`}
              onClick={() => setViewMode("all-entries")}
            >
              All Entries
            </button>
          </div>
          <div className="feed-sort-group">
            <span className="feed-sort-label">Sort:</span>
            <button
              className={`sort-btn ${sortBy === "date" ? "active" : ""}`}
              onClick={() => setSortBy("date")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Date
            </button>
            <button
              className={`sort-btn ${sortBy === "priority" ? "active" : ""}`}
              onClick={() => setSortBy("priority")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Priority
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="feed-loading">
            <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
            <p>Loading entries...</p>
          </div>
        )}

        {/* Entries feed — always shown (filtered by viewMode + sort) */}
        {!loading && !searchQuery && (
          <div className="entries-feed">
            {filteredEntries.length === 0 ? (
              <div className="empty-state animate-in">
                <div className="empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {viewMode === "due-soon" ? (
                      <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>
                    ) : (
                      <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
                    )}
                  </svg>
                </div>
                <h2 className="empty-title">
                  {viewMode === "due-soon" ? "Nothing due soon" : "No entries to show"}
                </h2>
                <p className="empty-desc">
                  {viewMode === "due-soon"
                    ? "No entries are due within the next 3 days. Switch to \"All Entries\" to see everything."
                    : "No entries match the current filters. Try a different view or sort."}
                </p>
              </div>
            ) : (
              filteredEntries.map((row, i) => (
                <EntryBox key={`entry-${row.id || i}`} entry={row as any} onUpdated={() => loadData()} />
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
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h2 className="empty-title">No results found</h2>
                <p className="empty-desc">No entries match "{searchQuery}". Try a different search term.</p>
              </div>
            ) : (
              <div className="entries-feed">
                {filteredEntries.map((row, i) => (
                  <EntryBox key={`search-${row.id || i}`} entry={row as any} onUpdated={() => loadData()} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* FAB */}
      <div className="fab-container">
        {fabOpen && (
          <div className="fab-menu">
            <button className="fab-menu-item" onClick={() => { setNewEntryOpen(true); setFabOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
              New Entry
            </button>
            <button className="fab-menu-item" onClick={() => { setNewProjectOpen(true); setFabOpen(false); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
              New Project
            </button>
          </div>
        )}
        <button className={`fab ${fabOpen ? "fab-open" : ""}`} onClick={() => setFabOpen(!fabOpen)} aria-label="Quick actions">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
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
              style={{ resize: "vertical", minHeight: "60px" }}
            />
            {newProjectError && (
              <div className="auth-error" style={{ marginBottom: "0.75rem" }}>
                {newProjectError}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setNewProjectOpen(false); setNewProjectDescription(""); setNewProjectError(null); }}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {newEntryOpen && (
        <div className="modal-overlay" onClick={() => { setNewEntryOpen(false); setNewEntryProject(""); }}>
          <div className="modal-card glass modal-card-wide" onClick={(e) => e.stopPropagation()}>
            {!newEntryProject ? (
              <>
                <h2 className="modal-title">New Entry</h2>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", margin: 0 }}>Select a project:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {projects.filter((p) => !p.archived).map((p) => (
                    <button
                      key={p.project_name as string}
                      className="drawer-item"
                      onClick={() => setNewEntryProject(p.project_name as string)}
                      style={{ textAlign: "left", justifyContent: "flex-start" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                      {p.project_name as string}
                    </button>
                  ))}
                  {projects.filter((p) => !p.archived).length === 0 && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>No projects yet. Create one first.</p>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="btn-secondary" onClick={() => { setNewEntryOpen(false); setNewEntryProject(""); }}>Cancel</button>
                </div>
              </>
            ) : (
              <AddEntry
                user_email={email}
                project_name={newEntryProject}
                onAdded={() => { setNewEntryOpen(false); setNewEntryProject(""); loadData(); }}
                onCancel={() => { setNewEntryOpen(false); setNewEntryProject(""); }}
              />
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        initialTab={settingsTab}
        userId={user?.id || ""}
        displayName={fullDisplayName}
        email={user?.email || ""}
        avatarUrl={avatarUrl}
        provider={provider}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={handleDeleteAccount}
        onResetPassword={resetPassword}
        deleting={deleting}
        deleteError={deleteError}
      />
    </div>
  );
}
