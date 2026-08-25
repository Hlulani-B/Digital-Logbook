import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '@/lib/supabase';
import { checkUser } from '../functions/profile/login.js';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  /** Route after checking user status — soft-deleted users are sent to the restore prompt */
  const routeUser = async (email: string) => {
    try {
      const result = await checkUser(email);
      if (result.exists && result.deleted) {
        // Soft-deleted account: do NOT log in. Redirect to sign-in restore prompt.
        try {
          await getSupabase().auth.signOut();
        } catch {
          /* best effort */
        }
        const scheduled = result.deletion_scheduled_at || new Date().toISOString();
        navigate(
          `/signin?restore_email=${encodeURIComponent(email)}&restore_scheduled_at=${encodeURIComponent(scheduled)}`,
          { replace: true }
        );
        return;
      } else if (result.exists) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/create-profile', { replace: true });
      }
    } catch (err) {
      console.error('checkUser failed, defaulting to create-profile:', err);
      navigate('/create-profile', { replace: true });
    }
  };

  useEffect(() => {
    let client;
    try {
      client = getSupabase();
    } catch {
      setError('Supabase is not configured. Cannot complete authentication.');
      return;
    }

    const handleCallback = async () => {
      // Check for hash-based tokens (implicit flow from OAuth)
      const hash = window.location.hash;
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (hash && hash.includes('access_token')) {
        // Parse hash fragment tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionError && data.session) {
            const email = data.session.user.email;
            if (email) localStorage.setItem('email', email);
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
            if (!email) {
              navigate('/create-profile', { replace: true });
              return;
            }
            try {
              await routeUser(email);
            } catch (err) {
              console.error('checkUser failed, defaulting to create-profile:', err);
              navigate('/create-profile', { replace: true });
            }
            return;
          }
          setError(sessionError?.message || 'Failed to set session');
          return;
        }
      }

      if (code) {
        // PKCE flow
        const { data, error } = await client.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          const email = data.session.user.email;
          if (email) localStorage.setItem('email', email);
          if (!email) {
            navigate('/create-profile', { replace: true });
            return;
          }
          try {
            await routeUser(email);
          } catch (err) {
            console.error('checkUser failed, defaulting to create-profile:', err);
            navigate('/create-profile', { replace: true });
          }
          return;
        }
        setError(error?.message || 'Failed to complete sign in');
        return;
      }

      // Fallback: check existing session
      const { data } = await client.auth.getSession();
      if (data.session) {
        const email = data.session.user.email;
        if (email) localStorage.setItem('email', email);
        if (!email) {
          navigate('/create-profile', { replace: true });
          return;
        }
        try {
          await routeUser(email);
        } catch (err) {
          console.error('checkUser failed, defaulting to create-profile:', err);
          navigate('/create-profile', { replace: true });
        }
        return;
      }

      setError('No authorization data found in the URL.');
    };

    handleCallback();
  }, [navigate]);

  return (
    <>
      <div className="bg-mesh" />
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#f87171',
                  marginBottom: '0.75rem',
                }}
              >
                Authentication Error
              </h1>
              <p
                style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
              >
                {error}
              </p>
              <button
                onClick={() => navigate('/signin')}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <div
                className="animate-spin"
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 auto 1rem',
                  borderRadius: '50%',
                  border: '3px solid var(--border)',
                  borderTopColor: 'var(--accent)',
                }}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>
                Completing sign in...
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
