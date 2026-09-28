import { useState } from 'react';
import { FiX, FiClock } from 'react-icons/fi';

interface ManualTimeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (startedAt: string, endedAt: string) => void;
  saving?: boolean;
}

/**
 * Modal for manually logging time worked on an entry.
 * Users can input duration (hours/minutes) and optionally set a custom end time.
 */
export function ManualTimeModal({ open, onClose, onSubmit, saving }: ManualTimeModalProps) {
  const [mode, setMode] = useState<'duration' | 'range'>('duration');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = () => {
    setError(null);

    if (mode === 'duration') {
      const h = Number(hours) || 0;
      const m = Number(minutes) || 0;
      const totalMinutes = h * 60 + m;

      if (totalMinutes <= 0) {
        setError('Please enter a duration greater than 0');
        return;
      }

      // Calculate start time from end time (or now) minus duration
      const end = endDate && endTime ? new Date(`${endDate}T${endTime}`) : new Date();

      const start = new Date(end.getTime() - totalMinutes * 60000);

      onSubmit(start.toISOString(), end.toISOString());
    } else {
      // Range mode
      if (!endDate || !endTime) {
        setError('Please select both date and time');
        return;
      }

      const end = new Date(`${endDate}T${endTime}`);
      if (isNaN(end.getTime())) {
        setError('Invalid end time');
        return;
      }

      // Default to 1 hour duration if not specified
      const h = Number(hours) || 1;
      const m = Number(minutes) || 0;
      const totalMinutes = h * 60 + m;
      const start = new Date(end.getTime() - totalMinutes * 60000);

      if (start >= end) {
        setError('Start time must be before end time');
        return;
      }

      onSubmit(start.toISOString(), end.toISOString());
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  const defaultTime = now.toTimeString().slice(0, 5);

  return (
    <div
      className="manual-time-modal__overlay"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="manual-time-modal"
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '420px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiClock />
            Log Time Manually
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
            aria-label="Close"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => setMode('duration')}
            style={{
              flex: 1,
              padding: '8px',
              border: `2px solid ${mode === 'duration' ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '6px',
              background: mode === 'duration' ? '#eff6ff' : 'white',
              color: mode === 'duration' ? '#3b82f6' : '#6b7280',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Duration
          </button>
          <button
            type="button"
            onClick={() => setMode('range')}
            style={{
              flex: 1,
              padding: '8px',
              border: `2px solid ${mode === 'range' ? '#3b82f6' : '#e5e7eb'}`,
              borderRadius: '6px',
              background: mode === 'range' ? '#eff6ff' : 'white',
              color: mode === 'range' ? '#3b82f6' : '#6b7280',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Time Range
          </button>
        </div>

        {/* Duration Input */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}
          >
            Duration
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                max="23"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>hours</span>
            </div>
            <div style={{ flex: 1 }}>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>minutes</span>
            </div>
          </div>
        </div>

        {/* End Time (optional for duration mode, required for range mode) */}
        {mode === 'range' && (
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '14px' }}
            >
              End Time
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                defaultValue={defaultDate}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                defaultValue={defaultTime}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        )}

        {mode === 'duration' && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#6b7280',
            }}
          >
            <strong>Note:</strong> Time will be logged ending now. To set a custom end time, switch
            to "Time Range" mode.
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#3b82f6',
              color: 'white',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Log Time'}
          </button>
        </div>
      </div>
    </div>
  );
}
