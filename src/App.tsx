import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCarbonStore } from './store/carbonStore';
import { useCompanyStore } from './store/companyStore';
import Layout from './components/Layout';
import AppWithPersistence from './components/AppWithPersistence';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import RecommendationsPage from './pages/RecommendationsPage';
import OffsetProjectsPage from './pages/OffsetProjectsPage';

function App() {
  const { user, loading, initializeAuth } = useAuthStore();
  const { loadSavedData } = useCarbonStore();
  const { fetchProfile } = useCompanyStore();

  useEffect(() => {
    // Initialize auth on app startup
    const init = async () => {
      console.log('Initializing app...');
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Error initializing auth:', error);
      }
    };
    
    init();
  }, [initializeAuth]);

  // Load user data when user is available
  useEffect(() => {
    if (user) {
      console.log('User authenticated, loading data for:', user.id);
      
      // Load carbon data
      loadSavedData(user.id).catch(err => {
        console.error('Error loading carbon data:', err);
      });
      
      // Load company profile
      fetchProfile().catch(err => {
        console.error('Error loading company profile:', err);
      });
    }
  }, [user, loadSavedData, fetchProfile]);

  // Show loading screen while initializing auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-emerald-100/70">Loading CarbonCTRL...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <AppWithPersistence>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<Layout />}>
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requireCompanyProfile={true}>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/company-profile" 
              element={
                <ProtectedRoute>
                  <CompanyProfilePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/recommendations" 
              element={
                <ProtectedRoute requireCompanyProfile={true}>
                  <RecommendationsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/offset-projects" 
              element={
                <ProtectedRoute requireCompanyProfile={true}>
                  <OffsetProjectsPage />
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </AppWithPersistence>
    </Router>
  );
}

export default App;