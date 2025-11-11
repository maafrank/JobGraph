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
import { JobMatchesPage } from './pages/candidate/JobMatchesPage';
import { MyApplicationsPage } from './pages/candidate/MyApplicationsPage';
import { EmployerDashboard } from './pages/employer/EmployerDashboard';
import { CompanyProfilePage } from './pages/employer/CompanyProfilePage';
import { JobPostingPage } from './pages/employer/JobPostingPage';
import JobManagementPage from './pages/employer/JobManagementPage';
import CandidateMatchesPage from './pages/employer/CandidateMatchesPage';

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
                <JobMatchesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/applications"
            element={
              <ProtectedRoute requiredRole="candidate">
                <MyApplicationsPage />
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
                <CompanyProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/new"
            element={
              <ProtectedRoute requiredRole="employer">
                <JobPostingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:jobId/edit"
            element={
              <ProtectedRoute requiredRole="employer">
                <JobPostingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs"
            element={
              <ProtectedRoute requiredRole="employer">
                <JobManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:jobId/candidates"
            element={
              <ProtectedRoute requiredRole="employer">
                <CandidateMatchesPage />
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
