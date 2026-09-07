import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';

export function ResetPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const { isDark } = useTheme();

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            {sent
              ? 'Check your email for a reset link'
              : "Enter your email and we'll send you a reset link"}
          </p>

          {error && <div className="auth-error">{error}</div>}

          {sent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  color: isDark ? '#86efac' : '#15803d',
                  fontSize: '0.8125rem',
                  lineHeight: '1.5',
                  textAlign: 'left',
                }}
              >
                A password reset link has been sent to <strong>{email}</strong>. The link will
                expire in 1 hour.
              </div>
              <Link
                to="/signin"
                className="btn-primary"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  textDecoration: 'none',
                  padding: '0.75rem',
                }}
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleReset}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div className="field-group">
                <label htmlFor="email" className="field-label">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ padding: '0.75rem', fontSize: '0.875rem' }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <Link
                to="/signin"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                &larr; Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
