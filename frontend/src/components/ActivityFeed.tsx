import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { getActivities } from "@/functions/activity.js";

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
const ACTION_CONFIG: Record<
  string,
  { icon: ReactNode; verb: string; entityLabel: string }
> = {
  PROJECT_CREATED: {
    verb: "created",
    entityLabel: "project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  PROJECT_RENAMED: {
    verb: "renamed",
    entityLabel: "project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  PROJECT_DELETED: {
    verb: "deleted",
    entityLabel: "project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  PROJECT_ARCHIVED: {
    verb: "archived",
    entityLabel: "project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  PROJECT_UNARCHIVED: {
    verb: "unarchived",
    entityLabel: "project",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  ENTRY_ADDED: {
    verb: "added",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  ENTRY_UPDATED: {
    verb: "updated",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M12 18v-6" />
        <path d="M9 15l3 3 3-3" />
      </svg>
    ),
  },
  ENTRY_DELETED: {
    verb: "deleted",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  ENTRY_ARCHIVED: {
    verb: "archived",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
      </svg>
    ),
  },
  ENTRY_UNARCHIVED: {
    verb: "unarchived",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8" />
        <rect x="1" y="3" width="22" height="5" />
      </svg>
    ),
  },
  FIELD_ADDED: {
    verb: "added",
    entityLabel: "field",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <line x1="12" y1="11" x2="12" y2="17" />
        <line x1="9" y1="14" x2="15" y2="14" />
      </svg>
    ),
  },
  FIELD_EDITED: {
    verb: "edited",
    entityLabel: "field",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  PRIORITY_SET: {
    verb: "set priority on",
    entityLabel: "entry",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
};

const FALLBACK_CONFIG = {
  verb: "performed action on",
  entityLabel: "item",
  icon: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
};

// Priority numeric value → label
const PRIORITY_LABELS: Record<string, string> = {
  "0": "Urgent and important",
  "1": "Urgent but not important",
  "2": "Not urgent, not important",
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function truncateName(name: string | null | undefined, max = 60): string {
  if (!name) return "";
  return name.length > max ? name.slice(0, max) + "…" : name;
}

interface ActivityFeedProps {
  /** Called when the feed finishes loading (used for parent loading state) */
  onLoadingChange?: (loading: boolean) => void;
}

export function ActivityFeed({ onLoadingChange }: ActivityFeedProps) {
  const { user } = useAuth();
  const email = user?.email || "";
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivities = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const result = await getActivities(email, 50);
      setActivities(result?.data || []);
    } catch (err) {
      console.error("[ActivityFeed] Failed to load activities:", err);
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
          className="animate-spin"
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
        />
        <p>Loading activity...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="empty-state animate-in">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h2 className="empty-title">No activity yet</h2>
        <p className="empty-desc">
          Your recent actions — creating projects, adding entries, archiving, and more — will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      {activities.map((activity, i) => {
        const config = ACTION_CONFIG[activity.action_type] || FALLBACK_CONFIG;
        const entityName = truncateName(activity.entity_name);
        const details = activity.details || {};
        const projectName = (details.project_name as string) || (details.old_project_name as string);
        const priorityLabel = details.priority != null ? PRIORITY_LABELS[String(details.priority)] : null;
        const isRename = activity.action_type === "PROJECT_RENAMED";

        return (
          <div key={activity.id || i} className="activity-item animate-in" style={{ animationDelay: `${Math.min(i, 5) * 0.06}s` }}>
            <div className="activity-icon">{config.icon}</div>
            <div className="activity-body">
              <p className="activity-text">
                <span className="activity-verb">{config.verb}</span>{" "}
                <span className="activity-entity-label">{config.entityLabel}</span>
                {entityName && (
                  <>
                    {" "}
                    <span className="activity-entity-name">"{entityName}"</span>
                  </>
                )}
                {isRename && details.old_project_name && details.new_project_name && (
                  <>
                    {" "}
                    <span className="activity-detail">
                      from "{truncateName(details.old_project_name as string)}" to "{truncateName(details.new_project_name as string)}"
                    </span>
                  </>
                )}
                {projectName && !isRename && config.entityLabel !== "project" && (
                  <>
                    {" "}
                    <span className="activity-detail">in {projectName}</span>
                  </>
                )}
                {priorityLabel && (
                  <>
                    {" "}
                    <span className="activity-detail">→ {priorityLabel}</span>
                  </>
                )}
              </p>
              <span className="activity-time">{formatRelativeTime(activity.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;
