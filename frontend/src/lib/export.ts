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

import {
  classifyEntryPayload,
  formatEntryValue,
  getEntryPayloadTitle,
  type EntryPayload,
} from './entryPayload';

export type { EntryPayload } from './entryPayload';

export interface ProjectSchemaMetadata {
  schema_revision?: number;
  template?: Record<string, unknown> | null;
  template_provenance?: Record<string, unknown> | null;
  source_template_id?: string | null;
  source_template_revision?: number | null;
}

export interface FieldSchemaMetadata {
  id?: string;
  is_unique?: boolean;
  rules?: {
    min?: number | string;
    max?: number | string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
  has_default?: boolean;
  default_value?: EntryPayload;
  options?: { id: string; label: string; value?: string }[];
  display_order?: number;
}

export interface AttachmentManifestItem {
  entry_index: number;
  project_name: string;
  field_name: string;
  field_id?: string;
  path: string[];
  attachment_id: string;
  binary_included: false;
}

export interface ExportedProject extends ProjectSchemaMetadata {
  project_name: string;
  description: string;
  archived: boolean;
}

export interface ExportedField extends FieldSchemaMetadata {
  table_name: string;
  field_name: string;
  data_type: string | null;
  is_required: boolean;
}

export interface ExportedEntry {
  project_name: string;
  entries: EntryPayload;
  due_date: string | null;
  priority: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration: string | null;
  summary: string | null;
  archived: boolean;
}

export interface ExportBundle {
  version: 3;
  attachments: AttachmentManifestItem[];
  exported_at: string;
  user_email: string;
  projects: ExportedProject[];
  fields: ExportedField[];
  entries: ExportedEntry[];
}

export interface RawEntryRow {
  project_name?: string;
  entries?: EntryPayload;
  due_date?: string | null;
  priority?: string | null;
  status?: string;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: string | null;
  summary?: string | null;
  archived?: boolean;
}

export interface RawProjectRow extends ProjectSchemaMetadata {
  project_name?: string;
  description?: string;
  archived?: boolean;
}

export interface RawFieldRow extends FieldSchemaMetadata {
  table_name?: string;
  field_name?: string;
  data_type?: string | null;
  is_required?: boolean;
}

function normaliseEntriesField(value: unknown): EntryPayload {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normaliseEntriesField);
  if (value && typeof value === 'object') {
    // Attachment references are portable identities, never access credentials or binary data.
    const record = value as Record<string, unknown>;
    if (typeof record.attachmentId === 'string') return { attachmentId: record.attachmentId };
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normaliseEntriesField(item)])
    );
  }
  return value as EntryPayload;
}

export function projectSchemaMetadata(project: ProjectSchemaMetadata): ProjectSchemaMetadata {
  const result: ProjectSchemaMetadata = {};
  for (const key of [
    'schema_revision',
    'source_template_id',
    'source_template_revision',
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(project, key))
      Object.assign(result, { [key]: project[key] });
  }
  for (const key of ['template', 'template_provenance'] as const) {
    const value = project[key];
    if (value === null) result[key] = null;
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = Object.fromEntries(
        [
          'id',
          'name',
          'revision',
          'version',
          'source',
          'kind',
          'template_id',
          'template_revision',
          'source_template_id',
          'source_template_revision',
        ]
          .filter((name) => Object.prototype.hasOwnProperty.call(value, name))
          .map((name) => [name, value[name]])
      );
    }
  }
  return result;
}

export function fieldSchemaMetadata(field: FieldSchemaMetadata): FieldSchemaMetadata {
  const result: FieldSchemaMetadata = {};
  for (const key of ['id', 'is_unique', 'has_default', 'default_value', 'display_order'] as const) {
    if (Object.prototype.hasOwnProperty.call(field, key))
      Object.assign(result, { [key]: field[key] });
  }
  if (field.rules)
    result.rules = Object.fromEntries(
      ['min', 'max', 'minLength', 'maxLength', 'pattern']
        .filter((key) => Object.prototype.hasOwnProperty.call(field.rules!, key))
        .map((key) => [key, field.rules![key as keyof typeof field.rules]])
    );
  if (Array.isArray(field.options))
    result.options = field.options.map((option) => ({
      id: option.id,
      label: option.label,
      ...(Object.prototype.hasOwnProperty.call(option, 'value') ? { value: option.value } : {}),
    }));
  return result;
}

export function attachmentKey(item: Pick<AttachmentManifestItem, 'entry_index' | 'path'>): string {
  return JSON.stringify([item.entry_index, item.path]);
}

export function buildAttachmentManifest(
  entries: ExportedEntry[],
  fields: ExportedField[] = []
): AttachmentManifestItem[] {
  const manifest: AttachmentManifestItem[] = [];
  entries.forEach((entry, entry_index) => {
    const visit = (value: unknown, path: string[]) => {
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      if (!Array.isArray(value) && typeof record.attachmentId === 'string') {
        const field = fields.find(
          (candidate) =>
            candidate.table_name === entry.project_name && candidate.field_name === path[0]
        );
        manifest.push({
          entry_index,
          project_name: entry.project_name,
          field_name: path[0] ?? '',
          ...(field?.id ? { field_id: field.id } : {}),
          path,
          attachment_id: record.attachmentId,
          binary_included: false,
        });
        return;
      }
      Object.entries(value).forEach(([key, item]) => visit(item, [...path, key]));
    };
    visit(entry.entries, []);
  });
  return manifest;
}

export function normaliseProjects(projects: RawProjectRow[]): ExportedProject[] {
  return projects.map((project) => ({
    ...projectSchemaMetadata(project),
    project_name: project.project_name ?? '',
    description: project.description ?? '',
    archived: project.archived === true,
  }));
}

export function normaliseFields(fields: RawFieldRow[]): ExportedField[] {
  return fields.map((field) => ({
    ...fieldSchemaMetadata(field),
    table_name: field.table_name ?? '',
    field_name: field.field_name ?? '',
    data_type: field.data_type ?? null,
    is_required: field.is_required === true,
  }));
}

export function normaliseEntries(entries: RawEntryRow[]): ExportedEntry[] {
  return entries.map((entry) => ({
    project_name: entry.project_name ?? '',
    entries: normaliseEntriesField(entry.entries),
    due_date: entry.due_date ?? null,
    priority: entry.priority ?? null,
    status: entry.status ?? 'up_next',
    started_at: entry.started_at ?? null,
    ended_at: entry.ended_at ?? null,
    duration: entry.duration ?? null,
    summary: entry.summary ?? null,
    archived: entry.archived === true,
  }));
}

export function buildExportBundle(
  userEmail: string,
  projects: RawProjectRow[],
  entries: RawEntryRow[],
  fields: RawFieldRow[] = []
): ExportBundle {
  const normalizedEntries = normaliseEntries(entries);
  const normalizedFields = normaliseFields(fields);
  return {
    version: 3,
    attachments: buildAttachmentManifest(normalizedEntries, normalizedFields),
    exported_at: new Date().toISOString(),
    user_email: userEmail,
    projects: normaliseProjects(projects),
    fields: normalizedFields,
    entries: normalizedEntries,
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
  'summary',
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
    '| project_name | entries | due_date | priority | status | started_at | ended_at | duration | summary | archived |'
  );
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const e of bundle.entries) {
    const cells = ENTRY_CSV_COLUMNS.map((col) => {
      const value = e[col];
      return escapeMD(col === 'entries' ? JSON.stringify(value) : value);
    });
    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Escapes a value for inclusion in an iCalendar (RFC 5545) text field.
 * Backslashes, semicolons, commas, and newlines are escaped.
 */
function escapeICS(value: unknown): string {
  const str = value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats a date string for iCalendar (UTC or all-day).
 * If the date has a time component, returns YYYYMMDDTHHMMSSZ.
 * Otherwise, returns YYYYMMDD for an all-day event.
 */
function formatICSDate(dateStr: string | null, allDay: boolean): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/**
 * Extracts the title from an entry's JSONB payload.
 */
function getEntryTitle(entries: EntryPayload): string {
  const payload = classifyEntryPayload(entries);
  if (payload.kind === 'object') {
    const directTitle = formatEntryValue(
      payload.value.title ?? payload.value.task ?? payload.value.name
    );
    if (directTitle !== 'Not recorded') return directTitle;
  }

  const title = getEntryPayloadTitle(entries);
  return title === 'Not recorded' ? 'Untitled' : title;
}

/**
 * Builds a description string from an entry's JSONB payload.
 */
function getEntryDescription(entries: EntryPayload): string {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return '';

  return [entries.description, entries.comment, entries.notes]
    .map(formatEntryValue)
    .filter((value) => value !== 'Not recorded')
    .join('\n\n');
}

/**
 * Maps entry status to iCalendar STATUS.
 */
function getICSStatus(status: string): string {
  if (status === 'done_and_dusted') return 'COMPLETED';
  if (status === 'in_motion') return 'CONFIRMED';
  return 'TENTATIVE';
}

/**
 * Maps entry priority to iCalendar PRIORITY (1-9, 0 = undefined).
 */
function getICSPriority(priority: string | null): number {
  if (!priority) return 0;
  const lower = priority.toLowerCase();
  if (lower.includes('urgent') || lower === 'p1' || lower === 'high') return 1;
  if (lower === 'p2' || lower === 'medium-high') return 3;
  if (lower === 'p3' || lower === 'medium') return 5;
  if (lower === 'p4' || lower === 'low') return 7;
  return 0;
}

/**
 * Serialises an export bundle to iCalendar (.ics) format.
 * Entries without a placable date are skipped.
 */
export function exportToICS(bundle: ExportBundle): string {
  const lines: string[] = [];

  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Digital Logbook//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeICS('Digital Logbook - ' + bundle.user_email)}`);
  lines.push(`X-WR-TIMEZONE:UTC`);

  // Events
  for (const entry of bundle.entries) {
    // Skip entries without any date
    const hasStart = !!entry.started_at;
    const hasDue = !!entry.due_date;
    if (!hasStart && !hasDue) continue;

    // Determine if this is an all-day event (no time component)
    const isAllDay = !hasStart && hasDue;

    // Resolve start date
    const startStr = entry.started_at ?? entry.due_date;
    const startFormatted = formatICSDate(startStr, isAllDay);
    if (!startFormatted) continue;

    // Resolve end date
    let endFormatted: string;
    if (entry.ended_at) {
      endFormatted = formatICSDate(entry.ended_at, isAllDay);
    } else if (entry.due_date && entry.started_at) {
      // If we have both start and due, use due as end
      endFormatted = formatICSDate(entry.due_date, isAllDay);
    } else {
      // Default: end = start + 1 hour (or + 1 day for all-day)
      const startDate = new Date(startStr!);
      if (isAllDay) {
        startDate.setUTCDate(startDate.getUTCDate() + 1);
      } else {
        startDate.setUTCHours(startDate.getUTCHours() + 1);
      }
      endFormatted = formatICSDate(startDate.toISOString(), isAllDay);
    }
    if (!endFormatted) continue;

    const title = getEntryTitle(entry.entries);
    const description = getEntryDescription(entry.entries);
    const status = getICSStatus(entry.status);
    const priority = getICSPriority(entry.priority);
    const uid = `entry-${Date.now()}-${Math.random().toString(36).slice(2)}@digital-logbook`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);

    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${startFormatted}`);
      lines.push(`DTEND;VALUE=DATE:${endFormatted}`);
    } else {
      lines.push(`DTSTART:${startFormatted}`);
      lines.push(`DTEND:${endFormatted}`);
    }

    lines.push(`SUMMARY:${escapeICS(title)}`);

    if (description) {
      lines.push(`DESCRIPTION:${escapeICS(description)}`);
    }

    if (entry.project_name) {
      lines.push(`CATEGORIES:${escapeICS(entry.project_name)}`);
    }

    lines.push(`STATUS:${status}`);

    if (priority > 0) {
      lines.push(`PRIORITY:${priority}`);
    }

    lines.push(`DTSTAMP:${formatICSDate(new Date().toISOString(), false)}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
