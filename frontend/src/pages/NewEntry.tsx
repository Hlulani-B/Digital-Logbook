import { useState, useRef, useEffect } from "react";
import { updateEntry } from "../functions/project/entries.js";
import { archiveEntry, unarchiveEntry } from "../functions/project/archives.js";
import { isOverdue, getOverdueText } from "../functions/dashboard/overdue.js";

type EntryStatus = "up_next" | "in_motion" | "done_and_dusted";

const PRIORITY_LABELS: Record<string, string> = {
  "0": "Urgent and important",
  "1": "Urgent but not important",
  "2": "Not urgent, not important",
  "3": "No priority",
};

const PRIORITY_TO_VALUE: Record<string, string> = {
  "Urgent and important": "0",
  "Urgent but not important": "1",
  "Not urgent, not important": "2",
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  up_next: "Up Next",
  in_motion: "In Motion",
  done_and_dusted: "Done & Dusted",
};

const STATUS_CLASS: Record<EntryStatus, string> = {
  up_next: "status-up-next",
  in_motion: "status-in-motion",
  done_and_dusted: "status-done",
};

const PRIORITY_CLASS: Record<string, string> = {
  "Urgent and important": "priority-urgent-important",
  "Urgent but not important": "priority-urgent",
  "Not urgent, not important": "priority-low",
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toInputDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  // Return YYYY-MM-DDTHH:MM for datetime-local inputs
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatFieldKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stringifyForInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface EntryRow {
  id: string;
  user_email: string;
  project_name: string;
  entries: Record<string, unknown>;
  created_at: string;
  due_date?: string | null;
  priority?: string | null;
  archived?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: string | null;
  status?: EntryStatus;
}

interface EntryBoxProps {
  entry: EntryRow;
  onUpdated?: (updatedEntry: EntryRow) => void;
  onArchiveToggled?: (entryId: string, archived: boolean) => void;
}

export function EntryBox({ entry, onUpdated, onArchiveToggled }: EntryBoxProps) {
  const {
    id,
    user_email,
    project_name,
    entries,
    created_at,
    due_date,
    priority,
    archived,
    started_at,
    ended_at,
    duration,
    status = "up_next",
  } = entry;

  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Live elapsed time for in-progress tasks
  const [elapsed, setElapsed] = useState<string>("");
  useEffect(() => {
    if (!started_at || ended_at) {
      setElapsed("");
      return;
    }
    const start = new Date(started_at).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setElapsed(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [started_at, ended_at]);

  const [draftFields, setDraftFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(entry.entries || {}).map(([k, v]) => [k, stringifyForInput(v)])
    )
  );
  const [draftDueDate, setDraftDueDate] = useState(toInputDate(due_date));
  const [draftStartedAt, setDraftStartedAt] = useState(toInputDate(started_at));
  const [draftEndedAt, setDraftEndedAt] = useState(toInputDate(ended_at));
  const [draftDuration, setDraftDuration] = useState(duration || "");
  const [draftPriorityValue, setDraftPriorityValue] = useState(
    priority && PRIORITY_TO_VALUE[priority] !== undefined
      ? PRIORITY_TO_VALUE[priority]
      : "3"
  );
  const [draftStatus, setDraftStatus] = useState<EntryStatus>(status);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const entryFields = Object.entries(entries || {});
  const createdLabel = formatDate(created_at);
  const dueLabel = formatDate(due_date);
  const startedLabel = formatDate(started_at);
  const endedLabel = formatDate(ended_at);

  const priorityClass = priority ? (PRIORITY_CLASS[priority] || "priority-neutral") : "";

  const handleFieldChange = (key: string, newValue: string) => {
    setDraftFields((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleCancel = () => {
    setDraftFields(
      Object.fromEntries(
        Object.entries(entry.entries || {}).map(([k, v]) => [k, stringifyForInput(v)])
      )
    );
    setDraftDueDate(toInputDate(due_date));
    setDraftStartedAt(toInputDate(started_at));
    setDraftEndedAt(toInputDate(ended_at));
    setDraftDuration(duration || "");
    setDraftPriorityValue(
      priority && PRIORITY_TO_VALUE[priority] !== undefined
        ? PRIORITY_TO_VALUE[priority]
        : "3"
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
      const newEntryObject: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(draftFields)) {
        try {
          newEntryObject[key] = JSON.parse(val);
        } catch {
          newEntryObject[key] = val;
        }
      }

      // Convert priority index to label string (or null for "No priority")
      const newPriorityLabel = draftPriorityValue === "3"
        ? null
        : PRIORITY_LABELS[draftPriorityValue];

      const newDueDate = draftDueDate
        ? new Date(draftDueDate).toISOString()
        : null;
      const newStartedAt = draftStartedAt
        ? new Date(draftStartedAt).toISOString()
        : null;
      const newEndedAt = draftEndedAt
        ? new Date(draftEndedAt).toISOString()
        : null;
      const newDuration = draftDuration || null;

      const updatedEntry: EntryRow = {
        ...entry,
        entries: newEntryObject,
        due_date: newDueDate,
        priority: newPriorityLabel,
        status: draftStatus,
        started_at: newStartedAt,
        ended_at: newEndedAt,
        duration: newDuration,
      };

      // Single update call with all schema columns
      const result = await updateEntry(user_email, project_name, id, newEntryObject, newDueDate, newPriorityLabel, draftStatus, newStartedAt, newEndedAt, newDuration);

      if (result?.success === false) {
        setError(result.message || "Failed to save changes");
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
      setError(err instanceof Error ? err.message : "Failed to save changes");
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

      if (result?.error) throw new Error(result.error);
      if (result?.success === false) throw new Error(result.message || "Failed to update archive state");

      onArchiveToggled?.(id, !archived);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update archive state");
    } finally {
      setArchiving(false);
    }
  };

  const handleStartTask = async () => {
    if (!user_email || saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const result = await updateEntry(user_email, project_name, id, entries, due_date, priority, status, now, null, null);
      if (result?.success === false) {
        setError(result.message || "Failed to start task");
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Always reload from database to show actual state
      onUpdated?.({ ...entry, started_at: now });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start task");
    } finally {
      setSaving(false);
    }
  };

  const handleEndTask = async () => {
    if (!user_email || saving) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const result = await updateEntry(user_email, project_name, id, entries, due_date, priority, status, started_at, now, null);
      if (result?.success === false) {
        setError(result.message || "Failed to end task");
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }
      // Always reload from database to show actual state
      onUpdated?.({ ...entry, ended_at: now });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end task");
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="entry-box entry-box--editing">
        <div className="entry-box__header">
          <div className="entry-box__tags">
            <select
              className="entry-box__priority-select"
              value={draftPriorityValue}
              onChange={(e) => setDraftPriorityValue(e.target.value)}
              disabled={saving}
            >
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              className="entry-box__status-select"
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value as EntryStatus)}
              disabled={saving}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <span className="entry-box__project">{project_name}</span>
        </div>

        {error && <div className="entry-box__error">{error}</div>}

        <div className="entry-box__fields--editing">
          {Object.entries(draftFields).map(([key, value]) => (
            <div className="entry-box__field--editing" key={key}>
              <label className="entry-box__field-key">{formatFieldKey(key)}</label>
              <input
                className="entry-box__field-input"
                type="text"
                value={value}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                disabled={saving}
              />
            </div>
          ))}
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

        <div className="entry-box__edit-actions">
          <button type="button" className="entry-box__btn entry-box__btn--cancel" onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="entry-box__btn entry-box__btn--save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`entry-box ${archived ? "entry-box--archived" : ""}`}>
      <div className="entry-box__header">
        <div className="entry-box__tags">
          {priority && (
            <span className={`entry-box__tag ${priorityClass}`}>{priority}</span>
          )}
          <span className={`entry-box__tag ${STATUS_CLASS[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          {isOverdue(due_date ?? null, status) && (
            <span className="entry-box__tag entry-box__tag--overdue">
              {getOverdueText(due_date ?? null, status)}
            </span>
          )}
        </div>
        <span className="entry-box__project">{project_name}</span>
      </div>

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
              className="entry-box__menu-item entry-box__menu-item--danger"
              onClick={handleToggleArchive}
              disabled={archiving}
            >
              {archiving ? (archived ? "Unarchiving..." : "Archiving...") : archived ? "Unarchive" : "Archive"}
            </button>
          </div>
        )}
      </div>

      {entryFields.length > 0 && (
        <table className="entry-box__table">
          <tbody>
            {entryFields.map(([key, value]) => (
              <tr className="entry-box__row" key={key}>
                <td className="entry-box__field-key">{formatFieldKey(key)}</td>
                <td className="entry-box__field-value">{formatFieldValue(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="entry-box__meta">
        <div className="entry-box__meta-left">
          {createdLabel && (
            <span className="entry-box__meta-item">
              <span className="entry-box__meta-label">Created</span>
              <span className="entry-box__meta-value">{createdLabel}</span>
            </span>
          )}
          {dueLabel && (
            <span className="entry-box__meta-item">
              <span className="entry-box__meta-label">Due</span>
              <span className="entry-box__meta-value">{dueLabel}</span>
            </span>
          )}
          {startedLabel && (
            <span className="entry-box__meta-item">
              <span className="entry-box__meta-label">Started</span>
              <span className="entry-box__meta-value">{startedLabel}</span>
            </span>
          )}
          {endedLabel && (
            <span className="entry-box__meta-item">
              <span className="entry-box__meta-label">Ended</span>
              <span className="entry-box__meta-value">{endedLabel}</span>
            </span>
          )}
          {duration && (
            <span className="entry-box__meta-item">
              <span className="entry-box__meta-label">Duration</span>
              <span className="entry-box__meta-value">{duration}</span>
            </span>
          )}
        </div>
        <div className="entry-box__meta-right">
          {!started_at && !ended_at && (
            <button
              type="button"
              className="entry-box__task-btn entry-box__task-btn--start"
              onClick={handleStartTask}
              disabled={saving || archived}
            >
              ▶ Start Task
            </button>
          )}
          {started_at && !ended_at && (
            <div className="entry-box__task-active">
              {elapsed && <span className="entry-box__task-elapsed">{elapsed}</span>}
              <button
                type="button"
                className="entry-box__task-btn entry-box__task-btn--end"
                onClick={handleEndTask}
                disabled={saving}
              >
                ■ End Task
              </button>
            </div>
          )}
          {archived && <span className="entry-box__archived-tag">Archived</span>}
        </div>
      </div>

      {error && <div className="entry-box__error">{error}</div>}
    </div>
  );
}

export default EntryBox;
