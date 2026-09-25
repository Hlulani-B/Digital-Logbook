import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShield, FiCpu, FiLock, FiCheck } from 'react-icons/fi';

/**
 * DataDisclaimer — shown once after signup (new accounts only).
 * Transparently explains that the user's data is kept secure, what the AI does
 * with it, and what rights they have. Must be acknowledged before entering the
 * dashboard.
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
          <h1 className="auth-title">Your privacy &amp; data</h1>
          <p className="auth-subtitle" style={{ marginBottom: '1.25rem' }}>
            We believe in transparency. Here's what you need to know about your information.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              textAlign: 'left',
            }}
          >
            {/* Data Security */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiShield size={18} />
                <span>Your data is secure</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  Your entries, projects, and profile are stored <strong>securely</strong> and are
                  only ever accessible from your own account.
                </li>
                <li>
                  A private copy of your data is also kept <strong>on your own device</strong> so
                  the app works fast and offline. It is never shared with anyone else.
                </li>
                <li>
                  Your data is <strong>encrypted in transit</strong> and is never used for anything
                  other than running this app.
                </li>
                <li>All data transmitted between your device and our servers is encrypted.</li>
              </ul>
            </div>

            {/* AI Usage */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiCpu size={18} />
                <span>Smart features</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  Optional AI assistance helps parse quick entries into structured data. This
                  processing is temporary and not stored.
                </li>
                <li>
                  AI features only access the specific entry text you submit — never your password,
                  email, or other personal information.
                </li>
                <li>
                  AI-generated suggestions are optional and can be disabled anytime in Settings.
                </li>
                <li>Your data is never used to train external AI models.</li>
                <li>
                  <strong>AI assistance is a helper, not perfect.</strong> Always review auto-parsed
                  entries to ensure accuracy. You can edit any entry at any time.
                </li>
              </ul>
            </div>

            {/* Privacy & Control */}
            <div className="disclaimer-section">
              <div className="disclaimer-section-header">
                <FiLock size={18} />
                <span>Your control</span>
              </div>
              <ul className="disclaimer-list">
                <li>
                  <strong>Export your data</strong> anytime in JSON format from Settings.
                </li>
                <li>
                  <strong>Delete your account</strong> permanently from Settings. A recovery period
                  is available if you change your mind.
                </li>
                <li>
                  Your data belongs to you. We never sell, share with third parties, or use it
                  beyond providing this service.
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
              <strong>Committed to privacy:</strong> we follow security best practices and undergo
              regular reviews to protect your information.
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
