/**
 * PageLayout - Themed layout wrapper for all pages
 * Provides consistent LOTR dark theme with optional background
 */
import { useNavigate } from 'react-router-dom';
import { Home, ChevronLeft } from 'lucide-react';

const PageLayout = ({ 
  children, 
  title,
  subtitle,
  showBackButton = true,
  showHomeButton = true,
  backgroundImage = null,
  backgroundOverlay = 'dark', // 'dark', 'darker', 'none'
  className = ''
}) => {
  const navigate = useNavigate();

  const overlayStyles = {
    dark: 'bg-gradient-to-b from-black/80 via-black/70 to-black/80',
    darker: 'bg-black/85',
    none: ''
  };

  return (
    <div 
      className={`min-h-screen relative ${className}`}
      style={{
        backgroundColor: '#0f0f10'
      }}
    >
      {/* Background Image (optional) */}
      {backgroundImage && (
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className={`absolute inset-0 ${overlayStyles[backgroundOverlay]}`} />
        </div>
      )}

      {/* Default texture overlay when no background image */}
      {!backgroundImage && (
        <div className="fixed inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,100,50,0.1) 0%, transparent 50%),
                             radial-gradient(circle at 80% 80%, rgba(255,80,30,0.08) 0%, transparent 50%)`,
          }}
        />
      )}

      {/* Header Navigation */}
      <header className="relative z-20 border-b border-orange-900/30 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Navigation */}
            <div className="flex items-center gap-3">
              {showHomeButton && (
                <button
                  onClick={() => navigate('/')}
                  className="p-2 rounded-lg bg-orange-600/20 hover:bg-orange-600/40 
                           text-orange-400 hover:text-orange-300 transition-all
                           border border-orange-500/30 hover:border-orange-500/50"
                  title="Volver al inicio"
                >
                  <Home className="w-5 h-5" />
                </button>
              )}
              {showBackButton && (
                <button
                  onClick={() => navigate(-1)}
                  className="p-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 
                           text-gray-400 hover:text-gray-300 transition-all
                           border border-gray-600/30 hover:border-gray-600/50"
                  title="Volver atrás"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Center - Title */}
            {title && (
              <div className="text-center flex-1">
                <h1 className="font-heading text-2xl md:text-3xl text-orange-400 tracking-wide">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
                )}
              </div>
            )}

            {/* Right side - placeholder for future actions */}
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Decorative corner flames */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-0">
        <div 
          className="w-full h-full animate-pulse"
          style={{
            background: 'radial-gradient(circle at top left, rgba(255,100,50,0.15) 0%, transparent 70%)',
            animationDuration: '3s'
          }}
        />
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-0">
        <div 
          className="w-full h-full animate-pulse"
          style={{
            background: 'radial-gradient(circle at top right, rgba(255,100,50,0.15) 0%, transparent 70%)',
            animationDuration: '4s'
          }}
        />
      </div>
    </div>
  );
};

export default PageLayout;
