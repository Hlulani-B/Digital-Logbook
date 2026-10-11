import { useState, useRef, useEffect } from 'react';
import { useNotes } from '@/context/NotesContext';
import { FiEdit } from 'react-icons/fi';
import { EntryQuickActions, loadProjectFields } from '@/components/EntryQuickActions';
import { updateEntry } from '@/functions/project/entries.js';
import { setPriority } from '@/functions/project/priority.js';
import { isOverdue, getOverdueText } from '@/functions/dashboard/overdue.js';
import { toLocalDateTime, dateOnlyDueToISO } from '@/lib/newEntryDates';
import {
  type EntryPayload,
  classifyEntryPayload,
  formatEntryValue,
  getEntryPayloadTitle,
  cleanSummaryText,
} from '@/lib/entryPayload';
import { resolveProjectColor } from '@/lib/projectColorMap';
import { formatDueDateTime } from '@/lib/dueDateDisplay';
import { FieldDisplay } from '@/components/fields/FieldDisplay';
import { FieldEditor } from '@/components/fields/FieldEditors';
import { evaluateVisibility } from '@/lib/fieldVisibility';
import { resolveFieldPermission } from '@/hooks/useFieldPermissions';
import type { FieldDefinition } from '@/lib/fieldSchema';

type EntryStatus = 'up_next' | 'in_motion' | 'done_and_dusted';

// Same encoding as the Cards view / DB: raw '0'-'3' codes drive the selects,
// friendly labels live in the payload.
const PRIORITY_LABELS: Record<string, string> = {
  '0': 'Urgent and important',
  '1': 'Urgent but not important',
  '2': 'Not urgent, not important',
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  up_next: 'Up Next',
  in_motion: 'In Motion',
  done_and_dusted: 'Done & Dusted',
};

/**
 * Raw '0'-'3' code for the priority selects. Cached rows may hold the raw
 * code (optimistic writes) or the friendly label (server rows), so both
 * forms are accepted here; unknown values fall back to "No priority".
 */
function toRawPriorityValue(priority: string | null | undefined): string {
  if (!priority) return '3';
  if (priority === '0' || priority === '1' || priority === '2' || priority === '3') return priority;
  const lower = priority.toLowerCase();
  for (const [raw, label] of Object.entries(PRIORITY_LABELS)) {
    if (label.toLowerCase() === lower) return raw;
  }
  return '3';
}

interface ChecklistEntry {
  id: string;
  user_email: string;
  project_name: string;
  project_id?: number;
  summary?: string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: EntryStatus;
  entries?: EntryPayload;
  started_at?: string | null;
  archived?: boolean;
  _timerPending?: boolean;
}

interface ChecklistEntryCardProps {
  entry: ChecklistEntry;
  onUpdated?: () => void;
  onDelete?: (entryId: string) => void;
  projectColor?: string;
}

const DONE_STATUS: EntryStatus = 'done_and_dusted';

function formatDate(value: string | null | undefined): string {
  return (
    formatDueDateTime(value, {
      dateOptions: { day: 'numeric', month: 'short', year: 'numeric' },
    }) || 'No due date'
  );
}

function getSummary(entry: ChecklistEntry): string {
  const safe = cleanSummaryText(entry.summary);
  if (safe) return safe;

  const summary = getEntryPayloadTitle(entry.entries);
  return summary === 'Not recorded' ? `${entry.project_name} entry` : summary;
}

/** Reserved payload keys that never render as fields in the details panel. */
const SKIP_FIELDS = new Set([
  'created',
  'started',
  'ended',
  'duration',
  'created_at',
  'started_at',
  'ended_at',
  '_entry_ref',
  '_project_ref',
  '_pinned',
]);

function formatFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ChecklistEntryCard({
  entry,
  onUpdated,
  onDelete,
  projectColor,
}: ChecklistEntryCardProps) {
  const isDone = entry.status === DONE_STATUS;
  const [checking, setChecking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { openNotes } = useNotes();

  const payloadState = classifyEntryPayload(entry.entries);
  const parsedEntries = payloadState.kind === 'object' ? payloadState.value : {};

  // Project field schemas for in-dialog editing — shared TTL memo with the
  // quick actions, so a board of cards still fetches fields once per project.
  const [fieldDefs, setFieldDefs] = useState<Record<string, FieldDefinition>>({});
  const [fieldsReady, setFieldsReady] = useState(false);
  useEffect(() => {
    if (!entry.user_email || !entry.project_name) return;
    let cancelled = false;
    loadProjectFields(entry.user_email, entry.project_name).then((defs) => {
      if (!cancelled) {
        setFieldDefs(defs);
        setFieldsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [entry.user_email, entry.project_name]);

  // Inline dropdowns — a local override keeps the select responsive until the
  // host refresh lands, and rolls back when the write fails.
  const [priorityOverride, setPriorityOverride] = useState<string | null>(null);
  const [priorityPending, setPriorityPending] = useState(false);
  const [statusOverride, setStatusOverride] = useState<EntryStatus | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const priorityValue = priorityOverride ?? toRawPriorityValue(entry.priority);
  const statusValue = statusOverride ?? entry.status ?? 'up_next';
  useEffect(() => {
    setPriorityOverride(null);
  }, [entry.priority]);
  useEffect(() => {
    setStatusOverride(null);
  }, [entry.status]);

  // Card details — collapsed by default so the action buttons and toggles can
  // never push past the card border; the outlined panel below expands
  // downward only (it never reaches into the Due Soon rail's column).
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Every visible project field (so unfilled non-required fields still show,
  // blank and ready to fill in) plus payload keys without a schema anymore.
  const detailsFields: Array<[string, FieldDefinition | undefined, unknown]> = [];
  const detailsSeen = new Set<string>();
  for (const [key, fieldDef] of Object.entries(fieldDefs)) {
    if (SKIP_FIELDS.has(key) || key.startsWith('_calc_')) continue;
    if (!evaluateVisibility(fieldDef, parsedEntries)) continue;
    if (resolveFieldPermission(fieldDef, 'owner') === 'hidden') continue;
    detailsFields.push([key, fieldDef, parsedEntries[key]]);
    detailsSeen.add(key);
  }
  for (const [key, value] of Object.entries(parsedEntries)) {
    if (detailsSeen.has(key) || SKIP_FIELDS.has(key) || key.startsWith('_calc_')) continue;
    detailsFields.push([key, undefined, value]);
  }

  // Edit state
  const [draftSummary, setDraftSummary] = useState(getSummary(entry));
  const [draftDueDate, setDraftDueDate] = useState(toLocalDateTime(entry.due_date).slice(0, 10));
  const [draftPriorityValue, setDraftPriorityValue] = useState(toRawPriorityValue(entry.priority));
  const [draftStatus, setDraftStatus] = useState<EntryStatus>(entry.status || 'up_next');
  const [draftFields, setDraftFields] = useState<Record<string, unknown>>(() => ({
    ...parsedEntries,
  }));

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
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        newStatus
      );
      if (result?.success !== true) throw new Error(result?.message || 'Failed to update status');
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setChecking(false);
    }
  };

  const resetDrafts = () => {
    setDraftSummary(getSummary(entry));
    setDraftDueDate(toLocalDateTime(entry.due_date).slice(0, 10));
    setDraftPriorityValue(toRawPriorityValue(entry.priority));
    setDraftStatus(entry.status || 'up_next');
    setDraftFields({ ...parsedEntries });
  };

  const handleCardClick = () => {
    resetDrafts();
    setEditOpen(true);
  };

  const handlePrioritySelect = async (rawValue: string) => {
    if (!entry.user_email || !entry.project_name || priorityPending) return;
    setPriorityOverride(rawValue);
    setPriorityPending(true);
    setError(null);
    try {
      const result = await setPriority(entry.user_email, rawValue, entry.project_name, entry.id);
      if (result?.success !== true)
        throw new Error(result?.message || 'Failed to update priority');
      onUpdated?.();
    } catch (err) {
      setPriorityOverride(null);
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setPriorityPending(false);
    }
  };

  const handleStatusSelect = async (newStatus: EntryStatus) => {
    if (!entry.user_email || !entry.project_name || statusPending) return;
    setStatusOverride(newStatus);
    setStatusPending(true);
    setError(null);
    try {
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        newStatus
      );
      if (result?.success !== true) throw new Error(result?.message || 'Failed to update status');
      onUpdated?.();
    } catch (err) {
      setStatusOverride(null);
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusPending(false);
    }
  };

  const handleFieldChange = (key: string, newValue: unknown) => {
    setDraftFields((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleSaveEdit = async () => {
    if (!entry.user_email || !entry.project_name || saving) return;
    setSaving(true);
    setError(null);

    try {
      // Object and empty payloads can carry field values; legacy opaque
      // content stays untouched. Empty payloads only write once the user
      // actually adds a value.
      const draftFieldKeys = Object.keys(draftFields);
      const newEntryObject =
        fieldsReady &&
        payloadState.kind !== 'opaque' &&
        !(payloadState.kind === 'empty' && draftFieldKeys.length === 0)
          ? { ...draftFields }
          : undefined;
      const newPriorityLabel =
        draftPriorityValue === '3' ? null : (PRIORITY_LABELS[draftPriorityValue] ?? null);
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        newEntryObject,
        draftDueDate === toLocalDateTime(entry.due_date).slice(0, 10)
          ? undefined
          : dateOnlyDueToISO(draftDueDate),
        newPriorityLabel,
        draftStatus,
        undefined,
        undefined,
        undefined,
        draftSummary
      );
      if (result?.success !== true) throw new Error(result?.message || 'Failed to save');

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
        style={
          projectColor
            ? ({
                '--tint': `${projectColor}18`,
                borderLeft: `3px solid ${projectColor}`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {!editOpen && error && <p role="alert">{error}</p>}
        {entry._timerPending && (
          <p role="status">Pending sync — timer timing takes effect on synchronization.</p>
        )}
        <span className="checklist-project">{entry.project_name}</span>
        <div className="checklist-card-row">
          <button
            type="button"
            className={`checklist-checkbox ${checking ? 'checklist-checkbox--loading' : ''}`}
            role="checkbox"
            aria-checked={isDone}
            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
            onClick={handleCheckboxClick}
            disabled={checking || entry._timerPending}
          >
            {isDone && (
              <span className="checklist-check" aria-hidden="true">
                ✓
              </span>
            )}
          </button>

          <div className="checklist-body">
            <p className={`checklist-summary ${isDone ? 'checklist-summary--done' : ''}`}>
              {getSummary(entry)}
            </p>
            <p className="checklist-due">
              {formatDate(entry.due_date)}
              {isOverdue(entry.due_date ?? null, entry.status ?? null, entry.archived) && (
                <span className="checklist-overdue-badge">
                  {getOverdueText(entry.due_date ?? null, entry.status ?? null, entry.archived)}
                </span>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="checklist-card-notes-btn"
          onClick={(e) => {
            e.stopPropagation();
            openNotes(entry);
          }}
        >
          <FiEdit className="checklist-card-notes-icon" />
          View Notes
        </button>

        {/* Collapse toggle — the card ships collapsed so wide button rows and
            toggles can never spill past the border; Show details unfolds the
            outlined panel below. */}
        <div className="checklist-card-collapse-row">
          <button
            type="button"
            className={`checklist-card-collapse-btn ${detailsOpen ? '' : 'is-collapsed'}`}
            onClick={(e) => {
              e.stopPropagation();
              setDetailsOpen((prev) => !prev);
            }}
            aria-expanded={detailsOpen}
            title={detailsOpen ? 'Hide details' : 'Show details'}
          >
            <span>{detailsOpen ? 'Hide details' : 'Show details'}</span>
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
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* Outlined details panel — expands downward inside the card, so it
            never overlaps the Due Soon column. */}
        <div className={`checklist-card-details ${detailsOpen ? 'is-open' : ''}`}>
          {/* Status / Priority dropdowns — same actions as the Cards view */}
          <div className="checklist-card-controls">
            <select
              className={`checklist-control-select checklist-status-select checklist-status-${statusValue}`}
              value={statusValue}
              onChange={(e) => handleStatusSelect(e.target.value as EntryStatus)}
              onClick={(e) => e.stopPropagation()}
              disabled={checking || statusPending || entry._timerPending}
              aria-label="Status"
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="checklist-control-select checklist-priority-select"
              value={priorityValue}
              onChange={(e) => handlePrioritySelect(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={priorityPending || entry._timerPending}
              aria-label="Priority"
            >
              <option value="0">Urgent & important</option>
              <option value="1">Urgent, not important</option>
              <option value="2">Not urgent</option>
              <option value="3">No priority</option>
            </select>
          </div>

          {/* Every visible project field — unfilled ones stay blank so they
              can be filled in from the edit dialog. */}
          {detailsFields.length > 0 && (
            <div className="checklist-card-fields">
              {detailsFields.map(([key, fieldDef, value]) => (
                <div className="checklist-card-field" key={key}>
                  <span className="checklist-card-field-key">{formatFieldKey(key)}</span>
                  <span className="checklist-card-field-value">
                    {fieldDef ? (
                      <FieldDisplay field={fieldDef} value={value} />
                    ) : (
                      formatEntryValue(value)
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action row — wraps inside the panel so buttons never spill past
              the card border. */}
          <div className="checklist-card-menu">
            <button
              className="checklist-card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCardClick();
              }}
              title="Edit"
            >
              Edit
            </button>
            <button
              className="checklist-card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                openNotes(entry);
              }}
              title="View Notes"
            >
              View Notes
            </button>
            <button
              className="checklist-card-menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                openNotes(entry);
              }}
              title="Add Note"
            >
              Add Note
            </button>
            {/* Pin / Calculate / Archive — same entry keys as the Cards view */}
            <EntryQuickActions entry={entry} onUpdated={onUpdated} />
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
        </div>
      </div>

      {/* Edit Dialog */}
      {editOpen && (
        <div className="checklist-dialog-overlay" onClick={() => setEditOpen(false)}>
          <div
            className="checklist-dialog entry-form checklist-dialog--editing"
            ref={editRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="entry-form__body">
              <h3 className="checklist-dialog-title">Edit Entry</h3>
              {error && <p className="checklist-dialog-error">{error}</p>}

              <div className="checklist-dialog-field-row">
                <div className="checklist-dialog-field">
                  <label>Status</label>
                  <select
                    aria-label="Status"
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value as EntryStatus)}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="checklist-dialog-field">
                  <label>Priority</label>
                  <select
                    aria-label="Priority"
                    value={draftPriorityValue}
                    onChange={(e) => setDraftPriorityValue(e.target.value)}
                  >
                    <option value="0">{PRIORITY_LABELS['0']}</option>
                    <option value="1">{PRIORITY_LABELS['1']}</option>
                    <option value="2">{PRIORITY_LABELS['2']}</option>
                    <option value="3">No priority</option>
                  </select>
                </div>
              </div>

              <div className="checklist-dialog-field">
                <label>Summary</label>
                <textarea
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  rows={3}
                  placeholder="Enter summary..."
                />
              </div>

              {payloadState.kind !== 'opaque' &&
                Object.entries(fieldDefs).map(([key, fieldDef]) => {
                  // Visibility rules and permissions mirror the Cards view
                  if (!evaluateVisibility(fieldDef, draftFields)) return null;
                  const permission = resolveFieldPermission(fieldDef, 'owner');
                  if (permission === 'hidden') return null;
                  return (
                    <div className="checklist-dialog-field" key={key}>
                      <FieldEditor
                        field={fieldDef}
                        value={draftFields[key] ?? null}
                        originalValue={parsedEntries[key]}
                        onChange={(newValue) => handleFieldChange(key, newValue)}
                        disabled={saving || permission === 'view'}
                        projectId={entry.project_id}
                        entryId={entry.id}
                      />
                    </div>
                  );
                })}

              <div className="checklist-dialog-field">
                <label>Due Date</label>
                <input
                  type="date"
                  aria-label="Due Date (end of local day)"
                  title="Changed dates are due at the end of the selected local day"
                  value={draftDueDate}
                  onChange={(e) => setDraftDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="checklist-dialog-actions entry-form__footer">
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
    </>
  );
}

// Checklist view component that renders a list of entries
interface ChecklistViewProps {
  entries: ChecklistEntry[];
  onUpdated?: () => void;
  onDelete?: (entryId: string) => void;
  colorMap?: Record<string, string | null>;
}

export function ChecklistView({ entries, onUpdated, onDelete, colorMap }: ChecklistViewProps) {
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
          projectColor={colorMap ? resolveProjectColor(entry.project_name, colorMap) : undefined}
        />
      ))}
    </div>
  );
}
