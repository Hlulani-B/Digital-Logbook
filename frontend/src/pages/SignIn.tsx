import { useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "@/context/AuthContext";

type Provider = "google" | "github";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export function SignIn() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const captchaTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const { signInWithGoogle, signInWithGitHub, signInWithEmail, signUpWithEmail } = useAuth();

  const handleSignIn = async (provider: Provider) => {
    if (!captchaVerified) return;
    setOauthLoading(provider);
    setError(null);
    setSuccess(null);
    try {
      if (provider === "google") {
        await signInWithGoogle();
      } else {
        await signInWithGitHub();
      }
    } catch (err) {
      const label = provider === "google" ? "Google" : "GitHub";
      setError(err instanceof Error ? err.message : `${label} sign-in failed`);
      setOauthLoading(null);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaVerified) return;
    setEmailLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password, captchaTokenRef.current || undefined);
      } else {
        await signUpWithEmail(email, password, captchaTokenRef.current || undefined);
        setSuccess(
          "Account created! Please check your email to confirm your account before signing in."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
      // Reset CAPTCHA after a failed attempt so the user gets a fresh token
      turnstileRef.current?.reset();
      setCaptchaVerified(false);
      captchaTokenRef.current = null;
    } finally {
      setEmailLoading(false);
    }
  };

  const isLoading = oauthLoading !== null || emailLoading;

  return (
    <>
      <div className="bg-mesh" />
      <div className="auth-container">
        <div className="glass auth-card animate-in">
          <div className="auth-logo">DL</div>
          <h1 className="auth-title">Digital Logbook</h1>
          <p className="auth-subtitle">Track your time, own your progress</p>

          {error && <div className="auth-error">{error}</div>}
          {success && (
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-xs)",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.2)",
                color: "#86efac",
                fontSize: "0.8125rem",
                lineHeight: "1.5",
                textAlign: "left",
                marginBottom: "1rem",
              }}
            >
              {success}
            </div>
          )}

          {/* OAuth */}
          <div className="auth-buttons">
            <button
              onClick={() => handleSignIn("google")}
              disabled={isLoading || !captchaVerified}
              className="oauth-btn"
              aria-label="Continue with Google"
              title="Continue with Google"
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            </button>

            <button
              onClick={() => handleSignIn("github")}
              disabled={isLoading || !captchaVerified}
              className="oauth-btn"
              aria-label="Continue with GitHub"
              title="Continue with GitHub"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
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
                autoComplete="email"
              />
            </div>

            <div className="field-group">
              <label htmlFor="password" className="field-label">
                Password
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "signup" && (
                <p className="field-hint">Password must be at least 6 characters.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={emailLoading || !captchaVerified}
              className="btn-primary"
              style={{ padding: "0.75rem", fontSize: "0.875rem" }}
            >
              {emailLoading
                ? mode === "signin"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "signin"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* Toggle + Forgot Password */}
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setSuccess(null);
              }}
              className="auth-mode-toggle"
            >
              {mode === "signin"
                ? "Don't have an account? Create one"
                : "Already have an account? Sign in"}
            </button>

            {mode === "signin" && (
              <Link to="/reset-password" className="auth-trouble-link" style={{ marginTop: "0.5rem" }}>
                Forgot password?
              </Link>
            )}
          </div>

          {/* CAPTCHA */}
          <div className="captcha-wrapper">
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              onSuccess={(token) => {
                setCaptchaVerified(true);
                captchaTokenRef.current = token;
              }}
              onError={() => {
                setCaptchaVerified(false);
                captchaTokenRef.current = null;
              }}
              onExpire={() => {
                setCaptchaVerified(false);
                captchaTokenRef.current = null;
              }}
              options={{
                theme: "dark",
                size: "flexible",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
