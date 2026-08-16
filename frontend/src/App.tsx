import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SignIn } from "@/pages/SignIn";
import { AuthCallback } from "@/pages/AuthCallback";
import { ResetPassword } from "@/pages/ResetPassword";
import { UpdatePassword } from "@/pages/UpdatePassword";
import { Dashboard } from "@/pages/Dashboard";
import { CreateProfile } from "@/pages/CreateProfile";
import { AvatarPage } from "@/pages/Avatar";

function ThemeInitializer({ children }: { children: React.ReactNode }) {
  useTheme(); // applies data-theme on mount
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
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
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer>
        <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/signin" replace />}
          />
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/reset-password"
            element={
              <PublicRoute>
                <ResetPassword />
              </PublicRoute>
            }
          />
          <Route
            path="/auth/update-password"
            element={
              <PublicRoute>
                <UpdatePassword />
              </PublicRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-profile"
            element={
              <ProtectedRoute>
                <CreateProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/avatar"
            element={
              <ProtectedRoute>
                <AvatarPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeInitializer>
  </BrowserRouter>
  );
}
