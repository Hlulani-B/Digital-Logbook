import { useState, useEffect, useCallback } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

type Tab = "profile" | "preferences" | "account";

interface ProfileSettings {
  preferredName: string;
  role: string;
  bio: string;
  studentNumber: string;
}

interface Preferences {
  defaultView: string;
  weekStartsOn: string;
  timeFormat: string;
  autoSave: boolean;
  compactMode: boolean;
  notifications: boolean;
  weeklyReminder: boolean;
}

interface SettingsPanelProps {
  open: boolean;
  initialTab: Tab;
  userId: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  provider: string;
  onClose: () => void;
  onDeleteAccount: () => void;
  onResetPassword: (email: string, captchaToken?: string) => Promise<void>;
  deleting: boolean;
  deleteError: string | null;
}

const STORAGE_PREFIX = "dl_settings_";

function loadSettings<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

function saveSettings(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* Inline reset password component for the Account tab */
function ResetPasswordInline({
  email,
  onResetPassword,
}: {
  email: string;
  onResetPassword: (email: string, captchaToken?: string) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await onResetPassword(email, captchaToken || undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-xs)",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)",
          color: "#86efac",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
        }}
      >
        A password reset link has been sent to <strong>{email}</strong>.
        Check your inbox (and spam folder). The link expires in 1 hour.
      </div>
    );
  }

  return (
    <>
      <p className="danger-desc" style={{ color: "var(--text-muted)" }}>
        Send a password reset link to your email address. This is useful if you need to set up
        email-based sign-in alongside your OAuth provider.
      </p>
      {error && (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-xs)",
            background: "var(--danger-glow)",
            border: "1px solid rgba(239,68,68,0.2)",
            color: "#fca5a5",
            fontSize: "0.8125rem",
            marginBottom: "0.75rem",
          }}
        >
          {error}
        </div>
      )}
      <button
        onClick={handleSend}
        disabled={sending || !email || !captchaVerified}
        className="btn-secondary"
      >
        {sending ? "Sending..." : "Send Reset Link"}
      </button>

      <div className="captcha-wrapper" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
        <Turnstile
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
          onSuccess={(token) => {
            setCaptchaVerified(true);
            setCaptchaToken(token);
          }}
          onError={() => {
            setCaptchaVerified(false);
            setCaptchaToken(null);
          }}
          onExpire={() => {
            setCaptchaVerified(false);
            setCaptchaToken(null);
          }}
          options={{
            theme: "dark",
            size: "flexible",
          }}
        />
      </div>
    </>
  );
}

export function SettingsPanel({
  open,
  initialTab,
  userId,
  displayName,
  email,
  avatarUrl,
  provider,
  onClose,
  onDeleteAccount,
  onResetPassword,
  deleting,
  deleteError,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [saved, setSaved] = useState(false);

  const profileKey = `${STORAGE_PREFIX}profile_${userId}`;
  const prefsKey = `${STORAGE_PREFIX}prefs_${userId}`;

  const defaultProfile: ProfileSettings = {
    preferredName: "",
    role: "student",
    bio: "",
    studentNumber: "",
  };

  const defaultPrefs: Preferences = {
    defaultView: "dashboard",
    weekStartsOn: "monday",
    timeFormat: "24h",
    autoSave: true,
    compactMode: false,
    notifications: true,
    weeklyReminder: false,
  };

  const [profile, setProfile] = useState<ProfileSettings>(() =>
    loadSettings(profileKey, defaultProfile)
  );
  const [prefs, setPrefs] = useState<Preferences>(() =>
    loadSettings(prefsKey, defaultPrefs)
  );

  // Reset tab when panel opens
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setSaved(false);
    }
  }, [open, initialTab]);

  // Close on escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const handleSave = () => {
    saveSettings(profileKey, profile);
    saveSettings(prefsKey, prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="panel-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="panel-sheet">
        {/* Header */}
        <div className="panel-header">
          <h2>
            {tab === "profile"
              ? "Manage Profile"
              : tab === "preferences"
                ? "Settings"
                : "Account"}
          </h2>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="panel-tabs">
          <button
            className={`panel-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => setTab("profile")}
          >
            Profile
          </button>
          <button
            className={`panel-tab ${tab === "preferences" ? "active" : ""}`}
            onClick={() => setTab("preferences")}
          >
            Preferences
          </button>
          <button
            className={`panel-tab ${tab === "account" ? "active" : ""}`}
            onClick={() => setTab("account")}
          >
            Account
          </button>
        </div>

        {/* Body */}
        <div className="panel-body">
          {/* ===== PROFILE TAB ===== */}
          {tab === "profile" && (
            <>
              {/* Avatar section */}
              <div className="profile-avatar-section">
                <div className="profile-avatar-lg">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="profile-avatar-info">
                  <p className="profile-avatar-name">{displayName}</p>
                  <p className="profile-avatar-email">{email}</p>
                  <span className="profile-avatar-badge">
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {provider}
                  </span>
                </div>
              </div>

              <div className="panel-section">
                <p className="panel-section-title">Personal Information</p>

                <div className="field-group">
                  <label className="field-label" htmlFor="preferredName">
                    Preferred Name
                  </label>
                  <input
                    id="preferredName"
                    type="text"
                    className="field-input"
                    placeholder={displayName}
                    value={profile.preferredName}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, preferredName: e.target.value }))
                    }
                  />
                  <p className="field-hint">
                    This is how you'll be greeted across the logbook.
                  </p>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="role">Role</label>
                  <select
                    id="role"
                    className="field-input"
                    value={profile.role}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, role: e.target.value }))
                    }
                  >
                    <option value="student">Student</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="tutor">Tutor</option>
                    <option value="professional">Professional</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="studentNumber">
                    Student Number
                  </label>
                  <input
                    id="studentNumber"
                    type="text"
                    className="field-input"
                    placeholder="e.g. 2456789"
                    value={profile.studentNumber}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        studentNumber: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="panel-section">
                <p className="panel-section-title">About You</p>
                <div className="field-group">
                  <label className="field-label" htmlFor="bio">
                    Bio / Notes
                  </label>
                  <textarea
                    id="bio"
                    className="field-input"
                    placeholder="Tell us about yourself, your goals, or anything you'd like to remember..."
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, bio: e.target.value }))
                    }
                  />
                  <p className="field-hint">
                    Optional — visible only to you.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ===== PREFERENCES TAB ===== */}
          {tab === "preferences" && (
            <>
              <div className="panel-section">
                <p className="panel-section-title">Display</p>

                <div className="field-group">
                  <label className="field-label" htmlFor="defaultView">
                    Default View
                  </label>
                  <select
                    id="defaultView"
                    className="field-input"
                    value={prefs.defaultView}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, defaultView: e.target.value }))
                    }
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="entries">All Entries</option>
                    <option value="projects">Projects</option>
                    <option value="calendar">Calendar</option>
                  </select>
                  <p className="field-hint">
                    Where you land after signing in.
                  </p>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="weekStartsOn">
                    Week Starts On
                  </label>
                  <select
                    id="weekStartsOn"
                    className="field-input"
                    value={prefs.weekStartsOn}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, weekStartsOn: e.target.value }))
                    }
                  >
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                    <option value="saturday">Saturday</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="timeFormat">
                    Time Format
                  </label>
                  <select
                    id="timeFormat"
                    className="field-input"
                    value={prefs.timeFormat}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, timeFormat: e.target.value }))
                    }
                  >
                    <option value="24h">24-hour (14:30)</option>
                    <option value="12h">12-hour (2:30 PM)</option>
                  </select>
                </div>
              </div>

              <div className="panel-section">
                <p className="panel-section-title">Behavior</p>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <p className="toggle-label">Auto-save entries</p>
                    <p className="toggle-desc">
                      Automatically save drafts as you type.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={prefs.autoSave}
                      onChange={(e) =>
                        setPrefs((p) => ({ ...p, autoSave: e.target.checked }))
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <p className="toggle-label">Compact mode</p>
                    <p className="toggle-desc">
                      Tighter spacing to see more entries at once.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={prefs.compactMode}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          compactMode: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>

              <div className="panel-section">
                <p className="panel-section-title">Notifications</p>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <p className="toggle-label">Email notifications</p>
                    <p className="toggle-desc">
                      Receive updates about your account.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={prefs.notifications}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          notifications: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>

                <div className="toggle-row">
                  <div className="toggle-info">
                    <p className="toggle-label">Weekly log reminder</p>
                    <p className="toggle-desc">
                      Get a nudge to log your hours each Friday.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={prefs.weeklyReminder}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          weeklyReminder: e.target.checked,
                        }))
                      }
                    />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>
            </>
          )}

          {/* ===== ACCOUNT TAB ===== */}
          {tab === "account" && (
            <>
              <div className="panel-section">
                <p className="panel-section-title">Account Information</p>
                <div className="settings-grid">
                  <div className="setting-item">
                    <span className="setting-label">Email</span>
                    <span className="setting-value">{email}</span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">Sign-in Method</span>
                    <span className="setting-value" style={{ textTransform: "capitalize" }}>
                      {provider}
                    </span>
                  </div>
                  <div className="setting-item">
                    <span className="setting-label">User ID</span>
                    <span className="setting-value mono">{userId}</span>
                  </div>
                </div>
              </div>

              <hr className="divider" />

              {/* Reset Password */}
              <div className="panel-section">
                <p className="panel-section-title">Password</p>
                <ResetPasswordInline email={email} onResetPassword={onResetPassword} />
              </div>

              <hr className="divider" />

              <div className="panel-section danger-zone">
                <p className="panel-section-title" style={{ color: "#f87171" }}>
                  Danger Zone
                </p>
                <p className="danger-desc">
                  Permanently delete your account and all associated data. This
                  action cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div className="confirm-box">
                    {deleteError && (
                      <p style={{ marginBottom: "0.75rem" }}>{deleteError}</p>
                    )}
                    <p>Are you sure? This cannot be undone.</p>
                    <div className="confirm-actions">
                      <button
                        onClick={onDeleteAccount}
                        disabled={deleting}
                        className="btn-danger-solid"
                      >
                        {deleting ? "Deleting..." : "Yes, Delete My Account"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                        }}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {tab !== "account" && (
          <div className="panel-footer">
            {saved && (
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "#4ade80",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Saved
              </span>
            )}
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-save" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        )}
      </div>
    </>
  );
}
