import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotes } from '@/context/NotesContext';
import { FiEdit } from 'react-icons/fi';
import { updateEntry, deleteEntryById, getEntries } from '../functions/project/entries.js';
import { archiveEntry, unarchiveEntry } from '../functions/project/archives.js';
import { getFields } from '../functions/project/fields.js';
import { getProjectsByEmail } from '../functions/project/project.js';
import { isOverdue, getOverdueText } from '../functions/dashboard/overdue.js';
import { entryDurationMs, entryRemainingMs, formatTimer } from '../functions/dashboard/stats.js';
import { FieldEditor } from '@/components/fields/FieldEditors';
import { FieldDisplay } from '@/components/fields/FieldDisplay';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { normalizeField } from '@/lib/fieldSchema';
import { evaluateVisibility } from '@/lib/fieldVisibility';
import { resolveFieldPermission } from '@/hooks/useFieldPermissions';
import { useTimerActions } from '@/hooks/useTimerActions';
import {
  classifyEntryPayload,
  formatEntryValue,
  cleanSummaryText,
  type EntryPayload,
} from '@/lib/entryPayload';

type EntryStatus = 'up_next' | 'in_motion' | 'done_and_dusted';

const PRIORITY_LABELS: Record<string, string> = {
  '0': 'Urgent and important',
  '1': 'Urgent but not important',
  '2': 'Not urgent, not important',
  '3': 'No priority',
};

const PRIORITY_TO_VALUE: Record<string, string> = {
  'Urgent and important': '0',
  'Urgent but not important': '1',
  'Not urgent, not important': '2',
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  up_next: 'Up Next',
  in_motion: 'In Motion',
  done_and_dusted: 'Done & Dusted',
};

const STATUS_CLASS: Record<EntryStatus, string> = {
  up_next: 'status-up-next',
  in_motion: 'status-in-motion',
  done_and_dusted: 'status-done',
};

const PRIORITY_CLASS: Record<string, string> = {
  'Urgent and important': 'priority-urgent-important',
  'Urgent but not important': 'priority-urgent',
  'Not urgent, not important': 'priority-low',
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  // Return YYYY-MM-DDTHH:MM for datetime-local inputs
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatFieldKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface EntryRow {
  id: string;
  user_email: string;
  project_name: string;
  project_id?: number;
  entries: EntryPayload;
  created_at: string;
  due_date?: string | null;
  priority?: string | null;
  archived?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: string | null;
  target_duration_ms?: number | string | null;
  paused_ms?: number | string | null;
  paused_at?: string | null;
  status?: EntryStatus;
  summary?: string | null;
}

interface EntryBoxProps {
  entry: EntryRow;
  onUpdated?: (updatedEntry: EntryRow) => void;
  onArchiveToggled?: (entryId: string, archived: boolean) => void;
  onPriorityChanged?: (entryId: string, projectName: string, priorityValue: string) => void;
  onDelete?: (entryId: string) => void;
  projectColor?: string | null;
}

export function EntryBox({
  entry,
  onUpdated,
  onArchiveToggled,
  onPriorityChanged,
  onDelete,
  projectColor,
}: EntryBoxProps) {
  const navigate = useNavigate();
  const {
    id,
    user_email,
    project_name,
    project_id,
    entries,
    due_date,
    priority,
    archived,
    started_at,
    ended_at,
    target_duration_ms,
    paused_ms,
    paused_at,
    status = 'up_next',
    summary,
  } = entry;

  const safeSummary = cleanSummaryText(summary);
  const payloadState = classifyEntryPayload(entries);
  const parsedEntries = payloadState.kind === 'object' ? payloadState.value : {};

  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { openNotes } = useNotes();

  const [refPickerOpen, setRefPickerOpen] = useState<'project' | null>(null);
  const [refEntries, setRefEntries] = useState<any[]>([]);
  const [refProjects, setRefProjects] = useState<any[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [calcField, setCalcField] = useState<string | null>(null);

  const [fieldDefs, setFieldDefs] = useState<Record<string, FieldDefinition>>({});
  useEffect(() => {
    if (!user_email || !project_name) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getFields(user_email, project_name);
        if (!cancelled && result?.data) {
          const defs: Record<string, FieldDefinition> = {};
          for (const f of result.data) {
            // normalizeField handles legacy custom:type format
            const fieldDef = normalizeField(f);
            defs[f.field_name] = fieldDef;
          }
          setFieldDefs(defs);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [user_email, project_name]);

  // Live timer text for in-progress tasks.
  // With a target_duration_ms this is a DEADLINE COUNTDOWN (remaining time);
  // without one it counts UP elapsed work time. Paused entries freeze at the
  // moment they were paused (anchor = paused_at) and show a Paused badge.
  const isPaused = Boolean(started_at && !ended_at && paused_at);
  const [timerText, setTimerText] = useState<string>('');
  useEffect(() => {
    if (!started_at || ended_at) {
      setTimerText('');
      return;
    }
    const liveEntry = { started_at, ended_at, paused_at, paused_ms, target_duration_ms };
    const tick = () => {
      const now = Date.now();
      const remaining = entryRemainingMs(liveEntry, now);
      setTimerText(
        remaining != null ? formatTimer(remaining) : formatTimer(entryDurationMs(liveEntry, now))
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [started_at, ended_at, paused_at, paused_ms, target_duration_ms]);

  const [draftFields, setDraftFields] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(Object.entries(parsedEntries || {}).map(([k, v]) => [k, v]))
  );
  const [draftDueDate, setDraftDueDate] = useState(toInputDate(due_date));
  const [draftStartedAt, setDraftStartedAt] = useState(toInputDate(started_at));
  const [draftEndedAt, setDraftEndedAt] = useState(toInputDate(ended_at));
  const [draftPriorityValue, setDraftPriorityValue] = useState(
    priority && PRIORITY_TO_VALUE[priority] !== undefined ? PRIORITY_TO_VALUE[priority] : '3'
  );
  const [draftStatus, setDraftStatus] = useState<EntryStatus>(status);

  // Timer actions (start/pause/resume/stop) with in-flight and failure state
  const {
    timerAction,
    timerError,
    timerErrorAction,
    isActionInFlight,
    start: startTimer,
    pause: pauseTimer,
    resume: resumeTimer,
    stop: stopTimer,
    clearError: clearTimerError,
  } = useTimerActions({ entry, onUpdated: onUpdated as (entry: any) => void });

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
  ]);
  const entryFields = Object.entries(parsedEntries || {}).filter(
    ([key]) => !SKIP_FIELDS.has(key) && !key.startsWith('_calc_')
  );
  const dueLabel = formatDate(due_date);

  const priorityClass = priority ? PRIORITY_CLASS[priority] || 'priority-neutral' : '';

  const handleFieldChange = (key: string, newValue: unknown) => {
    setDraftFields((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleCancel = () => {
    setDraftFields(Object.fromEntries(Object.entries(parsedEntries || {}).map(([k, v]) => [k, v])));
    setDraftDueDate(toInputDate(due_date));
    setDraftStartedAt(toInputDate(started_at));
    setDraftEndedAt(toInputDate(ended_at));
    setDraftPriorityValue(
      priority && PRIORITY_TO_VALUE[priority] !== undefined ? PRIORITY_TO_VALUE[priority] : '3'
    );
    setDraftStatus(status);
    setIsEditing(false);
    setError(null);
  };

  const handleEnterEdit = () => {
    setMenuOpen(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!user_email || !project_name || saving) return;
    setSaving(true);
    setError(null);

    try {
      const newEntryObject: Record<string, unknown> | undefined =
        payloadState.kind === 'opaque' ? undefined : { ...draftFields };

      // Convert priority index to label string (or null for "No priority")
      const newPriorityLabel =
        draftPriorityValue === '3' ? null : PRIORITY_LABELS[draftPriorityValue];

      const newDueDate = draftDueDate ? new Date(draftDueDate).toISOString() : null;
      const newStartedAt = draftStartedAt ? new Date(draftStartedAt).toISOString() : null;
      const newEndedAt = draftEndedAt ? new Date(draftEndedAt).toISOString() : null;

      const updatedEntry: EntryRow = {
        ...entry,
        entries: newEntryObject ?? entries,
        due_date: newDueDate,
        priority: newPriorityLabel,
        status: draftStatus,
        started_at: newStartedAt,
        ended_at: newEndedAt,
      };

      // Single update call with all schema columns
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        newEntryObject,
        newDueDate,
        newPriorityLabel,
        draftStatus,
        newStartedAt,
        newEndedAt
      );

      if (result?.success === false) {
        setError(result.message || 'Failed to save changes');
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }

      // Always reload from database to show actual state
      onUpdated?.(updatedEntry);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!user_email || archiving) return;
    setArchiving(true);
    setError(null);
    setMenuOpen(false);
    try {
      const result = archived
        ? await unarchiveEntry(user_email, project_name, id)
        : await archiveEntry(user_email, project_name, id);

      if (result?.success === false)
        throw new Error(result.message || 'Failed to update archive state');

      onArchiveToggled?.(id, !archived);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update archive state');
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!user_email || deleting) return;
    setDeleting(true);
    setError(null);
    setMenuOpen(false);
    try {
      const result = await deleteEntryById(user_email, id);
      if (result?.success === false) throw new Error(result.message || 'Failed to delete item');
      onDelete?.(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleStatusChange = async (newStatus: EntryStatus) => {
    if (!user_email || !project_name || saving) return;
    setSaving(true);
    setError(null);
    try {
      // If moving to done_and_dusted, auto-set ended_at
      const newEndedAt =
        newStatus === 'done_and_dusted' && !ended_at ? new Date().toISOString() : ended_at;
      // If moving to in_motion and not started yet, auto-set started_at
      const newStartedAt =
        newStatus === 'in_motion' && !started_at ? new Date().toISOString() : started_at;
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        newStatus,
        newStartedAt,
        newEndedAt
      );
      if (result?.success === false) {
        setError(result.message || 'Failed to update status');
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }
      onUpdated?.({ ...entry, status: newStatus, started_at: newStartedAt, ended_at: newEndedAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // Timer actions are now handled by useTimerActions hook (startTimer, pauseTimer, resumeTimer, stopTimer)

  // Adds a deadline target to a running task that has none (count-up → countdown)
  const [targetDays, setTargetDays] = useState<string>('');
  const [targetHours, setTargetHours] = useState<string>('');
  const [targetMinutes, setTargetMinutes] = useState<string>('');
  const handleSetTarget = async () => {
    const days = Number(targetDays) || 0;
    const hours = Number(targetHours) || 0;
    const minutes = Number(targetMinutes) || 0;
    const totalMinutes = days * 1440 + hours * 60 + minutes;
    if (!user_email || saving || !Number.isFinite(totalMinutes) || totalMinutes <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const targetMs = Math.round(totalMinutes * 60000);
      const result = await updateEntry(
        user_email,
        project_name,
        id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        targetMs,
        paused_ms === undefined || paused_ms === null ? undefined : Number(paused_ms),
        paused_at === undefined ? undefined : paused_at
      );
      if (result?.success === false || result?.error) {
        setError(result.message || result.error || 'Failed to set target');
        return;
      }
      onUpdated?.({ ...entry, target_duration_ms: targetMs });
      setTargetDays('');
      setTargetHours('');
      setTargetMinutes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set target');
    } finally {
      setSaving(false);
    }
  };

  const openProjectRefPicker = async () => {
    setRefLoading(true);
    setRefPickerOpen('project');
    try {
      const result = await getProjectsByEmail(user_email);
      const projects = result?.projects || result?.data || [];
      setRefProjects(projects);
    } catch {}
    setRefLoading(false);
  };

  const selectProjectRef = async (project: any) => {
    const ref = { project_name: project.project_name };
    const newEntries = { ...parsedEntries, _project_ref: ref };
    await updateEntry(user_email, project_name, id, newEntries);
    setRefPickerOpen(null);
    onUpdated?.({ ...entry, entries: newEntries });
  };

  const removeProjectRef = async () => {
    const newEntries = { ...parsedEntries };
    delete newEntries._project_ref;
    await updateEntry(user_email, project_name, id, newEntries);
    onUpdated?.({ ...entry, entries: newEntries });
  };

  const openCalcPicker = async (fieldName: string) => {
    setCalcField(fieldName);
    try {
      const result = await getEntries(user_email, project_name);
      if (result?.data) setRefEntries(result.data);
    } catch {}
  };

  const doCalculation = (type: 'sum' | 'average') => {
    if (!calcField) return;
    const values = refEntries
      .map((e: any) => {
        const data = typeof e.entries === 'object' && e.entries ? e.entries : {};
        const val = Number(data[calcField]);
        return isNaN(val) ? null : val;
      })
      .filter((v): v is number => v !== null);
    if (values.length === 0) {
      setCalcField(null);
      return;
    }
    const result =
      type === 'sum'
        ? values.reduce((a, b) => a + b, 0)
        : values.reduce((a, b) => a + b, 0) / values.length;
    const newEntries = { ...parsedEntries, [`_calc_${calcField}`]: { type, value: result } };
    updateEntry(user_email, project_name, id, newEntries).then(() => {
      onUpdated?.({ ...entry, entries: newEntries });
    });
    setCalcField(null);
  };

  if (isEditing) {
    return (
      <div className="entry-box entry-box--editing entry-form">
        <div className="entry-form__body">
          <div className="entry-box__header">
            <div className="entry-box__tags">
              <select
                className="entry-box__priority-select"
                value={draftPriorityValue}
                onChange={(e) => setDraftPriorityValue(e.target.value)}
                disabled={saving}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="entry-box__status-select"
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as EntryStatus)}
                disabled={saving}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="entry-box__project entry-box__project--link"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/project/${encodeURIComponent(project_name)}`);
              }}
              title={`Go to ${project_name} page`}
            >
              {project_name}
            </button>
          </div>

          {error && <div className="entry-box__error">{error}</div>}

          <div className="entry-box__fields--editing">
            {payloadState.kind !== 'object' ? (
              <div className="entry-box__field--editing">
                <label className="entry-box__field-key">Item content</label>
                <span>{formatEntryValue(payloadState.value)}</span>
              </div>
            ) : (
              Object.entries(fieldDefs).map(([key, fieldDef]) => {
                const value = draftFields[key] ?? null;
                // Visibility: skip fields that are hidden by visibility rules
                if (!evaluateVisibility(fieldDef, draftFields)) {
                  return null;
                }
                // Field-Level Permissions: skip hidden fields
                // Note: userRole should be fetched from backend; defaulting to 'owner' for now
                const userRole = 'owner'; // TODO: Fetch actual user role
                const permission = resolveFieldPermission(fieldDef, userRole);
                if (permission === 'hidden') {
                  return null;
                }
                return (
                  <div className="entry-box__field--editing" key={key}>
                    <FieldEditor
                      field={fieldDef}
                      value={value}
                      onChange={(newValue) => handleFieldChange(key, newValue)}
                      disabled={saving || permission === 'view'}
                      projectId={project_id}
                      entryId={id}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="entry-box__field--editing">
            <label className="entry-box__field-key">Due Date</label>
            <input
              className="entry-box__field-input"
              type="datetime-local"
              value={draftDueDate}
              onChange={(e) => setDraftDueDate(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="entry-box__field--editing">
            <label className="entry-box__field-key">Started At</label>
            <input
              className="entry-box__field-input"
              type="datetime-local"
              value={draftStartedAt}
              onChange={(e) => setDraftStartedAt(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="entry-box__edit-actions entry-form__footer">
          <button
            type="button"
            className="entry-box__btn entry-box__btn--cancel"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="entry-box__btn entry-box__btn--save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`entry-box ${archived ? 'entry-box--archived' : ''}`}
        style={
          projectColor
            ? ({
                '--tint': `${projectColor}18`,
                borderLeft: `3px solid ${projectColor}`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <div className="entry-box__top-row">
          <div className="entry-box__menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="entry-box__menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Entry options"
              aria-expanded={menuOpen}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="entry-box__menu">
                <button type="button" className="entry-box__menu-item" onClick={handleEnterEdit}>
                  Edit
                </button>
                <button
                  type="button"
                  className="entry-box__menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    openNotes(entry);
                  }}
                >
                  View Notes
                </button>
                <button
                  type="button"
                  className="entry-box__menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    openNotes(entry);
                  }}
                >
                  Add Note
                </button>
                <button
                  type="button"
                  className="entry-box__menu-item entry-box__menu-item--danger"
                  onClick={handleToggleArchive}
                  disabled={archiving}
                >
                  {archiving
                    ? archived
                      ? 'Unarchiving...'
                      : 'Archiving...'
                    : archived
                      ? 'Unarchive'
                      : 'Archive'}
                </button>
                {confirmDelete ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim, #6b7280)' }}>
                      Delete this entry?
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.35rem',
                          padding: '0.3rem 0.7rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {deleting ? 'Deleting...' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="entry-box__menu-item entry-box__menu-item--danger"
                    onClick={() => setConfirmDelete(true)}
                    disabled={deleting}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="entry-box__header">
          <div className="entry-box__tags">
            {onPriorityChanged ? (
              <select
                className={`entry-box__tag entry-box__priority-select ${priorityClass}`}
                value={
                  priority && PRIORITY_TO_VALUE[priority] !== undefined
                    ? PRIORITY_TO_VALUE[priority]
                    : '3'
                }
                onChange={(e) => onPriorityChanged(id, project_name, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="0">Urgent & important</option>
                <option value="1">Urgent, not important</option>
                <option value="2">Not urgent</option>
                <option value="3">No priority</option>
              </select>
            ) : (
              priority && <span className={`entry-box__tag ${priorityClass}`}>{priority}</span>
            )}
            <select
              className={`entry-box__tag entry-box__status-select ${STATUS_CLASS[status]}`}
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as EntryStatus)}
              onClick={(e) => e.stopPropagation()}
              disabled={saving || archived}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {isOverdue(due_date ?? null, status) && (
              <span className="entry-box__tag entry-box__tag--overdue">
                {getOverdueText(due_date ?? null, status)}
              </span>
            )}
          </div>
          <button
            type="button"
            className="entry-box__project entry-box__project--link"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/project/${encodeURIComponent(project_name)}`);
            }}
            title={`Go to ${project_name} page`}
          >
            {project_name}
          </button>
        </div>

        {safeSummary && <p className="entry-box__summary">{safeSummary}</p>}

        {/* Project reference area */}
        <div className="entry-box__project-ref-area">
          {!!parsedEntries._project_ref && (
            <div className="entry-box__ref-row">
              <span className="entry-box__ref-label">Project ref:</span>
              <button
                type="button"
                className="entry-box__ref-link"
                onClick={(e) => {
                  e.stopPropagation();
                  const ref = parsedEntries._project_ref as any;
                  navigate(`/project/${encodeURIComponent(ref.project_name)}`);
                }}
              >
                📁 {(parsedEntries._project_ref as any).project_name}
              </button>
              <button
                type="button"
                className="entry-box__ref-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeProjectRef();
                }}
                title="Remove reference"
              >
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            className="entry-box__ref-btn"
            onClick={(e) => {
              e.stopPropagation();
              openProjectRefPicker();
            }}
          >
            + Project Reference
          </button>
        </div>

        {entryFields.length > 0 && (
          <table className="entry-box__table">
            <tbody>
              {entryFields.map(([key, value]) => {
                const fieldDef = fieldDefs[key];
                const calcKey = `_calc_${key}`;
                const calcResult = parsedEntries[calcKey] as
                  { type: string; value: number } | undefined;
                return (
                  <React.Fragment key={key}>
                    <tr className="entry-box__row">
                      <td className="entry-box__field-key">{formatFieldKey(key)}</td>
                      <td className="entry-box__field-value">
                        {fieldDef ? (
                          <FieldDisplay field={fieldDef} value={value} />
                        ) : (
                          formatEntryValue(value)
                        )}
                        {fieldDef && fieldDef.data_type === 'number' && (
                          <button
                            type="button"
                            className="entry-box__calc-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCalcPicker(key);
                            }}
                            title="Calculate sum or average"
                          >
                            Calculate
                          </button>
                        )}
                      </td>
                    </tr>
                    {calcResult && (
                      <tr className="entry-box__row entry-box__row--calc">
                        <td className="entry-box__field-key entry-box__field-key--calc">
                          {calcResult.type === 'sum' ? 'Σ' : 'μ'} {formatFieldKey(key)}
                        </td>
                        <td className="entry-box__field-value entry-box__field-value--calc">
                          {Number(calcResult.value).toFixed(2)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="entry-box__meta">
          <div className="entry-box__meta-left">
            {dueLabel && (
              <span className="entry-box__meta-item">
                <span className="entry-box__meta-label">Due</span>
                <span className="entry-box__meta-value">{dueLabel}</span>
              </span>
            )}
          </div>
          <div className="entry-box__meta-right">
            {!started_at && !ended_at && !archived && (
              <button
                type="button"
                className="entry-box__task-btn entry-box__task-btn--start"
                onClick={startTimer}
                disabled={saving || isActionInFlight}
              >
                {timerAction === 'starting'
                  ? 'Starting…'
                  : timerErrorAction === 'starting'
                    ? 'Failed to start — tap to retry'
                    : '▶ Start'}
              </button>
            )}
            {started_at && !ended_at && (
              <div className="entry-box__task-active">
                {timerAction === 'pending-sync' && (
                  <span className="entry-box__task-pending">Pending sync</span>
                )}
                {isPaused && timerAction !== 'pending-sync' && (
                  <span className="entry-box__task-paused">Paused</span>
                )}
                {timerText && (
                  <span className="entry-box__task-elapsed">
                    {target_duration_ms != null ? `${timerText} left` : timerText}
                  </span>
                )}
                {isPaused ? (
                  <button
                    type="button"
                    className="entry-box__task-btn entry-box__task-btn--resume"
                    onClick={resumeTimer}
                    disabled={saving || (isActionInFlight && timerAction !== 'resuming')}
                  >
                    {timerAction === 'resuming'
                      ? 'Resuming…'
                      : timerErrorAction === 'resuming'
                        ? 'Failed to resume — tap to retry'
                        : '▶ Resume'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="entry-box__task-btn entry-box__task-btn--pause"
                    onClick={pauseTimer}
                    disabled={saving || (isActionInFlight && timerAction !== 'pausing')}
                  >
                    {timerAction === 'pausing'
                      ? 'Pausing…'
                      : timerErrorAction === 'pausing'
                        ? 'Failed to pause — tap to retry'
                        : '❚❚ Pause'}
                  </button>
                )}
                <button
                  type="button"
                  className="entry-box__task-btn entry-box__task-btn--end"
                  onClick={stopTimer}
                  disabled={saving || (isActionInFlight && timerAction !== 'stopping')}
                >
                  {timerAction === 'stopping'
                    ? 'Stopping…'
                    : timerErrorAction === 'stopping'
                      ? 'Failed to stop — tap to retry'
                      : '■ End Task'}
                </button>
                {target_duration_ms == null && (
                  <span className="entry-box__target-set">
                    <input
                      type="number"
                      min="0"
                      placeholder="d"
                      aria-label="Target days"
                      value={targetDays}
                      onChange={(e) => setTargetDays(e.target.value)}
                      className="entry-box__target-input entry-box__target-input--small"
                    />
                    <input
                      type="number"
                      min="0"
                      max="23"
                      placeholder="h"
                      aria-label="Target hours"
                      value={targetHours}
                      onChange={(e) => setTargetHours(e.target.value)}
                      className="entry-box__target-input entry-box__target-input--small"
                    />
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="m"
                      aria-label="Target minutes"
                      value={targetMinutes}
                      onChange={(e) => setTargetMinutes(e.target.value)}
                      className="entry-box__target-input entry-box__target-input--small"
                    />
                    <button
                      type="button"
                      className="entry-box__task-btn entry-box__task-btn--target"
                      onClick={handleSetTarget}
                      disabled={saving || (!targetDays && !targetHours && !targetMinutes)}
                    >
                      Set Target
                    </button>
                  </span>
                )}
              </div>
            )}
            {archived && <span className="entry-box__archived-tag">Archived</span>}
          </div>
        </div>

        {/* View Notes button - secondary action on its own line */}
        <button
          type="button"
          className="entry-box__view-notes-btn"
          onClick={() => openNotes(entry)}
        >
          <FiEdit className="entry-box__view-notes-icon" />
          View Notes
        </button>

        {timerErrorAction !== null && (
          <div className="entry-box__error entry-box__error--timer">
            {timerError}
            <button
              type="button"
              className="entry-box__error-dismiss"
              onClick={clearTimerError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        {error && <div className="entry-box__error">{error}</div>}
      </div>

      {/* Project Reference Picker Modal */}
      {refPickerOpen && (
        <div className="modal-overlay" onClick={() => setRefPickerOpen(null)}>
          <div className="ref-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ref-picker-header">
              <h3>Select a Project</h3>
              <button
                type="button"
                className="ref-picker-close"
                onClick={() => setRefPickerOpen(null)}
              >
                ×
              </button>
            </div>
            {refLoading ? (
              <div className="ref-picker-loading">Loading...</div>
            ) : (
              <div className="ref-picker-list">
                {refProjects.map((p: any) => (
                  <button
                    key={p.project_name}
                    type="button"
                    className="ref-picker-item"
                    onClick={() => selectProjectRef(p)}
                  >
                    <span className="ref-picker-item-project">{p.project_name}</span>
                  </button>
                ))}
                {refProjects.length === 0 && (
                  <div className="ref-picker-empty">No projects found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calculation Picker Modal */}
      {calcField && (
        <div className="modal-overlay" onClick={() => setCalcField(null)}>
          <div
            className="ref-picker-modal ref-picker-modal--small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ref-picker-header">
              <h3>Calculate {formatFieldKey(calcField)}</h3>
              <button type="button" className="ref-picker-close" onClick={() => setCalcField(null)}>
                ×
              </button>
            </div>
            <div className="calc-picker-actions">
              <button
                type="button"
                className="calc-picker-btn"
                onClick={() => doCalculation('sum')}
              >
                Sum
              </button>
              <button
                type="button"
                className="calc-picker-btn"
                onClick={() => doCalculation('average')}
              >
                Average
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EntryBox;
