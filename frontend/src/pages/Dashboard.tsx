import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProfileMenu } from "@/components/ProfileMenu";
import { SettingsPanel } from "@/components/SettingsPanel";
import { getProjectsByEmail, addProject } from "@/functions/project/project.js";
import { getAllEntries, addEntry } from "@/functions/project/entries.js";
import { archiveProject, unarchiveProject, archiveEntry } from "@/functions/project/archives.js";
import { dueSoon, upNext } from "@/functions/dashboard.js";
import { EntryBox } from "@/pages/NewEntry";

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

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueSoonRows, setDueSoonRows] = useState<Entry[]>([]);
  const [upNextRows, setUpNextRows] = useState<Entry[]>([]);

  // Sort state
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");

  // FAB menu
  const [fabOpen, setFabOpen] = useState(false);

  // New project modal
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // New entry modal
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEntryProject, setNewEntryProject] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [creatingEntry, setCreatingEntry] = useState(false);

  const email = user?.email || "";

  // Load data
  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const [projectsRes, entriesRes, dueSoonRes, upNextRes] = await Promise.all([
        getProjectsByEmail(email),
        getAllEntries(email),
        dueSoon(email, null),
        upNext(email, null),
      ]);
      setProjects(projectsRes?.projects || []);
      setEntries(entriesRes?.data || []);
      setDueSoonRows(dueSoonRes?.data || []);
      setUpNextRows(upNextRes?.data || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [email]);

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

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Filter by view
    if (activeView === "recent") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((e) => new Date(e.created_at as string) >= weekAgo);
      // Only unarchived in recent
      filtered = filtered.filter((e) => !e.archived);
    } else if (activeView === "archives") {
      // Show only archived entries
      filtered = filtered.filter((e) => e.archived);
    } else if (activeView !== "all" && activeView !== "drafts") {
      // Filter by project name
      filtered = filtered.filter((e) => e.project_name === activeView);
      // Only unarchived when viewing a specific project
      filtered = filtered.filter((e) => !e.archived);
    } else {
      // Default: only show unarchived
      filtered = filtered.filter((e) => !e.archived);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const entryObj = e.entries as Record<string, unknown> | string;
        const entryStr = typeof entryObj === "string" ? entryObj : JSON.stringify(entryObj);
        return (
          (e.project_name as string)?.toLowerCase().includes(q) ||
          entryStr.toLowerCase().includes(q) ||
          (e.title as string)?.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sortBy === "priority") {
      const priorityOrder = ['Urgent and important', 'Urgent but not important', 'Not urgent, not important'];
      filtered.sort((a, b) => {
        const aIdx = priorityOrder.indexOf(a.priority as string);
        const bIdx = priorityOrder.indexOf(b.priority as string);
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });
    } else {
      // Sort by created_at descending
      filtered.sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    }

    return filtered;
  }, [entries, activeView, searchQuery, sortBy]);

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
    try {
      await addProject(email, newProjectName.trim());
      setNewProjectOpen(false);
      setNewProjectName("");
      await loadData();
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateEntry = async () => {
    if (!newEntryContent.trim() || !newEntryProject || !email) return;
    setCreatingEntry(true);
    try {
      await addEntry(email, newEntryProject, newEntryContent.trim(), null);
      setNewEntryOpen(false);
      setNewEntryContent("");
      setNewEntryProject("");
      await loadData();
    } catch (err) {
      console.error("Failed to create entry:", err);
    } finally {
      setCreatingEntry(false);
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

  const handleArchiveEntry = async (projectName: string, entry: unknown) => {
    if (!email) return;
    try {
      await archiveEntry(email, projectName, entry);
      await loadData();
    } catch (err) {
      console.error("Failed to archive entry:", err);
    }
  };

  const getEntrySnippet = (entry: Entry): string => {
    const entryObj = entry.entries as Record<string, unknown> | string;
    if (typeof entryObj === "string") return entryObj.slice(0, 120);
    if (entryObj && typeof entryObj === "object") {
      const values = Object.values(entryObj);
      return values.join(" ").slice(0, 120);
    }
    return "No content";
  };

  const getEntryDate = (entry: Entry): string => {
    const date = new Date(entry.created_at as string);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
          <h1 className="feed-title">
            {activeView === "all" ? "All Entries" : activeView === "recent" ? "Recent" : activeView === "drafts" ? "Drafts" : activeView === "archives" ? "Archived Projects" : activeView}
          </h1>
          {searchQuery && (
            <p className="feed-subtitle">
              {filteredEntries.length} result{filteredEntries.length !== 1 ? "s" : ""} for "{searchQuery}"
            </p>
          )}
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

        {/* Loading */}
        {loading && (
          <div className="feed-loading">
            <div className="animate-spin" style={{ width: 24, height: 24, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)" }} />
            <p>Loading entries...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredEntries.length === 0 && (
          <div className="empty-state animate-in">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
            </div>
            <h2 className="empty-title">
              {searchQuery ? "No matching entries" : "No entries yet"}
            </h2>
            <p className="empty-desc">
              {searchQuery
                ? `No entries match "${searchQuery}". Try a different search term.`
                : "Start logging your work. Create your first entry to get started."}
            </p>
            {!searchQuery && (
              <button className="btn-primary empty-cta" onClick={() => setNewEntryOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create your first entry
              </button>
            )}
          </div>
        )}

        {/* Sections: Due Soon + Up Next */}
        {!loading && (
          <div className="dashboard-sections">
            {/* Due Soon — top left, default view */}
            <section className="dash-section dash-section-due">
              <div className="dash-section-header">
                <h2 className="dash-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Due Soon
                </h2>
              </div>
              <div className="dash-section-body">
                {dueSoonRows.length > 0 ? (
                  dueSoonRows.map((row, i) => (
                    <EntryBox key={`due-${row.id || i}`} entry={row as any} onUpdated={() => loadData()} />
                  ))
                ) : (
                  <p className="dash-section-empty">Nothing due soon</p>
                )}
              </div>
            </section>

            {/* Up Next — This Week */}
            <section className="dash-section dash-section-upnext">
              <div className="dash-section-header">
                <h2 className="dash-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Up Next <span className="dash-section-sub">This Week</span>
                </h2>
              </div>
              <div className="dash-section-body">
                {upNextRows.length > 0 ? (
                  upNextRows.map((row, i) => (
                    <EntryBox key={`upnext-${row.id || i}`} entry={row as any} onUpdated={() => loadData()} />
                  ))
                ) : (
                  <p className="dash-section-empty">Nothing up next this week</p>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Sort controls — below sections */}
        {!loading && filteredEntries.length > 0 && (
          <div className="feed-sort-controls">
            <button className={`sort-btn ${sortBy === "date" ? "active" : ""}`} onClick={() => setSortBy("date")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Date
            </button>
            <button className={`sort-btn ${sortBy === "priority" ? "active" : ""}`} onClick={() => setSortBy("priority")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
              Priority
            </button>
          </div>
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
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setNewProjectOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {newEntryOpen && (
        <div className="modal-overlay" onClick={() => setNewEntryOpen(false)}>
          <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">New Entry</h2>
            <select
              className="field-input"
              value={newEntryProject}
              onChange={(e) => setNewEntryProject(e.target.value)}
            >
              <option value="">Select a project...</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.project_name as string} value={p.project_name as string}>{p.project_name as string}</option>
              ))}
            </select>
            <textarea
              placeholder="What did you work on?"
              value={newEntryContent}
              onChange={(e) => setNewEntryContent(e.target.value)}
              className="field-input"
              rows={4}
              autoFocus
              style={{ resize: "vertical", minHeight: "80px" }}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setNewEntryOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateEntry} disabled={creatingEntry || !newEntryContent.trim() || !newEntryProject}>
                {creatingEntry ? "Saving..." : "Save Entry"}
              </button>
            </div>
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
