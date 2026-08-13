import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

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
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
