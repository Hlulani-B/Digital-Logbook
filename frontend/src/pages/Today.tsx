import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isOverdue } from '@/functions/dashboard/overdue.js';
import { type CalendarEntry, getEntryTitle, parseDueDate } from '@/lib/calendar';
import { getTodaySections, hasNothingToDo } from '@/lib/today';
import './Today.css';
import { NavBar } from '@/components/NavBar';
import { Header } from '@/components/Header';
import { cacheGet, CACHE_STORES } from '@/lib/cache';
import { syncAllData } from '@/CacheFunctions';

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getPriorityClass(priority: string | null): string {
  if (!priority) return '';
  if (priority.includes('Urgent and important')) return 'today-priority--urgent';
  if (priority.includes('Urgent but not important')) return 'today-priority--high';
  if (priority.includes('Not urgent')) return 'today-priority--low';
  return '';
}

interface TodayCardProps {
  entry: CalendarEntry;
  onClick: () => void;
}

function TodayCard({ entry, onClick }: TodayCardProps) {
  const status = entry.status ?? 'up_next';
  const due = parseDueDate(entry.due_date);
  const overdue = isOverdue(entry.due_date ?? null, status);
  const priorityClass = getPriorityClass(entry.priority ?? null);

  return (
    <button className="today-card" onClick={onClick} type="button">
      <div className="today-card-main">
        <span
          className={['today-card-title', overdue && 'today-card-title--overdue']
            .filter(Boolean)
            .join(' ')}
        >
          {getEntryTitle(entry)}
        </span>
        <span className="today-card-project">{entry.project_name}</span>
      </div>
      <div className="today-card-meta">
        {due && (
          <span className={`today-card-due ${overdue ? 'today-card-due--overdue' : ''}`}>
            {overdue ? 'Overdue' : formatShortDate(due)}
          </span>
        )}
        {entry.priority && (
          <span className={['today-card-priority', priorityClass].filter(Boolean).join(' ')}>
            {entry.priority}
          </span>
        )}
        {entry.status === 'in_motion' && (
          <span className="today-card-status today-card-status--active">In motion</span>
        )}
      </div>
    </button>
  );
}

interface TodaySectionProps {
  title: string;
  subtitle: string;
  entries: CalendarEntry[];
  variant: 'urgent' | 'today' | 'progress';
  onEntryClick: (entry: CalendarEntry) => void;
}

function TodaySection({ title, subtitle, entries, variant, onEntryClick }: TodaySectionProps) {
  if (entries.length === 0) return null;

  return (
    <section className={`today-section today-section--${variant}`}>
      <div className="today-section-header">
        <h2 className="today-section-title">{title}</h2>
        <p className="today-section-subtitle">{subtitle}</p>
      </div>
      <div className="today-section-list">
        {entries.map((entry) => (
          <TodayCard key={entry.id} entry={entry} onClick={() => onEntryClick(entry)} />
        ))}
      </div>
    </section>
  );
}

export function TodayPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? '';

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data — read ONLY from IndexedDB. Mutations update it directly.
  const loadData = useCallback(async () => {
    if (!email) return;
    setError(null);
    try {
      const cached = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
      if (cached?.data) {
        const data = (Array.isArray(cached.data) ? cached.data : []).filter((e: CalendarEntry) => !e.archived);
        setEntries(data);
      } else {
        // First visit ever — trigger initial sync
        setLoading(true);
        await syncAllData(email);
        const fresh = await cacheGet(CACHE_STORES.ALL_ENTRIES, email);
        if (fresh?.data) {
          const data = (Array.isArray(fresh.data) ? fresh.data : []).filter((entry: CalendarEntry) => !entry.archived);
          setEntries(data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today view');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const sections = useMemo(() => getTodaySections(entries), [entries]);
  const nothingToDo = useMemo(() => hasNothingToDo(sections), [sections]);

  const handleEntryClick = (entry: CalendarEntry) => {
    navigate(`/project/${encodeURIComponent(entry.project_name)}`);
  };

  return (
    <div className="dash-layout">
      <div className="bg-mesh" />
      <NavBar entries={entries as unknown as Array<Record<string, unknown>>} activeView="all" />
      <main className="dash-main">
        <Header title="Today" entries={entries as unknown as Array<Record<string, unknown>>} />
        <div className="today-page">

      {error && (
        <div className="today-error" role="alert">
          {error}
          <button type="button" className="today-error-close" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="today-loading">
          <span className="today-spinner" />
          Loading today…
        </div>
      ) : nothingToDo ? (
        <div className="today-empty">
          <div className="today-empty-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h2 className="today-empty-title">You are all caught up</h2>
          <p className="today-empty-message">
            Nothing is overdue, due today, or in progress. Enjoy the moment, or head to the
            dashboard to plan your next task.
          </p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="today-sections">
          <TodaySection
            title="Overdue"
            subtitle="These deadlines have already passed — handle them first."
            entries={sections.overdue}
            variant="urgent"
            onEntryClick={handleEntryClick}
          />
          <TodaySection
            title="Due today"
            subtitle="Commitments that need to be finished today."
            entries={sections.dueToday}
            variant="today"
            onEntryClick={handleEntryClick}
          />
          <TodaySection
            title="In progress"
            subtitle="Work you have already started and may want to continue."
            entries={sections.inProgress}
            variant="progress"
            onEntryClick={handleEntryClick}
          />
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
