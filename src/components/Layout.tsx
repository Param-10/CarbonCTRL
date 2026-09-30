import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Leaf,
  LineChart,
  Menu,
  X,
  Building2,
  ListTodo,
  FileText,
  BookOpen,
  Compass
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { motion } from 'framer-motion';

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  const navigation = [
    { name: 'How it works', href: '/how-it-works', icon: Compass },
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Recommendations', href: '/recommendations', icon: LineChart },
    { name: 'Action Plan', href: '/action-plan', icon: ListTodo },
    { name: 'Report', href: '/report', icon: FileText },
    { name: 'Methodology', href: '/methodology', icon: BookOpen },
    { name: 'Company Profile', href: '/company-profile', icon: Building2 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Escape closes the mobile menu, as it would any overlay
  React.useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const handleSignOut = async () => {
    // Clear saved page before signing out
    localStorage.removeItem('carbonctrl_last_page');
    await signOut();
    navigate('/', { replace: true });
  };

  if (!user) {
    return <Outlet />;
  }

  return (
    <div className="relative isolate min-h-screen print:bg-white">
      {/* Sized to the screen, not the page, so long pages get the same background as short ones */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 print:hidden" />
      {/* Sidebar */}
      <aside className="print:hidden fixed inset-y-0 left-0 z-50 w-64 transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out bg-gray-900/50 backdrop-blur-xl border-r border-emerald-500/20">
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-3 px-6 py-8">
            <Leaf className="w-8 h-8 text-emerald-400" />
            <span className="font-space text-white font-bold text-xl">CarbonCTRL</span>
          </div>

          <nav className="flex-1 px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-300'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-mono">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors duration-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-mono">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <div className="print:hidden fixed top-4 left-4 z-50 md:hidden">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
          className="p-2 rounded-lg bg-gray-900/50 backdrop-blur-xl text-white"
        >
          {isMenuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Mobile menu, over a backdrop that closes it when tapped */}
      {isMenuOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsMenuOpen(false)}
          className="print:hidden fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      {isMenuOpen && (
        <motion.div
          initial={{ opacity: 0, x: -100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          className="print:hidden fixed inset-y-0 left-0 z-40 w-64 max-w-[85vw] bg-gray-900/95 backdrop-blur-xl md:hidden overflow-y-auto"
        >
          <div className="h-full flex flex-col">
            {/* Top padding keeps the logo clear of the menu button above it */}
            <div className="flex items-center gap-3 px-6 pt-20 pb-6">
              <Leaf className="w-8 h-8 text-emerald-400" />
              <span className="font-space text-white font-bold text-xl">CarbonCTRL</span>
            </div>

            <nav className="flex-1 px-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-300'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-mono">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-mono">Sign Out</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main content */}
      <main className="md:pl-64 print:pl-0 min-h-screen">
        <div className="max-w-8xl mx-auto px-4 pt-20 pb-8 md:py-8 sm:px-6 lg:px-8 print:pt-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}