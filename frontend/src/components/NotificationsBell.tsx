import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
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

const POLL_INTERVAL_MS = 60_000;
const SNOOZE_OPTIONS = [
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: 'tomorrow', label: 'Tomorrow 8am' },
] as const;

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
 * Bell icon with unread badge in the top nav. Polls the notifications
 * service every 60s (and on window focus); rows are generated server-side
 * by the hourly pg_cron job, so the badge refreshes within a poll interval
 * of any active session.
 */
export function NotificationsBell({ email }: { email: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snoozeMenuId, setSnoozeMenuId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnreadIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!email || !navigator.onLine) return;
    setLoading(true);
    try {
      const result = await getNotifications(email);
      if (result?.success && result.data) {
        const newItems = (result.data.notifications || []) as NotificationRow[];
        setItems(newItems);
        const newUnread = result.data.unreadCount ?? 0;
        setUnreadCount(newUnread);

        // Browser toast: fire a native notification for each newly-arrived
        // unread item (ones that weren't in the previous poll).
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const newUnreadIds = new Set(newItems.filter((n) => !n.read).map((n) => n.id));
          for (const n of newItems) {
            if (!n.read && !prevUnreadIds.current.has(n.id)) {
              const title = n.type === 'overdue' ? 'Overdue' : 'Due soon';
              const body = n.entry_title || (n.project_name ? `${n.project_name} entry` : 'Entry');
              new Notification(`${title}: ${body}`, {
                icon: '/favicon.ico',
                tag: n.id,
              });
            }
          }
          prevUnreadIds.current = newUnreadIds;
        }
      }
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_INTERVAL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    // Request browser notification permission on first mount
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleOpenItem = async (n: NotificationRow) => {
    if (!n.read) {
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationRead(email, n.id).catch(() => {});
    }
    setOpen(false);
    if (n.project_name) {
      navigate(`/project/${encodeURIComponent(n.project_name)}`);
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead(email).catch(() => {});
  };

  const handleSnooze = async (id: string, duration: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    setSnoozeMenuId(null);
    await snoozeNotification(email, id, duration).catch(() => {});
  };

  const handleDismiss = async (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setUnreadCount((c) => Math.max(0, c - 1));
    await dismissNotification(email, id).catch(() => {});
  };

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="notif-bell-btn"
        onClick={() => setOpen((o) => !o)}
        title={unreadCount > 0 ? `${unreadCount} unread notification(s)` : 'Notifications'}
        aria-label="Notifications"
        aria-expanded={open}
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
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel" role="menu" aria-label="Notification list">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-mark-all" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {loading && items.length === 0 && <p className="notif-empty">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="notif-empty">
                Nothing needs attention. Due-date reminders will appear here.
              </p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`notif-item-wrap ${n.read ? 'notif-item-wrap--read' : ''}`}
              >
                <button type="button" className="notif-item" onClick={() => handleOpenItem(n)}>
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

          <div className="notif-panel-footer">
            <button
              type="button"
              className="notif-view-all"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;
