import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LandingPage } from "./components/landing/LandingPage";
import { Workspace } from "./components/workspace/Workspace";

function AppContent() {
  const { loading } = useAuth();
  const [currentView, setCurrentView] = useState('landing');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const pathname = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check if this is a join-session link - redirect to workspace
      if (pathname === '/join-session' && urlParams.has('invitation')) {
        // Redirect to workspace with the invitation parameters preserved
        window.location.href = `/#workspace${window.location.search}`;
        return;
      } else if (urlParams.has('invitation')) {
        // Handle invitation parameters in any URL
        window.location.href = `/#workspace${window.location.search}`;
        return;
      } else if (hash === '#workspace') {
        setCurrentView('workspace');
      } else {
        setCurrentView('landing');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Loading CollabSpace</h3>
          <p className="text-white/80">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'workspace') {
    return <Workspace />;
  }

  return <LandingPage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
