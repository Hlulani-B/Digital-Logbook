import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { updateName, updateUsername } from "@/lib/profileService";

export function CreateProfile() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = localStorage.getItem("email");
    if (!storedEmail) {
      navigate("/signin", { replace: true });
      return;
    }
    setEmail(storedEmail);
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      const nameResult = await updateName(email, name.trim());
      if (nameResult?.error) throw new Error(nameResult.error);

      const usernameResult = await updateUsername(email, username.trim());
      if (usernameResult?.error) throw new Error(usernameResult.error);

      navigate("/avatar", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setLoading(false);
    }
  };

  if (!email) return null;

  return (
    <>
      <div className="bg-mesh">
        <div className="orb" />
      </div>
      <div className="auth-container">
        <div className="glass auth-card animate-in">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              <path d="M8 7h6" />
              <path d="M8 11h4" />
            </svg>
          </div>
          <h1 className="auth-title">Set up your profile</h1>
          <p className="auth-subtitle">Tell us what to call you</p>

          {error && <div className="auth-error">{error}</div>}

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}
          >
            <div className="field-group">
              <label className="field-label">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="field-input"
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>

            <div className="field-group">
              <label htmlFor="name" className="field-label">
                Full name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="field-input"
                placeholder="Hlulani Baloyi"
                autoComplete="name"
              />
            </div>

            <div className="field-group">
              <label htmlFor="username" className="field-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                className="field-input"
                placeholder="hlulani_b"
                autoComplete="off"
              />
              <p className="field-hint">
                Lowercase letters, numbers, and underscores only.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || username.trim().length < 3}
              className="btn-primary auth-submit"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
