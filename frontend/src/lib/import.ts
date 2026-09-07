/**
 * Import helpers.
 *
 * Parses JSON, CSV, and Markdown into a normalised bundle shape,
 * validates each row, and reports rejections with line numbers
 * so the caller can show a clear report.
 */

import {
  type ExportedEntry,
  type ExportedProject,
  normaliseEntries,
  normaliseProjects,
} from './export';

export interface ImportResult {
  projects: ExportedProject[];
  entries: ExportedEntry[];
  rejections: Rejection[];
}

export interface Rejection {
  /** 1-based line number (or "N/A" for JSON). */
  line: number | 'N/A';
  reason: string;
  row?: Record<string, unknown>;
}

const VALID_STATUSES = new Set(['up_next', 'in_motion', 'done_and_dusted']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates a single entry row and returns a normalised ExportedEntry,
 * or null with a rejection reason.
 */
function validateEntry(
  row: Record<string, unknown>,
  line: number | 'N/A'
): { entry: ExportedEntry; rejection: null } | { entry: null; rejection: Rejection } {
  const projectName = row.project_name;
  if (typeof projectName !== 'string' || projectName.trim() === '') {
    return {
      entry: null,
      rejection: { line, reason: 'Missing or empty project_name', row },
    };
  }

  const entriesValue = row.entries;
  let entries: Record<string, unknown> | null = null;
  if (entriesValue != null && entriesValue !== '' && entriesValue !== 'null') {
    if (typeof entriesValue === 'string') {
      try {
        entries = JSON.parse(entriesValue) as Record<string, unknown>;
      } catch {
        return {
          entry: null,
          rejection: { line, reason: 'entries field is not valid JSON', row },
        };
      }
    } else if (isPlainObject(entriesValue)) {
      entries = entriesValue;
    } else {
      return {
        entry: null,
        rejection: { line, reason: 'entries field must be JSON object or string', row },
      };
    }
  }

  const status = typeof row.status === 'string' ? row.status : 'up_next';
  if (!VALID_STATUSES.has(status)) {
    return {
      entry: null,
      rejection: { line, reason: `Invalid status: ${status}`, row },
    };
  }

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
      entries: [],
      rejections: [{ line: 'N/A', reason: 'JSON root must be an object' }],
    };
  }

  const projects = normaliseProjects((parsed.projects ?? []) as Record<string, unknown>[]).map(
    (p, i) => {
      const result = validateProject(p as unknown as Record<string, unknown>, i + 1);
      if (result.rejection) {
        rejections.push(result.rejection);
        return null;
      }
      return result.project;
    }
  );

  const entries = normaliseEntries((parsed.entries ?? []) as Record<string, unknown>[]).map(
    (e, i) => {
      const result = validateEntry(e as unknown as Record<string, unknown>, i + 1);
      if (result.rejection) {
        rejections.push(result.rejection);
        return null;
      }
      return result.entry;
    }
  );

  return {
    projects: projects.filter((p): p is ExportedProject => p !== null),
    entries: entries.filter((e): e is ExportedEntry => e !== null),
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
      const result = validateEntry(row, lineNum);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.entry) {
        entries.push(result.entry);
      }
    }
  }

  return { projects, entries, rejections };
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
      const result = validateEntry(row, lineNum);
      if (result.rejection) {
        rejections.push(result.rejection);
      } else if (result.entry) {
        entries.push(result.entry);
      }
    }
  }

  return { projects, entries, rejections };
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
