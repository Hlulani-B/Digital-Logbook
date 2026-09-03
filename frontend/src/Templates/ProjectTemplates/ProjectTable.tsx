import { useState, useEffect } from "react";
import { getSupabase } from "@/lib/supabase";

/*
  ProjectTaskTable
  -----------------
  Renders rows straight from the `entries` table, grouped by `project_name`,
  matching the "Projects & Tasks" layout. No assignee column, since that
  field doesn't exist in the schema.

  Expects data shaped exactly like what Supabase returns:

  entries table columns used:
    id            uuid
    project_name  varchar
    entries       jsonb   -> custom field values, keyed by field_name
    due_date      timestamptz
    priority      enum
    status        enum (default 'up_next')
    summary       text
    archived      boolean
    deleted       boolean

  fields table columns used (per project_name, defines what shows up
  from the entries.entries jsonb blob as extra columns):
    table_name    varchar   -> matches project_name
    field_name    varchar
    data_type     varchar
    is_required   boolean

  Props:
    rows: entries[]      -- flat array straight from `select * from entries`
    fields: fields[]     -- flat array straight from `select * from fields`
                             (used to know which custom columns to render
                             per project, and in what order)

  No colors/spacing are hardcoded beyond bare structural classes, styling
  is left to be layered on separately (Qoder / CSS).
*/

// Dummy data for preview - using hlulanibaloyi@khanyisaeducentre's projects
const DUMMY_ROWS = [
  {
    id: "1",
    project_name: "Digital Logbook",
    entries: { task: "Fixed authentication bug", hours: "3" },
    due_date: "2026-09-05T00:00:00Z",
    priority: "Urgent and important",
    status: "in_progress",
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
    priority: "Important not urgent",
    status: "up_next",
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
    priority: "Urgent not important",
    status: "done",
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
    priority: "Important not urgent",
    status: "in_progress",
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
    priority: "Urgent and important",
    status: "done",
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
    priority: "Neither urgent nor important",
    status: "done",
    summary: "Went for a 5km morning run",
    archived: false,
    deleted: false,
    user_email: "hlulanibaloyi@khanyisaeducentre",
  },
];

const DUMMY_FIELDS = [
  {
    id: "1",
    table_name: "Digital Logbook",
    field_name: "task",
    data_type: "text",
    is_required: true,
    deleted: false,
  },
  {
    id: "2",
    table_name: "Digital Logbook",
    field_name: "hours",
    data_type: "number",
    is_required: false,
    deleted: false,
  },
  {
    id: "3",
    table_name: "Khanyisa MVP",
    field_name: "task",
    data_type: "text",
    is_required: true,
    deleted: false,
  },
  {
    id: "4",
    table_name: "Khanyisa MVP",
    field_name: "hours",
    data_type: "number",
    is_required: false,
    deleted: false,
  },
  {
    id: "5",
    table_name: "Personal",
    field_name: "task",
    data_type: "text",
    is_required: true,
    deleted: false,
  },
  {
    id: "6",
    table_name: "Personal",
    field_name: "hours",
    data_type: "number",
    is_required: false,
    deleted: false,
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

function TaskRow({ entry, customFields }: { entry: any; customFields: any[] }) {
  const customValues = entry.entries || {};

  return (
    <div
      className="ptt-row"
      data-status={entry.status}
      data-priority={entry.priority}
    >
      <div className="ptt-cell ptt-cell-title">
        <span className="ptt-checkbox" aria-hidden="true" />
        <span className="ptt-title-text">
          {customValues.title || customValues.task || entry.summary || "Untitled entry"}
        </span>
      </div>

      <div className="ptt-cell ptt-cell-status">
        <span className="ptt-pill ptt-pill-status">
          {entry.status || "up_next"}
        </span>
      </div>

      <div className="ptt-cell ptt-cell-due">{formatDate(entry.due_date)}</div>

      <div className="ptt-cell ptt-cell-priority">
        {entry.priority && (
          <span className="ptt-pill ptt-pill-priority">{entry.priority}</span>
        )}
      </div>

      {customFields.map((field) => (
        <div className="ptt-cell ptt-cell-custom" key={field.field_name}>
          {String(customValues[field.field_name] ?? "")}
        </div>
      ))}
    </div>
  );
}

function ProjectGroup({ project, fields }: { project: any; fields: any[] }) {
  const [open, setOpen] = useState(true);
  const customFields = customFieldsFor(project.name, fields);

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
          <div className="ptt-columns">
            <div className="ptt-col ptt-col-title">Task name</div>
            <div className="ptt-col ptt-col-status">Status</div>
            <div className="ptt-col ptt-col-due">Due</div>
            <div className="ptt-col ptt-col-priority">Priority</div>
            {customFields.map((field) => (
              <div className="ptt-col ptt-col-custom" key={field.field_name}>
                {field.field_name}
              </div>
            ))}
          </div>

          <div className="ptt-rows">
            {project.entries.map((entry: any) => (
              <TaskRow key={entry.id} entry={entry} customFields={customFields} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectTaskTable({ rows = [], fields = [] }: { rows?: any[]; fields?: any[] }) {
  const projects = groupByProject(rows);

  return (
    <div className="ptt-root">
      {projects.map((project) => (
        <ProjectGroup key={project.name} project={project} fields={fields} />
      ))}
    </div>
  );
}

// Preview wrapper - fetches real data or uses dummy data
export function ProjectTablePreview() {
  const [rows, setRows] = useState<any[]>(DUMMY_ROWS);
  const [fields, setFields] = useState<any[]>(DUMMY_FIELDS);
  const [useRealData, setUseRealData] = useState(false);
  const [loading, setLoading] = useState(false);

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

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <h2 style={{ margin: 0 }}>ProjectTaskTable Preview</h2>
        <button
          onClick={() => setUseRealData(!useRealData)}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            background: useRealData ? "#4CAF50" : "#fff",
            color: useRealData ? "#fff" : "#333",
            cursor: "pointer",
          }}
        >
          {loading ? "Loading..." : useRealData ? "Showing Real Data" : "Show Real Data"}
        </button>
        <span style={{ color: "#666", fontSize: "0.875rem" }}>
          {useRealData ? "hlulanibaloyi@khanyisaeducentre" : "Dummy data"}
        </span>
      </div>
      <ProjectTaskTable rows={rows} fields={fields} />
    </div>
  );
}
