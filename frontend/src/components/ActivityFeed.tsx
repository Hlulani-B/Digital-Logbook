import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getActivities } from '@/functions/activity.js';

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

interface ActivityFeedProps {
  /** Called when the feed finishes loading (used for parent loading state) */
  onLoadingChange?: (loading: boolean) => void;
}

// Filter categories for action types
const FILTER_CATEGORIES = {
  all: { label: 'All', types: null },
  projects: {
    label: 'Projects',
    types: [
      'PROJECT_CREATED',
      'PROJECT_RENAMED',
      'PROJECT_DELETED',
      'PROJECT_ARCHIVED',
      'PROJECT_UNARCHIVED',
    ],
  },
  entries: { label: 'Entries', types: ['ENTRY_ADDED', 'ENTRY_EDITED', 'ENTRY_DELETED'] },
  fields: { label: 'Fields', types: ['FIELD_ADDED', 'FIELD_EDITED', 'FIELD_DELETED'] },
  other: {
    label: 'Other',
    types: [
      'PRIORITY_SET',
      'TIMER_STARTED',
      'TIMER_STOPPED',
      'PROFILE_CREATED',
      'PROFILE_USERNAME_UPDATED',
      'PROFILE_EMAIL_UPDATED',
      'PROFILE_PASSWORD_UPDATED',
    ],
  },
} as const;

type FilterKey = keyof typeof FILTER_CATEGORIES;

export function ActivityFeed({ onLoadingChange }: ActivityFeedProps) {
  const { user } = useAuth();
  const email = user?.email || '';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter activities based on active filter and search term
  const filteredActivities = activities.filter((activity) => {
    // Apply action type filter
    const filterConfig = FILTER_CATEGORIES[activeFilter];
    if (filterConfig.types && !filterConfig.types.includes(activity.action_type)) {
      return false;
    }
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const entityName = parseEntityName(activity.entity_name).toLowerCase();
      const details = JSON.stringify(activity.details || {}).toLowerCase();
      return entityName.includes(searchLower) || details.includes(searchLower);
    }
    return true;
  });

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

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  if (loading) {
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

  // Determine empty state message based on active filters
  const getEmptyState = () => {
    const hasFilter = activeFilter !== 'all';
    const hasSearch = searchTerm.trim() !== '';

    if (activities.length === 0) {
      return {
        icon: 'clock',
        title: 'No activity yet',
        description:
          'Your recent actions — creating projects, adding entries, archiving, and more — will appear here.',
      };
    }

    if (hasSearch && hasFilter) {
      return {
        icon: 'search',
        title: 'No matching results',
        description: `No ${FILTER_CATEGORIES[activeFilter].label.toLowerCase()} activities match "${searchTerm}".`,
      };
    }

    if (hasSearch) {
      return {
        icon: 'search',
        title: 'No results found',
        description: `No activities match "${searchTerm}". Try a different search term.`,
      };
    }

    if (hasFilter) {
      return {
        icon: 'filter',
        title: `No ${FILTER_CATEGORIES[activeFilter].label.toLowerCase()} activity`,
        description: `No ${FILTER_CATEGORIES[activeFilter].label.toLowerCase()} activities found. Try a different filter.`,
      };
    }

    return {
      icon: 'clock',
      title: 'No activity yet',
      description:
        'Your recent actions — creating projects, adding entries, archiving, and more — will appear here.',
    };
  };

  const renderEmptyIcon = (type: string) => {
    const commonProps = {
      width: 48,
      height: 48,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };

    switch (type) {
      case 'search':
        return (
          <svg {...commonProps}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        );
      case 'filter':
        return (
          <svg {...commonProps}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        );
      default:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
    }
  };

  if (filteredActivities.length === 0) {
    const emptyState = getEmptyState();
    return (
      <div className="empty-state animate-in">
        <div className="empty-icon">{renderEmptyIcon(emptyState.icon)}</div>
        <h2 className="empty-title">{emptyState.title}</h2>
        <p className="empty-desc">{emptyState.description}</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {/* Search and Filter Controls */}
      <div className="activity-controls">
        <div className="activity-search">
          <svg
            className="activity-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="activity-search-input"
            placeholder="Search activities..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="activity-filters">
          {(Object.keys(FILTER_CATEGORIES) as FilterKey[]).map((key) => (
            <button
              key={key}
              className={`activity-filter-btn ${activeFilter === key ? 'active' : ''}`}
              onClick={() => setActiveFilter(key)}
            >
              {FILTER_CATEGORIES[key].label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      {filteredActivities.map((activity, i) => {
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
