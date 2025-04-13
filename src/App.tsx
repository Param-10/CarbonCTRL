import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCompanyStore } from './store/companyStore';
import Layout from './components/Layout';

// Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import RecommendationsPage from './pages/RecommendationsPage';
import OffsetProjectsPage from './pages/OffsetProjectsPage';
import SettingsPage from './pages/SettingsPage';
import CompanyProfilePage from './pages/CompanyProfilePage';

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

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // When a user logs in, fetch their company profile
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  return (
    <Router>
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
          <Route path="/offset-projects" element={<OffsetProjectsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/company-profile" element={<CompanyProfilePage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;