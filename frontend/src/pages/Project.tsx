import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  editProjectName,
  deleteProject,
  getProjectsByEmail,
} from "../functions/project/project.js";

type ProjectRecord = { project_name: string; [key: string]: unknown };

const TAB_COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TAB_COLORS[Math.abs(hash) % TAB_COLORS.length];
}

export function ProjectsPage() {
  const { user } = useAuth();
  const email = user?.email || "";
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProjects = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getProjectsByEmail(email);
      if (result?.error) throw new Error(result.error);
      const list: ProjectRecord[] = Array.isArray(result)
        ? result
        : Array.isArray(result?.projects)
          ? result.projects
          : [];
      setProjects(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your projects");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const startEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
    setEditError(null);
  };

  const handleRename = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || !email) return;
    if (trimmed === oldName) {
      setEditingName(null);
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const result = await editProjectName(email, trimmed, oldName);
      if (result?.error) throw new Error(result.error);
      setEditingName(null);
      await loadProjects();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not rename project");
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
      setError(err instanceof Error ? err.message : "Could not delete project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "1.75rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Your projects
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-dim, #6b7280)", fontSize: "0.9rem" }}>
            {projects.length === 0
              ? "Nothing logged yet — start your first project."
              : `${projects.length} project${projects.length === 1 ? "" : "s"} in progress`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
          className="btn-primary"
          style={{ whiteSpace: "nowrap" }}
        >
          + New project
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {creating && (
        <div
          className="glass"
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem 1.25rem",
            borderRadius: "0.85rem",
            marginBottom: "1.25rem",
            borderLeft: "6px solid #ec4899",
            color: "var(--text-dim, #6b7280)",
            fontSize: "0.875rem",
          }}
        >
          Project creation is not available yet. Check back soon.
          <button
            type="button"
            onClick={() => { setCreating(false); }}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="glass"
              style={{
                height: 64,
                borderRadius: "0.85rem",
                opacity: 0.5,
                animation: "pulse 1.4s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {!loading && projects.length === 0 && !creating && (
        <div
          className="glass"
          style={{
            textAlign: "center",
            padding: "3rem 1.5rem",
            borderRadius: "1rem",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📓</div>
          <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", fontWeight: 700 }}>
            No projects yet
          </h3>
          <p style={{ margin: "0 0 1.25rem", color: "var(--text-dim, #6b7280)", fontSize: "0.875rem" }}>
            Create a project to start logging entries against it.
          </p>
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            + New project
          </button>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {projects.map((p) => {
            const name = p.project_name;
            const color = colorForName(name);
            const isEditing = editingName === name;
            const isConfirming = confirmDelete === name;

            return (
              <div
                key={name}
                className="glass"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: "1rem 1.25rem",
                  borderRadius: "0.85rem",
                  borderLeft: `6px solid ${color}`,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />

                {isEditing ? (
                  <div style={{ flex: 1, display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(name);
                        if (e.key === "Escape") setEditingName(null);
                      }}
                      className="field-input"
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(name)}
                      disabled={saving}
                      className="btn-primary"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    {editError && (
                      <span style={{ color: "#dc2626", fontSize: "0.8rem" }}>{editError}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: "0.98rem" }}>{name}</span>

                    {isConfirming ? (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-dim, #6b7280)" }}>
                          Delete this project?
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDelete(name)}
                          disabled={deleting}
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: "0.5rem",
                            padding: "0.4rem 0.75rem",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          {deleting ? "Deleting..." : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={() => startEdit(name)}
                          aria-label={`Rename ${name}`}
                          title="Rename"
                          className="btn-secondary"
                          style={{ padding: "0.4rem 0.6rem" }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(name)}
                          aria-label={`Delete ${name}`}
                          title="Delete"
                          style={{
                            background: "transparent",
                            border: "1px solid rgba(220,38,38,0.35)",
                            color: "#dc2626",
                            borderRadius: "0.5rem",
                            padding: "0.4rem 0.6rem",
                            fontSize: "0.85rem",
                            cursor: "pointer",
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}