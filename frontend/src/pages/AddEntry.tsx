import React, { useState, useEffect, useRef } from 'react';
import { addEntry } from '../functions/project/entries.js';
import { getFields } from '../functions/project/fields.js';

type NoteType = 'text' | 'link' | 'image' | 'pdf';

interface NoteDraft {
  entry_type: NoteType;
  value: string | File;
}

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

interface FieldDef {
  field_name: string;
  data_type: string;
  is_required: boolean;
}

interface AddEntryProps {
  user_email: string;
  project_name: string;
  onAdded?: (result: unknown) => void;
  onCancel?: () => void;
}

function parseFieldValue(value: string, dataType: string): unknown {
  if (dataType === 'number' || dataType === 'integer' || dataType === 'float') {
    const num = Number(value);
    return isNaN(num) ? value : num;
  }
  if (dataType === 'boolean') {
    return value === 'true';
  }
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
    case 'boolean':
      return 'text';
    default:
      return 'text';
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AddEntry({ user_email, project_name, onAdded, onCancel }: AddEntryProps) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 16));
  const [priorityValue, setPriorityValue] = useState('3');
  const [statusValue, setStatusValue] = useState('up_next');
  const [saving, setSaving] = useState(false);
  const [loadingFields, setLoadingFields] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<NoteDraft[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Load predefined fields for this project
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const result = await getFields(user_email, project_name);
        if (!cancelled) {
          const defs: FieldDef[] = (result?.data || []).map((f: any) => ({
            field_name: f.field_name,
            data_type: f.data_type || 'text',
            is_required: !!f.is_required,
          }));
          setFields(defs);
          // Initialize empty values for each field (booleans default to "false")
          const initial: Record<string, string> = {};
          for (const f of defs) {
            initial[f.field_name] = f.data_type === 'boolean' ? 'false' : '';
          }
          setFieldValues(initial);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load fields');
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user_email, project_name]);

  const handleValueChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_email || !project_name || saving) return;

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

    try {
      const entryObject: Record<string, unknown> = {};
      for (const f of fields) {
        const val = fieldValues[f.field_name];
        if (val !== undefined && val.trim() !== '') {
          entryObject[f.field_name] = parseFieldValue(val, f.data_type);
        }
      }
      // Convert priority index to label (null = no priority)
      const priorityLabel = priorityValue === '3' ? null : PRIORITY_LABELS[priorityValue];

      // Build notes array — read files as base64
      const notesPayload: { entry_type: string; value: string }[] = [];
      for (const note of notes) {
        if (note.entry_type === 'image' || note.entry_type === 'pdf') {
          if (note.value instanceof File) {
            const base64 = await fileToBase64(note.value);
            notesPayload.push({ entry_type: note.entry_type, value: base64 });
          } else if (typeof note.value === 'string' && note.value) {
            notesPayload.push({ entry_type: note.entry_type, value: note.value });
          }
        } else if (typeof note.value === 'string' && note.value.trim()) {
          notesPayload.push({ entry_type: note.entry_type, value: note.value.trim() });
        }
      }

      const result = await addEntry(
        user_email,
        project_name,
        entryObject,
        dueDate ? new Date(dueDate).toISOString() : null,
        priorityLabel,
        statusValue,
        null, // started_at - set via Start Task button
        null, // ended_at - set via End Task button
        null, // duration - calculated in Supabase
        notesPayload.length > 0 ? notesPayload : undefined
      );

      if (result?.success === false) {
        throw new Error((result as any).message || 'Failed to add entry');
      }

      onAdded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry');
    } finally {
      setSaving(false);
    }
  };

  if (loadingFields) {
    return (
      <div className="add-entry">
        <div className="add-entry__header">
          <h2 className="add-entry__title">New Entry</h2>
          <span className="add-entry__project">{project_name}</span>
        </div>
        <div className="add-entry__loading">Loading columns...</div>
      </div>
    );
  }

  return (
    <form className="add-entry" onSubmit={handleSubmit}>
      <div className="add-entry__header">
        <h2 className="add-entry__title">New Entry</h2>
        <span className="add-entry__project">{project_name}</span>
      </div>

      {error && <div className="add-entry__error">{error}</div>}

      {fields.length > 0 && (
        <div className="add-entry__fields">
          <span className="add-entry__section-label">Columns</span>
          {fields.map((field) => (
            <div className="add-entry__field-row" key={field.field_name}>
              <label className="add-entry__field-label" htmlFor={`field-${field.field_name}`}>
                {field.field_name.replace(/_/g, ' ')}
                {field.is_required && <span className="add-entry__required">*</span>}
              </label>
              {field.data_type === 'boolean' ? (
                <input
                  id={`field-${field.field_name}`}
                  type="checkbox"
                  className="add-entry__field-input"
                  checked={fieldValues[field.field_name] === 'true'}
                  onChange={(e) =>
                    handleValueChange(field.field_name, e.target.checked ? 'true' : 'false')
                  }
                  disabled={saving}
                />
              ) : (
                <input
                  id={`field-${field.field_name}`}
                  type={inputTypeForDataType(field.data_type)}
                  className="add-entry__field-input"
                  placeholder={`Enter ${field.field_name.replace(/_/g, ' ')}`}
                  value={fieldValues[field.field_name] || ''}
                  onChange={(e) => handleValueChange(field.field_name, e.target.value)}
                  disabled={saving}
                  required={field.is_required}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {fields.length === 0 && (
        <p className="add-entry__no-fields">No columns defined for this project yet.</p>
      )}

      <div className="add-entry__row">
        <div className="add-entry__group">
          <label className="add-entry__label" htmlFor="due-date">
            Due Date
          </label>
          <input
            id="due-date"
            type="datetime-local"
            className="add-entry__input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={saving}
          />
        </div>
      </div>

      <div className="add-entry__row">
        <div className="add-entry__group">
          <label className="add-entry__label" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            className="add-entry__input"
            value={priorityValue}
            onChange={(e) => setPriorityValue(e.target.value)}
            disabled={saving}
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="add-entry__group">
          <label className="add-entry__label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            className="add-entry__input"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
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

      {/* Notes Section */}
      <div className="add-entry__notes-section">
        <button
          type="button"
          className="add-entry__notes-toggle"
          onClick={() => setNotesOpen((v) => !v)}
          disabled={saving}
        >
          <span>Notes</span>
          <span className="add-entry__notes-count">{notes.length > 0 ? `(${notes.length})` : ''}</span>
          <span className={`add-entry__notes-arrow ${notesOpen ? 'add-entry__notes-arrow--open' : ''}`}>
            &#9662;
          </span>
        </button>

        {notesOpen && (
          <div className="add-entry__notes-body">
            {notes.map((note, idx) => (
              <div className="add-entry__note-row" key={idx}>
                <select
                  className="add-entry__note-type"
                  value={note.entry_type}
                  onChange={(e) => {
                    const updated = [...notes];
                    updated[idx] = { ...note, entry_type: e.target.value as NoteType, value: '' };
                    setNotes(updated);
                  }}
                  disabled={saving}
                >
                  <option value="text">Text</option>
                  <option value="link">Link</option>
                  <option value="image">Image</option>
                  <option value="pdf">PDF</option>
                </select>

                {(note.entry_type === 'text' || note.entry_type === 'link') ? (
                  <input
                    type={note.entry_type === 'link' ? 'url' : 'text'}
                    className="add-entry__note-input"
                    placeholder={note.entry_type === 'link' ? 'https://...' : 'Type a note...'}
                    value={typeof note.value === 'string' ? note.value : ''}
                    onChange={(e) => {
                      const updated = [...notes];
                      updated[idx] = { ...note, value: e.target.value };
                      setNotes(updated);
                    }}
                    disabled={saving}
                  />
                ) : (
                  <>
                    <input
                      ref={(el) => { fileInputRefs.current[idx] = el; }}
                      type="file"
                      className="add-entry__note-file"
                      accept={note.entry_type === 'image' ? 'image/*' : '.pdf'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const updated = [...notes];
                          updated[idx] = { ...note, value: file };
                          setNotes(updated);
                        }
                      }}
                      disabled={saving}
                    />
                    {note.value instanceof File && (
                      <span className="add-entry__note-filename">{note.value.name}</span>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="add-entry__note-remove"
                  onClick={() => setNotes(notes.filter((_, i) => i !== idx))}
                  disabled={saving}
                  title="Remove note"
                >
                  &times;
                </button>
              </div>
            ))}

            <button
              type="button"
              className="add-entry__note-add"
              onClick={() => {
                setNotes([...notes, { entry_type: 'text', value: '' }]);
                if (!notesOpen) setNotesOpen(true);
              }}
              disabled={saving}
            >
              + Add Note
            </button>
          </div>
        )}
      </div>

      <div className="add-entry__actions">
        {onCancel && (
          <button
            type="button"
            className="add-entry__btn add-entry__btn--cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="add-entry__btn add-entry__btn--submit"
          disabled={saving || loadingFields}
        >
          {saving ? 'Adding...' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
}

export default AddEntry;
