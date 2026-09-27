import { classifyEntryPayload } from '@/lib/entryPayload';
import type { FieldDefinition } from '@/lib/fieldSchema';
import { isNumericField } from '@/lib/fieldSchema';

export type NumericFilterMode = 'above' | 'below' | 'between';

/** One field's filter state. Numeric fields use above/below/between, others use contains. */
export interface FieldFilterState {
  mode: NumericFilterMode | 'contains';
  /** Single value for above/below/contains */
  value: string;
  /** Bounds for the between mode */
  min: string;
  max: string;
}

export type FieldFilters = Record<string, FieldFilterState>;

export function defaultFilterState(field: FieldDefinition): FieldFilterState {
  return {
    mode: isNumericField(field.data_type) ? 'above' : 'contains',
    value: '',
    min: '',
    max: '',
  };
}

export function isFilterActive(filter: FieldFilterState | undefined): boolean {
  if (!filter) return false;
  if (filter.mode === 'between') return filter.min.trim() !== '' || filter.max.trim() !== '';
  return filter.value.trim() !== '';
}

/** Number of fields with an active filter — drives the badge on the Filters button. */
export function activeFilterCount(filters: FieldFilters): number {
  return Object.values(filters).filter(isFilterActive).length;
}

/** The entry payload as an object (entries may be stored as a JSON string). */
export function getPayloadObject(row: Record<string, unknown>): Record<string, unknown> {
  const state = classifyEntryPayload(row?.entries);
  return state.kind === 'object' ? state.value : {};
}

/** Pinned entries carry a reserved `_pinned` key inside the entries payload. */
export function isPinnedEntry(row: Record<string, unknown>): boolean {
  return getPayloadObject(row)._pinned === true;
}

/** Pinned entries first, everything else keeps its existing order. */
export function pinFirst<T extends Record<string, unknown>>(rows: T[]): T[] {
  const pinned: T[] = [];
  const rest: T[] = [];
  for (const row of rows) {
    if (isPinnedEntry(row)) pinned.push(row);
    else rest.push(row);
  }
  return [...pinned, ...rest];
}

/**
 * Regular (non-AI) search: matches against the summary, the project name and
 * every visible field value in the entry payload (reserved `_` keys excluded).
 */
export function matchesTextQuery(row: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const summary = typeof row.summary === 'string' ? row.summary : '';
  const project = typeof row.project_name === 'string' ? row.project_name : '';
  if (summary.toLowerCase().includes(q) || project.toLowerCase().includes(q)) return true;

  for (const [key, value] of Object.entries(getPayloadObject(row))) {
    if (key.startsWith('_')) continue;
    if (value == null) continue;
    if (typeof value === 'object') {
      try {
        if (JSON.stringify(value).toLowerCase().includes(q)) return true;
      } catch {
        // Unserializable value — skip it
      }
    } else if (String(value).toLowerCase().includes(q)) {
      return true;
    }
  }
  return false;
}

function matchesFilter(value: unknown, filter: FieldFilterState): boolean {
  if (!isFilterActive(filter)) return true;

  if (filter.mode === 'contains') {
    if (value == null) return false;
    const text =
      typeof value === 'object' ? (JSON.stringify(value) ?? '') : String(value as string | number);
    return text.toLowerCase().includes(filter.value.trim().toLowerCase());
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return false;

  if (filter.mode === 'above') {
    const bound = Number(filter.value);
    return Number.isFinite(bound) && num > bound;
  }
  if (filter.mode === 'below') {
    const bound = Number(filter.value);
    return Number.isFinite(bound) && num < bound;
  }
  // between — an empty bound means "unbounded" on that side
  const min = filter.min.trim() === '' ? -Infinity : Number(filter.min);
  const max = filter.max.trim() === '' ? Infinity : Number(filter.max);
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  return num >= min && num <= max;
}

/** Apply every active field filter (AND logic) to a list of entries. */
export function applyFieldFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: FieldFilters
): T[] {
  const active = Object.entries(filters).filter(([, f]) => isFilterActive(f));
  if (active.length === 0) return rows;
  return rows.filter((row) => {
    const payload = getPayloadObject(row);
    return active.every(([field, filter]) => matchesFilter(payload[field], filter));
  });
}

/**
 * Filters for the all-entries feed. Entries there are mixed across projects, so
 * instead of per-project field filters the criteria are project-level: the
 * project's name, how many entries it has and how many fields it defines.
 */
export interface ProjectFilters {
  /** Selected project name ('' = every project) */
  projectName: string;
  /** Number of entries in the entry's project */
  entryCount: FieldFilterState;
  /** Number of fields defined on the entry's project */
  fieldCount: FieldFilterState;
}

/** Counts per project name — entry counts plus field counts. */
export interface ProjectCounts {
  entryCounts: Record<string, number>;
  fieldCounts: Record<string, number>;
}

export function defaultProjectFilters(): ProjectFilters {
  const numeric = (): FieldFilterState => ({ mode: 'above', value: '', min: '', max: '' });
  return { projectName: '', entryCount: numeric(), fieldCount: numeric() };
}

/** Number of active project criteria — drives the badge on the filter icon. */
export function activeProjectFilterCount(filters: ProjectFilters): number {
  let count = filters.projectName.trim() === '' ? 0 : 1;
  if (isFilterActive(filters.entryCount)) count += 1;
  if (isFilterActive(filters.fieldCount)) count += 1;
  return count;
}

/** Apply every active project filter (AND logic) to a list of entries. */
export function applyProjectFilters<T extends Record<string, unknown>>(
  rows: T[],
  filters: ProjectFilters,
  counts: ProjectCounts
): T[] {
  const name = filters.projectName.trim().toLowerCase();
  const entryActive = isFilterActive(filters.entryCount);
  const fieldActive = isFilterActive(filters.fieldCount);
  if (!name && !entryActive && !fieldActive) return rows;

  return rows.filter((row) => {
    const project = typeof row.project_name === 'string' ? row.project_name : '';
    if (name && project.toLowerCase() !== name) return false;
    // Unknown counts fall back to 0 — a project with no cached fields has none.
    if (entryActive && !matchesFilter(counts.entryCounts[project] ?? 0, filters.entryCount)) {
      return false;
    }
    if (fieldActive && !matchesFilter(counts.fieldCounts[project] ?? 0, filters.fieldCount)) {
      return false;
    }
    return true;
  });
}
