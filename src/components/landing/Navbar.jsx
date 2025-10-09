import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { AuthModal } from "../auth/AuthModal";

export function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [navbarTheme, setNavbarTheme] = useState('dark'); // 'dark' or 'light'
  const [isWorkspacePage, setIsWorkspacePage] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      
      // Check if we're on workspace page
      const isOnWorkspace = window.location.hash.startsWith('#workspace');
      setIsWorkspacePage(isOnWorkspace);
      
      // For workspace page, always use light theme
      if (isOnWorkspace) {
        setNavbarTheme('light');
        setIsScrolled(true); // Always show background on workspace
        return;
      }
      
      // Check if scrolled past the hero section (assuming hero is full height)
      const isScrolledPastHero = scrollPosition > windowHeight * 0.8;
      
      setIsScrolled(scrollPosition > 20);
      
      // Change theme based on scroll position
      if (isScrolledPastHero) {
        setNavbarTheme('light'); // Over white sections
      } else {
        setNavbarTheme('dark'); // Over hero section
      }
    };

    handleScroll(); // Set initial state
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('hashchange', handleScroll); // Listen for hash changes
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('hashchange', handleScroll);
    };
  }, []);

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleWorkspaceClick = (e) => {
    e.preventDefault();
    window.location.hash = '#workspace';
  };

  const handleLogout = () => {
    logout();
    // Clear the hash and navigate to landing page
    window.location.href = window.location.origin;
  };

  // Dynamic classes based on theme
  const getNavClasses = () => {
    if (navbarTheme === 'light') {
      return 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200';
    } else if (isScrolled) {
      return 'glass shadow-xl';
    } else {
      return 'bg-transparent';
    }
  };

  const getTextClasses = () => {
    return navbarTheme === 'light' ? 'text-gray-900' : 'text-white';
  };

  const getTextSecondaryClasses = () => {
    return navbarTheme === 'light' ? 'text-gray-600' : 'text-white/90';
  };

  const getLogoClasses = () => {
    if (navbarTheme === 'light') {
      return 'gradient-primary text-white'; // Keep logo colored
    } else {
      return 'gradient-primary text-white';
    }
  };

  const getHoverClasses = () => {
    if (navbarTheme === 'light') {
      return 'hover:text-blue-600';
    } else {
      return 'hover:text-white';
    }
  };

  const getMobileMenuClasses = () => {
    if (navbarTheme === 'light') {
      return 'bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-gray-200';
    } else {
      return 'glass rounded-2xl p-4';
    }
  };

  const getBorderClasses = () => {
    return navbarTheme === 'light' ? 'border-gray-200' : 'border-white/20';
  };

  // Dynamic button classes for Get Started button
  const getGetStartedButtonClasses = () => {
    if (navbarTheme === 'light') {
      // Over light background - use solid blue button
      return 'btn-dynamic-light';
    } else {
      // Over dark background - use glass button
      return 'btn-dynamic-dark';
    }
  };

  const getDashboardButtonClasses = () => {
    if (navbarTheme === 'light') {
      return 'btn-dynamic-light';
    } else {
      return 'btn btn-primary'; // Keep primary for logged in users
    }
  };

  return (
    <>
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'py-2' : 'py-4'
      } ${getNavClasses()}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${getLogoClasses()} rounded-xl flex items-center justify-center shadow-lg`}>
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className={`text-xl font-bold ${getTextClasses()}`}>SynqLab</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              {!isWorkspacePage && (
                <>
                  <a href="#features" className={`${getTextSecondaryClasses()} ${getHoverClasses()} transition-colors`}>
                    Features
                  </a>
                  <a href="#pricing" className={`${getTextSecondaryClasses()} ${getHoverClasses()} transition-colors`}>
                    Pricing
                  </a>
                  <a href="#testimonials" className={`${getTextSecondaryClasses()} ${getHoverClasses()} transition-colors`}>
                    Reviews
                  </a>
                  <a href="#about" className={`${getTextSecondaryClasses()} ${getHoverClasses()} transition-colors`}>
                    About
                  </a>
                </>
              )}
              
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {user?.name?.[0] || user?.email?.[0] || 'U'}
                      </span>
                    </div>
                    <span className={`${getTextSecondaryClasses()} text-sm`}>
                      {user?.name || user?.email}
                    </span>
                  </div>
                  {!isWorkspacePage && (
                    <button onClick={handleWorkspaceClick} className={getDashboardButtonClasses()}>
                      Dashboard
                    </button>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className={`${getTextSecondaryClasses()} ${getHoverClasses()} text-sm transition-colors`}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => openAuthModal('login')} 
                    className={`${getTextSecondaryClasses()} ${getHoverClasses()} transition-colors`}
                  >
                    Login
                  </button>
                  <button 
                    onClick={() => openAuthModal('signup')} 
                    className={getGetStartedButtonClasses()}
                  >
                    Get Started
                  </button>
                </div>
              )}
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`${getTextClasses()} p-2 transition-colors`}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className={`md:hidden mt-4 ${getMobileMenuClasses()}`}>
              <div className="space-y-3">
                {!isWorkspacePage && (
                  <>
                    <a href="#features" className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}>
                      Features
                    </a>
                    <a href="#pricing" className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}>
                      Pricing
                    </a>
                    <a href="#testimonials" className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}>
                      Reviews
                    </a>
                    <a href="#about" className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}>
                      About
                    </a>
                  </>
                )}
                {isAuthenticated ? (
                  <div className={`${!isWorkspacePage ? 'border-t' : ''} ${getBorderClasses()} ${!isWorkspacePage ? 'pt-3' : ''} space-y-3`}>
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 gradient-accent rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">{user?.name?.[0] || 'U'}</span>
                      </div>
                      <span className={`${getTextSecondaryClasses()} text-sm`}>
                        {user?.name || user?.email}
                      </span>
                    </div>
                    {!isWorkspacePage && (
                      <button onClick={handleWorkspaceClick} className={`w-full ${getDashboardButtonClasses()}`}>
                        Dashboard
                      </button>
                    )}
                    <button 
                      onClick={handleLogout} 
                      className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className={`${!isWorkspacePage ? 'border-t' : ''} ${getBorderClasses()} ${!isWorkspacePage ? 'pt-3' : ''} space-y-3`}>
                    <button 
                      onClick={() => openAuthModal('login')} 
                      className={`block ${getTextSecondaryClasses()} ${getHoverClasses()} py-2 transition-colors`}
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => openAuthModal('signup')} 
                      className={`w-full ${getGetStartedButtonClasses()}`}
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
        setMode={setAuthMode}
      />
    </>
  );
}
