import { type CalendarEntry, getEntryTitle } from './calendar';

export interface TimelineEntry {
  id: string | number;
  title: string;
  project_name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  dependencies: (string | number)[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDependencies(entries: Record<string, unknown> | string | null): (string | number)[] {
  if (!entries) return [];
  const obj =
    typeof entries === 'string' ? (JSON.parse(entries) as Record<string, unknown>) : entries;

  const raw = obj.dependencies ?? obj.depends_on ?? obj.blocked_by ?? [];
  if (!Array.isArray(raw)) return [];

  return raw
    .map((dep) => (typeof dep === 'string' || typeof dep === 'number' ? dep : null))
    .filter((dep): dep is string | number => dep !== null);
}

/**
 * Resolves a start date for an entry.
 * Falls back to created_at, then to one day before the due date, then to today.
 */
function resolveStartDate(entry: CalendarEntry): Date | null {
  const started = parseDate(entry.started_at);
  if (started) return started;

  const created = parseDate(entry.created_at);
  if (created) return created;

  const due = parseDate(entry.due_date);
  if (due) return new Date(due.getTime() - MS_PER_DAY);

  return null;
}

/**
 * Resolves an end date for an entry.
 * Falls back to one day after the start date, then to today.
 */
function resolveEndDate(entry: CalendarEntry, startDate: Date): Date | null {
  const due = parseDate(entry.due_date);
  if (due) return due;

  const ended = parseDate(entry.ended_at);
  if (ended) return ended;

  return new Date(startDate.getTime() + MS_PER_DAY);
}

/**
 * Converts raw entries into timeline entries with normalised start/end dates
 * and dependency IDs.
 */
export function parseTimelineEntries(entries: CalendarEntry[]): TimelineEntry[] {
  const result: TimelineEntry[] = [];

  for (const entry of entries) {
    if (entry.archived || entry.status === 'done_and_dusted') continue;

    const startDate = resolveStartDate(entry);
    if (!startDate) continue;

    const endDate = resolveEndDate(entry, startDate);
    if (!endDate) continue;

    result.push({
      id: entry.id,
      title: getEntryTitle(entry),
      project_name: entry.project_name,
      status: entry.status ?? 'up_next',
      startDate,
      endDate,
      dependencies: parseDependencies(entry.entries),
    });
  }

  return result;
}

/**
 * Returns the earliest start and latest end dates among timeline entries.
 */
export function getTimelineBounds(entries: TimelineEntry[]): { start: Date; end: Date } | null {
  if (entries.length === 0) return null;

  let start = entries[0].startDate;
  let end = entries[0].endDate;

  for (const entry of entries) {
    if (entry.startDate < start) start = entry.startDate;
    if (entry.endDate > end) end = entry.endDate;
  }

  return { start: new Date(start), end: new Date(end) };
}

/**
 * Expands a date range so the timeline always shows at least `minDays`.
 */
export function ensureMinimumRange(
  bounds: { start: Date; end: Date },
  minDays = 35
): { start: Date; end: Date } {
  const start = new Date(bounds.start);
  const end = new Date(bounds.end);
  const diffDays = (end.getTime() - start.getTime()) / MS_PER_DAY;

  if (diffDays < minDays) {
    const extra = Math.ceil(minDays - diffDays);
    end.setDate(end.getDate() + extra);
  }

  return { start, end };
}

export interface TimelineRowItem {
  entry: TimelineEntry;
  row: number;
}

export interface TimelineLayout {
  items: TimelineRowItem[];
  rowCount: number;
}

/**
 * Assigns rows greedily so horizontally overlapping bars do not collide.
 * This keeps dependency chains readable because sequential tasks tend to
 * land on different rows, leaving room for arrows between them.
 */
export function layoutTimelineRows(entries: TimelineEntry[]): TimelineLayout {
  const sorted = [...entries].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const rows: TimelineEntry[][] = [];
  const items: TimelineRowItem[] = [];

  for (const entry of sorted) {
    let placed = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const overlaps = row.some(
        (existing) =>
          entry.startDate.getTime() <= existing.endDate.getTime() &&
          entry.endDate.getTime() >= existing.startDate.getTime()
      );
      if (!overlaps) {
        row.push(entry);
        items.push({ entry, row: i });
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([entry]);
      items.push({ entry, row: rows.length - 1 });
    }
  }

  return { items, rowCount: rows.length };
}

export interface TimelineRenderItem {
  entry: TimelineEntry;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineRenderLayout {
  items: TimelineRenderItem[];
  rowCount: number;
  totalWidth: number;
  totalHeight: number;
}

export interface TimelineRenderOptions {
  dayWidth: number;
  rowHeight: number;
  barHeight: number;
  range: { start: Date; end: Date };
  paddingX?: number;
  paddingY?: number;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / MS_PER_DAY;
}

/**
 * Computes pixel coordinates for bars and the overall canvas size.
 */
export function computeTimelineRenderLayout(
  layout: TimelineLayout,
  options: TimelineRenderOptions
): TimelineRenderLayout {
  const { dayWidth, rowHeight, barHeight, range, paddingX = 16, paddingY = 24 } = options;
  const totalDays = Math.max(1, daysBetween(range.start, range.end));
  const totalWidth = totalDays * dayWidth + paddingX * 2;
  const totalHeight = Math.max(layout.rowCount, 1) * rowHeight + paddingY * 2;

  const items = layout.items.map(({ entry, row }) => {
    const startOffset = daysBetween(range.start, entry.startDate);
    const duration = Math.max(0.25, daysBetween(entry.startDate, entry.endDate));
    const x = paddingX + startOffset * dayWidth;
    const width = duration * dayWidth;
    const y = paddingY + row * rowHeight + (rowHeight - barHeight) / 2;
    return { entry, row, x, y, width, height: barHeight };
  });

  return { items, rowCount: layout.rowCount, totalWidth, totalHeight };
}

export interface TimelineArrow {
  id: string;
  d: string;
}

/**
 * Builds SVG path data for dependency arrows.
 * Arrows leave the right edge of the predecessor and enter the left edge
 * of the successor, with a gentle S-curve when rows differ.
 */
export function buildDependencyArrows(renderItems: TimelineRenderItem[]): TimelineArrow[] {
  const byId = new Map<string | number, TimelineRenderItem>();
  for (const item of renderItems) {
    byId.set(item.entry.id, item);
  }

  const arrows: TimelineArrow[] = [];

  for (const target of renderItems) {
    for (const depId of target.entry.dependencies) {
      const source = byId.get(depId);
      if (!source) continue;

      const x1 = source.x + source.width;
      const y1 = source.y + source.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;
      const midX = (x1 + x2) / 2;

      const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
      arrows.push({ id: `${source.entry.id}-${target.entry.id}`, d });
    }
  }

  return arrows;
}
