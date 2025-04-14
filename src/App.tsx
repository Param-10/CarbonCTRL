import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useCarbonStore } from './store/carbonStore';
import { useCompanyStore } from './store/companyStore';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import CompanyProfilePage from './pages/CompanyProfilePage';
import RecommendationsPage from './pages/RecommendationsPage';
import OffsetProjectsPage from './pages/OffsetProjectsPage';

function App() {
  const { user, initializeAuth } = useAuthStore();
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

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<Layout />}>
          <Route 
            path="/dashboard" 
            element={user ? <DashboardPage /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/settings" 
            element={user ? <SettingsPage /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/company-profile" 
            element={user ? <CompanyProfilePage /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/recommendations" 
            element={user ? <RecommendationsPage /> : <Navigate to="/auth" />} 
          />
          <Route 
            path="/offset-projects" 
            element={user ? <OffsetProjectsPage /> : <Navigate to="/auth" />} 
          />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;