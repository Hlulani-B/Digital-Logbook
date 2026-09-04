import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAllEntries, updateEntry } from '@/functions/project/entries.js';
import { isOverdue } from '@/functions/dashboard/overdue.js';
import { cacheGet, cacheSet } from '@/lib/cache.js';
import { ProfileMenu } from '@/components/ProfileMenu';
import {
  type CalendarEntry,
  type CalendarView,
  buildMonthGrid,
  buildWeekGrid,
  formatMonthYear,
  formatShortDay,
  formatDayNumber,
  getEntriesForDay,
  getEntryTitle,
  isSameDay,
  addDays,
  addMonths,
  parseDueDate,
} from '@/lib/calendar';
import './Calendar.css';

const WEEK_STARTS_ON: 0 | 1 = 0; // Sunday
const VISIBLE_TASKS_PER_CELL = 4;

type DragState = {
  entry: CalendarEntry;
  sourceDate: Date | null;
} | null;

function toISODate(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function parseEntryObject(entries: CalendarEntry['entries']): Record<string, unknown> {
  if (!entries) return {};
  if (typeof entries === 'string') {
    try {
      return JSON.parse(entries);
    } catch {
      return {};
    }
  }
  return entries;
}

function CalendarDayCell({
  date,
  isCurrentMonth,
  entries,
  dragging,
  onDragStart,
  onDrop,
  onEntryClick,
  isOverdue: isDayOverdue,
}: {
  date: Date;
  isCurrentMonth: boolean;
  entries: CalendarEntry[];
  dragging: DragState;
  onDragStart: (entry: CalendarEntry, sourceDate: Date) => void;
  onDrop: (date: Date) => void;
  onEntryClick: (entry: CalendarEntry) => void;
  isOverdue: (date: Date) => boolean;
}) {
  const isToday = isSameDay(date, new Date());
  const isDropTarget = dragging !== null;
  const visibleEntries = entries.slice(0, VISIBLE_TASKS_PER_CELL);
  const hiddenCount = Math.max(0, entries.length - VISIBLE_TASKS_PER_CELL);
  const dayOverdue = isDayOverdue(date);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(date);
  };

  return (
    <div
      className={[
        'calendar-day',
        !isCurrentMonth && 'calendar-day--outside',
        isToday && 'calendar-day--today',
        isDropTarget && 'calendar-day--drop-target',
        dayOverdue && 'calendar-day--overdue',
      ]
        .filter(Boolean)
        .join(' ')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-date={date.toISOString()}
    >
      <div className="calendar-day-header">
        <span className="calendar-day-number">{formatDayNumber(date)}</span>
        {isToday && <span className="calendar-day-today-label">Today</span>}
      </div>
      <div className="calendar-day-entries">
        {visibleEntries.map((entry) => (
          <CalendarEntryPill
            key={entry.id}
            entry={entry}
            draggable
            onDragStart={() => onDragStart(entry, date)}
            onClick={() => onEntryClick(entry)}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            className="calendar-more-btn"
            onClick={() => {}}
            title={`${hiddenCount} more task${hiddenCount === 1 ? '' : 's'}`}
          >
            +{hiddenCount} more
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarEntryPill({
  entry,
  draggable,
  onDragStart,
  onClick,
}: {
  entry: CalendarEntry;
  draggable?: boolean;
  onDragStart?: () => void;
  onClick?: () => void;
}) {
  const status = entry.status ?? 'up_next';
  const isCompleted = status === 'done_and_dusted';
  const overdue = isOverdue(entry.due_date ?? null, status);

  return (
    <div
      className={[
        'calendar-entry',
        isCompleted && 'calendar-entry--completed',
        overdue && 'calendar-entry--overdue',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(entry.id));
        onDragStart?.();
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick?.();
      }}
      title={`${getEntryTitle(entry)}${entry.project_name ? ` · ${entry.project_name}` : ''}`}
    >
      <span className="calendar-entry-title">{getEntryTitle(entry)}</span>
      <span className="calendar-entry-project">{entry.project_name}</span>
    </div>
  );
}

export function CalendarPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? '';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [dragging, setDragging] = useState<DragState>(null);
  const [updating, setUpdating] = useState(false);

  const loadEntries = useCallback(async () => {
    if (!email) return;
    setError(null);

    // Try cache first — show cached data immediately, no spinner
    const cacheKey = `calendar:${email}`;
    try {
      const cached = await cacheGet('entries', cacheKey);
      if (cached?.data && cached.data.length > 0) {
        setEntries(cached.data);
        setLoading(false);
      } else {
        // No cache — show spinner
        setLoading(true);
      }
    } catch {
      setLoading(true);
    }

    // Fetch fresh data in background
    try {
      const result = await getAllEntries(email);
      if (result?.success === false) {
        setError(result.message || 'Failed to load entries');
        return;
      }
      const data = (result?.data || []).filter(
        (entry: CalendarEntry) => !entry.archived && entry.due_date
      );
      setEntries(data);
      // Update cache
      await cacheSet('entries', cacheKey, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const gridDays = useMemo(() => {
    return view === 'month'
      ? buildMonthGrid(currentDate, WEEK_STARTS_ON)
      : buildWeekGrid(currentDate, WEEK_STARTS_ON);
  }, [currentDate, view]);

  const headerDays = useMemo(() => {
    const start = gridDays[0];
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [gridDays]);

  const isDayOverdue = useCallback((date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  }, []);

  const handlePrev = () => {
    setCurrentDate((prev) => (view === 'month' ? addMonths(prev, -1) : addDays(prev, -7)));
  };

  const handleNext = () => {
    setCurrentDate((prev) => (view === 'month' ? addMonths(prev, 1) : addDays(prev, 7)));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (entry: CalendarEntry, sourceDate: Date) => {
    setDragging({ entry, sourceDate });
  };

  const handleDrop = async (date: Date) => {
    if (!dragging || !email) return;
    const { entry } = dragging;
    setDragging(null);

    const originalDue = parseDueDate(entry.due_date);
    if (originalDue && isSameDay(originalDue, date)) return;

    setUpdating(true);
    try {
      const newDueDate = toISODate(date);
      const result = await updateEntry(
        email,
        entry.project_name,
        entry.id,
        parseEntryObject(entry.entries),
        newDueDate,
        entry.priority,
        entry.status ?? 'up_next',
        entry.started_at ?? null,
        entry.ended_at ?? null,
        entry.duration ?? null
      );

      if (result?.success === false) {
        setError(result.message || 'Failed to reschedule entry');
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, due_date: newDueDate } : e))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule entry');
    } finally {
      setUpdating(false);
    }
  };

  const handleEntryClick = (entry: CalendarEntry) => {
    navigate(`/project/${encodeURIComponent(entry.project_name)}`);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />

      {/* Top Navigation - same as Dashboard */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="nav-left-group">
            <button
              className="nav-hamburger"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label="Toggle menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <button
              className="nav-home-btn"
              onClick={() => navigate('/dashboard')}
              aria-label="Go to dashboard"
            >
              <div className="nav-logo">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  <path d="M8 7h6" />
                  <path d="M8 11h4" />
                </svg>
              </div>
              <span className="nav-title">Digital Logbook</span>
            </button>
          </div>
          <div className="nav-right-group">
            <div className="nav-user">
              <ProfileMenu
                displayName=""
                email={user?.email || ''}
                avatarUrl={undefined}
                onManageProfile={() => navigate('/create-profile')}
                onSettings={() => navigate('/dashboard')}
                onSignOut={handleLogout}
                signingOut={loggingOut}
              />
            </div>
          </div>
        </div>
      </nav>

      {/* Drawer Overlay */}
      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Drawer */}
      <aside className={`drawer ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="drawer-header">
          <span className="drawer-title">Navigation</span>
          <button className="drawer-close" onClick={() => setDrawerOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="drawer-section">
          <button className="drawer-item" onClick={() => { navigate('/dashboard'); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            Home
          </button>
          <button className="drawer-item" onClick={() => { navigate('/entries'); setDrawerOpen(false); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            All Entries
          </button>
          <button className="drawer-item active" onClick={() => setDrawerOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            Calendar
          </button>
        </div>
      </aside>

      <main className="dash-main">
      <div className="calendar-page">

      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button type="button" className="btn-icon" onClick={handlePrev} aria-label="Previous">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button type="button" className="btn-secondary" onClick={handleToday}>
            Today
          </button>
          <button type="button" className="btn-icon" onClick={handleNext} aria-label="Next">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <h2 className="calendar-period">{formatMonthYear(currentDate)}</h2>
        <div className="calendar-view-toggle">
          <button
            type="button"
            className={`btn-toggle ${view === 'month' ? 'active' : ''}`}
            onClick={() => setView('month')}
          >
            Month
          </button>
          <button
            type="button"
            className={`btn-toggle ${view === 'week' ? 'active' : ''}`}
            onClick={() => setView('week')}
          >
            Week
          </button>
        </div>
      </div>

      {error && (
        <div className="calendar-error" role="alert">
          {error}
          <button type="button" className="calendar-error-close" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {updating && (
        <div className="calendar-updating" aria-live="polite">
          <span className="calendar-spinner" />
          Updating due date…
        </div>
      )}

      {loading ? (
        <div className="calendar-loading">
          <span className="calendar-spinner" />
          Loading entries…
        </div>
      ) : entries.length === 0 ? (
        <div className="calendar-empty">
          <p>No scheduled entries yet.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Add an entry
          </button>
        </div>
      ) : (
        <div
          className={['calendar-grid', view === 'week' && 'calendar-grid--week']
            .filter(Boolean)
            .join(' ')}
        >
          {headerDays.map((day) => (
            <div key={day.toISOString()} className="calendar-header-cell">
              {formatShortDay(day)}
            </div>
          ))}
          {gridDays.map((day) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const dayEntries = getEntriesForDay(entries, day);
            return (
              <CalendarDayCell
                key={day.toISOString()}
                date={day}
                isCurrentMonth={view === 'week' || isCurrentMonth}
                entries={dayEntries}
                dragging={dragging}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onEntryClick={handleEntryClick}
                isOverdue={isDayOverdue}
              />
            );
          })}
        </div>
      )}

      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--overdue" />
          Overdue
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--completed" />
          Completed
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot calendar-legend-dot--upcoming" />
          Upcoming
        </span>
      </div>
      </div>
      </main>
    </div>
  );
}
