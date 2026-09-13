/**
 * Pure date helpers for the Calendar page.
 * All functions operate on vanilla Date objects and avoid mutable inputs.
 */

import { type EntryPayload, getEntryPayloadTitle, cleanSummaryText } from '@/lib/entryPayload';

export type CalendarView = 'month' | 'week';

export interface CalendarEntry {
  id: string | number;
  user_email: string;
  project_name: string;
  entries: EntryPayload;
  due_date: string | null;
  priority: string | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration?: string | null;
  archived?: boolean;
  summary?: string | null;
  created_at?: string;
}

export function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfWeek(date: Date, weekStartsOn: 0 | 1 = 0): Date {
  const d = stripTime(date);
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(date: Date, weekStartsOn: 0 | 1 = 0): Date {
  const start = startOfWeek(date, weekStartsOn);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = stripTime(start);
  const last = stripTime(end);
  while (current <= last) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export function formatShortDay(date: Date): string {
  return date.toLocaleDateString('en-ZA', { weekday: 'short' });
}

export function formatDayNumber(date: Date): number {
  return date.getDate();
}

export function parseDueDate(dueDate: string | null | undefined): Date | null {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  return isNaN(d.getTime()) ? null : d;
}

export function getEntriesForDay(entries: CalendarEntry[], day: Date): CalendarEntry[] {
  return entries.filter((entry) => {
    const due = parseDueDate(entry.due_date);
    return due ? isSameDay(due, day) : false;
  });
}

export function getEntryTitle(entry: CalendarEntry): string {
  // Prefer the AI-generated summary if available. cleanSummaryText guards
  // against the historical bug where a notes payload was written into the
  // summary column verbatim, which would otherwise render as raw JSON.
  const safe = cleanSummaryText(entry.summary);
  if (safe) return safe;

  if (entry.entries == null) return `${entry.project_name} entry`;

  let payload: unknown = entry.entries;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      // Plain-text legacy entries remain plain text.
    }
  }

  const title = getEntryPayloadTitle(payload);
  return title === 'Not recorded' ? `${entry.project_name} entry` : title;
}

export function buildMonthGrid(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const gridStart = startOfWeek(monthStart, weekStartsOn);
  const gridEnd = endOfWeek(monthEnd, weekStartsOn);
  return eachDay(gridStart, gridEnd);
}

export function buildWeekGrid(date: Date, weekStartsOn: 0 | 1 = 0): Date[] {
  const start = startOfWeek(date, weekStartsOn);
  const end = endOfWeek(date, weekStartsOn);
  return eachDay(start, end);
}
