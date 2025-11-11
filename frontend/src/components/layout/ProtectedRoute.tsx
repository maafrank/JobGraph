import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../common';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to appropriate dashboard if user has wrong role
    if (user?.role === 'candidate') {
      return <Navigate to="/candidate/dashboard" replace />;
    } else {
      return <Navigate to="/employer/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
