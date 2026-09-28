import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEntryTitle, type CalendarEntry } from '@/lib/calendar';

type Entry = Record<string, unknown>;

interface DueSoonRailProps {
  /** Entries already narrowed to the due-soon window (today → +3 days). */
  entries: Entry[];
}

const RAIL_COLLAPSE_KEY = 'dl_due_rail_collapsed';

function readRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** "Today" / "Tomorrow" / short date — the chip shown on a due-soon item. */
function formatRailDue(value?: string | null): string | null {
  if (!value) return null;
  const due = new Date(value);
  if (isNaN(due.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return dueDay.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Card-width right rail listing the entries due soon. Clicking an item opens
 * that entry inside its project (same behaviour as the old due-soon feed).
 * The tab on its left collapses/expands the whole rail — collapsed returns
 * the page to its pre-rail layout.
 */
export function DueSoonRail({ entries }: DueSoonRailProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => readRailCollapsed());

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSE_KEY, String(next));
      } catch {
        /* storage unavailable — the rail simply forgets its state */
      }
      return next;
    });
  };

  // Soonest due first so the most urgent entries sit at the top.
  const sorted = [...entries].sort((a, b) => {
    const da = new Date((a.due_date as string) || 0).getTime();
    const db = new Date((b.due_date as string) || 0).getTime();
    return da - db;
  });

  return (
    <div className={`dash-rail-col${collapsed ? ' dash-rail-col--collapsed' : ''}`}>
      <button
        type="button"
        className={`dash-rail-toggle${collapsed ? ' is-collapsed' : ''}`}
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand the due soon list' : 'Collapse the due soon list'}
        title={collapsed ? 'Show the due soon list' : 'Hide the due soon list'}
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
      </button>

      {!collapsed && (
        <aside className="dash-rail" aria-label="Due soon entries">
          <section className="dash-rail__section">
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
      )}
    </div>
  );
}

export default DueSoonRail;
