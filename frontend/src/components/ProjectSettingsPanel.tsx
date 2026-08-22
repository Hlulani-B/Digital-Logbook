import { useState, useEffect, useCallback } from "react";
import { editProjectName, deleteProject } from "@/functions/project/project.js";
import { getFields, addField, editField } from "@/functions/project/fields.js";
import { FiEdit2 } from "react-icons/fi";

interface ProjectSettingsPanelProps {
  open: boolean;
  projectName: string;
  userEmail: string;
  onClose: () => void;
  onProjectUpdated?: () => void;
  onProjectDeleted?: () => void;
}

type FieldRecord = {
  field_name: string;
  data_type: string;
  is_required: boolean;
};

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

  // Fields management
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date" | "boolean">("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Editing fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldName, setEditFieldName] = useState("");
  const [editFieldType, setEditFieldType] = useState("");
  const [editFieldRequired, setEditFieldRequired] = useState(false);

  // Reset state when panel opens or projectName changes
  useEffect(() => {
    if (open) {
      setEditName(projectName);
      setConfirmDelete(false);
      setError(null);
      setFieldError(null);
    }
  }, [open, projectName]);

  // Load fields when panel opens
  useEffect(() => {
    if (!open || !userEmail || !projectName) return;
    let cancelled = false;
    (async () => {
      setLoadingFields(true);
      try {
        const result = await getFields(userEmail, projectName);
        if (!cancelled) {
          setFields(Array.isArray(result?.data) ? result.data : []);
        }
      } catch {
        if (!cancelled) setFields([]);
      } finally {
        if (!cancelled) setLoadingFields(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, userEmail, projectName]);

  // Close on escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

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

  const handleAddField = async () => {
    const name = newFieldName.trim();
    if (!name) return;
    setFieldError(null);
    try {
      await addField(userEmail, projectName, name, newFieldType, newFieldRequired);
      setNewFieldName("");
      setNewFieldType("text");
      setNewFieldRequired(false);
      const result = await getFields(userEmail, projectName);
      setFields(Array.isArray(result?.data) ? result.data : []);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Failed to add field");
    }
  };

  const startEditField = (f: FieldRecord) => {
    setEditingField(f.field_name);
    setEditFieldName(f.field_name);
    setEditFieldType(f.data_type);
    setEditFieldRequired(f.is_required);
  };

  const handleSaveField = async () => {
    const name = editFieldName.trim();
    if (!name) return;
    setFieldError(null);
    try {
      await editField(userEmail, projectName, name, editFieldType as any, editFieldRequired);
      setEditingField(null);
      const result = await getFields(userEmail, projectName);
      setFields(Array.isArray(result?.data) ? result.data : []);
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Failed to update field");
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="panel-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="panel-sheet">
        {/* Header */}
        <div className="panel-header">
          <h2>Project Settings</h2>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="panel-body">
          {/* Error banner */}
          {error && (
            <div className="field-hint" style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius-xs)",
              background: "var(--danger-glow)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--danger-text, #b91c1c)",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
            }}>
              {error}
            </div>
          )}

          {/* ── Project Name ── */}
          <div className="panel-section">
            <p className="panel-section-title">Project Name</p>
            <div className="field-group">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="field-input"
                placeholder="Enter new project name"
                disabled={saving}
              />
            </div>
            <button
              className="btn-primary"
              onClick={handleSaveName}
              disabled={saving || !editName.trim() || editName.trim() === projectName}
            >
              {saving ? "Saving..." : "Save Name"}
            </button>
          </div>

          <hr className="divider" />

          {/* ── Fields ── */}
          <div className="panel-section">
            <p className="panel-section-title">Fields</p>

            {fieldError && (
              <div className="field-hint" style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-xs)",
                background: "var(--danger-glow)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "var(--danger-text, #b91c1c)",
                fontSize: "0.8125rem",
                marginBottom: "0.75rem",
              }}>
                {fieldError}
              </div>
            )}

            {loadingFields ? (
              <p className="field-hint">Loading fields...</p>
            ) : (
              <>
                {fields.length === 0 && (
                  <p className="field-hint" style={{ marginBottom: "1rem" }}>
                    No fields defined for this project.
                  </p>
                )}

                {/* Existing fields list */}
                <div className="project-fields-list" style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  {fields.map((f) => (
                    <div
                      key={f.field_name}
                      className="glass"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.625rem 0.75rem",
                      }}
                    >
                      {editingField === f.field_name ? (
                        <>
                          <input
                            type="text"
                            value={editFieldName}
                            onChange={(e) => setEditFieldName(e.target.value)}
                            className="field-input"
                            style={{ flex: 1 }}
                          />
                          <select
                            value={editFieldType}
                            onChange={(e) => setEditFieldType(e.target.value)}
                            className="field-input"
                            style={{ width: "auto" }}
                          >
                            <option value="text">Text</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Boolean</option>
                          </select>
                          <label className="field-hint" style={{ display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap", marginBottom: 0 }}>
                            <input
                              type="checkbox"
                              checked={editFieldRequired}
                              onChange={(e) => setEditFieldRequired(e.target.checked)}
                            />
                            Req
                          </label>
                          <button className="btn-primary" onClick={handleSaveField} style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}>
                            Save
                          </button>
                          <button className="btn-secondary" onClick={() => setEditingField(null)} style={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: 1, fontWeight: 500, fontSize: "0.9rem", color: "var(--text)" }}>{f.field_name}</span>
                          <span className="field-badge">{f.data_type}</span>
                          {f.is_required && (
                            <span className="field-badge field-badge--accent">req</span>
                          )}
                          <button
                            className="btn-secondary"
                            onClick={() => startEditField(f)}
                            style={{ padding: "0.35rem 0.55rem", fontSize: "0.85rem" }}
                            title="Edit field"
                          >
                            <FiEdit2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add new field */}
                <div className="glass" style={{
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  padding: "0.75rem",
                  borderStyle: "dashed",
                }}>
                  <input
                    type="text"
                    placeholder="New field name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    className="field-input"
                    style={{ flex: 1, minWidth: "120px" }}
                  />
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as any)}
                    className="field-input"
                    style={{ width: "auto" }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                  <label className="field-hint" style={{ display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap", marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(e) => setNewFieldRequired(e.target.checked)}
                    />
                    Req
                  </label>
                  <button
                    className="btn-primary"
                    onClick={handleAddField}
                    disabled={!newFieldName.trim()}
                    style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem" }}
                  >
                    + Add
                  </button>
                </div>
              </>
            )}
          </div>

          <hr className="divider" />

          {/* ── Danger Zone ── */}
          <div className="panel-section danger-zone">
            <p className="panel-section-title" style={{ color: "var(--danger-text)" }}>
              Danger Zone
            </p>
            {!confirmDelete ? (
              <>
                <p className="danger-desc">
                  Permanently delete this project and all its entries.
                </p>
                <button
                  className="btn-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete Project
                </button>
              </>
            ) : (
              <div className="confirm-box">
                <p>Are you sure? This will delete all entries in this project. This action cannot be undone.</p>
                <div className="confirm-actions">
                  <button
                    className="btn-danger-solid"
                    onClick={handleDeleteProject}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, Delete Project"}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="panel-footer">
          <span />
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

export default ProjectSettingsPanel;
