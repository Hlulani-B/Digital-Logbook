import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setTone, TONE_OPTIONS, type Tone } from "@/functions/tone";

/**
 * ToneSetup — onboarding page between Avatar and Dashboard.
 * Asks the user: "How should this notebook talk to you?"
 */
export function ToneSetup() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Tone>("soft");
  const [saving, setSaving] = useState(false);

  const handleContinue = () => {
    setSaving(true);
    setTone(selected);
    setTimeout(() => navigate("/theme-setup"), 400);
  };

  const handleSkip = () => {
    setTone("soft");
    navigate("/theme-setup");
  };

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ maxWidth: 520 }}>
          <div className="auth-logo">
            <img src="/notebook.jpeg" alt="Digital Logbook" style={{ width: 48, height: 48, borderRadius: "14px", objectFit: "cover" }} />
          </div>
          <h1 className="auth-title">How should your notebook talk to you?</h1>
          <p className="auth-subtitle">Choose a personality. You can always change this later in Settings.</p>

          <div className="tone-options">
            {TONE_OPTIONS.map((option) => {
              const isSelected = option.value === selected;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`tone-option ${isSelected ? "tone-option-selected" : ""}`}
                  onClick={() => setSelected(option.value)}
                >
                  <span className="tone-icon"><option.icon size={24} /></span>
                  <div className="tone-info">
                    <span className="tone-label">{option.label}</span>
                    <span className="tone-desc">{option.description}</span>
                  </div>
                  <div className={`tone-radio ${isSelected ? "tone-radio-checked" : ""}`} />
                </button>
              );
            })}
          </div>

          {/* Live preview */}
          <div className="tone-preview">
            <p className="tone-preview-label">Preview</p>
            <p className="tone-preview-text">
              {selected === "soft" && "Hey! You're doing great. Let's keep that momentum going today."}
              {selected === "tough" && "Alright, let's see what you've got. No excuses today."}
              {selected === "cynical" && "Oh look, you're back. Another day of pretending to be productive? Let's go."}
            </p>
          </div>

          <div className="tone-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleContinue}
              disabled={saving}
            >
              {saving ? "Setting up..." : "Let's go"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ToneSetup;
