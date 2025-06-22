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
  const { profile, loading, fetchProfile } = useCompanyStore();
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

  // If this route requires company profile
  if (requireCompanyProfile && user) {
    // Don't redirect from company profile page to avoid infinite loop
    if (location.pathname === '/company-profile') {
      return <>{children}</>;
    }
    
    // Wait for profile loading to complete before making redirect decision
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="font-mono text-emerald-100/70 text-sm">Loading profile...</p>
          </div>
        </div>
      );
    }
    
    // Only redirect if profile loading is done and no profile exists
    if (!loading && (!profile || !profile.name)) {
      return <Navigate to="/company-profile" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute; 