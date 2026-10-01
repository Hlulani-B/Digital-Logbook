import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiPause, FiPlay, FiSquare } from 'react-icons/fi';
import { updateEntry } from '@/functions/project/entries';
import './FocusMode.css';

interface EntryRow {
  id: string;
  user_email: string;
  project_name: string;
  summary: string;
  entries: any;
  due_date?: string;
  priority?: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
  paused_at?: string;
  paused_ms?: number;
  target_duration_ms?: number;
  archived?: boolean;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function entryDurationMs(entry: EntryRow, now: number): number {
  if (!entry.started_at) return 0;
  const start = new Date(entry.started_at).getTime();
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now;
  const pausedMs = entry.paused_ms || 0;
  return Math.max(0, end - start - pausedMs);
}

export default function FocusMode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entryData = searchParams.get('entry');

  const [entry, setEntry] = useState<EntryRow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [completed, setCompleted] = useState(false);
  const [soundPlayed, setSoundPlayed] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  // Parse entry from URL params
  useEffect(() => {
    if (entryData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(entryData));
        setEntry(parsed);
      } catch {
        navigate('/dashboard');
      }
    } else {
      navigate('/dashboard');
    }
  }, [entryData, navigate]);

  // Timer tick
  useEffect(() => {
    if (!entry || entry.ended_at) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [entry]);

  // Check completion
  useEffect(() => {
    if (!entry || !entry.target_duration_ms || completed) return;
    const elapsed = entryDurationMs(entry, now);
    if (elapsed >= Number(entry.target_duration_ms)) {
      setCompleted(true);
    }
  }, [entry, now, completed]);

  // Play completion sound
  const playCompletionSound = useCallback(() => {
    if (soundPlayed) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioRef.current = ctx;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 1);
      setSoundPlayed(true);
    } catch {
      // Audio not supported
    }
  }, [soundPlayed]);

  useEffect(() => {
    if (completed && !soundPlayed) {
      playCompletionSound();
    }
  }, [completed, soundPlayed, playCompletionSound]);

  const isPaused = Boolean(entry?.started_at && !entry?.ended_at && entry?.paused_at);
  const isRunning = Boolean(entry?.started_at && !entry?.ended_at && !entry?.paused_at);
  const elapsedMs = entry ? entryDurationMs(entry, now) : 0;
  const targetMs = entry?.target_duration_ms ? Number(entry.target_duration_ms) : null;
  const hasTarget = targetMs !== null && targetMs > 0;

  // Progress for circular timer
  const progress = useMemo(() => {
    if (!hasTarget) return 0;
    return Math.min(1, elapsedMs / targetMs);
  }, [elapsedMs, targetMs, hasTarget]);

  const handleExit = () => {
    navigate('/dashboard');
  };

  const handlePause = async () => {
    if (!entry) return;
    const now = new Date().toISOString();
    try {
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        now
      );
      if (result?.data) setEntry(result.data);
    } catch {
      setEntry({ ...entry, paused_at: now });
    }
  };

  const handleResume = async () => {
    if (!entry) return;
    const now = new Date();
    const openPauseMs = entry.paused_at
      ? Math.max(0, now.getTime() - new Date(entry.paused_at).getTime())
      : 0;
    const newPausedMs = (Number(entry.paused_ms) || 0) + openPauseMs;
    try {
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        newPausedMs,
        undefined
      );
      if (result?.data) setEntry(result.data);
    } catch {
      setEntry({ ...entry, paused_at: undefined, paused_ms: newPausedMs });
    }
  };

  const handleStop = async () => {
    if (!entry) return;
    try {
      const result = await updateEntry(
        entry.user_email,
        entry.project_name,
        entry.id,
        undefined,
        undefined,
        undefined,
        'done_and_dusted',
        new Date().toISOString(),
        undefined,
        undefined,
        undefined,
        undefined
      );
      if (result?.data) setEntry(result.data);
    } catch {
      setEntry({ ...entry, ended_at: new Date().toISOString(), status: 'done_and_dusted' });
    }
  };

  if (!entry) return null;

  // Parse notes from entries JSONB
  const notes =
    typeof entry.entries === 'object' && entry.entries?.notes ? String(entry.entries.notes) : '';

  // SVG circular timer
  const size = 220;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * progress;

  const ringColor = completed ? '#10b981' : isPaused ? '#f59e0b' : '#6366f1';
  const statusLabel = completed ? 'Completed' : isPaused ? 'Paused' : 'Focusing';
  const statusClass = completed
    ? 'focus-page__status--completed'
    : isPaused
      ? 'focus-page__status--paused'
      : 'focus-page__status--running';

  return (
    <div className="focus-page">
      <button className="focus-page__exit" onClick={handleExit}>
        <FiArrowLeft size={14} />
        Exit
      </button>

      <div className="focus-page__header">
        <div className="focus-page__project">{entry.project_name}</div>
        <h1 className="focus-page__title">{entry.summary || 'Untitled Entry'}</h1>
        {notes && <p className="focus-page__notes">{notes}</p>}
      </div>

      <div className="focus-page__timer">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>

        <div style={{ textAlign: 'center' }}>
          <div className="focus-page__timer-label">{hasTarget ? 'Remaining' : 'Elapsed'}</div>
          <div
            className={`focus-page__timer-time${hasTarget ? ' focus-page__timer-time--countdown' : ''}`}
          >
            {hasTarget
              ? formatDuration(Math.max(0, targetMs - elapsedMs))
              : formatDuration(elapsedMs)}
          </div>
          {hasTarget && (
            <div className="focus-page__timer-label" style={{ marginTop: '0.25rem' }}>
              Total: {formatDuration(elapsedMs)}
            </div>
          )}
        </div>

        <span className={`focus-page__status ${statusClass}`}>{statusLabel}</span>
      </div>

      <div className="focus-page__controls">
        {!completed && !entry.ended_at && (
          <>
            {!entry.started_at ? (
              <button className="focus-page__btn focus-page__btn--primary" onClick={handleResume}>
                <FiPlay size={16} />
                Start
              </button>
            ) : isRunning ? (
              <button className="focus-page__btn" onClick={handlePause}>
                <FiPause size={16} />
                Pause
              </button>
            ) : (
              <button className="focus-page__btn focus-page__btn--primary" onClick={handleResume}>
                <FiPlay size={16} />
                Resume
              </button>
            )}
            <button className="focus-page__btn focus-page__btn--danger" onClick={handleStop}>
              <FiSquare size={14} />
              End Task
            </button>
          </>
        )}
        {completed && (
          <button className="focus-page__btn focus-page__btn--primary" onClick={handleExit}>
            Done — Back to Dashboard
          </button>
        )}
      </div>
    </div>
  );
}
