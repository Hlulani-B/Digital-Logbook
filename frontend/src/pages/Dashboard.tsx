import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ProfileMenu } from "@/components/ProfileMenu";
import { SettingsPanel } from "@/components/SettingsPanel";

export function Dashboard() {
  const { user, signOut, deleteAccount } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "preferences" | "account">("profile");
  const navigate = useNavigate();

  // Check if this is a new user synchronously and mark as visited
  const isNewUser = useMemo(() => {
    if (!user?.id) return true;
    const key = `dl_visited_${user.id}`;
    const hasVisited = localStorage.getItem(key);
    if (!hasVisited) {
      localStorage.setItem(key, "true");
      return true;
    }
    return false;
  }, [user?.id]);

  const fullDisplayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User";

  // Use preferred name if set, otherwise fall back to Google name
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
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account"
      );
      setDeleting(false);
    }
  };

  const openSettings = (tab: "profile" | "preferences" | "account") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-brand">
            <div className="nav-logo">DL</div>
            <span className="nav-title">Digital Logbook</span>
          </div>

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
      </nav>

      {/* Main */}
      <main className="dash-main">
        {/* Greeting */}
        <div className="dash-greeting animate-in">
          <h1>
            {isNewUser ? "Welcome" : "Welcome back"}, {preferredName}
          </h1>
          <p>Your digital logbook dashboard</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="glass glass-hover stat-card animate-in animate-in-delay-1">
            <div className="stat-icon purple">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="stat-label">Total Entries</p>
            <p className="stat-value">0</p>
          </div>

          <div className="glass glass-hover stat-card animate-in animate-in-delay-2">
            <div className="stat-icon green">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="stat-label">This Week</p>
            <p className="stat-value">0</p>
          </div>

          <div className="glass glass-hover stat-card animate-in animate-in-delay-3">
            <div className="stat-icon amber">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <p className="stat-label">Projects</p>
            <p className="stat-value">0</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass section-card animate-in animate-in-delay-3">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-row">
            <button className="btn-primary">
              <span className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Entry
              </span>
            </button>
            <button className="btn-secondary">
              <span className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                View All Entries
              </span>
            </button>
            <button className="btn-secondary">
              <span className="flex items-center gap-2">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Data
              </span>
            </button>
          </div>
        </div>
      </main>

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
        deleting={deleting}
        deleteError={deleteError}
      />
    </div>
  );
}
