import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import './ProjectTable.css';

/*
  ProjectTaskTable
  -----------------
  Editable table — every cell updates Supabase on change.
  View toggle: "entry" shows dynamic jsonb fields, "summary" shows AI summary.
*/

// Status & priority enums matching the rest of the app
const STATUSES = ["in_motion", "done_and_dusted"] as const;
const PRIORITIES = ["0", "1", "2", "3"] as const;

const STATUS_LABELS: Record<string, string> = {
  up_next: "Up Next",
  in_motion: "In Motion",
  done_and_dusted: "Done & Dusted",
};

const PRIORITY_LABELS: Record<string, string> = {
  "0": "Urgent and important",
  "1": "Urgent but not important",
  "2": "Not urgent, not important",
  "3": "No priority",
};

function friendlyStatus(raw: string) {
  return STATUS_LABELS[raw] || raw;
}

function friendlyPriority(raw: string) {
  return PRIORITY_LABELS[raw] || raw;
}

// Dummy data for preview
const DUMMY_ROWS = [
  {
    id: "1",
    project_name: "Digital Logbook",
    entries: { task: "Fixed authentication bug", hours: "3" },
    due_date: "2026-09-05T00:00:00Z",
    priority: "0",
    status: "in_motion",
    summary: "Fixed the authentication bug in the login flow",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
  {
    id: "2",
    project_name: "Digital Logbook",
    entries: { task: "Add entry summaries feature", hours: "5" },
    due_date: "2026-09-10T00:00:00Z",
    priority: "1",
    status: "in_motion",
    summary: "Implemented AI-generated summaries for log entries",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
  {
    id: "3",
    project_name: "Digital Logbook",
    entries: { task: "Write unit tests", hours: "2" },
    due_date: null,
    priority: "2",
    status: "done_and_dusted",
    summary: "Added tests for AI messages toggle",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
  {
    id: "4",
    project_name: "Khanyisa MVP",
    entries: { task: "Design learner dashboard", hours: "4" },
    due_date: "2026-09-08T00:00:00Z",
    priority: "1",
    status: "in_motion",
    summary: "Designed the learner dashboard wireframes",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
  {
    id: "5",
    project_name: "Khanyisa MVP",
    entries: { task: "Setup Supabase schema", hours: "6" },
    due_date: "2026-09-01T00:00:00Z",
    priority: "0",
    status: "done_and_dusted",
    summary: "Set up the database schema in Supabase",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
  {
    id: "6",
    project_name: "Personal",
    entries: { task: "Morning run", hours: "1" },
    due_date: null,
    priority: "3",
    status: "done_and_dusted",
    summary: "Went for a 5km morning run",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
];

const DUMMY_FIELDS = [
  { id: "1", table_name: "Digital Logbook", field_name: "task", data_type: "text", is_required: true, deleted: false },
  { id: "2", table_name: "Digital Logbook", field_name: "hours", data_type: "number", is_required: false, deleted: false },
  { id: "3", table_name: "Khanyisa MVP", field_name: "task", data_type: "text", is_required: true, deleted: false },
  { id: "4", table_name: "Khanyisa MVP", field_name: "hours", data_type: "number", is_required: false, deleted: false },
  { id: "5", table_name: "Personal", field_name: "task", data_type: "text", is_required: true, deleted: false },
  { id: "6", table_name: "Personal", field_name: "hours", data_type: "number", is_required: false, deleted: false },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function groupByProject(rows: any[]) {
  const groups: Record<string, any[]> = {};
  for (const row of rows) {
    if (row.deleted || row.archived) continue;
    const key = row.project_name || "Unassigned";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return Object.entries(groups).map(([name, entries]) => ({ name, entries }));
}

function customFieldsFor(projectName: string, fields: any[]) {
  return fields.filter((f) => f.table_name === projectName && !f.deleted);
}

// Grid: Status | Due | Priority | content columns
// Priority wider for long labels that wrap, others compact
const BASE_COLS = "110px 80px 150px";

function buildGridTemplate(viewMode: string, customFieldCount: number) {
  let template = BASE_COLS;
  if (viewMode === "summary") {
    template += " minmax(200px, 3fr)"; // single summary column
  } else {
    for (let i = 0; i < customFieldCount; i++) {
      template += " minmax(80px, 1fr)";
    }
  }
  return template;
}

// ── Inline editable text cell ──────────────────────────────
function EditableText({
  value,
  onSave,
  type = "text",
  className,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value) onSave(draft.trim());
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="ptt-inline-input"
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <span className={`ptt-editable ${className || ""}`} onClick={() => setEditing(true)} title="Click to edit">
      {value || <span className="ptt-placeholder">click to edit</span>}
    </span>
  );
}

// ── Inline editable date cell ──────────────────────────────
function EditableDate({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const toDateInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  };

  const commit = (raw: string) => {
    setEditing(false);
    const newVal = raw ? new Date(raw).toISOString() : null;
    if (newVal !== value) onSave(newVal);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="ptt-inline-input ptt-inline-date"
        type="date"
        defaultValue={toDateInput(value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <span className="ptt-editable ptt-editable-date" onClick={() => setEditing(true)} title="Click to edit">
      {formatDate(value) || <span className="ptt-placeholder">set date</span>}
    </span>
  );
}

// ── Row component ──────────────────────────────────────────
function TaskRow({
  entry,
  customFields,
  gridTemplate,
  viewMode,
  onUpdate,
}: {
  entry: any;
  customFields: any[];
  gridTemplate: string;
  viewMode: "entry" | "summary";
  onUpdate: (id: string, patch: Record<string, any>) => void;
}) {
  const customValues = entry.entries || {};

  const handleFieldEdit = useCallback(
    (fieldName: string, newVal: string) => {
      const updated = { ...customValues, [fieldName]: newVal };
      onUpdate(entry.id, { entries: updated });
    },
    [entry.id, customValues, onUpdate],
  );

  return (
    <div
      className="ptt-row"
      data-status={friendlyStatus(entry.status)}
      data-priority={friendlyPriority(entry.priority)}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {/* Status — dropdown */}
      <div className="ptt-cell ptt-cell-status">
        <select
          className="ptt-select ptt-select-status"
          value={entry.status || STATUSES[0]}
          onChange={(e) => onUpdate(entry.id, { status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{friendlyStatus(s)}</option>
          ))}
        </select>
      </div>

      {/* Due date — editable date */}
      <div className="ptt-cell ptt-cell-due">
        <EditableDate
          value={entry.due_date}
          onSave={(val) => onUpdate(entry.id, { due_date: val })}
        />
      </div>

      {/* Priority — dropdown */}
      <div className="ptt-cell ptt-cell-priority">
        <select
          className="ptt-select ptt-select-priority"
          value={entry.priority || PRIORITIES[3]}
          onChange={(e) => onUpdate(entry.id, { priority: e.target.value })}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{friendlyPriority(p)}</option>
          ))}
        </select>
      </div>

      {/* Content columns depend on view mode */}
      {viewMode === "summary" ? (
        <div className="ptt-cell ptt-cell-summary">
          <EditableText
            value={entry.summary || ""}
            onSave={(val) => onUpdate(entry.id, { summary: val })}
            className="ptt-summary-text"
          />
        </div>
      ) : (
        customFields.map((field) => {
          const val = String(customValues[field.field_name] ?? "");
          return (
            <div className="ptt-cell ptt-cell-custom" key={field.field_name}>
              <EditableText
                value={val}
                onSave={(newVal) => handleFieldEdit(field.field_name, newVal)}
                type={field.data_type === "number" ? "number" : "text"}
              />
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Project group ──────────────────────────────────────────
function ProjectGroup({
  project,
  fields,
  viewMode,
  onUpdate,
}: {
  project: any;
  fields: any[];
  viewMode: "entry" | "summary";
  onUpdate: (id: string, patch: Record<string, any>) => void;
}) {
  const [open, setOpen] = useState(true);
  const customFields = customFieldsFor(project.name, fields);
  const gridTemplate = buildGridTemplate(viewMode, customFields.length);

  return (
    <div className="ptt-group">
      <button
        type="button"
        className="ptt-group-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ptt-group-toggle" aria-hidden="true">
          {open ? "v" : ">"}
        </span>
        <span className="ptt-group-name">{project.name}</span>
        <span className="ptt-group-count">{project.entries.length}</span>
      </button>

      {open && (
        <div className="ptt-table">
          <div className="ptt-columns" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="ptt-col">Status</div>
            <div className="ptt-col">Due</div>
            <div className="ptt-col">Priority</div>
            {viewMode === "summary" ? (
              <div className="ptt-col ptt-col-summary">Summary</div>
            ) : (
              customFields.map((field) => (
                <div className="ptt-col ptt-col-custom" key={field.field_name}>
                  {field.field_name}
                </div>
              ))
            )}
          </div>

          <div className="ptt-rows">
            {project.entries.map((entry: any) => (
              <TaskRow
                key={entry.id}
                entry={entry}
                customFields={customFields}
                gridTemplate={gridTemplate}
                viewMode={viewMode}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main table ─────────────────────────────────────────────
export default function ProjectTaskTable({
  rows = [],
  fields = [],
  viewMode = "entry",
  onUpdate,
}: {
  rows?: any[];
  fields?: any[];
  viewMode?: "entry" | "summary";
  onUpdate: (id: string, patch: Record<string, any>) => void;
}) {
  const projects = groupByProject(rows);

  return (
    <div className="ptt-root">
      {projects.map((project) => (
        <ProjectGroup
          key={project.name}
          project={project}
          fields={fields}
          viewMode={viewMode}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

// ── Preview wrapper with Supabase persistence ──────────────
export function ProjectTablePreview() {
  const [rows, setRows] = useState<any[]>(DUMMY_ROWS);
  const [fields, setFields] = useState<any[]>(DUMMY_FIELDS);
  const [useRealData, setUseRealData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"entry" | "summary">("entry");

  useEffect(() => {
    if (!useRealData) return;

    async function fetchRealData() {
      setLoading(true);
      try {
        const supabase = getSupabase();
        const { data: entriesData } = await supabase
          .from("entries")
          .select("*")
          .eq("user_email", "hlulanibaloyi@khanyisaeducentre")
          .eq("deleted", false);

        const { data: fieldsData } = await supabase
          .from("fields")
          .select("*")
          .eq("deleted", false);

        if (entriesData && entriesData.length > 0) setRows(entriesData);
        if (fieldsData && fieldsData.length > 0) setFields(fieldsData);
      } catch (err) {
        console.error("Failed to fetch real data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRealData();
  }, [useRealData]);

  const handleUpdate = useCallback(
    async (id: string, patch: Record<string, any>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );

      if (!useRealData) return;

      setSaving(id);
      try {
        const supabase = getSupabase();
        const { error } = await supabase
          .from("entries")
          .update(patch)
          .eq("id", id);

        if (error) {
          console.error("[ptt] update failed:", error.message);
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== id) return r;
              const original = rows.find((o) => o.id === id);
              return original || r;
            }),
          );
        }
      } catch (err) {
        console.error("[ptt] update error:", err);
      } finally {
        setSaving(null);
      }
    },
    [useRealData, rows],
  );

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>ProjectTaskTable</h2>

        {/* View toggle */}
        <div style={{ display: "flex", gap: "0", borderRadius: "6px", overflow: "hidden", border: "1.5px solid #c49a2a" }}>
          <button
            onClick={() => setViewMode("entry")}
            style={{
              padding: "0.35rem 0.9rem",
              border: "none",
              background: viewMode === "entry" ? "#c49a2a" : "#fdfaf3",
              color: viewMode === "entry" ? "#fff" : "#3b3226",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.8rem",
            }}
          >
            Entry
          </button>
          <button
            onClick={() => setViewMode("summary")}
            style={{
              padding: "0.35rem 0.9rem",
              border: "none",
              borderLeft: "1.5px solid #c49a2a",
              background: viewMode === "summary" ? "#c49a2a" : "#fdfaf3",
              color: viewMode === "summary" ? "#fff" : "#3b3226",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.8rem",
            }}
          >
            Summary
          </button>
        </div>

        <button
          onClick={() => setUseRealData(!useRealData)}
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: useRealData ? "#4a7c59" : "#fff",
            color: useRealData ? "#fff" : "#333",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          {loading ? "Loading..." : useRealData ? "Real Data" : "Dummy Data"}
        </button>

        <span style={{ color: "#666", fontSize: "0.8rem" }}>
          {useRealData ? "hlulanibaloyi@khanyisaeducentre" : "Preview"}
          {saving && " — saving..."}
        </span>
      </div>
      <ProjectTaskTable rows={rows} fields={fields} viewMode={viewMode} onUpdate={handleUpdate} />
    </div>
  );
}
