import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

export function Hero() {
  const { isAuthenticated } = useAuth();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGetStarted = (e) => {
    e.preventDefault();
    // Always navigate to workspace (authenticated or not)
    window.location.hash = '#workspace';
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 gradient-primary">
        <div 
          className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 transition-all duration-1000"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
          }}
        ></div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 gradient-secondary rounded-full opacity-20 animate-float"></div>
      <div className="absolute bottom-20 right-10 w-32 h-32 gradient-accent rounded-full opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-20 w-16 h-16 bg-yellow-400 rounded-full opacity-20 animate-float" style={{ animationDelay: '4s' }}></div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white mb-4 sm:mb-6 leading-tight">
            The Future of
            <span className="block bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
              Remote Collaboration
            </span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-4">
            Experience seamless teamwork with HD video calls, real-time document editing, 
            interactive whiteboards, and intelligent task management — all in one powerful platform.
          </p>
          
          <div className="flex justify-center items-center mb-8 sm:mb-12 px-4">
            <button
              onClick={handleGetStarted}
              className={isAuthenticated ? "btn btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 hover-scale" : "btn btn-dynamic-dark text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 hover-scale"}
            >
              <span className="mr-2">{isAuthenticated ? "🚀" : "✨"}</span>
              {isAuthenticated ? "Go to Dashboard" : "Get Started"}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 max-w-4xl mx-auto px-4">
            <div className="card-glass p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">50K+</div>
              <div className="text-sm sm:text-base text-white/80">Active Teams</div>
            </div>
            <div className="card-glass p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">99.9%</div>
              <div className="text-sm sm:text-base text-white/80">Uptime</div>
            </div>
            <div className="card-glass p-4 sm:p-6 animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-2">150+</div>
              <div className="text-sm sm:text-base text-white/80">Countries</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
