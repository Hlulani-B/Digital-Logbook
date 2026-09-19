/**
 * Import helpers.
 *
 * Parses JSON, CSV, and Markdown into a normalised bundle shape,
 * validates each row, and reports rejections with line numbers
 * so the caller can show a clear report.
 */

import {
  attachmentKey,
  buildAttachmentManifest,
  fieldSchemaMetadata,
  projectSchemaMetadata,
  type AttachmentManifestItem,
  type EntryPayload,
  type ExportedEntry,
  type ExportedField,
  type ExportedProject,
} from './export';

export interface ImportResult {
  version?: 1 | 2 | 3;
  attachments?: AttachmentManifestItem[];
  blockedProjects?: string[];
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
  if (!isPlainObject(row))
    return { entry: null, rejection: { line, reason: 'Entry must be an object' } };
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
  if (!isPlainObject(row))
    return { project: null, rejection: { line, reason: 'Project must be an object' } };
  const name = row.project_name;
  if (typeof name !== 'string' || name.trim() === '') {
    return {
      project: null,
      rejection: { line, reason: 'Missing or empty project_name', row },
    };
  }

  return {
    project: {
      ...projectSchemaMetadata(row),
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
  if (!isPlainObject(row))
    return { field: null, rejection: { line, reason: 'Field must be an object' } };
  const tableName = row.table_name;
  const fieldName = row.field_name;
  if (typeof tableName !== 'string' || tableName.trim() === '') {
    return { field: null, rejection: { line, reason: 'Missing table_name', row } };
  }
  if (typeof fieldName !== 'string' || fieldName.trim() === '') {
    return { field: null, rejection: { line, reason: 'Missing field_name', row } };
  }
  const invalidMetadata =
    ['is_unique', 'has_default'].some((key) => key in row && typeof row[key] !== 'boolean') ||
    ('rules' in row && !isPlainObject(row.rules)) ||
    ('options' in row &&
      (!Array.isArray(row.options) ||
        row.options.some(
          (option) =>
            !isPlainObject(option) ||
            typeof option.id !== 'string' ||
            typeof option.label !== 'string' ||
            ('value' in option && typeof option.value !== 'string')
        ))) ||
    (row.has_default === true && !Object.prototype.hasOwnProperty.call(row, 'default_value'));
  if (invalidMetadata)
    return { field: null, rejection: { line, reason: 'Invalid field metadata', row } };
  return {
    field: {
      ...fieldSchemaMetadata(row),
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
  if (version !== 1 && version !== 2 && version !== 3) {
    return {
      projects: [],
      fields: [],
      entries: [],
      rejections: [{ line: 'N/A', reason: `Unsupported export version: ${String(version)}` }],
    };
  }

  const projectRows = Array.isArray(parsed.projects) ? parsed.projects : [];
  const fieldRows = version >= 2 && Array.isArray(parsed.fields) ? parsed.fields : [];
  const blockedProjects = new Set<string>();
  if (version === 3 && !Array.isArray(parsed.fields)) {
    rejections.push({ line: 'N/A', reason: 'JSON v3 requires a fields array' });
    projectRows.forEach((row) => {
      if (isPlainObject(row) && typeof row.project_name === 'string')
        blockedProjects.add(row.project_name.trim());
    });
  }
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
      if (isPlainObject(row) && typeof row.table_name === 'string')
        blockedProjects.add(row.table_name.trim());
      else
        projectRows.forEach((project) => {
          if (isPlainObject(project) && typeof project.project_name === 'string')
            blockedProjects.add(project.project_name.trim());
        });
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

  const validEntries = entries.filter((entry): entry is ExportedEntry => entry !== null);
  const validFields = fields.filter((field): field is ExportedField => field !== null);
  // Derive requirements from actual references, never trust a supplied manifest to waive reupload.
  const attachments = buildAttachmentManifest(validEntries, validFields);
  return {
    version,
    blockedProjects: [...blockedProjects],
    attachments,
    projects: projects.filter((project): project is ExportedProject => project !== null),
    fields: fields.filter((field): field is ExportedField => field !== null),
    entries: entries.filter((entry): entry is ExportedEntry => entry !== null),
    rejections,
  };
}

export interface ImportOutcome {
  projects: number;
  fields: number;
  entries: number;
  failures: string[];
  notRestored: { entryIndex: number; projectName: string; reason: string; errors?: unknown }[];
}

type AdapterResult = {
  success?: boolean;
  queued?: boolean;
  pending?: boolean;
  _optimistic?: boolean;
  message?: string;
  errors?: unknown;
  field_errors?: unknown;
  data?: any;
  fields?: ExportedField[];
  schema_revision?: number;
  option_id_map?: Record<string, string>;
};

export interface ImportAdapters {
  addProject: (
    email: string,
    name: string,
    description: string,
    schema: {
      fields: ExportedField[];
      template?: Record<string, unknown> | null;
      schema_revision?: number;
    }
  ) => Promise<AdapterResult>;
  addEntry: (
    email: string,
    entry: ExportedEntry,
    schemaRevision?: number
  ) => Promise<AdapterResult>;
  archiveEntry: (email: string, projectName: string, id: string) => Promise<AdapterResult>;
  archiveProject: (email: string, projectName: string) => Promise<AdapterResult>;
  uploadFieldAttachment?: (input: {
    email: string;
    projectName: string;
    fieldId: string;
    file: File;
  }) => Promise<AdapterResult>;
  isOnline?: () => boolean;
}

function confirmed(response: AdapterResult | undefined): boolean {
  const row = Array.isArray(response?.data) ? response?.data[0] : response?.data;
  return (
    response?.success === true &&
    !response.queued &&
    !response.pending &&
    !response._optimistic &&
    !row?._optimistic &&
    !row?.pending &&
    !String(row?.id ?? '').startsWith('optimistic-')
  );
}

function failureMessage(error: unknown): string {
  if (isPlainObject(error) || error instanceof Error) {
    const detail = error as AdapterResult;
    const errors = detail.errors ?? detail.field_errors;
    return `${detail.message || 'Server did not confirm persistence'}${errors ? `: ${JSON.stringify(errors)}` : ''}`;
  }
  return String(error);
}

export function importAttachmentRequirements(result: ImportResult): AttachmentManifestItem[] {
  return buildAttachmentManifest(result.entries, result.fields);
}

export async function restoreImport(
  result: ImportResult,
  email: string,
  adapters: ImportAdapters,
  files: ReadonlyMap<string, File> = new Map()
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = {
    projects: 0,
    fields: 0,
    entries: 0,
    failures: [],
    notRestored: [],
  };
  const online = adapters.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
  const requireOnline = () => {
    if (!online())
      throw new Error('Import requires connectivity; no records were queued by the importer');
  };
  const schemas = new Map<
    string,
    { fields: ExportedField[]; revision?: number; optionMap: Record<string, string> }
  >();
  const requirements = importAttachmentRequirements(result);
  if (!email || !online()) {
    outcome.failures.push('Sign in and connect before restoring data');
    return outcome;
  }
  const duplicateNames = new Set(
    result.projects
      .filter(
        (project, index, all) =>
          all.findIndex((item) => item.project_name === project.project_name) !== index
      )
      .map((project) => project.project_name)
  );
  for (const project of result.projects) {
    const fields = result.fields.filter((field) => field.table_name === project.project_name);
    try {
      requireOnline();
      if (
        result.blockedProjects?.includes(project.project_name) ||
        duplicateNames.has(project.project_name)
      ) {
        throw new Error('Invalid or duplicate project schema; project was not created');
      }
      if (new Set(fields.map((field) => field.field_name)).size !== fields.length)
        throw new Error('Duplicate field names');
      if (
        fields.some(
          (field) => ['file', 'image'].includes(field.data_type ?? '') && field.has_default
        )
      ) {
        throw new Error('Attachment defaults cannot be imported');
      }
      const response = await adapters.addProject(email, project.project_name, project.description, {
        fields,
        ...projectSchemaMetadata(project),
        template:
          project.template ??
          project.template_provenance ??
          (project.source_template_id
            ? { id: project.source_template_id, revision: project.source_template_revision }
            : undefined),
      });
      if (!confirmed(response)) throw response;
      outcome.projects++;
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      const canonical = response.fields ?? data?.fields;
      if (
        fields.length &&
        (!Array.isArray(canonical) ||
          fields.some(
            (field) =>
              !canonical.some(
                (created: ExportedField) => created.field_name === field.field_name && created.id
              )
          ))
      ) {
        throw new Error(
          'Project created, but canonical schema was not returned; entries were not restored'
        );
      }
      outcome.fields += fields.length;
      schemas.set(project.project_name, {
        fields: canonical ?? [],
        revision: response.schema_revision ?? data?.schema_revision,
        optionMap: response.option_id_map ?? data?.option_id_map ?? {},
      });
    } catch (error) {
      outcome.failures.push(`Project "${project.project_name}": ${failureMessage(error)}`);
    }
  }
  for (const field of result.fields) {
    if (!result.projects.some((project) => project.project_name === field.table_name)) {
      outcome.failures.push(
        `Field "${field.field_name}": project "${field.table_name}" is missing`
      );
    }
  }
  for (const [entryIndex, entry] of result.entries.entries()) {
    try {
      requireOnline();
      const schema = schemas.get(entry.project_name);
      if (!schema) throw new Error('Project schema was not restored');
      const payload: EntryPayload = JSON.parse(JSON.stringify(entry.entries));
      const assets = requirements.filter((item) => item.entry_index === entryIndex);
      // Validate every dependency before uploading any binary or persisting this entry.
      for (const asset of assets) {
        const field = schema.fields.find((candidate) => candidate.field_name === asset.field_name);
        if (
          asset.path.length !== 1 ||
          !field?.id ||
          !['file', 'image'].includes(field.data_type ?? '')
        ) {
          throw new Error(
            `Attachment in "${asset.field_name}" has no compatible field; explicit conversion is required`
          );
        }
        if (!files.has(attachmentKey(asset)))
          throw new Error(
            `Missing binary for "${asset.field_name}"; reupload required, entry not restored`
          );
        if (!adapters.uploadFieldAttachment)
          throw new Error('Attachment upload adapter is unavailable; entry not restored');
      }
      if (isPlainObject(payload)) {
        for (const source of result.fields.filter(
          (field) => field.table_name === entry.project_name
        )) {
          const value = payload[source.field_name];
          if (
            value === undefined ||
            value === null ||
            !['select', 'multiselect'].includes(source.data_type ?? '')
          )
            continue;
          const created = schema.fields.find((field) => field.field_name === source.field_name);
          const mapId = (id: unknown) => {
            if (typeof id !== 'string') return id;
            const option = source.options?.find((item) => item.id === id);
            if (!option) return id;
            const mapped = schema.optionMap[id];
            if (mapped && created?.options?.some((item) => item.id === mapped)) return mapped;
            const matches =
              created?.options?.filter(
                (item) => item.label === option.label && item.value === option.value
              ) ?? [];
            if (matches.length !== 1)
              throw new Error(`Option mapping missing for "${source.field_name}"`);
            return matches[0].id;
          };
          if (source.data_type === 'multiselect' && Array.isArray(value))
            payload[source.field_name] = value.map(mapId);
          else if (source.data_type === 'select') payload[source.field_name] = mapId(value);
        }
        for (const asset of assets) {
          requireOnline();
          const field = schema.fields.find(
            (candidate) => candidate.field_name === asset.field_name
          )!;
          const uploaded = await adapters.uploadFieldAttachment!({
            email,
            projectName: entry.project_name,
            fieldId: field.id!,
            file: files.get(attachmentKey(asset))!,
          });
          const data = Array.isArray(uploaded.data) ? uploaded.data[0] : uploaded.data;
          const id = data?.attachmentId ?? data?.id;
          if (!confirmed(uploaded) || typeof id !== 'string' || !id || id === asset.attachment_id) {
            throw new Error(`Reupload failed for "${asset.field_name}"; entry not restored`);
          }
          payload[asset.field_name] = { attachmentId: id };
        }
      }
      requireOnline();
      const response = await adapters.addEntry(
        email,
        { ...entry, entries: payload },
        schema.revision
      );
      const data = Array.isArray(response.data) ? response.data[0] : response.data;
      if (!confirmed(response) || !data?.id) throw response;
      outcome.entries++;
      if (entry.archived) {
        try {
          requireOnline();
          const archived = await adapters.archiveEntry(email, entry.project_name, data.id);
          if (!confirmed(archived)) throw archived;
        } catch (error) {
          outcome.failures.push(
            `Entry ${entryIndex + 1} restored, but archive failed: ${failureMessage(error)}`
          );
        }
      }
    } catch (error) {
      const reason = failureMessage(error);
      outcome.notRestored.push({
        entryIndex,
        projectName: entry.project_name,
        reason,
        ...(isPlainObject(error) ? { errors: error.errors ?? error.field_errors } : {}),
      });
      outcome.failures.push(
        `Entry ${entryIndex + 1} in "${entry.project_name}" not restored: ${reason}`
      );
    }
  }
  for (const project of result.projects.filter(
    (item) => item.archived && schemas.has(item.project_name)
  )) {
    try {
      requireOnline();
      const response = await adapters.archiveProject(email, project.project_name);
      if (!confirmed(response)) throw response;
    } catch (error) {
      outcome.failures.push(
        `Project "${project.project_name}" restored, but archive failed: ${failureMessage(error)}`
      );
    }
  }
  return outcome;
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
