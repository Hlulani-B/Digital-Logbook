import { useState, useEffect, useCallback, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useTheme } from "@/hooks/useTheme";
import type { Theme } from "@/hooks/useTheme";
import { AvatarPicker } from "@/components/AvatarPicker";
import {
  getProfile,
  updateName,
  updateUsername,
} from "@/lib/profileService";

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
  theme: string;
  fontFamily: string;
  cornerStyle: string;
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

function applyFont(fontFamily: string) {
  if (fontFamily === "lora") {
    document.documentElement.removeAttribute("data-font");
  } else {
    document.documentElement.setAttribute("data-font", fontFamily);
  }
  localStorage.setItem("dl_font", fontFamily);
}

function applyCorners(cornerStyle: string) {
  if (cornerStyle === "rounded") {
    document.documentElement.removeAttribute("data-corners");
  } else {
    document.documentElement.setAttribute("data-corners", cornerStyle);
  }
  localStorage.setItem("dl_corners", cornerStyle);
}

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
  const captchaTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const { isDark } = useTheme();

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      await onResetPassword(email, captchaTokenRef.current || undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
      // Reset CAPTCHA after a failed attempt so the user gets a fresh token
      turnstileRef.current?.reset();
      setCaptchaVerified(false);
      captchaTokenRef.current = null;
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
          color: isDark ? "#86efac" : "#15803d",
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
            color: isDark ? "#fca5a5" : "#b91c1c",
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
          ref={turnstileRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"}
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
            theme: isDark ? "dark" : "light",
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
  displayName: _displayName,
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
    theme: "light",
    fontFamily: "lora",
    cornerStyle: "rounded",
    autoSave: true,
    compactMode: false,
    notifications: true,
    weeklyReminder: false,
  };

  const [profile] = useState<ProfileSettings>(() =>
    loadSettings(profileKey, defaultProfile)
  );
  const [prefs, setPrefs] = useState<Preferences>(() =>
    loadSettings(prefsKey, defaultPrefs)
  );
  const { setTheme, isDark } = useTheme();

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
    setTheme(prefs.theme as Theme);
    applyFont(prefs.fontFamily);
    applyCorners(prefs.cornerStyle);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Real profile data from profile service
  const [serverProfile, setServerProfile] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Fetch profile from service when panel opens
  useEffect(() => {
    if (!open || !email) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await getProfile(email);
        if (cancelled) return;
        if (result?.error) throw new Error(result.error);
        setServerProfile(result);
        setName(result?.name || "");
        setUsername(result?.username || "");
      } catch (err) {
        if (!cancelled) {
          setProfileError(err instanceof Error ? err.message : "Could not load profile");
        }
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, email]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const nameResult = await updateName(email, name.trim());
      if (nameResult?.error) throw new Error(nameResult.error);

      const usernameResult = await updateUsername(email, username.trim());
      if (usernameResult?.error) throw new Error(usernameResult.error);

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setProfileSaving(false);
    }
  };

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
              {/* Avatar picker */}
              <div className="panel-section">
                <AvatarPicker
                  currentAvatar={serverProfile?.avatar_url as string || avatarUrl}
                  email={email}
                />
              </div>

              {/* Profile details */}
              <div className="panel-section">
                <p className="panel-section-title">Profile Details</p>

                {profileError && (
                  <div style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-xs)",
                    background: "var(--danger-glow)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: isDark ? "#fca5a5" : "#b91c1c",
                    fontSize: "0.8125rem",
                    marginBottom: "0.75rem",
                  }}>
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-xs)",
                    background: "rgba(34,197,94,0.1)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    color: isDark ? "#86efac" : "#15803d",
                    fontSize: "0.8125rem",
                    marginBottom: "0.75rem",
                  }}>
                    Profile updated!
                  </div>
                )}

                {loadingProfile ? (
                  <p className="field-hint">Loading profile...</p>
                ) : (
                  <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                    <div className="field-group">
                      <label className="field-label" htmlFor="settings-name">Full name</label>
                      <input
                        id="settings-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label" htmlFor="settings-username">Username</label>
                      <input
                        id="settings-username"
                        type="text"
                        required
                        minLength={3}
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                        }
                        className="field-input"
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">Email</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="field-input"
                        style={{ opacity: 0.6, cursor: "not-allowed" }}
                      />
                      <p className="field-hint">Email cannot be changed here.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={profileSaving || !name.trim() || username.trim().length < 3}
                      className="btn-primary"
                      style={{ alignSelf: "flex-start" }}
                    >
                      {profileSaving ? "Saving..." : "Save changes"}
                    </button>
                  </form>
                )}
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

                <div className="field-group">
                  <label className="field-label" htmlFor="theme">
                    Theme
                  </label>
                  <select
                    id="theme"
                    className="field-input"
                    value={prefs.theme}
                    onChange={(e) => {
                      const newTheme = e.target.value as Theme;
                      setPrefs((p) => ({ ...p, theme: newTheme }));
                      setTheme(newTheme);
                    }}
                  >
                    <option value="light">Light (White)</option>
                    <option value="dark">Dark</option>
                    <option value="pink">Pink</option>
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="green">Green</option>
                    <option value="brown">Brown (Vintage)</option>
                  </select>
                  <p className="field-hint">
                    Choose how the logbook looks to you.
                  </p>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="fontFamily">
                    Font
                  </label>
                  <select
                    id="fontFamily"
                    className="field-input"
                    value={prefs.fontFamily}
                    onChange={(e) => {
                      const newFont = e.target.value;
                      setPrefs((p) => ({ ...p, fontFamily: newFont }));
                      applyFont(newFont);
                    }}
                  >
                    <option value="lora">Lora (Default)</option>
                    <option value="jakarta">Plus Jakarta Sans</option>
                    <option value="playfair">Playfair Display</option>
                    <option value="crimson">Crimson Text</option>
                    <option value="garamond">EB Garamond</option>
                  </select>
                  <p className="field-hint">
                    Change the typography across the entire logbook.
                  </p>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="cornerStyle">
                    Corner Style
                  </label>
                  <select
                    id="cornerStyle"
                    className="field-input"
                    value={prefs.cornerStyle}
                    onChange={(e) => {
                      const newCorners = e.target.value;
                      setPrefs((p) => ({ ...p, cornerStyle: newCorners }));
                      applyCorners(newCorners);
                    }}
                  >
                    <option value="rounded">Rounded (Default)</option>
                    <option value="soft">Soft</option>
                    <option value="sharp">Sharp (Vintage)</option>
                  </select>
                  <p className="field-hint">
                    Control how rounded the corners are across the logbook.
                  </p>
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
                <p className="panel-section-title" style={{ color: "var(--danger-text)" }}>
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
                  color: isDark ? "#4ade80" : "#16a34a",
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
