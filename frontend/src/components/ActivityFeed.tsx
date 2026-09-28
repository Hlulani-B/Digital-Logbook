import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActivities, getDigest } from '@/functions/activity.js';

type Activity = {
  id: number;
  user_email: string;
  action_type: string;
  entity_type: string;
  entity_name: string;
  details: Record<string, unknown>;
  created_at: string;
};

// Maps each action_type to an SVG icon + verb phrase
const ACTION_CONFIG: Record<string, { icon: ReactNode; verb: string; entityLabel: string }> = {
  PROJECT_CREATED: {
    verb: 'created',
    entityLabel: 'project',
    icon: (
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
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  PROJECT_RENAMED: {
    verb: 'renamed',
    entityLabel: 'project',
    icon: (
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
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  PROJECT_DELETED: {
    verb: 'deleted',
    entityLabel: 'project',
    icon: (
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
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  PROJECT_ARCHIVED: {
    verb: 'archived',
    entityLabel: 'project',
    icon: (
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
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  PROJECT_UNARCHIVED: {
    verb: 'unarchived',
    entityLabel: 'project',
    icon: (
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
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  ENTRY_ADDED: {
    verb: 'added',
    entityLabel: 'entry',
    icon: (
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  ENTRY_UPDATED: {
    verb: 'updated',
    entityLabel: 'entry',
    icon: (
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M12 18v-6" />
        <path d="M9 15l3 3 3-3" />
      </svg>
    ),
  },
  ENTRY_DELETED: {
    verb: 'deleted',
    entityLabel: 'entry',
    icon: (
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  ENTRY_ARCHIVED: {
    verb: 'archived',
    entityLabel: 'entry',
    icon: (
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
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
      </svg>
    ),
  },
  ENTRY_UNARCHIVED: {
    verb: 'unarchived',
    entityLabel: 'entry',
    icon: (
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
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
      </svg>
    ),
  },
  FIELD_ADDED: {
    verb: 'added',
    entityLabel: 'field',
    icon: (
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
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  FIELD_EDITED: {
    verb: 'edited',
    entityLabel: 'field',
    icon: (
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
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  PRIORITY_SET: {
    verb: 'set priority on',
    entityLabel: 'entry',
    icon: (
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
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
};

const FALLBACK_CONFIG = {
  verb: 'performed action on',
  entityLabel: 'item',
  icon: (
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

// Priority numeric value → label
const PRIORITY_LABELS: Record<string, string> = {
  '0': 'Urgent and important',
  '1': 'Urgent but not important',
  '2': 'Not urgent, not important',
};

// Human-readable labels for detail keys
const DETAIL_LABELS: Record<string, string> = {
  project_name: 'Project',
  old_project_name: 'Old name',
  new_project_name: 'New name',
  description: 'Description',
  due_date: 'Due date',
  priority: 'Priority',
  entry_id: 'Entry ID',
  source: 'Source',
  field_name: 'Field',
  data_type: 'Type',
  is_required: 'Required',
};

function formatDetailValue(key: string, value: unknown): string {
  if (value == null) return '—';
  if (key === 'priority') return PRIORITY_LABELS[String(value)] || String(value);
  if (key === 'is_required') return value ? 'Yes' : 'No';
  if (key === 'source') return value === 'natural-language' ? 'Quick Add (AI)' : String(value);
  if (key === 'due_date' && value) {
    const d = new Date(String(value));
    if (!isNaN(d.getTime()))
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return String(value);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/** Truncate only very long project/entity display names; entry text is shown in full. */
function truncateName(name: string | null | undefined, max = 120): string {
  if (!name) return '';
  return name.length > max ? name.slice(0, max) + '\u2026' : name;
}

/** If entity_name is a JSON string like {"field":"Buy bedding"}, extract the value. */
function parseEntityName(name: string | null | undefined): string {
  if (!name) return '';
  try {
    const parsed = JSON.parse(name);
    if (typeof parsed === 'object' && parsed !== null) {
      // Return the first string value found
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string') return val;
      }
    }
    if (typeof parsed === 'string') return parsed;
  } catch {
    // Not JSON, return as-is
  }
  return name;
}

type DigestData = {
  period: string;
  total: number;
  categories: { category: string; count: number }[];
  topProjects: { project_name: string; count: number }[];
  topEntries: { entity_name: string; count: number }[];
};

type ViewMode = 'feed' | 'digest';
type DigestPeriod = 'daily' | 'weekly';

interface ActivityFeedProps {
  /** Called when the feed finishes loading (used for parent loading state) */
  onLoadingChange?: (loading: boolean) => void;
}

export function ActivityFeed({ onLoadingChange }: ActivityFeedProps) {
  const { user } = useAuth();
  const email = user?.email || '';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [digestPeriod, setDigestPeriod] = useState<DigestPeriod>('daily');
  const [digestLoading, setDigestLoading] = useState(false);

  const loadActivities = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const result = await getActivities(email, 50);
      setActivities(result?.data || []);
    } catch (err) {
      console.error('[ActivityFeed] Failed to load activities:', err);
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [email, onLoadingChange]);

  const loadDigest = useCallback(async () => {
    if (!email) return;
    setDigestLoading(true);
    try {
      const result = await getDigest(email, digestPeriod);
      setDigest(result?.data || null);
    } catch (err) {
      console.error('[ActivityFeed] Failed to load digest:', err);
    } finally {
      setDigestLoading(false);
    }
  }, [email, digestPeriod]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    if (viewMode === 'digest') {
      loadDigest();
    }
  }, [viewMode, loadDigest]);

  if (loading && viewMode === 'feed') {
    return (
      <div className="feed-loading">
        <div
          className="animate-spin spinner-circle"
          style={{
            width: 24,
            height: 24,
          }}
        />
        <p>Loading activity...</p>
      </div>
    );
  }

  const CATEGORY_LABELS: Record<string, string> = {
    projects: 'Projects',
    entries: 'Entries',
    fields: 'Fields',
    timer: 'Timer',
    profile: 'Profile',
    priority: 'Priority',
    other: 'Other',
  };

  const CATEGORY_COLORS: Record<string, string> = {
    projects: '#22c55e',
    entries: '#3b82f6',
    fields: '#a855f7',
    timer: '#14b8a6',
    profile: '#ec4899',
    priority: '#f97316',
    other: '#6b7280',
  };

  const viewToggle = (
    <div
      className="activity-view-toggle"
      style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '12px',
        padding: '3px',
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}
    >
      <button
        type="button"
        onClick={() => setViewMode('feed')}
        style={{
          flex: 1,
          padding: '6px 12px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          border: 'none',
          borderRadius: 'calc(var(--radius-sm) - 2px)',
          cursor: 'pointer',
          background: viewMode === 'feed' ? 'var(--accent)' : 'transparent',
          color: viewMode === 'feed' ? '#fff' : 'var(--text-secondary)',
          transition: 'all 0.15s ease',
        }}
      >
        Feed
      </button>
      <button
        type="button"
        onClick={() => setViewMode('digest')}
        style={{
          flex: 1,
          padding: '6px 12px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          border: 'none',
          borderRadius: 'calc(var(--radius-sm) - 2px)',
          cursor: 'pointer',
          background: viewMode === 'digest' ? 'var(--accent)' : 'transparent',
          color: viewMode === 'digest' ? '#fff' : 'var(--text-secondary)',
          transition: 'all 0.15s ease',
        }}
      >
        Digest
      </button>
    </div>
  );

  if (viewMode === 'digest') {
    return (
      <div className="activity-feed">
        {viewToggle}

        {/* Period toggle */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '16px',
          }}
        >
          {(['daily', 'weekly'] as DigestPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDigestPeriod(p)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 500,
                border: '1px solid',
                borderColor: digestPeriod === p ? 'var(--accent)' : 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                background: digestPeriod === p ? 'var(--accent-glow)' : 'transparent',
                color: digestPeriod === p ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {p === 'daily' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>

        {digestLoading ? (
          <div className="feed-loading" style={{ textAlign: 'center', padding: '24px' }}>
            <div className="animate-spin spinner-circle" style={{ width: 20, height: 20 }} />
            <p style={{ fontSize: '0.8125rem' }}>Loading digest...</p>
          </div>
        ) : !digest || digest.total === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              No activity {digestPeriod === 'daily' ? 'today' : 'this week'}.
            </p>
          </div>
        ) : (
          <div className="digest-content animate-in">
            {/* Total */}
            <div
              style={{
                textAlign: 'center',
                padding: '16px',
                marginBottom: '16px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>
                {digest.total}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                actions {digestPeriod === 'daily' ? 'today' : 'this week'}
              </div>
            </div>

            {/* Category breakdown */}
            {digest.categories.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}
                >
                  By Category
                </h4>
                {digest.categories.map((cat) => {
                  const pct = digest.total > 0 ? Math.round((cat.count / digest.total) * 100) : 0;
                  const color = CATEGORY_COLORS[cat.category] || '#6b7280';
                  return (
                    <div key={cat.category} style={{ marginBottom: '6px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.8125rem',
                          marginBottom: '2px',
                        }}
                      >
                        <span style={{ color }}>
                          {CATEGORY_LABELS[cat.category] || cat.category}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {cat.count} ({pct}%)
                        </span>
                      </div>
                      <div
                        style={{
                          height: '4px',
                          background: 'var(--border)',
                          borderRadius: '2px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: color,
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top projects */}
            {digest.topProjects.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}
                >
                  Top Projects
                </h4>
                {digest.topProjects.map((proj) => (
                  <div
                    key={proj.project_name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      padding: '4px 0',
                    }}
                  >
                    <span style={{ color: 'var(--text)' }}>
                      {truncateName(parseEntityName(proj.project_name), 40)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{proj.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top entries */}
            {digest.topEntries.length > 0 && (
              <div>
                <h4
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-secondary)',
                    marginBottom: '8px',
                  }}
                >
                  Top Entries
                </h4>
                {digest.topEntries.map((entry) => (
                  <div
                    key={entry.entity_name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      padding: '4px 0',
                    }}
                  >
                    <span style={{ color: 'var(--text)' }}>
                      {truncateName(parseEntityName(entry.entity_name), 40)}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="activity-feed">
        {viewToggle}
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
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h2 className="empty-title">No activity yet</h2>
          <p className="empty-desc">
            Your recent actions — creating projects, adding entries, archiving, and more — will
            appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {viewToggle}
      {activities.map((activity, i) => {
        const config = ACTION_CONFIG[activity.action_type] || FALLBACK_CONFIG;
        const entityName = truncateName(parseEntityName(activity.entity_name));
        const details = activity.details || {};
        const detailEntries = Object.entries(details).filter(
          ([key, val]) =>
            val != null &&
            val !== '' &&
            key !== 'old_project_name' &&
            key !== 'new_project_name' &&
            key !== 'entry_id'
        );
        const isRename = activity.action_type === 'PROJECT_RENAMED';
        const oldName = String(details.old_project_name ?? '');
        const newName = String(details.new_project_name ?? '');

        return (
          <div
            key={activity.id || i}
            className="activity-item animate-in"
            style={{ animationDelay: `${Math.min(i, 5) * 0.06}s` }}
          >
            <div className="activity-icon">{config.icon}</div>
            <div className="activity-body">
              <p className="activity-text">
                <span className="activity-verb">{config.verb}</span>{' '}
                <span className="activity-entity-label">{config.entityLabel}</span>
                {entityName && (
                  <>
                    {' '}
                    <span className="activity-entity-name">"{entityName}"</span>
                  </>
                )}
                {isRename && oldName && newName && (
                  <>
                    {' '}
                    <span className="activity-detail">
                      from "{truncateName(oldName)}" to "{truncateName(newName)}"
                    </span>
                  </>
                )}
              </p>
              <span className="activity-time">{formatRelativeTime(activity.created_at)}</span>

              {detailEntries.length > 0 && (
                <div className="activity-details">
                  {detailEntries.map(([key, val]) => (
                    <div key={key} className="activity-detail-row">
                      <span className="activity-detail-key">
                        {DETAIL_LABELS[key] || key.replace(/_/g, ' ')}
                      </span>
                      <span className="activity-detail-value">{formatDetailValue(key, val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
