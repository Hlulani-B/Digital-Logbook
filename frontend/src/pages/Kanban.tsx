import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateEntry } from '@/functions/project/entries.js';
import { isOverdue } from '@/functions/dashboard/overdue.js';
import { type CalendarEntry, getEntryTitle } from '@/lib/calendar';
import {
  type EntryStatus,
  STATUS_LABELS,
  STATUS_ORDER,
  getEntryStatus,
  groupEntriesByStatus,
} from '@/lib/kanban';
import './Kanban.css';
import { resolveProjectColor } from '@/lib/projectColorMap';
import { formatDueDateTime } from '@/lib/dueDateDisplay';
import { pinFirst } from '@/lib/entryFilters';
import { useEntryPinScope } from '@/lib/entryPins';

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
  projectColor,
}: {
  entry: CalendarEntry;
  onDragStart: () => void;
  onClick: () => void;
  projectColor?: string;
}) {
  const status = getEntryStatus(entry);
  const due = formatDueDateTime(entry.due_date, {
    locale: 'en-ZA',
    dateOptions: { month: 'short', day: 'numeric' },
  });
  const overdue = isOverdue(entry.due_date ?? null, status);
  const priorityClass = getPriorityClass(entry.priority ?? null);
  // Pin — shown only where the page provides its own private pin scope.
  const pinApi = useEntryPinScope();
  const isPinned = pinApi ? pinApi.isPinned(entry.id) : false;

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
      style={projectColor ? { borderLeft: `3px solid ${projectColor}` } : undefined}
    >
      {pinApi && (
        <button
          type="button"
          className={`kanban-card-pin${isPinned ? ' is-pinned' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            pinApi.togglePin(entry.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          aria-pressed={isPinned}
          aria-label={isPinned ? 'Unpin entry' : 'Pin entry'}
          title={isPinned ? 'Unpin: back to the normal order' : 'Pin to the top of this column'}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={isPinned ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
          </svg>
        </button>
      )}
      {(entry as CalendarEntry & { _timerPending?: boolean })._timerPending && (
        <p role="status">Pending sync — timer timing takes effect on synchronization.</p>
      )}
      <div className="kanban-card-title">{getEntryTitle(entry)}</div>
      <div className="kanban-card-meta">
        <span className="kanban-card-project">{entry.project_name}</span>
        {due && (
          <span className={`kanban-card-due ${overdue ? 'kanban-card-due--overdue' : ''}`}>
            {due}
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
  colorMap,
}: {
  status: EntryStatus;
  entries: CalendarEntry[];
  dragging: CalendarEntry | null;
  onDragStart: (entry: CalendarEntry) => void;
  onDrop: (status: EntryStatus) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  colorMap?: Record<string, string | null>;
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
            projectColor={
              colorMap ? resolveProjectColor(entry.project_name || '', colorMap) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

interface KanbanBoardViewProps {
  entries: CalendarEntry[];
  email: string;
  colorMap?: Record<string, string | null>;
  onUpdated: () => void;
}

/**
 * The drag-and-drop Kanban board itself (columns + status updates). Shared by
 * the standalone Kanban page and the "Kanban" view on the All Entries page.
 */
export function KanbanBoardView({ entries, email, colorMap, onUpdated }: KanbanBoardViewProps) {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState<CalendarEntry | null>(null);
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pinApi = useEntryPinScope();
  const groupedEntries = useMemo(() => groupEntriesByStatus(entries), [entries]);
  // Pinned entries rise to the top of the column they are in (this page's pins).
  const orderedEntries = (status: EntryStatus) =>
    pinFirst(groupedEntries[status], pinApi?.pinned);

  const handleDrop = async (targetStatus: EntryStatus) => {
    if (!dragging || !email) return;
    const entry = dragging;
    const sourceStatus = getEntryStatus(entry);
    setDragging(null);

    if (sourceStatus === targetStatus) return;

    setUpdatingId(entry.id);

    try {
      const result = await updateEntry(
        email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        targetStatus
      );

      if (result?.success !== true || result?.error) {
        throw new Error(result?.message || result?.error || 'Failed to update status');
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleEntryClick = (entry: CalendarEntry) => {
    navigate(`/project/${encodeURIComponent(entry.project_name)}`);
  };

  return (
    <>
      {error && (
        <div className="kanban-error" role="alert">
          {error}
          <button type="button" className="kanban-error-close" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="kanban-board">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            entries={orderedEntries(status)}
            dragging={dragging}
            onDragStart={setDragging}
            onDrop={handleDrop}
            onEntryClick={handleEntryClick}
            colorMap={colorMap}
          />
        ))}
      </div>

      {updatingId && (
        <div className="kanban-toast" aria-live="polite">
          <span className="kanban-spinner" />
          Updating status…
        </div>
      )}
    </>
  );
}
