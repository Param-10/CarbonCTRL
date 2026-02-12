import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const LAST_PAGE_KEY = 'carbonctrl_last_page';
const DEFAULT_AUTHENTICATED_PAGE = '/dashboard';
const DEFAULT_UNAUTHENTICATED_PAGE = '/';

export function usePagePersistence() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuthStore();
  const [isRestoringPage, setIsRestoringPage] = useState(false);

  // Save current page to localStorage whenever location changes
  useEffect(() => {
    if (user && location.pathname !== '/auth') {
      // Only save authenticated pages, exclude auth page
      const protectedPaths = ['/dashboard', '/recommendations', '/company-profile', '/settings', '/offset-projects'];
      if (protectedPaths.includes(location.pathname)) {
        localStorage.setItem(LAST_PAGE_KEY, location.pathname);
        console.log('CarbonCTRL: Saved current page to localStorage:', location.pathname);
      }
    }
  }, [location.pathname, user]);

  // Restore last page on app initialization
  useEffect(() => {
    if (!loading && user) {
      const lastPage = localStorage.getItem(LAST_PAGE_KEY);
      const currentPath = location.pathname;
      
      // If we're on landing page or auth page, redirect to last saved page or dashboard
      if (currentPath === '/' || currentPath === '/auth') {
        const targetPage = lastPage || DEFAULT_AUTHENTICATED_PAGE;
        console.log('CarbonCTRL: Restoring user to last visited page:', targetPage);
        setIsRestoringPage(true);
        navigate(targetPage, { replace: true });
        // Reset the restoration state after a brief delay
        setTimeout(() => setIsRestoringPage(false), 100);
      }
      // If user is authenticated and on a valid page, save it immediately
      else {
        const protectedPaths = ['/dashboard', '/recommendations', '/company-profile', '/settings', '/offset-projects'];
        if (protectedPaths.includes(currentPath)) {
          localStorage.setItem(LAST_PAGE_KEY, currentPath);
          console.log('CarbonCTRL: Updated last page on direct load:', currentPath);
        }
      }
    } else if (!loading && !user) {
      // Clear last page when user logs out
      localStorage.removeItem(LAST_PAGE_KEY);
      
      // If we're on a protected page without auth, redirect to landing
      const protectedPaths = ['/dashboard', '/recommendations', '/company-profile', '/settings', '/offset-projects'];
      if (protectedPaths.includes(location.pathname)) {
        console.log('Redirecting unauthenticated user to landing page');
        navigate(DEFAULT_UNAUTHENTICATED_PAGE, { replace: true });
      }
    }
  }, [user, loading, location.pathname, navigate]);

  // Get the last saved page (useful for initial routing decisions)
  const getLastPage = () => {
    return localStorage.getItem(LAST_PAGE_KEY);
  };

  // Clear saved page (useful for logout)
  const clearLastPage = () => {
    localStorage.removeItem(LAST_PAGE_KEY);
  };

  return {
    getLastPage,
    clearLastPage,
    currentPage: location.pathname,
    isRestoringPage
  };
} 