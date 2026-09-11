import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Stats } from '@/components/Stats';
import { cacheGet, cacheSubscribe, CACHE_STORES } from '@/lib/cache';

interface HeaderProps {
  title?: string;
  entries?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  dueSoonCount?: number;
}

export function Header({
  title = 'Dashboard',
  entries = [],
  projects = [],
  dueSoonCount = 0,
}: HeaderProps) {
  const { user, deleteAccount, resetPassword } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Listen for open-settings event from NavBar's ProfileMenu
  useEffect(() => {
    const handler = () => setSettingsOpen(true);
    window.addEventListener('open-settings', handler);
    return () => window.removeEventListener('open-settings', handler);
  }, []);

  // Profile info from IndexedDB
  const [profileData, setProfileData] = useState<{ displayName: string; avatarUrl: string }>({
    displayName:
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User',
    avatarUrl: user?.user_metadata?.avatar_url || '',
  });

  useEffect(() => {
    if (!user?.email) return () => {};

    const loadProfile = async () => {
      try {
        const cached = await cacheGet(CACHE_STORES.PROFILE, user.email!);
        if (cached?.data) {
          const profile = cached.data;
          const displayName =
            profile.username || profile.name || profile.display_name || user.email;
          const avatarUrl = profile.avatar || user?.user_metadata?.avatar_url || '';
          setProfileData({ displayName, avatarUrl });
        }
      } catch (err) {
        console.error('[Header] Failed to load profile from cache:', err);
      }
    };

    loadProfile();

    // Re-read when syncAllData writes the profile to IndexedDB
    const unsub = cacheSubscribe(CACHE_STORES.PROFILE, user.email, () => loadProfile());
    return () => unsub();
  }, [user?.email, user?.user_metadata]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Feed Header */}
      <div className="feed-header animate-in">
        <div className="feed-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1 className="feed-title">{title}</h1>
          </div>
          <Stats entries={entries} projects={projects} dueSoonCount={dueSoonCount} />
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        initialTab="profile"
        userId={user?.id || ''}
        displayName={profileData.displayName}
        email={user?.email || ''}
        avatarUrl={profileData.avatarUrl}
        provider={user?.app_metadata?.provider || 'email'}
        onClose={() => setSettingsOpen(false)}
        onDeleteAccount={handleDeleteAccount}
        onResetPassword={resetPassword}
        deleting={deleting}
        deleteError={deleteError}
      />
    </>
  );
}
