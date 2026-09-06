/**
 * Export/import data portability helpers.
 *
 * Supports three formats:
 *  - JSON: structured, round-trip safe, preserves all fields
 *  - CSV: one entry per row, entries JSONB serialised as JSON string
 *  - Markdown: table format with the same fields
 *
 * All formats include archived and unarchived data so that an export-then-import
 * cycle reproduces the original row count exactly.
 */

export interface ExportedProject {
  project_name: string;
  description: string;
  archived: boolean;
}

export interface ExportedEntry {
  project_name: string;
  entries: Record<string, unknown> | null;
  due_date: string | null;
  priority: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration: string | null;
  archived: boolean;
}

export interface ExportBundle {
  version: 1;
  exported_at: string;
  user_email: string;
  projects: ExportedProject[];
  entries: ExportedEntry[];
}

export interface RawEntryRow {
  project_name?: string;
  entries?: Record<string, unknown> | string | null;
  due_date?: string | null;
  priority?: string | null;
  status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: string | null;
  archived?: boolean;
}

export interface RawProjectRow {
  project_name?: string;
  description?: string;
  archived?: boolean;
}

/**
 * Normalises an entry's `entries` field to an object or null.
 */
function normaliseEntriesField(
  value: Record<string, unknown> | string | null | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * Converts raw project rows from the database into a canonical export shape.
 */
export function normaliseProjects(projects: RawProjectRow[]): ExportedProject[] {
  return projects.map((p) => ({
    project_name: p.project_name ?? '',
    description: p.description ?? '',
    archived: p.archived === true,
  }));
}

/**
 * Converts raw entry rows from the database into a canonical export shape.
 */
export function normaliseEntries(entries: RawEntryRow[]): ExportedEntry[] {
  return entries.map((e) => ({
    project_name: e.project_name ?? '',
    entries: normaliseEntriesField(e.entries),
    due_date: e.due_date ?? null,
    priority: e.priority ?? null,
    status: e.status ?? 'up_next',
    started_at: e.started_at ?? null,
    ended_at: e.ended_at ?? null,
    duration: e.duration ?? null,
    archived: e.archived === true,
  }));
}

/**
 * Builds a full export bundle from raw data.
 */
export function buildExportBundle(
  userEmail: string,
  projects: RawProjectRow[],
  entries: RawEntryRow[]
): ExportBundle {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    user_email: userEmail,
    projects: normaliseProjects(projects),
    entries: normaliseEntries(entries),
  };
}

/**
 * Serialises an export bundle to a JSON string.
 */
export function exportToJSON(bundle: ExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Escapes a value for inclusion in a CSV cell.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSV(value: unknown): string {
  const str = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const ENTRY_CSV_COLUMNS = [
  'project_name',
  'entries',
  'due_date',
  'priority',
  'status',
  'started_at',
  'ended_at',
  'duration',
  'archived',
] as const;

/**
 * Serialises an export bundle to CSV.
 * Projects are emitted first as a separate block preceded by a marker row.
 */
export function exportToCSV(bundle: ExportBundle): string {
  const lines: string[] = [];

  // Projects block
  lines.push('# projects');
  lines.push('project_name,description,archived');
  for (const p of bundle.projects) {
    lines.push([p.project_name, p.description, p.archived].map(escapeCSV).join(','));
  }

  // Entries block
  lines.push('');
  lines.push('# entries');
  lines.push(ENTRY_CSV_COLUMNS.join(','));
  for (const e of bundle.entries) {
    const row = ENTRY_CSV_COLUMNS.map((col) => {
      const value = e[col];
      return escapeCSV(col === 'entries' ? JSON.stringify(value) : value);
    });
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/**
 * Escapes a value for inclusion in a Markdown table cell.
 * Pipes and newlines are replaced so the table structure is preserved.
 */
function escapeMD(value: unknown): string {
  const str = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '');
}

/**
 * Serialises an export bundle to Markdown.
 */
export function exportToMarkdown(bundle: ExportBundle): string {
  const lines: string[] = [];

  lines.push(`# Digital Logbook Export`);
  lines.push('');
  lines.push(`- **User:** ${bundle.user_email}`);
  lines.push(`- **Exported:** ${bundle.exported_at}`);
  lines.push(`- **Projects:** ${bundle.projects.length}`);
  lines.push(`- **Entries:** ${bundle.entries.length}`);
  lines.push('');

  // Projects
  lines.push('## Projects');
  lines.push('');
  lines.push('| project_name | description | archived |');
  lines.push('| --- | --- | --- |');
  for (const p of bundle.projects) {
    lines.push(`| ${escapeMD(p.project_name)} | ${escapeMD(p.description)} | ${p.archived} |`);
  }
  lines.push('');

  // Entries
  lines.push('## Entries');
  lines.push('');
  lines.push(
    '| project_name | entries | due_date | priority | status | started_at | ended_at | duration | archived |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const e of bundle.entries) {
    const cells = ENTRY_CSV_COLUMNS.map((col) => {
      const value = e[col];
      return escapeMD(col === 'entries' ? JSON.stringify(value) : value);
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}
