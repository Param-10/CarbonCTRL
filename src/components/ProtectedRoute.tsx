import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCompanyStore } from '../store/companyStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireCompanyProfile?: boolean;
}

const ProtectedRoute = ({ children, requireCompanyProfile = false }: ProtectedRouteProps) => {
  const { user, sessionCheckFailed, initializeAuth } = useAuthStore();
  const [retrying, setRetrying] = useState(false);
  const { profile, loading, loaded, fetchProfile } = useCompanyStore();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const retrySessionCheck = async () => {
    setRetrying(true);
    await initializeAuth();
    setRetrying(false);
  };

  // A saved session that could not be checked is not a signed-out user; let them retry instead
  if (!user && sessionCheckFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="font-mono text-red-300 text-sm mb-4">Could not reach the server to restore your session.</p>
          <button
            onClick={retrySessionCheck}
            disabled={retrying}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {retrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

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
    
    // Wait for the profile lookup to finish before deciding anything. The
    // store's `loaded` flag starts false, so the first paint shows a spinner
    // instead of bouncing the user to /company-profile before the fetch
    // completes (the redirect race).
    if (!loaded || loading) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2"></div>
            <p className="font-mono text-emerald-100/70 text-sm">Loading profile...</p>
          </div>
        </div>
      );
    }
    
    // New companies set up through the guided onboarding first
    if (!profile || !profile.name) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;