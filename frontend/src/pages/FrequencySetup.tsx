import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBellOff, FiBell, FiClock, FiZap } from 'react-icons/fi';

export type NudgeFrequency = 'silent' | 'gentle' | 'daily' | 'active';

const FREQUENCY_OPTIONS: {
  value: NudgeFrequency;
  label: string;
  description: string;
  icon: typeof FiBell;
  example: string;
}[] = [
  {
    value: 'silent',
    label: 'Silent',
    description: 'Your notebook never nudges. You open it when you want.',
    icon: FiBellOff,
    example: '',
  },
  {
    value: 'gentle',
    label: 'Gentle',
    description: "A soft nudge every 2–3 days if you haven't logged anything.",
    icon: FiBell,
    example: "Hey, it's been a couple days. Everything okay?",
  },
  {
    value: 'daily',
    label: 'Daily',
    description: "Once a day if there's something worth mentioning.",
    icon: FiClock,
    example: "You've got 2 things still in motion. Want to update them?",
  },
  {
    value: 'active',
    label: 'Active',
    description: 'Up to 2–3 nudges a day — morning prompt, evening recap, and more.',
    icon: FiZap,
    example: "Good morning! You logged 3 entries yesterday. Let's keep it going.",
  },
];

const STORAGE_KEY = 'dl_nudge_frequency';

export function setNudgeFrequency(freq: NudgeFrequency) {
  localStorage.setItem(STORAGE_KEY, freq);
}

export function getNudgeFrequency(): NudgeFrequency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['silent', 'gentle', 'daily', 'active'].includes(stored)) {
      return stored as NudgeFrequency;
    }
  } catch {}
  return 'gentle';
}

/**
 * FrequencySetup — final onboarding page before the dashboard.
 * Asks the user: "How often should your notebook talk to you?"
 */
export function FrequencySetup() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<NudgeFrequency>('gentle');
  const [saving, setSaving] = useState(false);

  const handleContinue = () => {
    setSaving(true);
    setNudgeFrequency(selected);
    setTimeout(() => navigate('/dashboard'), 400);
  };

  const handleSkip = () => {
    setNudgeFrequency('gentle');
    navigate('/dashboard');
  };

  const activeOption = FREQUENCY_OPTIONS.find((o) => o.value === selected)!;

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ maxWidth: 520 }}>
          <div className="auth-logo">
            <img
              src="/notebook.jpeg"
              alt="Digital Logbook"
              style={{ width: 48, height: 48, borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>
          <h1 className="auth-title">How often should your notebook talk to you?</h1>
          <p className="auth-subtitle">
            Your logbook can check in with nudges, reminders, and encouragement. Choose how much —
            you can change this later in Settings.
          </p>

          <div className="tone-options">
            {FREQUENCY_OPTIONS.map((option) => {
              const isSelected = option.value === selected;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`tone-option ${isSelected ? 'tone-option-selected' : ''}`}
                  onClick={() => setSelected(option.value)}
                >
                  <span className="tone-icon">
                    <Icon size={24} />
                  </span>
                  <div className="tone-info">
                    <span className="tone-label">{option.label}</span>
                    <span className="tone-desc">{option.description}</span>
                  </div>
                  <div className={`tone-radio ${isSelected ? 'tone-radio-checked' : ''}`} />
                </button>
              );
            })}
          </div>

          {/* Live preview */}
          {activeOption.example && (
            <div className="tone-preview">
              <p className="tone-preview-label">Example nudge</p>
              <p className="tone-preview-text">"{activeOption.example}"</p>
            </div>
          )}

          <div className="tone-actions">
            <button type="button" className="btn-secondary" onClick={handleSkip} disabled={saving}>
              Skip
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleContinue}
              disabled={saving}
            >
              {saving ? 'Setting up...' : 'Enter my logbook'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default FrequencySetup;
