import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SignIn } from '@/pages/SignIn';
import { AuthCallback } from '@/pages/AuthCallback';
import { AuthRestore } from '@/pages/AuthRestore';
import { ResetPassword } from '@/pages/ResetPassword';
import { UpdatePassword } from '@/pages/UpdatePassword';
import { Dashboard } from '@/pages/Dashboard';
import { AllEntriesPage } from '@/pages/AllEntries';
import { ArchivesPage } from '@/pages/Archives';
import { ActivityPage } from '@/pages/Activity';
import { CreateProfile } from '@/pages/CreateProfile';
import { AvatarPage } from '@/pages/Avatar';
import { ToneSetup } from '@/pages/ToneSetup';
import { ThemeSetup } from '@/pages/ThemeSetup';
import { FrequencySetup } from '@/pages/FrequencySetup';
import { ProjectsPage } from '@/pages/Project';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { StatsView } from '@/pages/StatsView';
import { StreakView } from '@/pages/StreakView';
import { ProjectTablePreview } from '@/Templates/ProjectTemplates/ProjectTable';

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
          <div className="glass auth-card" style={{ textAlign: 'center' }}>
            <div
              className="animate-spin"
              style={{
                width: 32,
                height: 32,
                margin: '0 auto 1rem',
                borderRadius: '50%',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--accent)',
              }}
            />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-dim)' }}>Loading...</p>
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
            <Route path="/" element={<Navigate to="/signin" replace />} />
            <Route
              path="/signin"
              element={
                <PublicRoute>
                  <SignIn />
                </PublicRoute>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/restore" element={<AuthRestore />} />
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
              path="/dashboard/all"
              element={
                <ProtectedRoute>
                  <AllEntriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/archives"
              element={
                <ProtectedRoute>
                  <ArchivesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/activity"
              element={
                <ProtectedRoute>
                  <ActivityPage />
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
            <Route
              path="/tone-setup"
              element={
                <ProtectedRoute>
                  <ToneSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/theme-setup"
              element={
                <ProtectedRoute>
                  <ThemeSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/frequency-setup"
              element={
                <ProtectedRoute>
                  <FrequencySetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:projectName"
              element={
                <ProtectedRoute>
                  <ProjectDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute>
                  <StatsView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/streaks"
              element={
                <ProtectedRoute>
                  <StreakView />
                </ProtectedRoute>
              }
            />
            <Route path="/template" element={
              <ProtectedRoute>
                <ProjectTablePreview />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeInitializer>
    </BrowserRouter>
  );
}
