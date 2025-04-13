import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCompanyStore } from './store/companyStore';
import { useCarbonStore } from './store/carbonStore';
import Layout from './components/Layout';

// Implement lazy loading for page components
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'));
const CompanyProfilePage = lazy(() => import('./pages/CompanyProfilePage'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen w-full bg-gradient-to-b from-gray-900 to-black">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-t-emerald-500 border-emerald-200 rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-emerald-500 text-lg font-semibold">Loading CarbonCTRL...</p>
    </div>
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-emerald-100">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

function App() {
  const { initializeAuth, user } = useAuthStore();
  const { fetchProfile } = useCompanyStore();
  const { loadSavedData } = useCarbonStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // When a user logs in, fetch their company profile and carbon data
  useEffect(() => {
    if (user) {
      fetchProfile();
      loadSavedData(user.id);
    }
  }, [user, fetchProfile, loadSavedData]);

  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/company-profile" element={<CompanyProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;