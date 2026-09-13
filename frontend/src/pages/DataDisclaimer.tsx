import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiDatabase, FiCpu, FiLock, FiCheck } from 'react-icons/fi';

/**
 * DataDisclaimer — shown once after signup (new accounts only).
 * Transparently explains how the user's data is stored, what the AI does with it,
 * and what rights they have. Must be acknowledged before entering the dashboard.
 */
export function DataDisclaimer() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleContinue = () => {
    if (!accepted) return;
    setSaving(true);
    sessionStorage.removeItem('dl_new_signup');
    navigate('/dashboard', { replace: true });
  };

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div
          className="glass auth-card animate-in"
          style={{ maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}
        >
          <div className="auth-logo">
            <img
              src="/notebook.jpeg"
              alt="Digital Logbook"
              style={{ width: 48, height: 48, borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>
          <h1 className="auth-title">Your data &amp; AI — the honest picture</h1>
          <p className="auth-subtitle" style={{ marginBottom: '1.25rem' }}>
            Before you dive in, we want you to know exactly what happens with your information.
            No surprises.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              textAlign: 'left',
            }}
          >
            {/* Data Storage */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiDatabase size={18} />
                <span>Where your data lives</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  Your entries, projects, and profile are stored in a <strong>Supabase</strong>{' '}
                  cloud database (PostgreSQL). Supabase is an open-source backend hosted on
                  infrastructure in dedicated data centres.
                </li>
                <li>
                  A copy of your data is also cached <strong>locally in your browser</strong>{' '}
                  (IndexedDB) so the app works fast and offline. This cache stays on your device
                  and is never sent anywhere except back to your own account.
                </li>
                <li>
                  The app is hosted on <strong>Render</strong> (free tier). Your data in transit
                  is encrypted via HTTPS.
                </li>
              </ul>
            </div>

            {/* AI Usage */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiCpu size={18} />
                <span>How AI is used</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  When you type a quick entry, the text is sent to an <strong>AI model</strong>{' '}
                  to parse it into structured data (project, priority, due date). This is the
                  only automated AI processing that happens.
                </li>
                <li>
                  The AI <strong>reads your entry text and project names</strong> to understand
                  context. It does <strong>not</strong> have access to your password, email, or
                  any other personal data.
                </li>
                <li>
                  AI-generated comments and greetings are <strong>optional</strong> — you can
                  turn them off at any time in Settings → Preferences → AI Messages.
                </li>
                <li>
                  We do <strong>not</strong> train any external AI model on your data. The AI
                  provider processes your text per-request and does not retain it for model
                  training.
                </li>
                <li>
                  <strong>Quick Add is not perfect.</strong> The AI may misread your intent —
                  for example it could assign an entry to the wrong project, guess the wrong
                  priority, or parse a due date incorrectly. <strong>Always verify</strong>{' '}
                  that the entry was filed in the right place after using Quick Add. You can
                  edit any entry to fix mistakes.
                </li>
              </ul>
            </div>

            {/* Privacy & Control */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiLock size={18} />
                <span>Your rights &amp; control</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  You can <strong>export all your data</strong> at any time via Settings →
                  Data Portability (JSON format).
                </li>
                <li>
                  You can <strong>delete your account</strong> permanently from Settings →
                  Account. There is a 30-day grace period in case you change your mind.
                </li>
                <li>
                  Your data is <strong>yours</strong>. We will never sell it, share it with
                  advertisers, or use it for anything other than running this app.
                </li>
              </ul>
            </div>

            {/* Transparency note */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-xs, 8px)',
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.15)',
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                color: 'var(--text-secondary, #555)',
              }}
            >
              <FiShield
                size={14}
                style={{ verticalAlign: 'middle', marginRight: 6, marginBottom: 2 }}
              />
              <strong>Open source:</strong> this app's code is publicly auditable. Anyone can
              inspect exactly what happens with your data.
            </div>
          </div>

          {/* Accept checkbox */}
          <label
            className="disclaimer-accept"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              marginTop: '1.25rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: 6,
                border: accepted
                  ? '2px solid var(--accent, #111)'
                  : '2px solid var(--border, #ccc)',
                background: accepted ? 'var(--accent, #111)' : 'transparent',
                color: accepted ? '#fff' : 'transparent',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              {accepted && <FiCheck size={14} />}
            </span>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            I've read and understand how my data is handled.
          </label>

          {/* Continue button */}
          <button
            type="button"
            className="btn-primary auth-submit"
            style={{ marginTop: '1rem' }}
            onClick={handleContinue}
            disabled={!accepted || saving}
          >
            {saving ? 'Taking me in...' : 'Continue to my logbook'}
          </button>
        </div>
      </div>
    </>
  );
}

export default DataDisclaimer;
