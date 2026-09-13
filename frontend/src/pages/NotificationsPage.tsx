import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import {
  getNotificationHistory,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/functions/project/notifications.js';

interface NotificationRow {
  id: string;
  entry_id: string | null;
  project_name: string | null;
  entry_title: string | null;
  type: 'due_soon' | 'overdue';
  due_at: string | null;
  read: boolean;
  created_at: string;
}

const PAGE_SIZE = 50;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Full notification history — every due-soon / overdue alert still stored
 * for the user, read and unread, newest first. Read rows are pruned after
 * 30 days by the migration 011 cron job, so this page shows everything
 * the notifications table holds.
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const email = user?.email || '';
  const navigate = useNavigate();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      if (!email) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await getNotificationHistory(email, PAGE_SIZE, offset);
        if (result?.success && result.data) {
          const rows = (result.data.notifications || []) as NotificationRow[];
          setItems((prev) => (append ? [...prev, ...rows] : rows));
          setTotal(result.data.total ?? 0);
        } else {
          setError(result?.message || 'Failed to load notifications');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notifications');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [email]
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  const handleOpen = async (n: NotificationRow) => {
    if (!n.read) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
      markNotificationRead(email, n.id).catch(() => {});
    }
    if (n.project_name) {
      navigate(`/project/${encodeURIComponent(n.project_name)}`);
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
    await markAllNotificationsRead(email).catch(() => {});
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />
      <NavBar activeView="all" />
      <main className="dash-main">
        <Header title="Notifications" />
        <div className="notif-history-page">
          <div className="notif-history-toolbar">
            <p className="notif-history-summary">
              {total === 0
                ? 'No notifications yet'
                : `${total} notification${total === 1 ? '' : 's'}${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
            </p>
            {unreadCount > 0 && (
              <button type="button" className="notif-mark-all" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          {loading && <p className="notif-history-status">Loading…</p>}
          {!loading && error && <p className="notif-history-status">{error}</p>}
          {!loading && !error && items.length === 0 && (
            <p className="notif-history-status">
              Nothing needs attention. Due-date reminders will appear here.
            </p>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="notif-history-list">
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-history-item ${n.read ? 'notif-history-item--read' : ''}`}
                  onClick={() => handleOpen(n)}
                >
                  <span
                    className={`notif-dot ${
                      n.type === 'overdue' ? 'notif-dot--overdue' : 'notif-dot--due-soon'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="notif-item-text">
                    <span className="notif-item-title">
                      {n.type === 'overdue' ? 'Overdue: ' : 'Due soon: '}
                      {n.entry_title || 'Untitled entry'}
                    </span>
                    <span className="notif-item-meta">
                      {n.project_name ? `${n.project_name} · ` : ''}
                      {formatDue(n.due_at) || relativeTime(n.created_at)}
                      {' · '}
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                  {!n.read && <span className="notif-unread-pip" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}

          {!loading && !error && items.length < total && (
            <div className="notif-history-more">
              <p className="notif-history-showing">
                Showing {items.length} of {total}
              </p>
              <button
                type="button"
                className="btn-secondary"
                disabled={loadingMore}
                onClick={() => load(items.length, true)}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default NotificationsPage;
