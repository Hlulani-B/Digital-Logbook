import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';

export function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const { isDark } = useTheme();

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      await updatePassword(password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const strength = (() => {
    if (password.length === 0) return { level: 0, label: '', color: '' };
    if (password.length < 6) return { level: 1, label: 'Weak', color: '#ef4444' };
    if (password.length < 10 && !/[A-Z]/.test(password))
      return { level: 2, label: 'Fair', color: '#f59e0b' };
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password))
      return { level: 4, label: 'Strong', color: '#22c55e' };
    return { level: 3, label: 'Good', color: '#3b82f6' };
  })();

  return (
    <>
      <div className="bg-mesh" />
      <div className="auth-container">
        <div className="glass auth-card animate-in">
          <div className="auth-logo">
            <img
              src="/notebook.jpeg"
              alt="Digital Logbook"
              style={{ width: 48, height: 48, borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>
          <h1 className="auth-title">Update Password</h1>
          <p className="auth-subtitle">Choose a strong new password for your account</p>

          {error && <div className="auth-error">{error}</div>}

          <form
            onSubmit={handleUpdate}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div className="field-group">
              <label htmlFor="password" className="field-label">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                placeholder="••••••••"
                autoFocus
              />
              {password.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      marginBottom: '0.375rem',
                    }}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: '3px',
                          borderRadius: '2px',
                          background:
                            i <= strength.level
                              ? strength.color
                              : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : '#e5e7eb',
                          transition: 'background 0.3s',
                        }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      color: strength.color,
                      fontWeight: 500,
                    }}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="field-group">
              <label htmlFor="confirm-password" className="field-label">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field-input"
                placeholder="••••••••"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p
                  style={{
                    fontSize: '0.6875rem',
                    color: isDark ? '#f87171' : '#dc2626',
                    marginTop: '0.375rem',
                  }}
                >
                  Passwords do not match
                </p>
              )}
              {confirmPassword.length > 0 &&
                password === confirmPassword &&
                password.length >= 6 && (
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      color: isDark ? '#4ade80' : '#16a34a',
                      marginTop: '0.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Passwords match
                  </p>
                )}
            </div>

            <button
              type="submit"
              disabled={loading || password !== confirmPassword}
              className="btn-primary"
              style={{ padding: '0.75rem', fontSize: '0.875rem' }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
