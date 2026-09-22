import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { checkAbandonedTimers, formatDuration } from '@/lib/timerAbandonment';
import type { CalendarEntry } from '@/lib/calendar';

interface TimerEntry extends CalendarEntry {
  paused_at?: string | null;
  deleted?: boolean;
}

interface AbandonedTimerBannerProps {
  entries: TimerEntry[];
  onNavigate?: (projectName: string) => void;
}

/**
 * Banner that appears when the user has entries with abandoned timers.
 * Shows immediately on app load if any timers have exceeded thresholds.
 */
export function AbandonedTimerBanner({ entries, onNavigate }: AbandonedTimerBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);

  const abandoned = useMemo(() => {
    if (!user?.email) return [];
    return checkAbandonedTimers(entries).filter((t) => !dismissed.includes(t.entry.id as string));
  }, [entries, user?.email, dismissed]);

  if (abandoned.length === 0) return null;

  const handleDismiss = (entryId: string) => {
    setDismissed((prev) => [...prev, entryId]);
  };

  const handleNavigate = (entry: TimerEntry) => {
    if (entry.project_name && onNavigate) {
      onNavigate(entry.project_name);
    }
  };

  return (
    <div
      style={{
        background: 'var(--surface, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: abandoned[0].type === 'timer_running_long' ? '#ea580c' : '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '1rem',
          }}
        >
          ⏱
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text, #111827)',
            }}
          >
            {abandoned.length === 1
              ? abandoned[0].type === 'timer_running_long'
                ? 'Timer still running'
                : 'Timer paused too long'
              : `${abandoned.length} timers need attention`}
          </p>
          <div style={{ marginTop: '0.25rem' }}>
            {abandoned.slice(0, 3).map((t) => (
              <div
                key={t.entry.id}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary, #6b7280)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.125rem 0',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: t.type === 'timer_running_long' ? '#ea580c' : '#7c3aed',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {t.entry.summary || `${t.entry.project_name} entry`}
                </span>
                <span style={{ color: 'var(--text-muted, #9ca3af)', flexShrink: 0 }}>
                  {formatDuration(t.durationMs)}
                </span>
              </div>
            ))}
            {abandoned.length > 3 && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted, #9ca3af)',
                  marginTop: '0.25rem',
                }}
              >
                +{abandoned.length - 3} more
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {abandoned.length === 1 && (
            <button
              type="button"
              onClick={() => handleNavigate(abandoned[0].entry)}
              style={{
                background: 'var(--accent, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '0.375rem 0.75rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Open
            </button>
          )}
          <button
            type="button"
            onClick={() => handleDismiss(abandoned[0].entry.id as string)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #9ca3af)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0.25rem',
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
