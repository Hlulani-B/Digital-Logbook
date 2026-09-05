import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAllEntries } from '@/functions/project/entries.js';
import { type CalendarEntry } from '@/lib/calendar';
import {
  buildDependencyArrows,
  computeTimelineRenderLayout,
  ensureMinimumRange,
  getTimelineBounds,
  layoutTimelineRows,
  parseTimelineEntries,
  type TimelineRenderItem,
} from '@/lib/timeline';
import './Timeline.css';

const ROW_HEIGHT = 56;
const BAR_HEIGHT = 32;
const HEADER_HEIGHT = 40;
const ZOOM_LEVELS = [0.5, 1, 1.5, 2, 3, 4];

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
}

function getStatusClass(status: string): string {
  if (status === 'done_and_dusted') return 'timeline-bar--done';
  if (status === 'in_motion') return 'timeline-bar--active';
  return 'timeline-bar--upcoming';
}

function getPriorityClass(priority: string | null): string {
  if (!priority) return '';
  if (priority.includes('Urgent and important')) return 'timeline-bar--urgent';
  if (priority.includes('Urgent but not important')) return 'timeline-bar--high';
  return '';
}

interface TimelineBarProps {
  item: TimelineRenderItem;
  priority: string | null;
  onClick: () => void;
}

function TimelineBar({ item, priority, onClick }: TimelineBarProps) {
  const { entry, x, y, width, height } = item;
  const statusClass = getStatusClass(entry.status);
  const priorityClass = getPriorityClass(priority);

  return (
    <g className="timeline-bar-group" onClick={onClick}>
      <rect
        className={['timeline-bar', statusClass, priorityClass].filter(Boolean).join(' ')}
        x={x}
        y={y}
        width={Math.max(width, 4)}
        height={height}
        rx={6}
        ry={6}
      />
      {width > 60 && (
        <text
          className="timeline-bar-label"
          x={x + 8}
          y={y + height / 2}
          dominantBaseline="central"
        >
          {entry.title}
        </text>
      )}
    </g>
  );
}

export function TimelinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? '';
  const scrollRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomIndex, setZoomIndex] = useState(1);

  const loadData = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getAllEntries(email);
      if (result?.success === false) {
        setError(result.message || 'Failed to load entries');
      } else {
        const data = (result?.data || []).filter((entry: CalendarEntry) => !entry.archived);
        setEntries(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dayWidth = ZOOM_LEVELS[zoomIndex] * 80;

  const { timelineEntries, range, renderLayout, arrows } = useMemo(() => {
    const timelineEntries = parseTimelineEntries(entries);
    const bounds = getTimelineBounds(timelineEntries);
    const range = bounds ? ensureMinimumRange(bounds, 35) : null;

    if (!range) {
      return { timelineEntries: [], range: null, renderLayout: null, arrows: [] };
    }

    const layout = layoutTimelineRows(timelineEntries);
    const renderLayout = computeTimelineRenderLayout(layout, {
      dayWidth,
      rowHeight: ROW_HEIGHT,
      barHeight: BAR_HEIGHT,
      range,
    });
    const arrows = buildDependencyArrows(renderLayout.items);

    return { timelineEntries, range, renderLayout, arrows };
  }, [entries, dayWidth]);

  const todayX = useMemo(() => {
    if (!range) return null;
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const offsetDays = (now.getTime() - range.start.getTime()) / msPerDay;
    return 16 + offsetDays * dayWidth;
  }, [range, dayWidth]);

  const gridLines = useMemo(() => {
    if (!range) return [];
    const lines: { x: number; label: string; isMonthStart: boolean }[] = [];
    const current = new Date(range.start);
    current.setHours(0, 0, 0, 0);

    while (current <= range.end) {
      const offsetDays = (current.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000);
      const x = 16 + offsetDays * dayWidth;
      lines.push({
        x,
        label: formatMonthDay(current),
        isMonthStart: current.getDate() === 1,
      });
      current.setDate(current.getDate() + 1);
    }

    return lines;
  }, [range, dayWidth]);

  const handleZoomIn = () => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  };

  const handleZoomOut = () => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  };

  const handleEntryClick = (entryId: string | number) => {
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      navigate(`/project/${encodeURIComponent(entry.project_name)}`);
    }
  };

  return (
    <div className="timeline-page">
      <div className="timeline-page-header">
        <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Dashboard
        </button>
        <div className="timeline-page-titles">
          <h1 className="timeline-page-title">Timeline</h1>
          <p className="timeline-page-subtitle">
            Bars span start to due date; arrows show dependencies.
          </p>
        </div>
        <div className="timeline-zoom">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleZoomOut}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="timeline-zoom-level">{Math.round(ZOOM_LEVELS[zoomIndex] * 100)}%</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleZoomIn}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {error && (
        <div className="timeline-error" role="alert">
          {error}
          <button type="button" className="timeline-error-close" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="timeline-loading">
          <span className="timeline-spinner" />
          Loading timeline…
        </div>
      ) : timelineEntries.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <h2 className="timeline-empty-title">No timeline data</h2>
          <p className="timeline-empty-message">
            There are no dated, incomplete tasks to display. Add entries with start and due dates,
            or set dependencies in the task details to see them linked here.
          </p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="timeline-scroll" ref={scrollRef}>
          <svg
            className="timeline-svg"
            width={renderLayout?.totalWidth}
            height={(renderLayout?.totalHeight ?? 0) + HEADER_HEIGHT}
          >
            <g transform={`translate(0, ${HEADER_HEIGHT})`}>
              {/* Grid lines and date labels */}
              {gridLines.map((line, index) => (
                <g key={index}>
                  <line
                    className={`timeline-grid ${line.isMonthStart ? 'timeline-grid--month' : ''}`}
                    x1={line.x}
                    y1={0}
                    x2={line.x}
                    y2={renderLayout?.totalHeight ?? 0}
                  />
                  <text
                    className={`timeline-grid-label ${line.isMonthStart ? 'timeline-grid-label--month' : ''}`}
                    x={line.x + 4}
                    y={-8}
                  >
                    {line.label}
                  </text>
                </g>
              ))}

              {/* Today marker */}
              {todayX !== null && todayX >= 0 && (
                <line
                  className="timeline-today"
                  x1={todayX}
                  y1={0}
                  x2={todayX}
                  y2={renderLayout?.totalHeight ?? 0}
                />
              )}

              {/* Dependency arrows */}
              {arrows.map((arrow) => (
                <path
                  key={arrow.id}
                  className="timeline-arrow"
                  d={arrow.d}
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
              ))}

              {/* Task bars */}
              {renderLayout?.items.map((item) => {
                const entry = entries.find((e) => e.id === item.entry.id);
                return (
                  <TimelineBar
                    key={item.entry.id}
                    item={item}
                    priority={entry?.priority ?? null}
                    onClick={() => handleEntryClick(item.entry.id)}
                  />
                );
              })}
            </g>

            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" className="timeline-arrow-head" />
              </marker>
            </defs>
          </svg>
        </div>
      )}
    </div>
  );
}
