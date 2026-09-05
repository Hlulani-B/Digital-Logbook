import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function AuthRestore() {
  const navigate = useNavigate();
  const { restoreAccount } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Restoring your account...');

  useEffect(() => {
    const restore = async () => {
      let client;
      try {
        client = getSupabase();
      } catch {
        setStatus('error');
        setMessage('Supabase is not configured. Cannot restore account.');
        return;
      }

      // The magic link from signInWithOtp creates a session before landing here.
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) {
        setStatus('error');
        setMessage('Your restore link is invalid or has expired. Please request a new one.');
        return;
      }

      try {
        await restoreAccount();
        setStatus('success');
        setMessage('Account restored successfully. Redirecting to your dashboard...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('Restore failed:', err);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not restore account.');
      }
    };

    restore();
  }, [navigate, restoreAccount]);

  return (
    <>
      <div className="bg-mesh" />
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <div
                className="animate-spin spinner-circle"
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 auto 1rem',
                }}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#22c55e',
                  marginBottom: '0.75rem',
                }}
              >
                Account Restored
              </h1>
              <p
                style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
              >
                {message}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#f87171',
                  marginBottom: '0.75rem',
                }}
              >
                Restore Failed
              </h1>
              <p
                style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
              >
                {message}
              </p>
              <button
                onClick={() => navigate('/signin')}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
