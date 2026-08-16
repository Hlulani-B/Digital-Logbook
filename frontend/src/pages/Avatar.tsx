import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateAvatar } from "@/lib/profileService";

// Preset avatar options (DiceBear "identicon" / "shapes" style seeds)
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
];

interface AvatarPageProps {
  currentAvatar?: string;
  onUpdated?: (avatarUrl: string) => void;
}

export function AvatarPage({ currentAvatar, onUpdated }: AvatarPageProps) {
  const email = localStorage.getItem("email");
  const navigate = useNavigate();
  const [selected, setSelected] = useState(currentAvatar || AVATAR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSelect = async (avatarUrl: string) => {
    if (!email || saving) return;
    setSelected(avatarUrl);
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await updateAvatar(email, avatarUrl);
      if (result?.error) throw new Error(result.error);
      setSuccess(true);
      onUpdated?.(avatarUrl);
      setTimeout(() => setSuccess(false), 2000);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ maxWidth: 480 }}>
          <div className="auth-logo">DL</div>
          <h1 className="auth-title">Choose your avatar</h1>
          <p className="auth-subtitle">Pick one that represents you</p>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">Avatar updated!</div>}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
              gap: "0.75rem",
              marginTop: "0.75rem",
              justifyContent: "center",
            }}
          >
            {AVATAR_OPTIONS.map((avatarUrl) => {
              const isSelected = avatarUrl === selected;
              return (
                <button
                  key={avatarUrl}
                  type="button"
                  onClick={() => handleSelect(avatarUrl)}
                  disabled={saving}
                  aria-label="Select avatar"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    padding: 0,
                    border: isSelected
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                    background: "var(--surface)",
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving && !isSelected ? 0.6 : 1,
                    transition: "border-color 0.15s ease, opacity 0.15s ease",
                  }}
                >
                  <img
                    src={avatarUrl}
                    alt=""
                    width={64}
                    height={64}
                    style={{ display: "block", width: "100%", height: "100%" }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
