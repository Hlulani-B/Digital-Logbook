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
  const [editName, setEditName] = useState(projectName);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!open) return null;

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === projectName) return;
    setSaving(true);
    setError(null);
    try {
      await editProjectName(userEmail, editName.trim(), projectName);
      onProjectUpdated?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project name");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(userEmail, projectName);
      onProjectDeleted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel glass" onClick={(e) => e.stopPropagation()}>
        <div className="settings-panel-header">
          <h2 className="settings-panel-title">Project Settings</h2>
          <button className="settings-panel-close" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-panel-body">
          {error && <div className="auth-error" style={{ marginBottom: "1rem" }}>{error}</div>}

          {/* Edit Project Name */}
          <div className="settings-section">
            <h3 className="settings-section-title">Project Name</h3>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="field-input"
              placeholder="Enter new project name"
              disabled={saving}
            />
            <button
              className="btn-primary"
              onClick={handleSaveName}
              disabled={saving || !editName.trim() || editName.trim() === projectName}
              style={{ marginTop: "0.5rem" }}
            >
              {saving ? "Saving..." : "Save Name"}
            </button>
          </div>

          {/* Delete Project */}
          <div className="settings-section" style={{ marginTop: "2rem" }}>
            <h3 className="settings-section-title" style={{ color: "var(--danger)" }}>Danger Zone</h3>
            {!confirmDelete ? (
              <button
                className="btn-secondary"
                onClick={() => setConfirmDelete(true)}
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
              >
                Delete Project
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: "0.875rem", color: "var(--danger)" }}>
                  Are you sure? This will delete all entries in this project. This action cannot be undone.
                </p>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleDeleteProject}
                    disabled={deleting}
                    style={{ background: "var(--danger)" }}
                  >
                    {deleting ? "Deleting..." : "Yes, Delete Project"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectSettingsPanel;
