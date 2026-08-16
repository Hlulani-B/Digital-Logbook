import { useState, useRef, type ChangeEvent } from "react";
import { updateAvatar } from "@/lib/profileService";
import { useTheme } from "@/hooks/useTheme";
import {
  FiSmile,
  FiSun,
  FiCompass,
  FiFeather,
  FiMonitor,
  FiMusic,
  FiHeart,
  FiStar,
} from "react-icons/fi";
import type { IconType } from "react-icons";

interface AvatarPickerProps {
  currentAvatar?: string | null;
  email?: string;
  onAvatarChange?: (url: string) => void;
}

const PRESET_AVATARS: { icon: IconType; bg: string; fg: string; label: string }[] = [
  { icon: FiSmile, bg: "#fef3c7", fg: "#d97706", label: "Smiley" },
  { icon: FiSun, bg: "#fce7f3", fg: "#db2777", label: "Sun" },
  { icon: FiCompass, bg: "#dbeafe", fg: "#2563eb", label: "Compass" },
  { icon: FiFeather, bg: "#dcfce7", fg: "#16a34a", label: "Feather" },
  { icon: FiMonitor, bg: "#e0e7ff", fg: "#4f46e5", label: "Tech" },
  { icon: FiMusic, bg: "#fae8ff", fg: "#a855f7", label: "Music" },
  { icon: FiHeart, bg: "#ffe4e6", fg: "#e11d48", label: "Heart" },
  { icon: FiStar, bg: "#fef9c3", fg: "#ca8a04", label: "Star" },
];

export function AvatarPicker({ currentAvatar, email, onAvatarChange }: AvatarPickerProps) {
  const [avatar, setAvatar] = useState(currentAvatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAvatar(url);
      onAvatarChange?.(url);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!email || !avatar) return;
    setSaving(true);
    setError(null);
    try {
      const result = await updateAvatar(email, avatar);
      if (result?.error) throw new Error(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
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
          fontSize: "2rem",
          fontWeight: 700,
          color: isDark ? "#e5e7eb" : "#6b7280",
          border: `2px solid ${isDark ? "rgba(255,255,255,0.12)" : "#e5e7eb"}`,
        }}
      >
        {avatar ? (
          avatar.startsWith("preset:") ? (
            (() => {
              const preset = PRESET_AVATARS.find(p => `preset:${p.label}` === avatar);
              if (!preset) return null;
              const Icon = preset.icon;
              return <Icon size={36} style={{ color: preset.fg }} />;
            })()
          ) : (
            <img
              src={avatar}
              alt="Avatar"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              referrerPolicy="no-referrer"
            />
          )
        ) : (
          "?"
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Photo
        </button>
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem" }}
          onClick={() => setShowPresets((v) => !v)}
        >
          Choose Preset
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Preset grid */}
      {showPresets && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.5rem",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
            background: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb",
            border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
          }}
        >
          {PRESET_AVATARS.map((preset) => {
            const Icon = preset.icon;
            const isActive = avatar === `preset:${preset.label}`;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setAvatar(`preset:${preset.label}`);
                  onAvatarChange?.(`preset:${preset.label}`);
                  setShowPresets(false);
                }}
                aria-label={preset.label}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor: "pointer",
                  background: preset.bg,
                  color: preset.fg,
                  padding: 0,
                  transition: "border-color 0.15s ease, transform 0.15s ease",
                }}
              >
                <Icon size={22} />
              </button>
            );
          })}
        </div>
      )}

      {/* Save button */}
      {avatar && avatar !== currentAvatar && (
        <button
          type="button"
          className="btn-primary"
          style={{ fontSize: "0.8125rem", padding: "0.375rem 1rem" }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Avatar"}
        </button>
      )}

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.8125rem", margin: 0 }}>{error}</p>
      )}
    </div>
  );
}
