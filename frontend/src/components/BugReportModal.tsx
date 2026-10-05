import { useState, useEffect } from 'react';
import { FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

interface BugReportModalProps {
  onClose: () => void;
}

export default function BugReportModal({ onClose }: BugReportModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-capture browser info
  const browserInfo = `${navigator.userAgent} | Screen: ${window.screen.width}x${window.screen.height} | URL: ${window.location.href}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

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
        `Title: ${title}\n\nDescription:\n${description}\n\nSteps to Reproduce:\n${steps || 'Not provided'}\n\n---\nBrowser Info: ${browserInfo}`
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

  if (status === 'success') {
    return (
      <div className="bug-modal-overlay" onClick={onClose}>
        <div className="bug-modal" onClick={(e) => e.stopPropagation()}>
          <div className="bug-modal__success">
            <FiCheckCircle size={48} className="bug-modal__success-icon" />
            <h2>Bug Report Sent!</h2>
            <p>Thanks for helping us improve Digital Logbook. We'll look into it soon.</p>
            <button className="bug-modal__close-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bug-modal-overlay" onClick={onClose}>
      <div className="bug-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bug-modal__header">
          <h2>
            <FiAlertCircle className="bug-modal__header-icon" />
            Report a Bug
          </h2>
          <button className="bug-modal__close" onClick={onClose} title="Close">
            <FiX size={20} />
          </button>
        </div>

        <form className="bug-modal__form" onSubmit={handleSubmit}>
          <div className="bug-modal__field">
            <label htmlFor="bug-title">
              Title <span className="bug-modal__required">*</span>
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

          <div className="bug-modal__field">
            <label htmlFor="bug-desc">
              Description <span className="bug-modal__required">*</span>
            </label>
            <textarea
              id="bug-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect?"
              rows={4}
              required
              disabled={status === 'submitting'}
            />
          </div>

          <div className="bug-modal__field">
            <label htmlFor="bug-steps">Steps to Reproduce</label>
            <textarea
              id="bug-steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
              rows={3}
              disabled={status === 'submitting'}
            />
          </div>

          <div className="bug-modal__field">
            <label htmlFor="bug-email">Your Email (optional)</label>
            <input
              id="bug-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="So we can follow up"
              disabled={status === 'submitting'}
            />
          </div>

          {errorMsg && <p className="bug-modal__error">{errorMsg}</p>}

          <div className="bug-modal__actions">
            <button
              type="button"
              className="bug-modal__cancel"
              onClick={onClose}
              disabled={status === 'submitting'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bug-modal__submit"
              disabled={status === 'submitting' || !title.trim() || !description.trim()}
            >
              {status === 'submitting' ? 'Sending...' : 'Send Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
