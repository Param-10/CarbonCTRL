import { usePagePersistence } from '../hooks/usePagePersistence';

interface AppWithPersistenceProps {
  children: React.ReactNode;
}

export default function AppWithPersistence({ children }: AppWithPersistenceProps) {
  // This hook handles all the page persistence logic
  const { isRestoringPage } = usePagePersistence();

  // Show a brief loading indicator while restoring the page
  if (isRestoringPage) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-800 via-emerald-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="font-mono text-emerald-100/70 text-sm">Restoring page...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 