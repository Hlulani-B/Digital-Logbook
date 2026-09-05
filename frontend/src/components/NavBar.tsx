import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ProfileMenu } from '@/components/ProfileMenu';
import { FiArchive } from 'react-icons/fi';
import { cacheGet, CACHE_STORES } from '@/lib/cache';

interface NavBarProps {
  projects?: Array<Record<string, unknown>>;
  entries?: Array<Record<string, unknown>>;
  activeView?: string;
  onArchiveProject?: (projectName: string) => void;
  onNewProject?: () => void;
}

export function NavBar({ projects: projectsProp = [], entries: entriesProp = [], activeView = 'all', onArchiveProject, onNewProject }: NavBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Load projects and entries from IndexedDB directly (local-first)
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>(() => 
    Array.isArray(projectsProp) && projectsProp.length > 0 ? projectsProp : []
  );
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>(() => 
    Array.isArray(entriesProp) && entriesProp.length > 0 ? entriesProp : []
  );

  useEffect(() => {
    const loadData = async () => {
      if (!user?.email) return;
      try {
        // Load projects from IndexedDB
        const cachedProjects = await cacheGet(CACHE_STORES.PROJECTS, user.email);
        if (cachedProjects?.data || cachedProjects?.projects) {
          const rawProjects = cachedProjects.data || cachedProjects.projects || [];
          const projectsList = Array.isArray(rawProjects) ? rawProjects : [];
          setProjects(projectsList.filter((p: Record<string, unknown>) => !p.archived));
        }
        // Load entries from IndexedDB
        const cachedEntries = await cacheGet(CACHE_STORES.ALL_ENTRIES, user.email);
        if (cachedEntries?.data) {
          const entriesList = Array.isArray(cachedEntries.data) ? cachedEntries.data : [];
          setEntries(entriesList);
        }
      } catch (err) {
        console.error('[NavBar] Failed to load data from cache:', err);
      }
    };
    loadData();
  }, [user?.email]);

  // Use props if provided, otherwise use IndexedDB data
  const safeProjects = (Array.isArray(projectsProp) && projectsProp.length > 0 ? projectsProp : projects) as Array<Record<string, unknown>>;
  const safeEntries = (Array.isArray(entriesProp) && entriesProp.length > 0 ? entriesProp : entries) as Array<Record<string, unknown>>;

  // Profile info from IndexedDB
  const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const [profileData, setProfileData] = useState<{ preferredName: string; avatarUrl: string }>({
    preferredName: fallbackName,
    avatarUrl: user?.user_metadata?.avatar_url || '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.email) return;
      try {
        const cached = await cacheGet(CACHE_STORES.PROFILE, user.email);
        if (cached?.data) {
          const profile = cached.data;
          // Field names from profile service: avatar, username, name
          const preferredName = profile.username || profile.name || profile.display_name || user.email;
          const avatarUrl = profile.avatar || user?.user_metadata?.avatar_url || '';
          setProfileData({ preferredName, avatarUrl });
        }
      } catch (err) {
        console.error('[NavBar] Failed to load profile from cache:', err);
      }
    };
    loadProfile();
  }, [user?.email, user?.user_metadata]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
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
            <div className="nav-user">
              <ProfileMenu
                displayName={profileData.preferredName}
                email={user?.email || ''}
                avatarUrl={profileData.avatarUrl}
                onManageProfile={() => navigate('/create-profile')}
                onSettings={() => navigate('/dashboard')}
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
            <span className="drawer-badge">{safeEntries.length}</span>
          </button>
          <button
            className="drawer-item"
            onClick={() => {
              navigate('/entries');
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            All Entries
          </button>
          <button
            className={`drawer-item ${activeView === 'archives' ? 'active' : ''}`}
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
            className={`drawer-item ${isActive('/stats') ? 'active' : ''}`}
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
            className={`drawer-item ${isActive('/dashboard/activity') ? 'active' : ''}`}
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
          <button
            className={`drawer-item ${isActive('/calendar') ? 'active' : ''}`}
            onClick={() => {
              navigate('/calendar');
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
          </button>
          <button
            className={`drawer-item ${isActive('/kanban') ? 'active' : ''}`}
            onClick={() => {
              navigate('/kanban');
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
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Kanban
          </button>
          <button
            className={`drawer-item ${isActive('/today') ? 'active' : ''}`}
            onClick={() => {
              navigate('/today');
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
            Today
          </button>
        </div>

        <div className="drawer-section drawer-projects">
          <p className="drawer-section-title">Projects</p>
          <div className="drawer-project-list">
            {safeProjects
              .filter((p) => !p.archived)
              .map((project) => {
                const name = project.project_name as string;
                const count = safeEntries.filter((e) => e.project_name === name).length;
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
                    {onArchiveProject && (
                      <button
                        type="button"
                        onClick={() => onArchiveProject(name)}
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
                    )}
                  </div>
                );
              })}
            {safeProjects.filter((p) => !p.archived).length === 0 && (
              <p className="drawer-empty">No projects yet. Create one below.</p>
            )}
          </div>
        </div>

        <div className="drawer-footer">
          <button
            className="btn-primary drawer-new-btn"
            onClick={() => {
              if (onNewProject) onNewProject();
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
    </>
  );
}
