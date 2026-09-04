import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAllEntries, updateEntry } from '@/functions/project/entries.js';
import { getProjectsByEmail } from '@/functions/project/project.js';
import { isOverdue } from '@/functions/dashboard/overdue.js';
import { type CalendarEntry, getEntryTitle, parseDueDate } from '@/lib/calendar';
import {
  type EntryStatus,
  STATUS_LABELS,
  STATUS_ORDER,
  buildUpdatedEntry,
  filterEntries,
  getEntryStatus,
  groupEntriesByStatus,
} from '@/lib/kanban';
import './Kanban.css';

function parseEntryObject(entries: CalendarEntry['entries']): Record<string, unknown> {
  if (!entries) return {};
  if (typeof entries === 'string') {
    try {
      return JSON.parse(entries);
    } catch {
      return {};
    }
  }
  return entries;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

function getPriorityClass(priority: string | null): string {
  if (!priority) return '';
  if (priority.includes('Urgent and important')) return 'kanban-priority--urgent';
  if (priority.includes('Urgent but not important')) return 'kanban-priority--high';
  if (priority.includes('Not urgent')) return 'kanban-priority--low';
  return '';
}

function KanbanCard({
  entry,
  onDragStart,
  onClick,
}: {
  entry: CalendarEntry;
  onDragStart: () => void;
  onClick: () => void;
}) {
  const status = getEntryStatus(entry);
  const due = parseDueDate(entry.due_date);
  const overdue = isOverdue(entry.due_date ?? null, status);
  const priorityClass = getPriorityClass(entry.priority ?? null);

  return (
    <div
      className={['kanban-card', overdue && 'kanban-card--overdue', priorityClass]
        .filter(Boolean)
        .join(' ')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(entry.id));
        onDragStart();
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <div className="kanban-card-title">{getEntryTitle(entry)}</div>
      <div className="kanban-card-meta">
        <span className="kanban-card-project">{entry.project_name}</span>
        {due && (
          <span className={`kanban-card-due ${overdue ? 'kanban-card-due--overdue' : ''}`}>
            {formatShortDate(due)}
          </span>
        )}
      </div>
      {entry.priority && (
        <span className={['kanban-card-priority', priorityClass].filter(Boolean).join(' ')}>
          {entry.priority}
        </span>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  entries,
  dragging,
  onDragStart,
  onDrop,
  onEntryClick,
}: {
  status: EntryStatus;
  entries: CalendarEntry[];
  dragging: CalendarEntry | null;
  onDragStart: (entry: CalendarEntry) => void;
  onDrop: (status: EntryStatus) => void;
  onEntryClick: (entry: CalendarEntry) => void;
}) {
  const isDropTarget = dragging !== null && getEntryStatus(dragging) !== status;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(status);
  };

  return (
    <div
      className={['kanban-column', isDropTarget && 'kanban-column--drop-target']
        .filter(Boolean)
        .join(' ')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-status={status}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-title">{STATUS_LABELS[status]}</span>
        <span className="kanban-column-count">{entries.length}</span>
      </div>
      <div className="kanban-column-cards">
        {entries.map((entry) => (
          <KanbanCard
            key={entry.id}
            entry={entry}
            onDragStart={() => onDragStart(entry)}
            onClick={() => onEntryClick(entry)}
          />
        ))}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? '';

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [projects, setProjects] = useState<{ project_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dragging, setDragging] = useState<CalendarEntry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const [entriesRes, projectsRes] = await Promise.allSettled([
        getAllEntries(email),
        getProjectsByEmail(email),
      ]);

      if (entriesRes.status === 'fulfilled') {
        const result = entriesRes.value;
        if (result?.success === false) {
          setError(result.message || 'Failed to load entries');
        } else {
          const data = (result?.data || []).filter((entry: CalendarEntry) => !entry.archived);
          setEntries(data);
        }
      } else {
        setError(entriesRes.reason?.message || 'Failed to load entries');
      }

      if (projectsRes.status === 'fulfilled') {
        const result = projectsRes.value;
        if (result?.success !== false) {
          setProjects((result?.data || []).filter((p: { archived?: boolean }) => !p.archived));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load board data');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEntries = useMemo(
    () => filterEntries(entries, projectFilter, searchQuery),
    [entries, projectFilter, searchQuery]
  );

  const groupedEntries = useMemo(() => groupEntriesByStatus(filteredEntries), [filteredEntries]);

  const handleDragStart = (entry: CalendarEntry) => {
    setDragging(entry);
  };

  const handleDrop = async (targetStatus: EntryStatus) => {
    if (!dragging || !email) return;
    const entry = dragging;
    const sourceStatus = getEntryStatus(entry);
    setDragging(null);

    if (sourceStatus === targetStatus) return;

    const previousEntries = [...entries];
    const updatedEntry = buildUpdatedEntry(entry, targetStatus, new Date().toISOString());

    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updatedEntry : e)));
    setUpdatingId(entry.id);

    try {
      const result = await updateEntry(
        email,
        entry.project_name,
        entry.id,
        parseEntryObject(entry.entries),
        entry.due_date,
        entry.priority,
        targetStatus,
        updatedEntry.started_at,
        updatedEntry.ended_at,
        entry.duration ?? null
      );

      if (result?.success === false || result?.error) {
        throw new Error(result?.message || result?.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
      setEntries(previousEntries);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEntryClick = (entry: CalendarEntry) => {
    navigate(`/project/${encodeURIComponent(entry.project_name)}`);
  };

  return (
    <div className="kanban-page">
      <div className="kanban-page-header">
        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Dashboard
        </button>
        <h1 className="kanban-page-title">Kanban Board</h1>
      </div>

      <div className="kanban-toolbar">
        <div className="kanban-filter">
          <label htmlFor="project-filter" className="kanban-filter-label">
            Project
          </label>
          <select
            id="project-filter"
            className="kanban-select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.project_name} value={p.project_name}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
        <div className="kanban-filter kanban-filter--grow">
          <label htmlFor="search-filter" className="kanban-filter-label">
            Search
          </label>
          <input
            id="search-filter"
            type="text"
            className="kanban-search"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setProjectFilter('');
            setSearchQuery('');
          }}
        >
          Clear filters
        </button>
      </div>

      {error && (
        <div className="kanban-error" role="alert">
          {error}
          <button type="button" className="kanban-error-close" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="kanban-loading">
          <span className="kanban-spinner" />
          Loading board…
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="kanban-empty">
          <p>No tasks match the current filter.</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setProjectFilter('');
              setSearchQuery('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="kanban-board">
          {STATUS_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              entries={groupedEntries[status]}
              dragging={dragging}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onEntryClick={handleEntryClick}
            />
          ))}
        </div>
      )}

      {updatingId && (
        <div className="kanban-toast" aria-live="polite">
          <span className="kanban-spinner" />
          Updating status…
        </div>
      )}
    </div>
  );
}
