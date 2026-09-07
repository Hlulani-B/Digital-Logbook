import { useState, useEffect, useCallback, useRef } from 'react';
import { addEntry } from '@/functions/project/entries.js';
import { getFields } from '@/functions/project/fields.js';
import { getEntryTitle, type CalendarEntry } from '@/lib/calendar';
import { isOverdue } from '@/functions/dashboard/overdue.js';
import './CalendarDayModal.css';

const PRIORITY_LABELS: Record<string, string> = {
  '0': 'Urgent and important',
  '1': 'Urgent but not important',
  '2': 'Not urgent, not important',
  '3': 'No priority',
};

const STATUS_LABELS: Record<string, string> = {
  up_next: 'Up Next',
  in_motion: 'In Motion',
  done_and_dusted: 'Done & Dusted',
};

const STATUS_COLORS: Record<string, string> = {
  up_next: '#6366f1',
  in_motion: '#f59e0b',
  done_and_dusted: '#22c55e',
};

interface FieldDef {
  field_name: string;
  data_type: string;
  is_required: boolean;
}

interface CalendarDayModalProps {
  date: Date;
  entries: CalendarEntry[];
  projects: { project_name: string }[];
  userEmail: string;
  onClose: () => void;
  onEntryAdded: () => void;
  onEntryClick: (entry: CalendarEntry) => void;
}

function parseFieldValue(value: string, dataType: string): unknown {
  if (dataType === 'number' || dataType === 'integer' || dataType === 'float') {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (dataType === 'boolean') return value === 'true';
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function inputTypeForDataType(dataType: string): string {
  switch (dataType) {
    case 'number':
    case 'integer':
    case 'float':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function formatDateHeading(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDueDateForInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T09:00`;
}

export function CalendarDayModal({
  date,
  entries,
  projects,
  userEmail,
  onClose,
  onEntryAdded,
  onEntryClick,
}: CalendarDayModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState(formatDueDateForInput(date));
  const [priority, setPriority] = useState('3');
  const [status, setStatus] = useState('up_next');
  const [saving, setSaving] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Load project fields when project is selected
  useEffect(() => {
    if (!selectedProject || !userEmail) {
      setFields([]);
      setFieldValues({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const result = await getFields(userEmail, selectedProject);
        if (!cancelled) {
          const defs: FieldDef[] = (result?.data || []).map((f: any) => ({
            field_name: f.field_name,
            data_type: f.data_type || 'text',
            is_required: !!f.is_required,
          }));
          setFields(defs);
          const initial: Record<string, string> = {};
          for (const f of defs) {
            initial[f.field_name] = f.data_type === 'boolean' ? 'false' : '';
          }
          setFieldValues(initial);
        }
      } catch {
        if (!cancelled) setError('Failed to load project fields');
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProject, userEmail]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !userEmail || saving) return;

    // Validate required fields
    for (const f of fields) {
      if (!f.is_required) continue;
      if (f.data_type === 'boolean') {
        if (fieldValues[f.field_name] !== 'true') {
          setError(`"${f.field_name}" is required`);
          return;
        }
      } else if (!fieldValues[f.field_name]?.trim()) {
        setError(`"${f.field_name}" is required`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const entryObject: Record<string, unknown> = {};
      for (const f of fields) {
        const val = fieldValues[f.field_name];
        if (val !== undefined && val.trim() !== '') {
          entryObject[f.field_name] = parseFieldValue(val, f.data_type);
        }
      }
      const priorityLabel = priority === '3' ? null : PRIORITY_LABELS[priority];

      await addEntry(
        userEmail,
        selectedProject,
        entryObject,
        dueDate ? new Date(dueDate).toISOString() : null,
        priorityLabel,
        status,
        null,
        null,
        null
      );

      setSuccessMsg('Entry added!');
      // Reset form
      setFieldValues({});
      setSelectedProject('');
      setFields([]);
      setShowAddForm(false);
      onEntryAdded();
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  }, [selectedProject, userEmail, fields, fieldValues, dueDate, priority, status, saving, onEntryAdded]);

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  return (
    <div className="cdm-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="cdm-modal">
        {/* Header */}
        <div className="cdm-header">
          <div>
            <h2 className="cdm-date">{formatDateHeading(date)}</h2>
            <span className="cdm-count">{entries.length} task{entries.length !== 1 ? 's' : ''}</span>
          </div>
          <button type="button" className="cdm-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Success message */}
        {successMsg && <div className="cdm-success">{successMsg}</div>}

        {/* Error */}
        {error && (
          <div className="cdm-error">
            {error}
            <button type="button" className="cdm-error-close" onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        {/* Scrollable content */}
        <div className="cdm-body">
          {/* Existing entries */}
          {entries.length > 0 && (
            <div className="cdm-entries-section">
              <div className="cdm-entries-list">
                {entries.map((entry) => {
                  const entryStatus = entry.status ?? 'up_next';
                  const overdue = isOverdue(entry.due_date ?? null, entryStatus);
                  const isCompleted = entryStatus === 'done_and_dusted';
                  const statusColor = STATUS_COLORS[entryStatus] || '#6366f1';

                  return (
                    <div
                      key={entry.id}
                      className={[
                        'cdm-entry',
                        isCompleted && 'cdm-entry--completed',
                        overdue && 'cdm-entry--overdue',
                      ].filter(Boolean).join(' ')}
                      onClick={() => onEntryClick(entry)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onEntryClick(entry); }}
                    >
                      <div className="cdm-entry-indicator" style={{ backgroundColor: statusColor }} />
                      <div className="cdm-entry-content">
                        <span className="cdm-entry-title">{getEntryTitle(entry)}</span>
                        <span className="cdm-entry-meta">
                          <span className="cdm-entry-project">{entry.project_name}</span>
                          <span className="cdm-entry-status" style={{ color: statusColor }}>
                            {STATUS_LABELS[entryStatus] || entryStatus}
                          </span>
                          {entry.priority && (
                            <span className="cdm-entry-priority">{entry.priority}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {entries.length === 0 && !showAddForm && (
            <p className="cdm-empty">No tasks for this day.</p>
          )}

          {/* Add entry form */}
          {showAddForm ? (
            <form className="cdm-form" onSubmit={handleSubmit}>
              <h3 className="cdm-form-title">New Entry</h3>

              {/* Project selector */}
              <div className="cdm-form-field">
                <label className="cdm-label" htmlFor="cdm-project">Project</label>
                <select
                  id="cdm-project"
                  className="cdm-select"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={saving}
                  required
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.project_name} value={p.project_name}>
                      {p.project_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic fields */}
              {loadingFields && <p className="cdm-loading">Loading fields...</p>}
              {fields.map((field) => (
                <div className="cdm-form-field" key={field.field_name}>
                  <label className="cdm-label" htmlFor={`cdm-field-${field.field_name}`}>
                    {field.field_name.replace(/_/g, ' ')}
                    {field.is_required && <span className="cdm-required">*</span>}
                  </label>
                  {field.data_type === 'boolean' ? (
                    <input
                      id={`cdm-field-${field.field_name}`}
                      type="checkbox"
                      className="cdm-checkbox"
                      checked={fieldValues[field.field_name] === 'true'}
                      onChange={(e) => handleFieldChange(field.field_name, e.target.checked ? 'true' : 'false')}
                      disabled={saving}
                    />
                  ) : (
                    <input
                      id={`cdm-field-${field.field_name}`}
                      type={inputTypeForDataType(field.data_type)}
                      className="cdm-input"
                      placeholder={`Enter ${field.field_name.replace(/_/g, ' ')}`}
                      value={fieldValues[field.field_name] || ''}
                      onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                      disabled={saving}
                      required={field.is_required}
                    />
                  )}
                </div>
              ))}

              {/* Due date */}
              <div className="cdm-form-field">
                <label className="cdm-label" htmlFor="cdm-due-date">Due Date</label>
                <input
                  id="cdm-due-date"
                  type="datetime-local"
                  className="cdm-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={saving}
                />
              </div>

              {/* Priority + Status row */}
              <div className="cdm-form-row">
                <div className="cdm-form-field">
                  <label className="cdm-label" htmlFor="cdm-priority">Priority</label>
                  <select
                    id="cdm-priority"
                    className="cdm-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    disabled={saving}
                  >
                    {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="cdm-form-field">
                  <label className="cdm-label" htmlFor="cdm-status">Status</label>
                  <select
                    id="cdm-status"
                    className="cdm-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={saving}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cdm-form-actions">
                <button
                  type="button"
                  className="cdm-btn cdm-btn--cancel"
                  onClick={() => { setShowAddForm(false); setError(null); }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cdm-btn cdm-btn--submit"
                  disabled={saving || !selectedProject}
                >
                  {saving ? 'Adding...' : 'Add Entry'}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="cdm-add-btn"
              onClick={() => { setShowAddForm(true); setError(null); setSuccessMsg(null); }}
            >
              + Add Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarDayModal;
