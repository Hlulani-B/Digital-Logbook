import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiAlertCircle,
  FiCheckCircle,
  FiSend,
  FiCamera,
  FiGlobe,
} from 'react-icons/fi';
import './ReportBug.css';

export default function ReportBug() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const browserInfo = `${navigator.userAgent} | Screen: ${window.screen.width}x${window.screen.height} | URL: ${window.location.href}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status === 'idle') navigate('/help');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setStatus('submitting');
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('name', email || 'Anonymous');
      formData.append('email', email || 'noreply@codacaine.com');
      formData.append('subject', `Bug Report: ${title}`);
      formData.append(
        'message',
        `Title: ${title}\n\nDescription:\n${description}\n\n---\nBrowser Info: ${browserInfo}`
      );
      formData.append('_captcha', 'false');
      formData.append('_template', 'table');
      formData.append('_subject', `Bug Report: ${title}`);

      const res = await fetch('https://formsubmit.co/ajax/admin@codacaine.com', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });

      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg('Failed to send. Please try again or email us directly.');
      }
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  };

  const copyBrowserInfo = () => {
    navigator.clipboard.writeText(browserInfo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === 'success') {
    return (
      <div className="report-bug">
        <div className="report-bug__success">
          <div className="report-bug__success-icon-wrap">
            <FiCheckCircle size={64} />
          </div>
          <h1>Bug Report Sent!</h1>
          <p>Thanks for helping us improve Digital Logbook.</p>
          <p className="report-bug__success-sub">
            We'll look into it and get back to you if we need more details.
          </p>
          <div className="report-bug__success-actions">
            <button
              className="report-bug__btn report-bug__btn--primary"
              onClick={() => navigate('/help')}
            >
              Back to Help Centre
            </button>
            <button
              className="report-bug__btn report-bug__btn--secondary"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-bug">
      {/* Header */}
      <header className="report-bug__header">
        <button
          className="report-bug__back"
          onClick={() => navigate('/help')}
          title="Back to Help Centre"
        >
          <FiArrowLeft size={20} />
        </button>
        <div className="report-bug__title-group">
          <h1 className="report-bug__title">
            <FiAlertCircle className="report-bug__title-icon" />
            Report a Bug
          </h1>
          <p className="report-bug__subtitle">Help us fix it — tell us what went wrong</p>
        </div>
      </header>

      <div className="report-bug__layout">
        {/* Form */}
        <form className="report-bug__form" onSubmit={handleSubmit}>
          <div className="report-bug__field">
            <label htmlFor="bug-title">
              Title <span className="report-bug__required">*</span>
            </label>
            <input
              id="bug-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the bug"
              required
              disabled={status === 'submitting'}
            />
          </div>

          <div className="report-bug__field">
            <label htmlFor="bug-desc">
              Description <span className="report-bug__required">*</span>
            </label>
            <textarea
              id="bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen?"
              rows={5}
              required
              disabled={status === 'submitting'}
            />
          </div>

          <div className="report-bug__field">
            <label htmlFor="bug-email">Your Email (optional)</label>
            <input
              id="bug-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="So we can follow up with you"
              disabled={status === 'submitting'}
            />
          </div>

          {errorMsg && <p className="report-bug__error">{errorMsg}</p>}

          <div className="report-bug__actions">
            <button
              type="button"
              className="report-bug__btn report-bug__btn--secondary"
              onClick={() => navigate('/help')}
              disabled={status === 'submitting'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="report-bug__btn report-bug__btn--primary"
              disabled={status === 'submitting' || !title.trim() || !description.trim()}
            >
              {status === 'submitting' ? (
                <>
                  <span className="report-bug__spinner" />
                  Sending...
                </>
              ) : (
                <>
                  <FiSend size={16} />
                  Send Report
                </>
              )}
            </button>
          </div>
        </form>

        {/* Sidebar tips */}
        <aside className="report-bug__tips">
          <h3>
            <FiCamera size={18} />
            Tips for a good report
          </h3>
          <ul>
            <li>Describe what you were doing when the bug occurred</li>
            <li>Mention expected behaviour vs. actual behaviour</li>
            <li>Attach screenshots or screen recordings if possible</li>
            <li>Note your browser name and version</li>
            <li>Mention whether you were online or offline</li>
          </ul>

          <div className="report-bug__browser-info">
            <h4>
              <FiGlobe size={16} />
              Auto-captured info
            </h4>
            <p className="report-bug__browser-note">
              We automatically attach your browser info to help us diagnose the issue.
            </p>
            <button type="button" className="report-bug__copy-btn" onClick={copyBrowserInfo}>
              {copied ? 'Copied!' : 'Copy browser info'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
