import { useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { checkUser } from '../functions/profile/login.js';
import { getSupabase } from '@/lib/supabase';
import { validateEmailForAuth, suggestEmailCorrection } from '@/lib/validation';
import './signin-landing.css';

type Provider = 'google' | 'github';

const SECTION_LINKS = [
  { id: 'sl-about', label: 'About' },
  { id: 'sl-about-us', label: 'About Us' },
  { id: 'sl-features', label: 'Features' },
];

const TEAM: Array<[string, string]> = [
  ['NN', 'Nasiphi Missy Ntontela'],
  ['HB', 'Hlulani Baloyi'],
  ['SM', 'Siphesihle Merile'],
  ['SV', 'Sicelo Vanyelwa'],
  ['LM', 'Lupa Martins'],
  ['ZM', 'Zamokuhle Maziya'],
];

function daysUntilDeletion(scheduledAt: string) {
  const ms = new Date(scheduledAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

/* ---------- small stroke icons (inherit currentColor) ---------- */

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function UserIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PasswordField({
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
  minLength,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <div className="sl-field">
      <div className="sl-pill">
        <LockIcon />
        <input
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          minLength={minLength}
        />
        <button
          type="button"
          className="sl-eye"
          onClick={onToggleVisibility}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

function SlBrand() {
  return (
    <a className="sl-brand" href="#sl-top">
      <span className="sl-mark">
        <BookIcon />
      </span>
      <b>Digital Logbook</b>
    </a>
  );
}

function SlLinks({ active, onNavigate }: { active: string | null; onNavigate?: () => void }) {
  return (
    <div className="sl-links">
      {SECTION_LINKS.map((l) => (
        <a
          key={l.id}
          href={`#${l.id}`}
          className={active === l.id ? 'sl-active' : ''}
          onClick={onNavigate}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

export function SignIn() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const { signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail } = useAuth();

  // Live password requirements for sign-up — shown before submit so users
  // know what is expected instead of discovering it from an error popup.
  const passwordRequirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase (a-z)', met: /[a-z]/.test(password) },
    { label: 'A number (0-9)', met: /[0-9]/.test(password) },
    {
      label: 'A special character',
      met: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/~]/.test(password),
    },
  ];
  // The match check lives under the confirm-password field, not in the rule
  // list — it compares two fields, so it belongs with the second one.
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const signupRequirementsMet =
    mode === 'signup' && passwordRequirements.every((r) => r.met) && passwordsMatch;

  // Restore-prompt state (for soft-deleted accounts signing back in)
  const [restoreEmail, setRestoreEmail] = useState<string | null>(
    searchParams.get('restore_email')
  );
  const [restoreScheduledAt, setRestoreScheduledAt] = useState<string | null>(
    searchParams.get('restore_scheduled_at')
  );
  const [restoreSending, setRestoreSending] = useState(false);
  const [restoreSent, setRestoreSent] = useState(false);
  const [restoreDetected, setRestoreDetected] = useState(false);

  // Clear restore query params from URL once read
  useEffect(() => {
    if (searchParams.has('restore_email') || searchParams.has('restore_scheduled_at')) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Watch for external restoration (e.g. user clicked restore link on another device).
  // Polls the profile service every 5 seconds while the restore prompt is visible.
  useEffect(() => {
    if (!restoreEmail || restoreDetected) return;

    const checkRestored = async () => {
      try {
        const result = await checkUser(restoreEmail);
        if (result.exists && !result.deleted) {
          setRestoreDetected(true);
        }
      } catch {
        /* ignore polling errors */
      }
    };

    void checkRestored();
    const id = setInterval(checkRestored, 5_000);
    return () => clearInterval(id);
  }, [restoreEmail, restoreDetected]);

  // Landing chrome only: smooth anchor scrolling, slim-nav reveal on scroll,
  // reveal-on-scroll for section content, and section scrollspy.
  const windowRef = useRef<HTMLDivElement>(null);
  const [topnavShow, setTopnavShow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';

    const onScroll = () => {
      const anchor = windowRef.current;
      setTopnavShow(window.scrollY > (anchor ? anchor.offsetTop + 80 : 200));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sl-in');
            reveal.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('.sl-reveal').forEach((el) => reveal.observe(el));

    const spy = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }),
      { rootMargin: '-35% 0px -55% 0px' }
    );
    SECTION_LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) spy.observe(el);
    });

    return () => {
      window.removeEventListener('scroll', onScroll);
      root.style.scrollBehavior = previousScrollBehavior;
      reveal.disconnect();
      spy.disconnect();
    };
  }, []);

  const switchMode = (next: 'signin' | 'signup') => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setSuccess(null);
    setEmailSuggestion(null);
    setConfirmPassword('');
  };

  const showRestorePrompt = (userEmail: string, scheduledAt: string) => {
    setRestoreEmail(userEmail);
    setRestoreScheduledAt(scheduledAt);
  };

  const routeAfterAuth = async (userEmail: string) => {
    localStorage.setItem('email', userEmail);
    let destination = '/create-profile';
    try {
      const result = await checkUser(userEmail);
      if (result.exists && result.deleted) {
        // Soft-deleted account: do NOT log in. Sign out and show restore prompt.
        try {
          await getSupabase().auth.signOut();
        } catch {
          /* best effort */
        }
        showRestorePrompt(userEmail, result.deletion_scheduled_at || new Date().toISOString());
        return;
      } else if (result.exists) {
        destination = '/dashboard';
      }
    } catch (err) {
      console.error('checkUser failed, defaulting to create-profile:', err);
    }
    navigate(destination);
  };

  const handleSignIn = async (provider: Provider) => {
    setOauthLoading(provider);
    setError(null);
    setSuccess(null);
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithGitHub();
      }
      // Note: OAuth redirects away from this page, so routeAfterAuth here
      // won't run for OAuth — handle post-login routing in AuthCallback instead.
    } catch (err) {
      const label = provider === 'google' ? 'Google' : 'GitHub';
      setError(err instanceof Error ? err.message : `${label} sign-in failed`);
      setOauthLoading(null);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const emailError = validateEmailForAuth(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    // A known typo was detected and the user has not accepted the fix yet.
    // The suggestion pill under the field already shows the proposed
    // correction — keep the banner generic so it doesn't repeat it.
    if (emailSuggestion) {
      setError('Please check your email address.');
      return;
    }

    if (mode === 'signup') {
      const unmet = passwordRequirements.find((r) => !r.met);
      if (unmet) {
        setError(`Password requirement not met: ${unmet.label}`);
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setEmailLoading(true);
    setError(null);
    setSuccess(null);
    setEmailSuggestion(null);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        await routeAfterAuth(email);
      } else {
        await signUpWithEmail(email, password);
        sessionStorage.setItem('dl_new_signup', 'true');
        setSuccess(
          'Account created! Please check your email to confirm your account before signing in.'
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRequestRestoreLink = async () => {
    if (!restoreEmail) return;
    setRestoreSending(true);
    setError(null);
    try {
      const { error: otpError } = await getSupabase().auth.signInWithOtp({
        email: restoreEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/restore`,
        },
      });
      if (otpError) throw otpError;
      setRestoreSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send restore link');
    } finally {
      setRestoreSending(false);
    }
  };

  const handleCancelRestore = () => {
    setRestoreEmail(null);
    setRestoreScheduledAt(null);
    setRestoreSent(false);
    setRestoreDetected(false);
    setEmail('');
    setPassword('');
  };

  const isLoading = oauthLoading !== null || emailLoading;

  const renderEmailField = (icon: ReactNode) => (
    <div className="sl-field">
      <div className="sl-pill">
        {icon}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            const next = e.target.value;
            setEmail(next);
            setEmailSuggestion(suggestEmailCorrection(next));
          }}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      {emailSuggestion && (
        <button
          type="button"
          onClick={() => {
            setEmail(emailSuggestion);
            setEmailSuggestion(null);
          }}
          className="sl-suggest"
        >
          Did you mean <strong>{emailSuggestion}</strong>?
        </button>
      )}
    </div>
  );

  const renderChecklist = () => (
    <ul className="sl-checklist">
      {passwordRequirements.map((req) => (
        <li key={req.label} className={req.met ? 'sl-ok' : ''}>
          <span className="sl-box">
            <CheckIcon />
          </span>
          {req.label}
        </li>
      ))}
      <li className={passwordsMatch ? 'sl-ok' : ''}>
        <span className="sl-box">
          <CheckIcon />
        </span>
        Passwords match
      </li>
    </ul>
  );

  const renderOauthButtons = () => (
    <>
      <div className="sl-oauth-line">
        <span>or continue with</span>
      </div>
      <div className="sl-oauth-btns">
        <button
          onClick={() => handleSignIn('google')}
          disabled={isLoading}
          className="sl-btn-oauth"
          aria-label="Continue with Google"
          title="Continue with Google"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        </button>
        <button
          onClick={() => handleSignIn('github')}
          disabled={isLoading}
          className="sl-btn-oauth"
          aria-label="Continue with GitHub"
          title="Continue with GitHub"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </button>
      </div>
    </>
  );

  const renderRestorePrompt = () => {
    const daysLeft = restoreScheduledAt ? daysUntilDeletion(restoreScheduledAt) : 30;
    return (
      <div className="sl-restore">
        {restoreDetected ? (
          <div className="sl-alert sl-alert-ok">
            <p style={{ margin: 0, fontWeight: 600 }}>Account restored</p>
            <p>Your account has been restored. You can now sign in again on this device.</p>
          </div>
        ) : (
          <div className="sl-alert sl-alert-err">
            <p style={{ margin: 0, fontWeight: 600 }}>Account scheduled for deletion</p>
            <p>
              Your account is scheduled to be permanently deleted in{' '}
              <strong>
                {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </strong>
              .
            </p>
            <p>
              Click below to receive a secure restore link via email. Opening the link will restore
              your account and sign you in.
            </p>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Tip: open the link on this device for the fastest experience.
            </p>
          </div>
        )}

        {restoreDetected ? (
          <button onClick={handleCancelRestore} className="sl-btn-mag">
            Continue to sign in
          </button>
        ) : restoreSent ? (
          <div className="sl-alert sl-alert-ok">
            A restore link has been sent to <strong>{restoreEmail}</strong>. Check your inbox (and
            spam folder) and click the link to restore your account. Open the link on this device
            for the fastest experience.
          </div>
        ) : (
          <button
            onClick={handleRequestRestoreLink}
            disabled={restoreSending}
            className="sl-btn-mag"
          >
            {restoreSending ? 'Sending...' : 'Send Restore Link'}
          </button>
        )}

        <button onClick={handleCancelRestore} className="sl-link-btn">
          Back to sign in
        </button>
      </div>
    );
  };

  const visualTitle: ReactNode =
    mode === 'signin' ? (
      <>
        Wel<em>come.</em>
      </>
    ) : (
      <>
        Join <em>us.</em>
      </>
    );
  const visualText =
    mode === 'signin'
      ? 'Your projects, deadlines and notes — finally in one calm place. Sign in and see what needs you today.'
      : 'Create a free account and get a voice-narrated tour of every view on your first visit.';

  return (
    <div className="sl-page" id="sl-top">
      <div className="sl-ambient">
        <i className="sl-a1" />
        <i className="sl-a2" />
        <i className="sl-a3" />
      </div>
      <div className="sl-grain" />

      {/* Fixed slim nav — slides in once the window scrolls out */}
      <nav className={`sl-topnav${topnavShow ? ' sl-show' : ''}`}>
        <div className="sl-wrap sl-tn-in">
          <SlBrand />
          <SlLinks active={activeSection} />
          <a className="sl-tn-signin" href="#sl-top" onClick={() => switchMode('signin')}>
            Sign in
          </a>
        </div>
      </nav>

      {/* ============ the window ============ */}
      <section className="sl-stage">
        <div className="sl-wrap">
          <div className="sl-window" ref={windowRef}>
            <div className="sl-win-nav">
              <SlBrand />
              <SlLinks active={activeSection} />
              <a className="sl-win-signin" href="#sl-top" onClick={() => switchMode('signin')}>
                Sign in
              </a>
              <button
                className="sl-burger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
            <div className={`sl-mnav${menuOpen ? ' sl-open' : ''}`}>
              {SECTION_LINKS.map((l) => (
                <a key={l.id} href={`#${l.id}`} onClick={() => setMenuOpen(false)}>
                  {l.label}
                </a>
              ))}
              <a
                href="#sl-top"
                onClick={() => {
                  setMenuOpen(false);
                  switchMode('signin');
                }}
              >
                Sign in
              </a>
            </div>

            <div className="sl-split">
              {/* left: form */}
              <div className="sl-form-side">
                <div className="sl-avatar">
                  <UserIcon size={38} />
                </div>

                {error && (
                  <div className="sl-alert sl-alert-err" role="alert">
                    {error}
                  </div>
                )}
                {success && <div className="sl-alert sl-alert-ok">{success}</div>}

                {restoreEmail ? (
                  renderRestorePrompt()
                ) : (
                  <>
                    {/* Sign in */}
                    <form
                      className={`sl-fpanel${mode === 'signin' ? ' sl-show' : ''}`}
                      onSubmit={handleEmailSubmit}
                    >
                      {renderEmailField(<UserIcon />)}
                      <PasswordField
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggleVisibility={() => setShowPassword(!showPassword)}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      />
                      <div className="sl-form-row">
                        <Link to="/reset-password">Forgot password?</Link>
                      </div>
                      <button type="submit" disabled={emailLoading} className="sl-btn-mag">
                        {emailLoading ? 'Signing in...' : 'Sign In'}
                      </button>
                      {renderOauthButtons()}
                    </form>

                    {/* Sign up */}
                    <form
                      className={`sl-fpanel${mode === 'signup' ? ' sl-show' : ''}`}
                      onSubmit={handleEmailSubmit}
                    >
                      {renderEmailField(<MailIcon />)}
                      <PasswordField
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggleVisibility={() => setShowPassword(!showPassword)}
                        autoComplete="new-password"
                      />
                      <PasswordField
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        visible={showConfirmPassword}
                        onToggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
                        autoComplete="new-password"
                        minLength={8}
                      />
                      {password.length > 0 && renderChecklist()}
                      <button
                        type="submit"
                        disabled={emailLoading || !signupRequirementsMet}
                        className="sl-btn-mag"
                      >
                        {emailLoading ? 'Creating account...' : 'Create Account'}
                      </button>
                    </form>
                  </>
                )}
              </div>

              {/* right: swirl + welcome */}
              <div className="sl-visual">
                <div className="sl-swirl">
                  <i className="sl-s1" />
                  <i className="sl-s2" />
                  <i className="sl-s3" />
                </div>
                <div className="sl-v-copy">
                  <h1>{visualTitle}</h1>
                  <p>{visualText}</p>
                  <span className="sl-tour-chip">
                    <span className="sl-dot" /> NEW · voice-narrated guided tour inside
                  </span>
                </div>
                <div className="sl-v-foot">
                  {mode === 'signin' ? (
                    <>
                      Not a member?{' '}
                      <button type="button" onClick={() => switchMode('signup')}>
                        Sign up now
                      </button>
                    </>
                  ) : (
                    <>
                      Already a member?{' '}
                      <button type="button" onClick={() => switchMode('signin')}>
                        Sign in now
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ About ============ */}
      <section className="sl-sec" id="sl-about">
        <div className="sl-wrap">
          <span className="sl-sec-tag sl-reveal">About</span>
          <h2 className="sl-reveal sl-d1">Your work, logged beautifully.</h2>
          <p className="sl-lead sl-reveal sl-d2">
            The Digital Logbook turns scattered tasks, deadlines and notes into one calm, searchable
            timeline. Type naturally — &ldquo;worked on the login feature for 2 hours&rdquo; — and
            it files itself under the right project with the right due date.
          </p>
          <div className="sl-grid3">
            <div className="sl-cardy sl-reveal sl-d1">
              <div className="sl-ic">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3>Plan visually</h3>
              <p>Calendar, kanban and a zoomable timeline — the same work seen six ways.</p>
            </div>
            <div className="sl-cardy sl-reveal sl-d2">
              <div className="sl-ic">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3>Never miss a deadline</h3>
              <p>Due-soon and overdue alerts by email and in the in-app bell.</p>
            </div>
            <div className="sl-cardy sl-reveal sl-d3">
              <div className="sl-ic">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Own your data</h3>
              <p>Export to JSON, CSV, Markdown or iCalendar anytime — no lock-in.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ About Us ============ */}
      <section className="sl-sec" id="sl-about-us">
        <div className="sl-wrap">
          <span className="sl-sec-tag sl-reveal">About Us</span>
          <h2 className="sl-reveal sl-d1">Built by team Codacaine.</h2>
          <p className="sl-lead sl-reveal sl-d2">
            Six students, one inspiration: turning ambition into momentum. We built the logbook we
            always wanted — then taught it to introduce itself.
          </p>
          <div className="sl-team">
            {TEAM.map(([initials, name], i) => (
              <div key={name} className={`sl-member sl-reveal sl-d${(i % 3) + 1}`}>
                <div className="sl-av">{initials}</div>
                <h3>{name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Features ============ */}
      <section className="sl-sec" id="sl-features">
        <div className="sl-wrap">
          <span className="sl-sec-tag sl-reveal">Features</span>
          <h2 className="sl-reveal sl-d1">Everything in one place.</h2>
          <p className="sl-lead sl-reveal sl-d2">
            Sign in once and the whole workspace is there — with a friendly voice to walk you
            through it.
          </p>
          <div className="sl-fgrid">
            <div className="sl-cardy sl-fcard sl-reveal sl-d1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <h3>Calendar</h3>
              <p>Entries on their due dates; drag to reschedule.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="18" />
              </svg>
              <h3>Kanban</h3>
              <p>Drag cards between Up Next, In Motion and Done.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
              </svg>
              <h3>Today</h3>
              <p>Overdue first, then due today, then in progress.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="5" x2="15" y2="5" />
                <circle cx="17" cy="5" r="2" />
                <line x1="3" y1="12" x2="11" y2="12" />
                <circle cx="13" cy="12" r="2" />
                <line x1="3" y1="19" x2="19" y2="19" />
                <circle cx="21" cy="19" r="2" />
              </svg>
              <h3>Timeline</h3>
              <p>Zoomable Gantt with dependency arrows.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d1">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <h3>Import &amp; Export</h3>
              <p>JSON, CSV, Markdown and iCalendar round-trips.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="20" x2="12" y2="10" />
                <line x1="18" y1="20" x2="18" y2="4" />
                <line x1="6" y1="20" x2="6" y2="16" />
              </svg>
              <h3>Statistics</h3>
              <p>Streaks, progress charts, time breakdowns.</p>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
              <h3>Voice-narrated tour</h3>
              <p>A friendly voice walks new users through every view.</p>
              <span className="sl-nb">NEW</span>
            </div>
            <div className="sl-cardy sl-fcard sl-reveal sl-d4">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <h3>Themes &amp; fonts</h3>
              <p>Pastel, dark and vintage palettes with previews.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="sl-footer">
        <div className="sl-wrap sl-foot">
          <SlBrand />
          <small>© 2026 Codacaine</small>
          <div className="sl-links">
            {SECTION_LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
