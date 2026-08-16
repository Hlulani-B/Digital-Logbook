import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { checkUser } from "../functions/profile/login.js";

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          const email = data.session.user.email;
          if (email) localStorage.setItem("email", email);
          try {
            const result = await checkUser(email);
            navigate(result.exists ? "/dashboard" : "/create-profile", { replace: true });
          } catch (err) {
            console.error("checkUser failed:", err);
            navigate("/dashboard", { replace: true });
          }
          return;
        }
        setError(error?.message || "Failed to complete sign in");
      } else {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const email = data.session.user.email;
          if (email) localStorage.setItem("email", email);
          try {
            const result = await checkUser(email);
            navigate(result.exists ? "/dashboard" : "/create-profile", { replace: true });
          } catch (err) {
            console.error("checkUser failed:", err);
            navigate("/dashboard", { replace: true });
          }
          return;
        }
        setError("No authorization code found in the URL.");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <>
      <div className="bg-mesh" />
      <div className="auth-container">
        <div className="glass auth-card animate-in" style={{ textAlign: "center" }}>
          {error ? (
            <>
              <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f87171", marginBottom: "0.75rem" }}>
                Authentication Error
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                {error}
              </p>
              <button
                onClick={() => navigate("/signin")}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <div
                className="animate-spin"
                style={{
                  width: 32,
                  height: 32,
                  margin: "0 auto 1rem",
                  borderRadius: "50%",
                  border: "3px solid var(--border)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <p style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>
                Completing sign in...
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
