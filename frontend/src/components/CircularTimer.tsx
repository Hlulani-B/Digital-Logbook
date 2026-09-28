import { useMemo } from 'react';

interface CircularTimerProps {
  /** Current elapsed time in milliseconds */
  elapsedMs: number;
  /** Target duration in milliseconds (for countdown mode) */
  targetMs?: number | null;
  /** Whether the timer is currently running */
  isRunning: boolean;
  /** Whether the timer is paused */
  isPaused: boolean;
  /** Whether the timer has completed */
  isCompleted: boolean;
  /** Callback when play/start is clicked */
  onStart?: () => void;
  /** Callback when pause is clicked */
  onPause?: () => void;
  /** Callback when stop is clicked */
  onStop?: () => void;
  /** Size of the timer in pixels */
  size?: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
}

/**
 * Circular timer with SVG progress ring.
 * Shows elapsed time in the center with play/pause/stop controls.
 */
export function CircularTimer({
  elapsedMs,
  targetMs,
  isRunning,
  isPaused,
  isCompleted,
  onStart,
  onPause,
  onStop,
  size = 200,
  strokeWidth = 12,
}: CircularTimerProps) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate progress (0 to 1)
  const progress = useMemo(() => {
    if (!targetMs || targetMs <= 0) return 0;
    return Math.min(elapsedMs / targetMs, 1);
  }, [elapsedMs, targetMs]);

  // Calculate stroke dash offset for progress ring
  const strokeDashoffset = useMemo(() => {
    return circumference - progress * circumference;
  }, [circumference, progress]);

  // Format time as MM:SS or HH:MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine ring color based on state
  const ringColor = useMemo(() => {
    if (isCompleted) return '#10b981'; // green
    if (isPaused) return '#f59e0b'; // amber
    if (isRunning) return '#8b5cf6'; // purple
    return '#d1d5db'; // gray
  }, [isRunning, isPaused, isCompleted]);

  // Background ring color
  const bgRingColor = '#e5e7eb';

  return (
    <div className="circular-timer" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="circular-timer-svg">
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgRingColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          className="circular-timer-ring"
          style={{
            transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
          }}
        />
        {/* Time display in center */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="circular-timer-time"
          style={{
            fontSize: size * 0.2,
            fontWeight: 600,
            fill: '#1f2937',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {formatTime(elapsedMs)}
        </text>
      </svg>

      {/* Control buttons */}
      <div className="circular-timer-controls">
        {!isRunning && !isCompleted && (
          <button
            type="button"
            className="circular-timer-btn circular-timer-btn--play"
            onClick={onStart}
            disabled={!onStart}
            aria-label="Start timer"
            title="Start timer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
        {isRunning && !isPaused && (
          <button
            type="button"
            className="circular-timer-btn circular-timer-btn--pause"
            onClick={onPause}
            disabled={!onPause}
            aria-label="Pause timer"
            title="Pause timer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
        )}
        {isPaused && (
          <button
            type="button"
            className="circular-timer-btn circular-timer-btn--play"
            onClick={onStart}
            disabled={!onStart}
            aria-label="Resume timer"
            title="Resume timer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}
        {(isRunning || isPaused) && (
          <button
            type="button"
            className="circular-timer-btn circular-timer-btn--stop"
            onClick={onStop}
            disabled={!onStop}
            aria-label="Stop timer"
            title="Stop timer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default CircularTimer;
