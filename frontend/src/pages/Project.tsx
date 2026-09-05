import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/AppShell';
import {
  editProjectName,
  deleteProject,
  getProjectsByEmail,
  addProject,
} from '../functions/project/project.js';
import { getArchivedProjects, archiveProject, unarchiveProject } from '../functions/project/archives.js';
import { FiArchive, FiEdit2, FiTrash2, FiX, FiBookOpen, FiPlus } from 'react-icons/fi';
import ProjectTaskTable from '@/Templates/ProjectTemplates/ProjectTable';
import { getAllEntries, getEntries, updateEntry, deleteEntryById } from '@/functions/project/entries';
import '@/Templates/ProjectTemplates/ProjectTable.css';

type ProjectRecord = {
  project_name: string;
  archived?: boolean;
  created_at?: string;
  [key: string]: unknown;
};
type EntryRecord = Record<string, unknown>;

const TAB_COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TAB_COLORS[Math.abs(hash) % TAB_COLORS.length];
}

export function ProjectsPage() {
  const { user } = useAuth();
  const email = user?.email || '';
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Archive state
  const [archivedProjects, setArchivedProjects] = useState<ProjectRecord[]>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  // Archived project detail view
  const [viewingArchived, setViewingArchived] = useState<string | null>(null);
  const [archivedEntries, setArchivedEntries] = useState<EntryRecord[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // View mode for table — persist in localStorage
  const [viewMode, setViewModeState] = useState<'entry' | 'summary'>(() => {
    const stored = localStorage.getItem('project-table-view-mode');
    if (stored === 'entry' || stored === 'summary') return stored;
    return 'entry';
  });
  const setViewMode = (mode: 'entry' | 'summary') => {
    setViewModeState(mode);
    localStorage.setItem('project-table-view-mode', mode);
  };

  const loadProjects = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getProjectsByEmail(email);
      if (result?.error) throw new Error(result.error);
      const list = (
        Array.isArray(result) ? result : Array.isArray(result?.projects) ? result.projects : []
      ).filter((p: ProjectRecord) => !p.archived);
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your projects');
    } finally {
      setLoading(false);
    }
  }, [email]);

  // Load all entries for the table
  const loadEntries = useCallback(async () => {
    if (!email) return;
    try {
      console.log('[ProjectsPage] loading entries for', email);
      const result = await getAllEntries(email);
      console.log('[ProjectsPage] entries result:', result?.success, 'data length:', result?.data?.length ?? 'N/A');
      if (result?.success && result.data) {
        setEntries(result.data);
      } else if (Array.isArray(result)) {
        setEntries(result);
      } else {
        console.warn('[ProjectsPage] unexpected entries result:', result);
        setEntries([]);
      }
    } catch (err) {
      console.error('[ProjectsPage] Failed to load entries:', err);
      setEntries([]);
    }
  }, [email]);

  const loadArchivedProjects = useCallback(async () => {
    if (!email) return;
    try {
      const result = await getArchivedProjects(email);
      if (result?.success && result.data) {
        setArchivedProjects(result.data);
      } else {
        setArchivedProjects([]);
      }
    } catch (err) {
      console.error('Failed to load archived projects:', err);
      setArchivedProjects([]);
    }
  }, [email]);

  useEffect(() => {
    loadProjects();
    loadArchivedProjects();
    loadEntries();
  }, [loadProjects, loadArchivedProjects, loadEntries]);

  // Handle entry updates from the table
  const handleEntryUpdate = useCallback(
    async (id: string, patch: Record<string, any>) => {
      setEntries((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      const row = entries.find((r) => r.id === id);
      if (!row) return;
      try {
        await updateEntry(
          email,
          row.project_name,
          id,
          patch.entries ?? row.entries,
          patch.due_date !== undefined ? patch.due_date : row.due_date,
          patch.priority !== undefined ? patch.priority : row.priority,
          patch.status !== undefined ? patch.status : row.status,
          row.started_at,
          row.ended_at,
          row.duration,
        );
        // Reload entries after successful update
        await loadEntries();
      } catch (err) {
        console.error('Update failed:', err);
        setEntries((prev) => prev.map((r) => (r.id === id ? row : r)));
      }
    },
    [entries, email, loadEntries],
  );

  const handleCreateProject = async () => {
    const trimmed = newProjectName.trim();
    if (!trimmed || !email) return;
    setSaving(true);
    try {
      const result = await addProject(email, trimmed, '');
      if (result?.error) throw new Error(result.error);
      setNewProjectName('');
      setCreating(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
    setEditError(null);
  };

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || !email) return;
    if (trimmed === oldName) { setEditingName(null); return; }
    setSaving(true);
    setEditError(null);
    try {
      const result = await editProjectName(email, trimmed, oldName);
      if (result?.error) throw new Error(result.error);
      setEditingName(null);
      await loadProjects();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not rename project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!email) return;
    setDeleting(true);
    try {
      const result = await deleteProject(email, name);
      if (result?.error) throw new Error(result.error);
      setConfirmDelete(null);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async (name: string) => {
    if (!email) return;
    setArchiving(true);
    try {
      const result = await archiveProject(email, name);
      if (result?.error) throw new Error(result.error);
      setConfirmArchive(null);
      await Promise.all([loadProjects(), loadArchivedProjects()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive project');
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async (name: string) => {
    if (!email) return;
    try {
      const result = await unarchiveProject(email, name);
      if (result?.error) throw new Error(result.error);
      setViewingArchived(null);
      setArchivedEntries([]);
      await Promise.all([loadProjects(), loadArchivedProjects()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unarchive project');
    }
  };

  const handleViewArchivedEntries = async (name: string) => {
    if (!email) return;
    setViewingArchived(name);
    setLoadingEntries(true);
    try {
      const result = await getEntries(email, name);
      if (result?.success && result.data) {
        setArchivedEntries(result.data);
      } else if (Array.isArray(result)) {
        setArchivedEntries(result);
      } else {
        setArchivedEntries([]);
      }
    } catch {
      setArchivedEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  return (
    <AppShell title="Projects">
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Your projects
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim, #6b7280)', fontSize: '0.9rem' }}>
            {projects.length === 0
              ? 'Nothing logged yet — start your first project.'
              : `${projects.length} project${projects.length === 1 ? '' : 's'} in progress`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1.5px solid var(--accent, #c49a2a)' }}>
            <button onClick={() => setViewMode('entry')} style={{ padding: '0.35rem 0.9rem', border: 'none', background: viewMode === 'entry' ? 'var(--accent, #c49a2a)' : 'var(--bg-subtle, #fdfaf3)', color: viewMode === 'entry' ? '#fff' : 'var(--text, #3b3226)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Entry</button>
            <button onClick={() => setViewMode('summary')} style={{ padding: '0.35rem 0.9rem', border: 'none', borderLeft: '1.5px solid var(--accent, #c49a2a)', background: viewMode === 'summary' ? 'var(--accent, #c49a2a)' : 'var(--bg-subtle, #fdfaf3)', color: viewMode === 'summary' ? '#fff' : 'var(--text, #3b3226)', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Summary</button>
          </div>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary" style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <FiPlus size={14} /> New project
          </button>
        </div>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Create project inline */}
      {creating && (
        <div className="glass" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '1rem 1.25rem', borderRadius: '0.85rem', marginBottom: '1.25rem', borderLeft: '6px solid #ec4899' }}>
          <input autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); if (e.key === 'Escape') { setCreating(false); setNewProjectName(''); } }} className="field-input" style={{ flex: 1 }} placeholder="Project name" />
          <button type="button" onClick={handleCreateProject} disabled={saving || !newProjectName.trim()} className="btn-primary">{saving ? 'Creating...' : 'Create'}</button>
          <button type="button" onClick={() => { setCreating(false); setNewProjectName(''); }} className="btn-secondary">Cancel</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass" style={{ height: 64, borderRadius: '0.85rem', opacity: 0.5, animation: 'pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && !creating && (
        <div className="glass" style={{ textAlign: 'center', padding: '3rem 1.5rem', borderRadius: '1rem' }}>
          <FiBookOpen size={40} style={{ opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: 700 }}>No projects yet</h3>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--text-dim, #6b7280)', fontSize: '0.875rem' }}>Create a project to start logging entries against it.</p>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">+ New project</button>
        </div>
      )}

      {/* Project table — all entries grouped by project */}
      {!loading && entries.length > 0 && (
        <ProjectTaskTable
          rows={entries}
          viewMode={viewMode}
          onUpdate={handleEntryUpdate}
          onProjectNameClick={(name) => navigate(`/project/${encodeURIComponent(name)}`)}
          onDeleteSelected={async (ids: string[]) => {
            if (!email) return;
            setEntries((prev) => prev.filter((r) => !ids.includes(r.id)));
            for (const id of ids) {
              try {
                await deleteEntryById(email, id);
              } catch (err) {
                console.error('[onDeleteSelected] Failed to delete', id, err);
              }
            }
          }}
        />
      )}

      {!loading && entries.length === 0 && projects.length > 0 && (
        <div className="glass" style={{ textAlign: 'center', padding: '2rem 1.5rem', borderRadius: '0.85rem', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-dim, #6b7280)', fontSize: '0.9rem' }}>
            No entries yet. Start logging entries to see them in the table above.
          </p>
        </div>
      )}

      {/* Project management cards (rename/archive/delete) */}
      {!loading && projects.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text, #3b3226)' }}>Manage projects</h2>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {projects.map((p) => {
              const name = p.project_name;
              const color = colorForName(name);
              const isEditing = editingName === name;
              const isConfirming = confirmDelete === name;
              const isConfirmingArchive = confirmArchive === name;

              return (
                <div key={name} className="glass" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderRadius: '0.75rem', borderLeft: `5px solid ${color}` }}>
                  <div aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />

                  {isEditing ? (
                    <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input autoFocus type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleRename(name); if (e.key === 'Escape') setEditingName(null); }} className="field-input" style={{ flex: 1 }} />
                      <button type="button" onClick={() => handleRename(name)} disabled={saving} className="btn-primary">Save</button>
                      <button type="button" onClick={() => setEditingName(null)} className="btn-secondary">Cancel</button>
                      {editError && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{editError}</span>}
                    </div>
                  ) : (
                    <>
                      <span
                        style={{ flex: 1, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', color: 'var(--accent, #c49a2a)' }}
                        onClick={() => navigate(`/project/${encodeURIComponent(name)}`)}
                        title={`Open ${name}`}
                      >
                        {name}
                      </span>

                      {isConfirming ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim, #6b7280)' }}>Delete?</span>
                          <button type="button" onClick={() => handleDelete(name)} disabled={deleting} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer' }}>{deleting ? 'Deleting...' : 'Yes, delete'}</button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
                        </div>
                      ) : isConfirmingArchive ? (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim, #6b7280)' }}>Archive?</span>
                          <button type="button" onClick={() => handleArchive(name)} disabled={archiving} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.35rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer' }}>{archiving ? 'Archiving...' : 'Yes, archive'}</button>
                          <button type="button" onClick={() => setConfirmArchive(null)} className="btn-secondary">Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button type="button" onClick={() => startEdit(name)} aria-label={`Rename ${name}`} title="Rename" className="btn-secondary" style={{ padding: '0.35rem 0.5rem' }}><FiEdit2 size={14} /></button>
                          <button type="button" onClick={() => setConfirmArchive(name)} aria-label={`Archive ${name}`} title="Archive" style={{ background: 'transparent', border: '1px solid rgba(99,102,241,0.35)', color: '#6366f1', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}><FiArchive size={14} /></button>
                          <button type="button" onClick={() => setConfirmDelete(name)} aria-label={`Delete ${name}`} title="Delete" style={{ background: 'transparent', border: '1px solid rgba(220,38,38,0.35)', color: '#dc2626', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}><FiTrash2 size={14} /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Archive button */}
      {archivedProjects.length > 0 && (
        <button type="button" onClick={() => setShowArchive(true)} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 100, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiArchive size={16} /> Archive
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '0.5rem', padding: '0.1rem 0.4rem', fontSize: '0.75rem' }}>{archivedProjects.length}</span>
        </button>
      )}

      {/* Archived Projects overlay */}
      {showArchive && (
        <div onClick={() => { setShowArchive(false); setViewingArchived(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="glass" style={{ width: '100%', maxWidth: 640, maxHeight: '80vh', overflowY: 'auto', borderRadius: '1rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}><FiArchive size={18} /> Archived Projects</h2>
              <button type="button" onClick={() => { setShowArchive(false); setViewingArchived(null); }} className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }}><FiX size={16} /></button>
            </div>

            {archivedProjects.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-dim, #6b7280)', padding: '2rem 0' }}>No archived projects.</p>
            ) : !viewingArchived ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {archivedProjects.map((p) => {
                  const name = p.project_name;
                  const color = colorForName(name);
                  return (
                    <div key={name} className="glass" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', borderRadius: '0.85rem', borderLeft: `6px solid ${color}` }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: '0.98rem' }}>{name}</span>
                      <button type="button" onClick={() => handleViewArchivedEntries(name)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>View entries</button>
                      <button type="button" onClick={() => handleUnarchive(name)} style={{ background: 'transparent', border: '1px solid rgba(99,102,241,0.4)', color: '#6366f1', borderRadius: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.85rem', cursor: 'pointer' }} title="Unarchive">↩ Unarchive</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <button type="button" onClick={() => { setViewingArchived(null); setArchivedEntries([]); }} className="btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>← Back</button>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{viewingArchived}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim, #6b7280)' }}>(read-only)</span>
                </div>
                {loadingEntries ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim, #6b7280)', padding: '1.5rem' }}>Loading entries...</p>
                ) : archivedEntries.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-dim, #6b7280)', padding: '2rem 0' }}>No entries in this project.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {archivedEntries.map((entry, i) => (
                      <div key={String(entry.id || i)} className="glass" style={{ padding: '0.75rem 1rem', borderRadius: '0.65rem' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>{String(entry.entries || 'Untitled entry')}</p>
                        {!!entry.due_date && <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim, #6b7280)' }}>Due: {new Date(entry.due_date as string).toLocaleDateString()}</p>}
                        {entry.priority != null && <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-dim, #6b7280)' }}>Priority: {String(entry.priority)}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button type="button" onClick={() => handleUnarchive(viewingArchived)} style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>↩ Unarchive this project</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
