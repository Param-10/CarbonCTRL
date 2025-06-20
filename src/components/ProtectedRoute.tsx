import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCompanyStore } from '../store/companyStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCompanyProfile?: boolean;
}

const ProtectedRoute = ({ children, requireCompanyProfile = false }: ProtectedRouteProps) => {
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useCompanyStore();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  // If user is not authenticated, redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If this route requires company profile and user doesn't have one
  if (requireCompanyProfile && user && (!profile || !profile.name)) {
    // Don't redirect from company profile page to avoid infinite loop
    if (location.pathname === '/company-profile') {
      return <>{children}</>;
    }
    return <Navigate to="/company-profile" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 