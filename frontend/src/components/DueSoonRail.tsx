import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntryTitle, type CalendarEntry } from '@/lib/calendar';
import { isDueSoon } from '@/functions/dashboard/overdue.js';
import { parseDueDateForDisplay, formatDueTime } from '@/lib/dueDateDisplay';

type Entry = Record<string, unknown>;

interface DueSoonRailProps {
  /** Entries already narrowed to the due-soon window (today → +3 days). */
  entries: Entry[];
}

/** "Today" / "Tomorrow" / short date — the chip shown on a due-soon item. */
function formatRailDue(value?: string | null): string | null {
  const parsed = parseDueDateForDisplay(value);
  if (!parsed) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate());
  const diffDays = Math.round((dueDay.getTime() - startOfToday.getTime()) / 86400000);
  // A saved due time rides alongside the relative date so the chip matches
  // the due-date surfaces; date-only entries keep their plain label.
  const time = parsed.hasTime ? ` \u00b7 ${formatDueTime(parsed.date, 'en-GB')}` : '';
  if (diffDays <= 0) return `Today${time}`;
  if (diffDays === 1) return `Tomorrow${time}`;
  return `${dueDay.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${time}`;
}

/**
 * Card-width right rail listing the entries due soon. Clicking an item opens
 * that entry inside its project (same behaviour as the old due-soon feed).
 * Open by default: the Hide button sits on the list itself, above a thin line
 * that separates it from the entries. Hiding collapses the rail into that same
 * thin line, which says "Show due soon list" and brings it back.
 */
export function DueSoonRail({ entries }: DueSoonRailProps) {
  const navigate = useNavigate();
  // Always starts open — hiding is a per-visit choice.
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => setCollapsed((prev) => !prev);

  // Defensive: apply the shared eligibility rule at the render boundary too —
  // a completed, archived or past-due entry must never appear in the rail,
  // even if a caller hands one over between state updates.
  const eligible = entries.filter((row) =>
    isDueSoon(row.due_date as string | null, row.status as string | null, row.archived as boolean)
  );

  // Soonest due first so the most urgent entries sit at the top.
  const sorted = [...eligible].sort((a, b) => {
    const da = new Date((a.due_date as string) || 0).getTime();
    const db = new Date((b.due_date as string) || 0).getTime();
    return da - db;
  });

  if (collapsed) {
    return (
      <div className="dash-rail-col dash-rail-col--collapsed">
        <button
          type="button"
          className="dash-rail-show"
          onClick={toggle}
          aria-expanded={false}
          aria-label="Show due soon list"
          title="Show the due soon list"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Show due soon list</span>
        </button>
      </div>
    );
  }

  return (
    <div className="dash-rail-col">
      <aside className="dash-rail" aria-label="Due soon entries">
        <section className="dash-rail__section">
          <div className="dash-rail__head">
            <h3 className="dash-rail__title">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Due soon</span>
              <span className="dash-rail__count">{sorted.length}</span>
            </h3>
            <button
              type="button"
              className="dash-rail__hide"
              onClick={toggle}
              aria-expanded={true}
              aria-label="Hide the due soon list"
              title="Hide the due soon list"
            >
              <span>Hide</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div className="dash-rail__list">
            {sorted.length === 0 ? (
              <p className="dash-rail__empty">Nothing due soon.</p>
            ) : (
              sorted.map((row, i) => {
                const due = formatRailDue((row.due_date as string) || null);
                const projectName = String(row.project_name || '');
                const title = getEntryTitle(row as unknown as CalendarEntry);
                return (
                  <button
                    key={`rail-due-${row.id || i}`}
                    type="button"
                    className="dash-rail__item"
                    onClick={() =>
                      navigate(
                        `/project/${encodeURIComponent(projectName)}?entry=${encodeURIComponent(String(row.id || ''))}`
                      )
                    }
                    title={title}
                  >
                    <span className="dash-rail__item-title">{title}</span>
                    <span className="dash-rail__item-meta">
                      <span className="dash-rail__item-project">{projectName}</span>
                      {due && <span className="dash-rail__due-chip">{due}</span>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default DueSoonRail;
