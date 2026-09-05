import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SettingsPanel } from '@/components/SettingsPanel';
import { Stats } from '@/components/Stats';

interface HeaderProps {
  title?: string;
  entries?: Array<Record<string, unknown>>;
  projects?: Array<Record<string, unknown>>;
  dueSoonCount?: number;
}

export function Header({ title = 'Dashboard', entries = [], projects = [], dueSoonCount = 0 }: HeaderProps) {
  const { user, deleteAccount, resetPassword } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'preferences' | 'account'>('profile');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Profile info
  const fullDisplayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url;
  const provider = user?.app_metadata?.provider || 'email';

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

  const openSettings = (tab: 'profile' | 'preferences' | 'account') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
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
    </>
  );
}
