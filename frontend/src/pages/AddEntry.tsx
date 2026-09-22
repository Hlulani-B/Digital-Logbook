import React, { useState, useEffect, useRef } from 'react';
import { addEntry } from '../functions/project/entries.js';
import { getFields } from '../functions/project/fields.js';
import { evaluateVisibility } from '@/lib/fieldVisibility';
import { resolveFieldPermission } from '@/hooks/useFieldPermissions';
import { FieldEditor } from '@/components/fields/FieldEditors';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { normalizeField } from '@/lib/fieldSchema';

type NoteType = 'text' | 'link' | 'image';

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

interface AddEntryProps {
  user_email: string;
  project_name: string;
  projectId?: number;
  onAdded?: (result: unknown) => void;
  onCancel?: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImageClient(file: File, maxSize = 1600, quality = 0.7): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height / width) * maxSize);
      width = maxSize;
    } else {
      width = Math.round((width / height) * maxSize);
      height = maxSize;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
  );
  return new File([blob], file.name, { type: 'image/jpeg' });
}

export function AddEntry({
  user_email,
  project_name,
  projectId,
  onAdded,
  onCancel,
}: AddEntryProps) {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>({});
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
          const defs: FieldDefinition[] = (result?.data || []).map((f: any) => normalizeField(f));
          setFields(defs);
          const initial: Record<string, unknown> = {};
          for (const f of defs) {
            if (f.data_type === 'boolean') {
              initial[f.field_name] = false;
            } else if (f.data_type === 'tags' || f.data_type === 'checklist') {
              initial[f.field_name] = [];
            } else if (f.data_type === 'geolocation') {
              initial[f.field_name] = { latitude: 0, longitude: 0 };
            } else if (f.data_type === 'currency') {
              initial[f.field_name] = { amount: '', currency: 'USD' };
            } else {
              initial[f.field_name] = '';
            }
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

  const handleValueChange = (fieldName: string, value: unknown) => {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user_email || !project_name || saving || loadingFields) return;

    // Validate required fields (skip hidden fields)
    for (const f of fields) {
      if (!f.is_required) continue;
      if (f.visibility && !evaluateVisibility(f, fieldValues)) continue;
      const val = fieldValues[f.field_name];
      if (f.data_type === 'boolean') {
        // boolean is always valid (true or false)
      } else if (f.data_type === 'tags' || f.data_type === 'checklist') {
        if (!Array.isArray(val) || val.length === 0) {
          setError(`"${f.field_name}" is required`);
          return;
        }
      } else if (val === null || val === undefined || val === '') {
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
        if (val !== undefined && val !== null && val !== '') {
          // Convert File objects to base64 for file/image fields during creation
          if (val instanceof File) {
            if (f.data_type === 'image') {
              const compressed = await compressImageClient(val);
              entryObject[f.field_name] = await fileToBase64(compressed);
            } else {
              entryObject[f.field_name] = await fileToBase64(val);
            }
          } else {
            entryObject[f.field_name] = val;
          }
        }
      }
      // Convert priority index to label (null = no priority)
      const priorityLabel = priorityValue === '3' ? null : PRIORITY_LABELS[priorityValue];

      // Build notes array — read files as base64
      const notesPayload: { entry_type: string; value: string }[] = [];
      for (const note of notes) {
        if (note.entry_type === 'image') {
          if (note.value instanceof File) {
            const compressed = await compressImageClient(note.value);
            const base64 = await fileToBase64(compressed);
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
        null, // started_at - set automatically when status becomes in_motion
        null, // ended_at - set via End Task button
        null, // duration - calculated in Supabase
        null, // summary - AI-generated in the background on the server
        notesPayload.length > 0 ? notesPayload : undefined
      );

      if (result?.success === false) {
        throw new Error((result as any).message || 'Failed to add item');
      }

      onAdded?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="add-entry entry-form" onSubmit={handleSubmit} aria-label="New Item">
      <div className="entry-form__body">
        <div className="add-entry__header">
          <h2 className="add-entry__title">New Item</h2>
          <span className="add-entry__project">{project_name}</span>
        </div>

        {loadingFields ? (
          <div className="add-entry__loading">Loading columns...</div>
        ) : (
          <>
            {error && <div className="add-entry__error">{error}</div>}

            {fields.length > 0 && (
              <div className="add-entry__fields">
                <span className="add-entry__section-label">Columns</span>
                {fields
                  .filter((field) => {
                    if (field.visibility) {
                      return evaluateVisibility(field, fieldValues);
                    }
                    const userRole = 'owner'; // TODO: Fetch actual user role
                    const permission = resolveFieldPermission(field, userRole);
                    return permission !== 'hidden';
                  })
                  .map((field) => {
                    const userRole = 'owner'; // TODO: Fetch actual user role
                    const permission = resolveFieldPermission(field, userRole);
                    const isReadOnly = permission === 'view';

                    return (
                      <div className="add-entry__field-row" key={field.field_name}>
                        <FieldEditor
                          field={field}
                          value={fieldValues[field.field_name]}
                          onChange={(newValue) => handleValueChange(field.field_name, newValue)}
                          disabled={saving || isReadOnly}
                          projectId={projectId}
                          entryId={undefined}
                        />
                      </div>
                    );
                  })}
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
                <span className="add-entry__notes-count">
                  {notes.length > 0 ? `(${notes.length})` : ''}
                </span>
                <span
                  className={`add-entry__notes-arrow ${notesOpen ? 'add-entry__notes-arrow--open' : ''}`}
                >
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
                          updated[idx] = {
                            ...note,
                            entry_type: e.target.value as NoteType,
                            value: '',
                          };
                          setNotes(updated);
                        }}
                        disabled={saving}
                      >
                        <option value="text">Text</option>
                        <option value="link">Link</option>
                        <option value="image">Image</option>
                      </select>

                      {note.entry_type === 'text' || note.entry_type === 'link' ? (
                        <input
                          type={note.entry_type === 'link' ? 'url' : 'text'}
                          className="add-entry__note-input"
                          placeholder={
                            note.entry_type === 'link' ? 'https://...' : 'Type a note...'
                          }
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
                            ref={(el) => {
                              fileInputRefs.current[idx] = el;
                            }}
                            type="file"
                            className="add-entry__note-file"
                            accept="image/*"
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
          </>
        )}
      </div>

      <div className="add-entry__actions entry-form__footer">
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
          {saving ? 'Adding...' : 'Add Item'}
        </button>
      </div>
    </form>
  );
}

export default AddEntry;
