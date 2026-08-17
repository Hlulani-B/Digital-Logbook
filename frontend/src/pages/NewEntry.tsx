import { useState, useRef, useEffect } from "react";
import { updateEntry } from "../functions/project/entries.js";
import { setPriority } from "../functions/project/priority.js";
import { archiveEntry, unarchiveEntry } from "../functions/project/archives.js";

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
  return date.toISOString().split("T")[0];
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

export function EntryBox({ entry, onUpdated, onArchiveToggled }: EntryBoxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [draftFields, setDraftFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(entry.entries || {}).map(([k, v]) => [k, stringifyForInput(v)])
    )
  );
  const [draftDueDate, setDraftDueDate] = useState(toInputDate(entry.due_date));
  const [draftPriorityValue, setDraftPriorityValue] = useState<string>(
    PRIORITY_TO_VALUE[entry.priority || ""] ?? "3"
  );
  const [draftStatus, setDraftStatus] = useState<EntryStatus>(entry.status || "up_next");

  const {
    id,
    project_name,
    entries,
    created_at,
    due_date,
    priority,
    archived = false,
    started_at,
    ended_at,
    duration,
    status = "up_next",
    user_email,
  } = entry;

  const entryFields = entries ? Object.entries(entries) : [];
  const createdLabel = formatDate(created_at);
  const dueLabel = formatDate(due_date);
  const startedLabel = formatDate(started_at);
  const endedLabel = formatDate(ended_at);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleEnterEdit = () => {
    setDraftFields(
      Object.fromEntries(
        Object.entries(entry.entries || {}).map(([k, v]) => [k, stringifyForInput(v)])
      )
    );
    setDraftDueDate(toInputDate(entry.due_date));
    setDraftPriorityValue(PRIORITY_TO_VALUE[entry.priority || ""] ?? "3");
    setDraftStatus(entry.status || "up_next");
    setError(null);
    setMenuOpen(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleFieldChange = (key: string, value: string) => {
    setDraftFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!user_email || saving) return;
    setSaving(true);
    setError(null);

    try {
      const newEntryObject: Record<string, unknown> = {};
      for (const [key, rawValue] of Object.entries(draftFields)) {
        try {
          newEntryObject[key] = JSON.parse(rawValue);
        } catch {
          newEntryObject[key] = rawValue;
        }
      }

      const updateResult = await updateEntry(
        user_email,
        project_name,
        entries,
        newEntryObject
      );
      if (updateResult?.error) throw new Error(updateResult.error);

      const priorityChanged =
        draftPriorityValue !== (PRIORITY_TO_VALUE[priority || ""] ?? "3");

      if (priorityChanged) {
        const priorityResult = await setPriority(
          user_email,
          draftPriorityValue,
          project_name,
          newEntryObject
        );
        if (priorityResult?.error) throw new Error(priorityResult.error);
      }

      const updatedEntry: EntryRow = {
        ...entry,
        entries: newEntryObject,
        due_date: draftDueDate ? new Date(draftDueDate).toISOString() : due_date,
        priority: priorityChanged
          ? PRIORITY_LABELS[draftPriorityValue] === "No priority"
            ? null
            : PRIORITY_LABELS[draftPriorityValue]
          : priority,
        status: draftStatus,
      };

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
        ? await unarchiveEntry(user_email, project_name, entries)
        : await archiveEntry(user_email, project_name, entries);

      if (result?.error) throw new Error(result.error);
      if (result?.success === false) throw new Error(result.message || "Failed to update archive state");

      onArchiveToggled?.(id, !archived);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update archive state");
    } finally {
      setArchiving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="entry-box entry-box--editing">
        <div className="entry-box__header">
          <span className="entry-box__project">{project_name}</span>
          <div className="entry-box__header-right">
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
        </div>

        {error && <div className="entry-box__error">{error}</div>}

        <div className="entry-box__fields entry-box__fields--editing">
          {Object.entries(draftFields).map(([key, value]) => (
            <div className="entry-box__field entry-box__field--editing" key={key}>
              <label className="entry-box__field-key" htmlFor={`field-${key}`}>
                {formatFieldKey(key)}
              </label>
              <input
                id={`field-${key}`}
                className="entry-box__field-input"
                type="text"
                value={value}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                disabled={saving}
              />
            </div>
          ))}
        </div>

        <div className="entry-box__field entry-box__field--editing">
          <label className="entry-box__field-key" htmlFor="due-date">
            Due Date
          </label>
          <input
            id="due-date"
            className="entry-box__field-input"
            type="date"
            value={draftDueDate}
            onChange={(e) => setDraftDueDate(e.target.value)}
            disabled={saving}
          />
        </div>

        <div className="entry-box__edit-actions">
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
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`entry-box ${archived ? "entry-box--archived" : ""}`}>
      <div className="entry-box__header">
        <span className="entry-box__project">{project_name}</span>
        <div className="entry-box__header-right">
          {priority && <span className="entry-box__priority">{priority}</span>}
          <span className={`entry-box__status ${STATUS_CLASS[status]}`}>
            {STATUS_LABELS[status]}
          </span>

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
                <button
                  type="button"
                  className="entry-box__menu-item"
                  onClick={handleEnterEdit}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="entry-box__menu-item entry-box__menu-item--danger"
                  onClick={handleToggleArchive}
                  disabled={archiving}
                >
                  {archiving
                    ? archived
                      ? "Unarchiving..."
                      : "Archiving..."
                    : archived
                    ? "Unarchive"
                    : "Archive"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {entryFields.length > 0 && (
        <div className="entry-box__fields">
          {entryFields.map(([key, value]) => (
            <div className="entry-box__field" key={key}>
              <span className="entry-box__field-key">{formatFieldKey(key)}</span>
              <span className="entry-box__field-value">{formatFieldValue(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="entry-box__meta">
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
        {archived && <span className="entry-box__archived-tag">Archived</span>}
      </div>

      {error && <div className="entry-box__error">{error}</div>}
    </div>
  );
}

export default EntryBox;