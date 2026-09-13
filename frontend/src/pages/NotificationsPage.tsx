import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import {
  getNotificationHistory,
  markNotificationRead,
  markAllNotificationsRead,
  snoozeNotification,
  dismissNotification,
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
  snoozed_until: string | null;
}

type FilterType = 'all' | 'unread' | 'due_soon' | 'overdue';
const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'overdue', label: 'Overdue' },
];
const SNOOZE_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'tomorrow', label: 'Tomorrow 8am' },
] as const;

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
  const [filter, setFilter] = useState<FilterType>('all');
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number, append: boolean, currentFilter: FilterType) => {
      if (!email) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const filters: Record<string, unknown> = {};
        if (currentFilter === 'unread') filters.unreadOnly = true;
        if (currentFilter === 'due_soon' || currentFilter === 'overdue')
          filters.type = currentFilter;
        const result = await getNotificationHistory(email, PAGE_SIZE, offset, filters);
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
    load(0, false, filter);
  }, [load, filter]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    setItems([]);
    setTotal(0);
  };

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

  const handleSnooze = async (id: string, duration: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    setSnoozeMenuId(null);
    await snoozeNotification(email, id, duration).catch(() => {});
  };

  const handleDismiss = async (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    await dismissNotification(email, id).catch(() => {});
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
            <div className="notif-filter-tabs">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`notif-filter-tab ${filter === f.value ? 'notif-filter-tab--active' : ''}`}
                  onClick={() => handleFilterChange(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="notif-history-summary">
              {total === 0
                ? 'No notifications'
                : `${total} notification${total === 1 ? '' : 's'}${unreadCount > 0 ? ` \u00b7 ${unreadCount} unread` : ''}`}
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
                <div
                  key={n.id}
                  className={`notif-history-item-wrap ${n.read ? 'notif-history-item-wrap--read' : ''}`}
                >
                  <button
                    type="button"
                    className="notif-history-item"
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
                        {n.entry_title || (n.project_name ? `${n.project_name} entry` : 'Entry')}
                      </span>
                      <span className="notif-item-meta">
                        {n.project_name ? `${n.project_name} \u00b7 ` : ''}
                        {formatDue(n.due_at) || relativeTime(n.created_at)}
                        {' \u00b7 '}
                        {relativeTime(n.created_at)}
                      </span>
                    </span>
                    {!n.read && <span className="notif-unread-pip" aria-hidden="true" />}
                  </button>
                  <div className="notif-item-actions">
                    <button
                      type="button"
                      className="notif-action-btn"
                      title="Snooze"
                      aria-label="Snooze notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSnoozeMenuId((prev) => (prev === n.id ? null : n.id));
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="notif-action-btn"
                      title="Dismiss"
                      aria-label="Dismiss notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss(n.id);
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                    {snoozeMenuId === n.id && (
                      <div className="notif-snooze-menu" role="menu">
                        {SNOOZE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            className="notif-snooze-option"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSnooze(n.id, opt.value);
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
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
                onClick={() => load(items.length, true, filter)}
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
