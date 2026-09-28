import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

interface EditTimeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (startedAt: string, endedAt: string) => void;
  saving: boolean;
  initialStartedAt?: string | null;
  initialEndedAt?: string | null;
}

export function EditTimeModal({
  open,
  onClose,
  onSubmit,
  saving,
  initialStartedAt,
  initialEndedAt,
}: EditTimeModalProps) {
  const [mode, setMode] = useState<'duration' | 'range'>('range');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize with existing values when modal opens
  useEffect(() => {
    if (open && initialStartedAt && initialEndedAt) {
      const start = new Date(initialStartedAt);
      const end = new Date(initialEndedAt);
      const durationMs = end.getTime() - start.getTime();
      const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
      setHours(String(Math.floor(totalMinutes / 60)));
      setMinutes(String(totalMinutes % 60));
      setStartDateTime(toLocalInput(start));
      setEndDateTime(toLocalInput(end));
    }
  }, [open, initialStartedAt, initialEndedAt]);

  if (!open) return null;

  const handleSubmit = () => {
    setError(null);

    if (mode === 'duration') {
      const h = Number(hours) || 0;
      const m = Number(minutes) || 0;
      if (h === 0 && m === 0) {
        setError('Duration must be at least 1 minute');
        return;
      }
      const end = new Date();
      const start = new Date(end.getTime() - (h * 60 + m) * 60000);
      onSubmit(start.toISOString(), end.toISOString());
    } else {
      if (!startDateTime || !endDateTime) {
        setError('Please enter both start and end times');
        return;
      }
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      if (end <= start) {
        setError('End time must be after start time');
        return;
      }
      onSubmit(start.toISOString(), end.toISOString());
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Edit Worked Time</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Mode Toggle */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            background: '#f3f4f6',
            padding: '4px',
            borderRadius: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setMode('duration')}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: '6px',
              background: mode === 'duration' ? 'white' : 'transparent',
              boxShadow: mode === 'duration' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: mode === 'duration' ? 600 : 400,
              color: mode === 'duration' ? '#111827' : '#6b7280',
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
              border: 'none',
              borderRadius: '6px',
              background: mode === 'range' ? 'white' : 'transparent',
              boxShadow: mode === 'range' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: mode === 'range' ? 600 : 400,
              color: mode === 'range' ? '#111827' : '#6b7280',
            }}
          >
            Time Range
          </button>
        </div>

        {/* Input Fields */}
        {mode === 'duration' ? (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Hours
              </label>
              <input
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                End Time
              </label>
              <input
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
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
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
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
              background: saving ? '#9ca3af' : '#111827',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              color: 'white',
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}
