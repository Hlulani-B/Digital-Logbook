import { useState, useEffect, useRef, useCallback } from "react";
import './ProjectTable.css';

/* Hook to detect mobile width (< 600px) */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 600);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 599px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
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
    user_email: "hlulanibaloyi@khanyisaeducentre.co.za",
  },
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
    // Only skip soft-deleted rows (show archived ones too)
    if (row.deleted) continue;
    // Ensure entries jsonb is parsed (might be string from API)
    if (typeof row.entries === "string") {
      try { row.entries = JSON.parse(row.entries); } catch { row.entries = {}; }
    }
    const key = row.project_name || "Unassigned";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }
  return Object.entries(groups).map(([name, entries]) => ({ name, entries }));
}

// Derive columns directly from the entries jsonb keys
function entryFieldNames(rows: any[]): string[] {
  const SKIP = new Set(["started_at", "description"]);
  const keys = new Set<string>();
  for (const row of rows) {
    const obj = row.entries;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const key of Object.keys(obj)) {
        if (!SKIP.has(key)) keys.add(key);
      }
    }
  }
  const names = Array.from(keys);
  console.log("[ptt] entry field names:", names);
  return names;
}

// Grid: content columns | Priority | Due | Status (far right)
const TRAILING_COLS = "150px 100px 120px"; // Priority | Due | Status (wider for spacing)

function buildGridTemplate(viewMode: string, customFieldCount: number) {
  let template = "";
  if (viewMode === "summary") {
    template = "minmax(150px, 2fr)"; // Reduced from 3fr to give less space to summary
  } else {
    const parts = [];
    for (let i = 0; i < customFieldCount; i++) {
      parts.push("minmax(80px, 1fr)");
    }
    template = parts.join(" ");
  }
  return template + " " + TRAILING_COLS;
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

// ── Mobile card — stacked layout for < 600px ─────────────
function MobileCard({
  entry,
  fieldNames,
  viewMode,
  onUpdate,
}: {
  entry: any;
  fieldNames: string[];
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
    <div className="ptt-mobile-card" data-status={friendlyStatus(entry.status)}>
      {/* Title / summary at top */}
      {viewMode === "summary" ? (
        <div className="ptt-mobile-card__title">
          <EditableText
            value={entry.summary || ""}
            onSave={(val) => onUpdate(entry.id, { summary: val })}
            className="ptt-summary-text"
          />
        </div>
      ) : (
        <div className="ptt-mobile-card__title">
          {fieldNames.map((fieldName) => {
            const val = String(customValues[fieldName] ?? "");
            return (
              <div key={fieldName} className="ptt-mobile-card__field-row">
                <span className="ptt-mobile-card__label">{fieldName}</span>
                <EditableText
                  value={val}
                  onSave={(newVal) => handleFieldEdit(fieldName, newVal)}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Labeled rows */}
      <div className="ptt-mobile-card__meta">
        <div className="ptt-mobile-card__row">
          <span className="ptt-mobile-card__label">Priority</span>
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
        <div className="ptt-mobile-card__row">
          <span className="ptt-mobile-card__label">Due</span>
          <EditableDate
            value={entry.due_date}
            onSave={(val) => onUpdate(entry.id, { due_date: val })}
          />
        </div>
        <div className="ptt-mobile-card__row">
          <span className="ptt-mobile-card__label">Status</span>
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
      </div>
    </div>
  );
}

// ── Row component ──────────────────────────────────────────
function TaskRow({
  entry,
  fieldNames,
  gridTemplate,
  viewMode,
  onUpdate,
}: {
  entry: any;
  fieldNames: string[];
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
      {/* Content columns — left side */}
      {viewMode === "summary" ? (
        <div className="ptt-cell ptt-cell-summary">
          <EditableText
            value={entry.summary || ""}
            onSave={(val) => onUpdate(entry.id, { summary: val })}
            className="ptt-summary-text"
          />
        </div>
      ) : (
        fieldNames.map((fieldName) => {
          const val = String(customValues[fieldName] ?? "");
          return (
            <div className="ptt-cell ptt-cell-custom" key={fieldName}>
              <EditableText
                value={val}
                onSave={(newVal) => handleFieldEdit(fieldName, newVal)}
              />
            </div>
          );
        })
      )}

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

      {/* Due date — editable date */}
      <div className="ptt-cell ptt-cell-due">
        <EditableDate
          value={entry.due_date}
          onSave={(val) => onUpdate(entry.id, { due_date: val })}
        />
      </div>

      {/* Status — dropdown (far right) */}
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
    </div>
  );
}

// ── Project group ──────────────────────────────────────────
function ProjectGroup({
  project,
  viewMode,
  onUpdate,
  onProjectNameClick,
  isMobile,
}: {
  project: any;
  viewMode: "entry" | "summary";
  onUpdate: (id: string, patch: Record<string, any>) => void;
  onProjectNameClick?: (projectName: string) => void;
  isMobile: boolean;
}) {
  const [open, setOpen] = useState(true);
  // Derive columns from the entries jsonb keys directly
  const fieldNames = entryFieldNames(project.entries);
  const colCount = viewMode === "summary" ? 1 : fieldNames.length;
  const gridTemplate = buildGridTemplate(viewMode, colCount);

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
        <span
          className="ptt-group-name"
          onClick={(e) => {
            e.stopPropagation();
            onProjectNameClick?.(project.name);
          }}
          style={onProjectNameClick ? { cursor: 'pointer', textDecoration: 'underline' } : undefined}
          title={onProjectNameClick ? `Open ${project.name}` : undefined}
        >
          {project.name}
        </span>
        <span className="ptt-group-count">{project.entries.length}</span>
      </button>

      {open && (
        isMobile ? (
          /* ── Mobile: stacked cards ── */
          <div className="ptt-mobile-list">
            {project.entries.map((entry: any) => (
              <MobileCard
                key={entry.id}
                entry={entry}
                fieldNames={fieldNames}
                viewMode={viewMode}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        ) : (
          /* ── Desktop: table ── */
          <div className="ptt-table">
            <div className="ptt-columns" style={{ gridTemplateColumns: gridTemplate }}>
              {viewMode === "summary" ? (
                <div className="ptt-col ptt-col-summary">Summary</div>
              ) : (
                fieldNames.map((name) => (
                  <div className="ptt-col ptt-col-custom" key={name}>
                    {name}
                  </div>
                ))
              )}
              <div className="ptt-col">Priority</div>
              <div className="ptt-col">Due</div>
              <div className="ptt-col">Status</div>
            </div>

            <div className="ptt-rows">
              {project.entries.map((entry: any) => (
                <TaskRow
                  key={entry.id}
                  entry={entry}
                  fieldNames={fieldNames}
                  gridTemplate={gridTemplate}
                  viewMode={viewMode}
                  onUpdate={onUpdate}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ── Main table ─────────────────────────────────────────────
export default function ProjectTaskTable({
  rows = [],
  viewMode = "entry",
  onUpdate,
  onProjectNameClick,
}: {
  rows?: any[];
  viewMode?: "entry" | "summary";
  onUpdate: (id: string, patch: Record<string, any>) => void;
  onProjectNameClick?: (projectName: string) => void;
}) {
  const projects = groupByProject(rows);
  const isMobile = useIsMobile();

  return (
    <div className="ptt-root">
      {projects.map((project) => (
        <ProjectGroup
          key={project.name}
          project={project}
          viewMode={viewMode}
          onUpdate={onUpdate}
          onProjectNameClick={onProjectNameClick}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}

// ── Preview wrapper — uses dummy data for now ─────────
export function ProjectTablePreview({
  onProjectNameClick,
}: {
  onProjectNameClick?: (projectName: string) => void;
} = {}) {
  const [rows, setRows] = useState<any[]>(DUMMY_ROWS);
  const [saving, setSaving] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"entry" | "summary">("entry");

  const handleUpdate = useCallback(
    async (id: string, patch: Record<string, any>) => {
      // Local update only (dummy mode)
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
      setSaving(id);
      setTimeout(() => setSaving(null), 500);
    },
    [rows],
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

        <span style={{ color: "#666", fontSize: "0.8rem" }}>
          {`${rows.length} entries`}
          {saving && " — saving..."}
        </span>
      </div>
      <ProjectTaskTable rows={rows} viewMode={viewMode} onUpdate={handleUpdate} onProjectNameClick={onProjectNameClick} />
    </div>
  );
}
