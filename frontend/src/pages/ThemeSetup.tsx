import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, type Theme } from '@/hooks/useTheme';

const THEME_OPTIONS: { value: Theme; label: string; color: string; bg: string }[] = [
  { value: 'light', label: 'Ivory', color: '#37352f', bg: '#f5f4f2' },
  { value: 'dark', label: 'Dark', color: '#e0ddd6', bg: '#1e1e1e' },
  { value: 'pink', label: 'Blush', color: '#5c3d4a', bg: '#fce4ec' },
  { value: 'blue', label: 'Powder Blue', color: '#2c3e50', bg: '#e3f2fd' },
  { value: 'purple', label: 'Pale Lilac', color: '#4a3660', bg: '#f3e5f5' },
  { value: 'green', label: 'Sage Mist', color: '#2e4a3e', bg: '#e8f5e9' },
  { value: 'brown', label: 'Soft Tan', color: '#4e3b2a', bg: '#efebe9' },
];

const FONT_OPTIONS: { value: string; label: string; family: string }[] = [
  { value: 'lora', label: 'Lora', family: "'Lora', serif" },
  { value: 'jakarta', label: 'Plus Jakarta Sans', family: "'Plus Jakarta Sans', sans-serif" },
  { value: 'playfair', label: 'Playfair Display', family: "'Playfair Display', serif" },
  { value: 'crimson', label: 'Crimson Text', family: "'Crimson Text', serif" },
  { value: 'garamond', label: 'EB Garamond', family: "'EB Garamond', serif" },
];

const CORNER_OPTIONS: { value: string; label: string; radius: string }[] = [
  { value: 'rounded', label: 'Rounded', radius: '10px' },
  { value: 'soft', label: 'Soft', radius: '16px' },
  { value: 'sharp', label: 'Sharp', radius: '2px' },
];

function applyFont(fontFamily: string) {
  if (fontFamily === 'lora') {
    document.documentElement.removeAttribute('data-font');
  } else {
    document.documentElement.setAttribute('data-font', fontFamily);
  }
  localStorage.setItem('dl_font', fontFamily);
}

function applyCorners(cornerStyle: string) {
  if (cornerStyle === 'rounded') {
    document.documentElement.removeAttribute('data-corners');
  } else {
    document.documentElement.setAttribute('data-corners', cornerStyle);
  }
  localStorage.setItem('dl_corners', cornerStyle);
}

/**
 * ThemeSetup — onboarding page after ToneSetup.
 * Lets the user pick theme, font, and corner style with live preview.
 */
export function ThemeSetup() {
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<Theme>('light');
  const [selectedFont, setSelectedFont] = useState('lora');
  const [selectedCorners, setSelectedCorners] = useState('rounded');
  const [saving, setSaving] = useState(false);

  const handleContinue = () => {
    setSaving(true);
    setTheme(selectedTheme);
    applyFont(selectedFont);
    applyCorners(selectedCorners);
    setTimeout(() => navigate('/frequency-setup'), 400);
  };

  const handleSkip = () => {
    setTheme('light');
    applyFont('lora');
    applyCorners('rounded');
    navigate('/frequency-setup');
  };

  // Live-preview theme
  const liveTheme = THEME_OPTIONS.find((t) => t.value === selectedTheme)!;

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ maxWidth: 540 }}>
          <div className="auth-logo">
            <img
              src="/notebook.jpeg"
              alt="Digital Logbook"
              style={{ width: 48, height: 48, borderRadius: '14px', objectFit: 'cover' }}
            />
          </div>
          <h1 className="auth-title">Make it yours</h1>
          <p className="auth-subtitle">
            Pick a look that feels right. You can always change this later in Settings.
          </p>

          {/* ── Theme swatches ── */}
          <div className="theme-section">
            <label className="theme-section-label">Colour theme</label>
            <div className="theme-swatches">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`theme-swatch ${t.value === selectedTheme ? 'theme-swatch-selected' : ''}`}
                  onClick={() => {
                    setSelectedTheme(t.value);
                    setTheme(t.value);
                  }}
                  title={t.label}
                >
                  <span
                    className="theme-swatch-circle"
                    style={{ background: t.bg, borderColor: t.color }}
                  />
                  <span className="theme-swatch-name">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Font picker ── */}
          <div className="theme-section">
            <label className="theme-section-label">Font</label>
            <div className="theme-font-list">
              {FONT_OPTIONS.map((f) => {
                const isSel = f.value === selectedFont;
                return (
                  <button
                    key={f.value}
                    type="button"
                    className={`theme-font-option ${isSel ? 'theme-font-selected' : ''}`}
                    onClick={() => {
                      setSelectedFont(f.value);
                      applyFont(f.value);
                    }}
                    style={{ fontFamily: f.family }}
                  >
                    <span className="theme-font-preview" style={{ fontFamily: f.family }}>
                      The quick brown fox
                    </span>
                    <span className="theme-font-name">{f.label}</span>
                    {isSel && <div className="theme-font-check" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Corner style ── */}
          <div className="theme-section">
            <label className="theme-section-label">Corner style</label>
            <div className="theme-corner-list">
              {CORNER_OPTIONS.map((c) => {
                const isSel = c.value === selectedCorners;
                return (
                  <button
                    key={c.value}
                    type="button"
                    className={`theme-corner-option ${isSel ? 'theme-corner-selected' : ''}`}
                    onClick={() => {
                      setSelectedCorners(c.value);
                      applyCorners(c.value);
                    }}
                  >
                    <span
                      className="theme-corner-box"
                      style={{
                        borderRadius: c.radius,
                        background: liveTheme.bg,
                        borderColor: liveTheme.color,
                      }}
                    />
                    <span className="theme-corner-name">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Actions ── */}
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
              {saving ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default ThemeSetup;
