import { useState, useRef, type ChangeEvent } from "react";
import { updateAvatar } from "@/lib/profileService";
import { useTheme } from "@/hooks/useTheme";

interface AvatarPickerProps {
  currentAvatar?: string | null;
  email?: string;
  onAvatarChange?: (url: string) => void;
}

const PRESET_AVATARS = [
  "https://api.dicebear.com/72/fluent-emoji/1F600.png",
  "https://api.dicebear.com/72/fluent-emoji/1F60E.png",
  "https://api.dicebear.com/72/fluent-emoji/1F680.png",
  "https://api.dicebear.com/72/fluent-emoji/1F331.png",
  "https://api.dicebear.com/72/fluent-emoji/1F4BB.png",
  "https://api.dicebear.com/72/fluent-emoji/1F3B5.png",
  "https://api.dicebear.com/72/fluent-emoji/1F431.png",
  "https://api.dicebear.com/72/fluent-emoji/1F98A.png",
];

export function AvatarPicker({ currentAvatar, email, onAvatarChange }: AvatarPickerProps) {
  const [avatar, setAvatar] = useState(currentAvatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

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

  const handlePresetSelect = (url: string) => {
    setAvatar(url);
    onAvatarChange?.(url);
    setShowPresets(false);
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
          background: theme === "dark" ? "rgba(255,255,255,0.08)" : "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "2rem",
          fontWeight: 700,
          color: theme === "dark" ? "#e5e7eb" : "#6b7280",
          border: `2px solid ${theme === "dark" ? "rgba(255,255,255,0.12)" : "#e5e7eb"}`,
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
            background: theme === "dark" ? "rgba(255,255,255,0.04)" : "#f9fafb",
            border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.08)" : "#e5e7eb"}`,
          }}
        >
          {PRESET_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => handlePresetSelect(url)}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                overflow: "hidden",
                border: avatar === url ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer",
                background: "none",
                padding: 0,
              }}
            >
              <img
                src={url}
                alt="Preset avatar"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
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
