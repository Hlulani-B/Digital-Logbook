import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { addEmail, updateName, updateUsername } from '../functions/profile/profile.js';

export function CreateProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email || null;
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      // Insert user row first (new users don't exist in users table yet)
      const emailResult = await addEmail(email);
      if (!emailResult?.success && !emailResult?.message?.includes('duplicate')) {
        throw new Error(emailResult?.message || 'Failed to add email');
      }

      const nameResult = await updateName(email, name.trim());
      if (!nameResult?.success) throw new Error(nameResult?.message || 'Failed to update name');

      const usernameResult = await updateUsername(email, username.trim());
      if (!usernameResult?.success)
        throw new Error(usernameResult?.message || 'Failed to update username');

      navigate('/avatar', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile');
    } finally {
      setLoading(false);
    }
  };

  if (!email) return null;

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in">
          <div className="auth-logo">
            <img
              src="/notebook.jpeg"
              alt="Digital Logbook"
              style={{ width: 48, height: 48, borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>
          <h1 className="auth-title">Set up your profile</h1>
          <p className="auth-subtitle">Tell us what to call you</p>

          {error && <div className="auth-error">{error}</div>}

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
          >
            <div className="field-group">
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="field-input"
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>

            <div className="field-group">
              <label htmlFor="name" className="field-label">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
                placeholder="Hlulani Baloyi"
                autoComplete="name"
              />
            </div>

            <div className="field-group">
              <label htmlFor="username" className="field-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                }
                className="field-input"
                placeholder="hlulani_b"
                autoComplete="off"
              />
              <p className="field-hint">Lowercase letters, numbers, and underscores only.</p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || username.trim().length < 3}
              className="btn-primary auth-submit"
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
