/**
 * Import helpers.
 *
 * Parses JSON, CSV, and Markdown into a normalised bundle shape,
 * validates each row, and reports rejections with line numbers
 * so the caller can show a clear report.
 */

import {
  type EntryPayload,
  type ExportedEntry,
  type ExportedField,
  type ExportedProject,
} from './export';

export interface ImportResult {
  projects: ExportedProject[];
  fields: ExportedField[];
  entries: ExportedEntry[];
  rejections: Rejection[];
}

export interface Rejection {
  /** 1-based line number (or "N/A" for JSON). */
  line: number | 'N/A';
  reason: string;
  row?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown, serialized: boolean): EntryPayload | undefined {
  if (value === undefined) return null;
  if (!serialized) return value as EntryPayload;
  if (value === '' || value === 'null') return null;
  if (typeof value !== 'string') return value as EntryPayload;
  return JSON.parse(value) as EntryPayload;
}

function validateEntry(
  row: Record<string, unknown>,
  line: number | 'N/A',
  serializedPayload = false
): { entry: ExportedEntry; rejection: null } | { entry: null; rejection: Rejection } {
  const projectName = row.project_name;
  if (typeof projectName !== 'string' || projectName.trim() === '') {
    return {
      entry: null,
      rejection: { line, reason: 'Missing or empty project_name', row },
    };
  }

  let entries: EntryPayload;
  try {
    entries = parsePayload(row.entries, serializedPayload) ?? null;
  } catch {
    return {
      entry: null,
      rejection: { line, reason: 'entries field is not valid JSON', row },
    };
  }

  const status = typeof row.status === 'string' && row.status ? row.status : 'up_next';

  return {
    entry: {
      project_name: projectName.trim(),
      entries,
      due_date: row.due_date ? String(row.due_date) : null,
      priority: row.priority ? String(row.priority) : null,
      status,
      started_at: row.started_at ? String(row.started_at) : null,
      ended_at: row.ended_at ? String(row.ended_at) : null,
      duration: row.duration ? String(row.duration) : null,
      summary: row.summary ? String(row.summary) : null,
      archived: row.archived === true || row.archived === 'true',
    },
    rejection: null,
  };
}

/**
 * Validates a project row.
 */
function validateProject(
  row: Record<string, unknown>,
  line: number | 'N/A'
): { project: ExportedProject; rejection: null } | { project: null; rejection: Rejection } {
  const name = row.project_name;
  if (typeof name !== 'string' || name.trim() === '') {
    return {
      project: null,
      rejection: { line, reason: 'Missing or empty project_name', row },
    };
  }

  return {
    project: {
      project_name: name.trim(),
      description: row.description ? String(row.description) : '',
      archived: row.archived === true || row.archived === 'true',
    },
    rejection: null,
  };
}

function validateField(
  row: Record<string, unknown>,
  line: number | 'N/A'
): { field: ExportedField; rejection: null } | { field: null; rejection: Rejection } {
  const tableName = row.table_name;
  const fieldName = row.field_name;
  if (typeof tableName !== 'string' || tableName.trim() === '') {
    return { field: null, rejection: { line, reason: 'Missing table_name', row } };
  }
  if (typeof fieldName !== 'string' || fieldName.trim() === '') {
    return { field: null, rejection: { line, reason: 'Missing field_name', row } };
  }
  return {
    field: {
      table_name: tableName.trim(),
      field_name: fieldName.trim(),
      data_type: row.data_type ? String(row.data_type) : null,
      is_required: row.is_required === true || row.is_required === 'true',
    },
    rejection: null,
  };
}

/**
 * Parses a JSON string into an import result.
 */
export function parseJSONImport(text: string): ImportResult {
  const rejections: Rejection[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      projects: [],
      fields: [],
      entries: [],
      rejections: [
        {
          line: 'N/A',
          reason: `Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`,
        },
      ],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      projects: [],
      fields: [],
      entries: [],
      rejections: [{ line: 'N/A', reason: 'JSON root must be an object' }],
    };
  }

  const version = parsed.version === undefined ? 1 : parsed.version;
  if (version !== 1 && version !== 2) {
    return {
      projects: [],
      fields: [],
      entries: [],
      rejections: [{ line: 'N/A', reason: `Unsupported export version: ${String(version)}` }],
    };
  }

  const projectRows = Array.isArray(parsed.projects) ? parsed.projects : [];
  const fieldRows = version === 2 && Array.isArray(parsed.fields) ? parsed.fields : [];
  const entryRows = Array.isArray(parsed.entries) ? parsed.entries : [];

  const projects = projectRows.map((row, index) => {
    const result = validateProject(row as Record<string, unknown>, index + 1);
    if (result.rejection) {
      rejections.push(result.rejection);
      return null;
    }
    return result.project;
  });

  const fields = fieldRows.map((row, index) => {
    const result = validateField(row as Record<string, unknown>, index + 1);
    if (result.rejection) {
      rejections.push(result.rejection);
      return null;
    }
    return result.field;
  });

  const entries = entryRows.map((row, index) => {
    const result = validateEntry(row as Record<string, unknown>, index + 1);
    if (result.rejection) {
      rejections.push(result.rejection);
      return null;
    }
    return result.entry;
  });

  return {
    projects: projects.filter((project): project is ExportedProject => project !== null),
    fields: fields.filter((field): field is ExportedField => field !== null),
    entries: entries.filter((entry): entry is ExportedEntry => entry !== null),
    rejections,
  };
}

/**
 * Parses a CSV line into cells, respecting quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        current += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        cells.push(current);
        current = '';
        i += 1;
      } else {
        current += ch;
        i += 1;
      }
    }
  }

  cells.push(current);
  return cells;
}

/**
 * Parses a CSV string into an import result.
 * Comment lines starting with `#` delimit sections (projects vs entries).
 */
export function parseCSVImport(text: string): ImportResult {
  const rejections: Rejection[] = [];
  const projects: ExportedProject[] = [];
  const entries: ExportedEntry[] = [];

  const lines = text.split(/\r?\n/);
  let section: 'projects' | 'entries' | null = null;
  let header: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    if (!line) continue;
    if (line.startsWith('#')) {
      if (line.toLowerCase().includes('project')) {
        section = 'projects';
      } else if (line.toLowerCase().includes('entrie')) {
        section = 'entries';
      }
      header = null;
      continue;
    }

    const cells = parseCSVLine(line);

    if (!header) {
      header = cells.map((c) => c.trim().toLowerCase());
      continue;
    }

    if (header.length !== cells.length) {
      rejections.push({
        line: lineNum,
        reason: `Column count mismatch (expected ${header.length}, got ${cells.length})`,
      });
      continue;
    }

    const row: Record<string, unknown> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j];
    }

    if (section === 'projects') {
      const result = validateProject(row, lineNum);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.project) {
        projects.push(result.project);
      }
    } else {
      const result = validateEntry(row, lineNum, true);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.entry) {
        entries.push(result.entry);
      }
    }
  }

  return { projects, fields: [], entries, rejections };
}

/**
 * Splits a Markdown table line into cells.
 */
function splitMDCells(line: string): string[] {
  const trimmed = line.trim();
  if (trimmed.startsWith('|')) {
    return trimmed
      .slice(1)
      .split('|')
      .map((c) => c.trim());
  }
  return trimmed.split('|').map((c) => c.trim());
}

/**
 * Returns true if a Markdown table line is a separator row (---|---|---).
 */
function isMDSeparator(line: string): boolean {
  return /^\s*\|?[\s\-:|]+\|?\s*$/.test(line);
}

/**
 * Parses a Markdown string into an import result.
 */
export function parseMarkdownImport(text: string): ImportResult {
  const rejections: Rejection[] = [];
  const projects: ExportedProject[] = [];
  const entries: ExportedEntry[] = [];

  const lines = text.split(/\r?\n/);
  let section: 'projects' | 'entries' | null = null;
  let header: string[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      const heading = trimmed.toLowerCase();
      if (heading.includes('project')) {
        section = 'projects';
      } else if (heading.includes('entrie')) {
        section = 'entries';
      }
      header = null;
      continue;
    }

    if (!trimmed.startsWith('|')) continue;
    if (isMDSeparator(trimmed)) continue;

    const cells = splitMDCells(line);

    if (!header) {
      header = cells.map((c) => c.trim().toLowerCase().replace(/\\\|/g, '|'));
      continue;
    }

    if (cells.length !== header.length) {
      rejections.push({
        line: lineNum,
        reason: `Column count mismatch (expected ${header.length}, got ${cells.length})`,
      });
      continue;
    }

    const row: Record<string, unknown> = {};
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j].replace(/\\\|/g, '|');
    }

    if (section === 'projects') {
      const result = validateProject(row, lineNum);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.project) {
        projects.push(result.project);
      }
    } else {
      const result = validateEntry(row, lineNum, true);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.entry) {
        entries.push(result.entry);
      }
    }
  }

  return { projects, fields: [], entries, rejections };
}

/**
 * Detects the format of a file and parses it accordingly.
 */
export function parseImport(text: string, fileName: string): ImportResult {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'json') return parseJSONImport(text);
  if (ext === 'csv') return parseCSVImport(text);
  if (ext === 'md' || ext === 'markdown') return parseMarkdownImport(text);

  // Fallback: try JSON first, then CSV, then Markdown
  try {
    const result = parseJSONImport(text);
    if (result.rejections.length === 0) return result;
  } catch {
    // ignore
  }

  const csvResult = parseCSVImport(text);
  if (csvResult.projects.length > 0 || csvResult.entries.length > 0) return csvResult;

  return parseMarkdownImport(text);
}
