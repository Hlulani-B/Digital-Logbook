import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [fallbackChecked, setFallbackChecked] = useState(false);
  const [fallbackHasSession, setFallbackHasSession] = useState(false);

  // If context says no user, do a direct Supabase session check
  // to guard against race conditions (e.g. OAuth callback navigates
  // before onAuthStateChange has propagated into React state).
  useEffect(() => {
    if (!loading && !user) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setFallbackChecked(true);
        setFallbackHasSession(!!session);
      });
    }
  }, [loading, user]);

  if (loading) {
    return (
      <>
        <div className="bg-mesh" />
        <div className="auth-container">
          <div className="glass auth-card" style={{ textAlign: "center" }}>
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
              Loading...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    // Still checking direct session — show loading while we verify
    if (!fallbackChecked) {
      return (
        <>
          <div className="bg-mesh" />
          <div className="auth-container">
            <div className="glass auth-card" style={{ textAlign: "center" }}>
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
                Loading...
              </p>
            </div>
          </div>
        </>
      );
    }

    // Direct check found a session — context hasn't caught up yet, render children
    if (fallbackHasSession) {
      return <>{children}</>;
    }

    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
