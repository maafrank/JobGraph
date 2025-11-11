import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './contexts/AuthContext';
import { ToastContainer } from './components/common';
import { ProtectedRoute } from './components/layout';
import { getAccessToken } from './services/api';

// Pages
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { CandidateDashboard } from './pages/candidate/CandidateDashboard';
import { ProfilePage } from './pages/candidate/ProfilePage';
import { SkillsPage } from './pages/candidate/SkillsPage';
import { EmployerDashboard } from './pages/employer/EmployerDashboard';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const { isAuthenticated, loadUser } = useAuthStore();

  // Load user on app start if we have a token
  useEffect(() => {
    const token = getAccessToken();
    if (token && !isAuthenticated) {
      loadUser();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ToastContainer />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Candidate routes */}
          <Route
            path="/candidate/dashboard"
            element={
              <ProtectedRoute requiredRole="candidate">
                <CandidateDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/profile"
            element={
              <ProtectedRoute requiredRole="candidate">
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/skills"
            element={
              <ProtectedRoute requiredRole="candidate">
                <SkillsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/matches"
            element={
              <ProtectedRoute requiredRole="candidate">
                <div>Matches page coming soon...</div>
              </ProtectedRoute>
            }
          />

          {/* Employer routes */}
          <Route
            path="/employer/dashboard"
            element={
              <ProtectedRoute requiredRole="employer">
                <EmployerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/company"
            element={
              <ProtectedRoute requiredRole="employer">
                <div>Company page coming soon...</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs"
            element={
              <ProtectedRoute requiredRole="employer">
                <div>Jobs page coming soon...</div>
              </ProtectedRoute>
            }
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
