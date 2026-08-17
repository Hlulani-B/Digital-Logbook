import { useState } from "react";
import { updateAvatar } from "../functions/profile/profile.js";
import { useTheme } from "@/hooks/useTheme";

interface AvatarPickerProps {
  currentAvatar?: string | null;
  email?: string;
  onAvatarChange?: (url: string) => void;
}

// DiceBear avatar options (same as Avatar page)
const AVATAR_OPTIONS = [
  "https://api.dicebear.com/7.x/identicon/svg?seed=Sunset",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Ocean",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Forest",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Ember",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Storm",
  "https://api.dicebear.com/7.x/identicon/svg?seed=Meadow",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Nova",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Comet",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Aurora",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Nebula",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Solstice",
  "https://api.dicebear.com/7.x/shapes/svg?seed=Zenith",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella&backgroundColor=ffd6e8",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Rosa&backgroundColor=ffe0f0",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=f3d9fa",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia&backgroundColor=ffe4ec",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Ivy&backgroundColor=fbe4ff",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Coco&backgroundColor=ffe9f3",
];

export function AvatarPicker({ currentAvatar, email, onAvatarChange }: AvatarPickerProps) {
  const [avatar, setAvatar] = useState(currentAvatar || AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { isDark } = useTheme();

  const handleSelect = async (avatarUrl: string) => {
    if (!email || saving) return;
    setAvatar(avatarUrl);
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updateAvatar(email, avatarUrl);
      if (result?.error) throw new Error(result.error);
      setSuccess(true);
      onAvatarChange?.(avatarUrl);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <p className="panel-section-title" style={{ marginBottom: "0.25rem" }}>Avatar</p>

      {/* Current avatar preview */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          overflow: "hidden",
          background: isDark ? "rgba(255,255,255,0.08)" : "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"}`,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt="Avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span style={{ fontSize: "2rem", fontWeight: 700, color: isDark ? "#e5e7eb" : "#6b7280" }}>?</span>
        )}
      </div>

      {success && (
        <p style={{ color: isDark ? "#86efac" : "#15803d", fontSize: "0.8125rem", margin: 0 }}>
          Avatar saved!
        </p>
      )}
      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.8125rem", margin: 0 }}>{error}</p>
      )}

      {/* Avatar grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          padding: "0.75rem",
          borderRadius: "var(--radius-sm)",
          background: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
          maxWidth: "320px",
        }}
      >
        {AVATAR_OPTIONS.map((avatarUrl) => {
          const isActive = avatar === avatarUrl;
          return (
            <button
              key={avatarUrl}
              type="button"
              onClick={() => handleSelect(avatarUrl)}
              disabled={saving}
              aria-label="Select avatar"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                overflow: "hidden",
                padding: 0,
                border: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                background: "var(--surface)",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving && !isActive ? 0.6 : 1,
                transition: "border-color 0.15s ease, opacity 0.15s ease",
              }}
            >
              <img
                src={avatarUrl}
                alt=""
                width={40}
                height={40}
                style={{ display: "block", width: "100%", height: "100%" }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
