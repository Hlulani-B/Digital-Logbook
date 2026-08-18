import { useState } from "react";
import { editProjectName, deleteProject } from "@/functions/project/project.js";

interface ProjectSettingsPanelProps {
  open: boolean;
  projectName: string;
  userEmail: string;
  onClose: () => void;
  onProjectUpdated?: () => void;
  onProjectDeleted?: () => void;
}

export function ProjectSettingsPanel({
  open,
  projectName,
  userEmail,
  onClose,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"general" | "fields">("general");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(projectName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!open) return null;

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === projectName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await editProjectName(userEmail, trimmed, projectName);
      if (result?.error) throw new Error(result.error);
      setEditingName(false);
      onProjectUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteProject(userEmail, projectName);
      if (result?.error) throw new Error(result.error);
      onProjectDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card glass"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px", width: "100%" }}
      >
        <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 className="modal-title" style={{ margin: 0 }}>
            {projectName} Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-dim)",
              fontSize: "1.25rem",
              padding: "0.25rem",
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)" }}>
          <button
            className={`tab-btn ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
            style={{
              padding: "0.5rem 1rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "general" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "general" ? "var(--text)" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: activeTab === "general" ? 600 : 400,
            }}
          >
            General
          </button>
          <button
            className={`tab-btn ${activeTab === "fields" ? "active" : ""}`}
            onClick={() => setActiveTab("fields")}
            style={{
              padding: "0.5rem 1rem",
              background: "none",
              border: "none",
              borderBottom: activeTab === "fields" ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === "fields" ? "var(--text)" : "var(--text-dim)",
              cursor: "pointer",
              fontWeight: activeTab === "fields" ? 600 : 400,
            }}
          >
            Fields
          </button>
        </div>

        {activeTab === "general" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>
                Project Name
              </label>
              {editingName ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                    autoFocus
                  />
                  <button
                    onClick={handleRename}
                    disabled={saving}
                    className="btn-primary"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNewName(projectName);
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{ flex: 1, fontSize: "0.95rem" }}>{projectName}</span>
                  <button
                    onClick={() => setEditingName(true)}
                    className="btn-secondary"
                    style={{ padding: "0.4rem 0.75rem" }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--danger)" }}>
                Danger Zone
              </h3>
              {confirmDelete ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <p style={{ fontSize: "0.875rem", margin: 0 }}>
                    Are you sure? This will delete all entries in this project.
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      style={{
                        background: "var(--danger)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "var(--radius-xs)",
                        padding: "0.5rem 1rem",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {deleting ? "Deleting..." : "Yes, delete project"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--danger)",
                    color: "var(--danger)",
                    borderRadius: "var(--radius-xs)",
                    padding: "0.5rem 1rem",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Delete Project
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "fields" && (
          <div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-dim)", margin: 0 }}>
              Field management coming soon. You'll be able to add, edit, and remove custom fields for this project.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectSettingsPanel;
