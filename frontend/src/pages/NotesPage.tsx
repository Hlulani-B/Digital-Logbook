import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getNotes, addNote, viewNote, updateNote, deleteNote } from '@/functions/project/notes.js';
import { getEntryTitle } from '@/lib/calendar';

type NoteType = 'text' | 'link' | 'image' | 'pdf';

interface Note {
  id: string;
  email: string;
  entry_id: string;
  entry_type: NoteType;
  value: string;
  created_at: string;
  deleted?: boolean;
}

interface NoteDraft {
  entry_type: NoteType;
  value: string | File;
}

interface ViewedNote {
  value: string;
  content_type?: string;
  file_data?: string;
}

interface EntryData {
  id: string;
  summary?: string | null;
  entries?: Record<string, unknown> | string | null;
  project_name?: string;
  status?: string;
  priority?: string | null;
  due_date?: string | null;
}

function formatNoteDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const TYPE_CONFIG: Record<NoteType, { label: string; icon: string; color: string }> = {
  text: { label: 'Text', icon: 'T', color: '#6b7280' },
  link: { label: 'Link', icon: '\u{1F517}', color: '#3b82f6' },
  image: { label: 'Image', icon: '\u{1F5BC}', color: '#8b5cf6' },
  pdf: { label: 'PDF', icon: '\u{1F4C4}', color: '#ef4444' },
};

export function NotesPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userEmail = user?.email || '';

  // Entry data from location state or minimal fallback
  const entryData = (location.state as EntryData) || null;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add note form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNote, setNewNote] = useState<NoteDraft>({ entry_type: 'text', value: '' });
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Viewed file notes
  const [viewedFiles, setViewedFiles] = useState<Record<string, ViewedNote>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});

  // Check if we should auto-open add form
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('add') === 'true') {
      setShowAddForm(true);
    }
  }, [location.search]);

  // Load notes
  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await getNotes(entryId);
        if (!cancelled) {
          if (result?.success && Array.isArray(result.data)) {
            setNotes(result.data);
          } else {
            setNotes([]);
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load notes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [entryId]);

  // Load file data for image/pdf notes
  useEffect(() => {
    for (const note of notes) {
      if ((note.entry_type === 'image' || note.entry_type === 'pdf') && !viewedFiles[note.id] && !loadingFiles[note.id]) {
        setLoadingFiles((prev) => ({ ...prev, [note.id]: true }));
        viewNote(note.id).then((result) => {
          if (result?.success && result.data) {
            setViewedFiles((prev) => ({ ...prev, [note.id]: result.data }));
          }
          setLoadingFiles((prev) => ({ ...prev, [note.id]: false }));
        }).catch(() => {
          setLoadingFiles((prev) => ({ ...prev, [note.id]: false }));
        });
      }
    }
  }, [notes, viewedFiles, loadingFiles]);

  const handleAddNote = async () => {
    if (!entryId || !userEmail || adding) return;

    let valueToSend: string;
    if (newNote.entry_type === 'image' || newNote.entry_type === 'pdf') {
      if (!(newNote.value instanceof File)) return;
      valueToSend = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(newNote.value as File);
      });
    } else {
      if (typeof newNote.value !== 'string' || !newNote.value.trim()) return;
      valueToSend = newNote.value.trim();
    }

    setAdding(true);
    setError(null);
    try {
      const result = await addNote(userEmail, entryId, newNote.entry_type, valueToSend);
      if (result?.success) {
        const refreshed = await getNotes(entryId);
        if (refreshed?.success && Array.isArray(refreshed.data)) {
          setNotes(refreshed.data);
        }
        setNewNote({ entry_type: 'text', value: '' });
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowAddForm(false);
      } else {
        setError(result?.message || 'Failed to add note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note');
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditValue(note.value);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editValue.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateNote(editingNoteId, editValue.trim());
      if (result?.success) {
        setNotes((prev) =>
          prev.map((n) => n.id === editingNoteId ? { ...n, value: editValue.trim() } : n)
        );
        setEditingNoteId(null);
        setEditValue('');
      } else {
        setError(result?.message || 'Failed to update note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!entryId) return;
    setError(null);
    try {
      const result = await deleteNote(noteId, entryId);
      if (result?.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId && n.id?.toString() !== noteId?.toString()));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  // Derive entry title
  const entryTitle = entryData
    ? getEntryTitle(entryData as Parameters<typeof getEntryTitle>[0])
    : 'Entry Notes';

  return (
    <div className="notes-panel-overlay" onClick={() => navigate(-1)}>
      <div className="notes-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="notes-panel__header">
          <button
            type="button"
            className="notes-panel__close"
            onClick={() => navigate(-1)}
            aria-label="Close"
          >
            &times;
          </button>
          <div className="notes-panel__entry-info">
            <h2 className="notes-panel__title">{entryTitle}</h2>
            {entryData?.project_name && (
              <span className="notes-panel__project">{entryData.project_name}</span>
            )}
          </div>
          <button
            type="button"
            className="notes-panel__add-toggle"
            onClick={() => setShowAddForm((v) => !v)}
            title="Add note"
          >
            {showAddForm ? '\u2715' : '+'}
          </button>
        </div>

        {/* Add Note Form */}
        {showAddForm && (
          <div className="notes-panel__add-form">
            <div className="notes-panel__add-row">
              <div className="notes-panel__type-pills">
                {(Object.keys(TYPE_CONFIG) as NoteType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`notes-panel__type-pill ${newNote.entry_type === type ? 'notes-panel__type-pill--active' : ''}`}
                    onClick={() => setNewNote({ ...newNote, entry_type: type, value: '' })}
                    disabled={adding}
                  >
                    <span className="notes-panel__type-pill-icon">{TYPE_CONFIG[type].icon}</span>
                    {TYPE_CONFIG[type].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="notes-panel__add-input-row">
              {(newNote.entry_type === 'text' || newNote.entry_type === 'link') ? (
                <input
                  type={newNote.entry_type === 'link' ? 'url' : 'text'}
                  className="notes-panel__add-input"
                  placeholder={newNote.entry_type === 'link' ? 'Paste a link...' : 'Type a note...'}
                  value={typeof newNote.value === 'string' ? newNote.value : ''}
                  onChange={(e) => setNewNote({ ...newNote, value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddNote(); }}
                  disabled={adding}
                  autoFocus
                />
              ) : (
                <div className="notes-panel__file-drop">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="notes-panel__add-file"
                    accept={newNote.entry_type === 'image' ? 'image/*' : '.pdf'}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setNewNote({ ...newNote, value: file });
                    }}
                    disabled={adding}
                  />
                  {newNote.value instanceof File ? (
                    <span className="notes-panel__file-name">{newNote.value.name}</span>
                  ) : (
                    <span className="notes-panel__file-placeholder">
                      {newNote.entry_type === 'image' ? 'Choose an image...' : 'Choose a PDF...'}
                    </span>
                  )}
                </div>
              )}

              <button
                type="button"
                className="notes-panel__submit-btn"
                onClick={handleAddNote}
                disabled={adding}
              >
                {adding ? '...' : 'Add'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="notes-panel__error">{error}</div>}

        {/* Notes List */}
        <div className="notes-panel__body">
          {loading && (
            <div className="notes-panel__loading">
              <div className="notes-panel__spinner" />
              <span>Loading notes...</span>
            </div>
          )}

          {!loading && notes.length === 0 && !showAddForm && (
            <div className="notes-panel__empty">
              <div className="notes-panel__empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <p className="notes-panel__empty-text">No notes yet</p>
              <button
                type="button"
                className="notes-panel__empty-add"
                onClick={() => setShowAddForm(true)}
              >
                + Add your first note
              </button>
            </div>
          )}

          <div className="notes-panel__grid">
            {notes.map((note) => {
              const config = TYPE_CONFIG[note.entry_type] || TYPE_CONFIG.text;
              return (
                <div className={`notes-panel__note notes-panel__note--${note.entry_type}`} key={note.id}>
                  {/* Note header */}
                  <div className="notes-panel__note-top">
                    <span
                      className="notes-panel__note-badge"
                      style={{ background: `${config.color}18`, color: config.color }}
                    >
                      <span className="notes-panel__note-badge-icon">{config.icon}</span>
                      {config.label}
                    </span>
                    <span className="notes-panel__note-time">{formatNoteDate(note.created_at)}</span>
                  </div>

                  {/* Note body */}
                  <div className="notes-panel__note-content">
                    {editingNoteId === note.id ? (
                      <div className="notes-panel__edit">
                        <textarea
                          className="notes-panel__edit-textarea"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={3}
                          disabled={saving}
                          autoFocus
                        />
                        <div className="notes-panel__edit-actions">
                          <button
                            type="button"
                            className="notes-panel__edit-cancel"
                            onClick={() => setEditingNoteId(null)}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="notes-panel__edit-save"
                            onClick={handleSaveEdit}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ) : note.entry_type === 'text' ? (
                      <p className="notes-panel__note-text">{note.value}</p>
                    ) : note.entry_type === 'link' ? (
                      <a
                        className="notes-panel__note-link"
                        href={note.value}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {note.value}
                      </a>
                    ) : note.entry_type === 'image' ? (
                      <div className="notes-panel__note-image">
                        {loadingFiles[note.id] ? (
                          <span className="notes-panel__note-loading">Loading...</span>
                        ) : viewedFiles[note.id]?.file_data ? (
                          <img
                            src={`data:${viewedFiles[note.id].content_type || 'image/jpeg'};base64,${viewedFiles[note.id].file_data}`}
                            alt="Note"
                            className="notes-panel__note-img"
                          />
                        ) : (
                          <span className="notes-panel__note-fallback">Image unavailable</span>
                        )}
                      </div>
                    ) : note.entry_type === 'pdf' ? (
                      <div className="notes-panel__note-pdf">
                        {loadingFiles[note.id] ? (
                          <span className="notes-panel__note-loading">Loading...</span>
                        ) : viewedFiles[note.id]?.file_data ? (
                          <a
                            className="notes-panel__note-download"
                            href={`data:${viewedFiles[note.id].content_type || 'application/pdf'};base64,${viewedFiles[note.id].file_data}`}
                            download="note.pdf"
                          >
                            Download PDF
                          </a>
                        ) : (
                          <span className="notes-panel__note-fallback">PDF unavailable</span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Note actions */}
                  <div className="notes-panel__note-footer">
                    {note.entry_type === 'text' && (
                      <button
                        type="button"
                        className="notes-panel__note-action"
                        onClick={() => handleStartEdit(note)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="notes-panel__note-action notes-panel__note-action--danger"
                      onClick={() => handleDelete(note.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotesPage;
