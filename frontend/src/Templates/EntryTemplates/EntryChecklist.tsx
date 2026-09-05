import { useState, useRef, useEffect } from 'react';
import { updateEntry } from '@/functions/project/entries.js';

type EntryStatus = 'up_next' | 'in_motion' | 'done_and_dusted';

interface ChecklistEntry {
  id: string;
  user_email: string;
  project_name: string;
  summary?: string | null;
  due_date?: string | null;
  status?: EntryStatus;
  entries?: Record<string, unknown> | string | null;
  started_at?: string | null;
}

interface ChecklistEntryCardProps {
  entry: ChecklistEntry;
  onUpdated?: () => void;
  onDelete?: (entryId: string) => void;
}

const DONE_STATUS: EntryStatus = 'done_and_dusted';

function formatDate(value: string | null | undefined): string {
  if (!value) return 'No due date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getSummary(entry: ChecklistEntry): string {
  // Try to get summary from the summary field first
  if (entry.summary) return entry.summary;
  
  // Try to extract from entries object
  if (entry.entries) {
    const entries = typeof entry.entries === 'string' 
      ? (() => { try { return JSON.parse(entry.entries as string); } catch { return {}; } })()
      : entry.entries;
    
    // Look for common summary field names
    const summaryKeys = ['summary', 'title', 'name', 'task', 'description'];
    for (const key of summaryKeys) {
      if (entries[key] && typeof entries[key] === 'string') {
        return entries[key] as string;
      }
    }
  }
  
  return 'Untitled entry';
}

export default function ChecklistEntryCard({ entry, onUpdated, onDelete }: ChecklistEntryCardProps) {
  const isDone = entry.status === DONE_STATUS;
  const [checking, setChecking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state
  const [draftSummary, setDraftSummary] = useState(getSummary(entry));
  const [draftDueDate, setDraftDueDate] = useState(entry.due_date ? entry.due_date.slice(0, 10) : '');
  
  const editRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);

  // Close dialogs on click outside
  useEffect(() => {
    if (!editOpen && !deleteOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setEditOpen(false);
      }
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        setDeleteOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [editOpen, deleteOpen]);

  const handleCheckboxClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (checking || !entry.user_email || !entry.project_name) return;
    
    setChecking(true);
    try {
      const newStatus = isDone ? 'up_next' : DONE_STATUS;
      await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined, // entries
        entry.due_date,
        undefined, // priority
        newStatus,
        entry.status === 'in_motion' ? entry.started_at : undefined,
        newStatus === DONE_STATUS ? new Date().toISOString() : undefined,
        undefined, // duration
      );
      onUpdated?.();
    } catch (err) {
      console.error('[ChecklistEntryCard] Failed to update status:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleCardClick = () => {
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!entry.user_email || !entry.project_name || saving) return;
    setSaving(true);
    setError(null);
    
    try {
      // Build entries object (keep existing data)
      let entriesObj: Record<string, unknown> = {};
      if (entry.entries) {
        entriesObj = typeof entry.entries === 'string'
          ? (() => { try { return JSON.parse(entry.entries as string); } catch { return {}; } })()
          : { ...entry.entries };
      }
      
      // Save summary directly to the summary column (as-is, no transformation)
      await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        entriesObj,
        draftDueDate || null,
        undefined, // priority
        undefined, // status
        undefined, // started_at
        undefined, // ended_at
        undefined, // duration
        draftSummary, // summary — saved as-is to the database
      );
      
      setEditOpen(false);
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!entry.user_email || !entry.project_name) return;
    try {
      const { deleteEntryById } = await import('@/functions/project/entries.js');
      await deleteEntryById(entry.user_email, entry.id);
      setDeleteOpen(false);
      onDelete?.(entry.id);
    } catch (err) {
      console.error('[ChecklistEntryCard] Failed to delete:', err);
    }
  };

  return (
    <>
      <div 
        className={`checklist-card ${isDone ? 'checklist-card--done' : ''}`}
        data-status={entry.status}
        onClick={handleCardClick}
      >
        <span className="checklist-project">{entry.project_name}</span>
        <div className="checklist-card-row">
          <button
            type="button"
            className={`checklist-checkbox ${checking ? 'checklist-checkbox--loading' : ''}`}
            role="checkbox"
            aria-checked={isDone}
            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
            onClick={handleCheckboxClick}
            disabled={checking}
          >
            {isDone && <span className="checklist-check" aria-hidden="true">✓</span>}
          </button>

          <div className="checklist-body">
            <p className={`checklist-summary ${isDone ? 'checklist-summary--done' : ''}`}>
              {getSummary(entry)}
            </p>
            <p className="checklist-due">{formatDate(entry.due_date)}</p>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      {editOpen && (
        <div className="checklist-dialog-overlay" onClick={() => setEditOpen(false)}>
          <div className="checklist-dialog" ref={editRef} onClick={(e) => e.stopPropagation()}>
            <h3 className="checklist-dialog-title">Edit Entry</h3>
            {error && <p className="checklist-dialog-error">{error}</p>}
            
            <div className="checklist-dialog-field">
              <label>Summary</label>
              <textarea
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
                rows={3}
                placeholder="Enter summary..."
              />
            </div>
            
            <div className="checklist-dialog-field">
              <label>Due Date</label>
              <input
                type="date"
                value={draftDueDate}
                onChange={(e) => setDraftDueDate(e.target.value)}
              />
            </div>
            
            <div className="checklist-dialog-actions">
              <button 
                className="checklist-dialog-btn checklist-dialog-btn--cancel"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="checklist-dialog-btn checklist-dialog-btn--save"
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteOpen && (
        <div className="checklist-dialog-overlay" onClick={() => setDeleteOpen(false)}>
          <div className="checklist-dialog" ref={deleteRef} onClick={(e) => e.stopPropagation()}>
            <h3 className="checklist-dialog-title">Delete Entry</h3>
            <p className="checklist-dialog-message">
              Are you sure you want to delete this entry? This cannot be undone.
            </p>
            <div className="checklist-dialog-actions">
              <button 
                className="checklist-dialog-btn checklist-dialog-btn--cancel"
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="checklist-dialog-btn checklist-dialog-btn--delete"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu for edit/delete */}
      <div className="checklist-card-menu">
        <button 
          className="checklist-card-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
          }}
          title="Edit"
        >
          Edit
        </button>
        <button 
          className="checklist-card-menu-btn checklist-card-menu-btn--delete"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteOpen(true);
          }}
          title="Delete"
        >
          Delete
        </button>
      </div>
    </>
  );
}

// Checklist view component that renders a list of entries
interface ChecklistViewProps {
  entries: ChecklistEntry[];
  onUpdated?: () => void;
  onDelete?: (entryId: string) => void;
}

export function ChecklistView({ entries, onUpdated, onDelete }: ChecklistViewProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="checklist-empty">
        <p>No entries yet</p>
      </div>
    );
  }

  // Sort entries by due_date (earliest first), entries without due_date go last
  const sortedEntries = [...entries].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return (
    <div className="checklist-list">
      {sortedEntries.map((entry) => (
        <ChecklistEntryCard
          key={entry.id}
          entry={entry}
          onUpdated={onUpdated}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
