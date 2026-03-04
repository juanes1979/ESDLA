/**
 * FireButton - Button component with fire glow effect on hover
 * Used for primary actions like Save, Cancel, etc.
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';

const FireButton = ({ 
  children, 
  onClick, 
  variant = 'primary', // primary (orange), secondary (gray), danger (red)
  size = 'default', // sm, default, lg
  disabled = false,
  className = '',
  type = 'button',
  ...props 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles = `
    relative overflow-visible font-heading
    transition-all duration-300 ease-out
    rounded-lg border-2
    flex items-center justify-center gap-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-5 py-2.5 text-base',
    lg: 'px-8 py-3 text-lg'
  };

  const variantStyles = {
    primary: `
      bg-gradient-to-b from-orange-600 to-orange-700 
      border-orange-500/50 
      text-white
      hover:from-orange-500 hover:to-orange-600
      hover:border-orange-400/70
    `,
    secondary: `
      bg-gradient-to-b from-gray-700 to-gray-800 
      border-gray-600/50 
      text-gray-200
      hover:from-gray-600 hover:to-gray-700
      hover:border-gray-500/70
    `,
    danger: `
      bg-gradient-to-b from-red-600 to-red-700 
      border-red-500/50 
      text-white
      hover:from-red-500 hover:to-red-600
      hover:border-red-400/70
    `,
    ghost: `
      bg-transparent
      border-transparent
      text-gray-300
      hover:bg-white/10
      hover:text-white
    `
  };

  const fireColors = {
    primary: { inner: 'rgba(255,120,50,0.8)', outer: 'rgba(255,80,20,0.4)' },
    secondary: { inner: 'rgba(100,100,100,0.6)', outer: 'rgba(80,80,80,0.3)' },
    danger: { inner: 'rgba(255,50,50,0.8)', outer: 'rgba(200,30,30,0.4)' },
    ghost: { inner: 'rgba(255,120,50,0.6)', outer: 'rgba(255,80,20,0.3)' }
  };

  const colors = fireColors[variant] || fireColors.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      style={{
        transform: isHovered && !disabled ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: isHovered && !disabled
          ? `0 0 20px 5px ${colors.inner}, 0 0 40px 10px ${colors.outer}, 0 8px 20px rgba(0,0,0,0.4)`
          : '0 4px 10px rgba(0,0,0,0.3)'
      }}
      {...props}
    >
      {/* Fire glow layers behind button */}
      {isHovered && !disabled && variant !== 'ghost' && (
        <>
          <span 
            className="absolute inset-0 rounded-lg animate-pulse"
            style={{
              background: `radial-gradient(circle at center, ${colors.inner} 0%, transparent 70%)`,
              filter: 'blur(8px)',
              transform: 'scale(1.3)',
              zIndex: -1,
              animationDuration: '1s'
            }}
          />
          <span 
            className="absolute inset-0 rounded-lg"
            style={{
              background: `radial-gradient(circle at center, ${colors.outer} 0%, transparent 60%)`,
              filter: 'blur(15px)',
              transform: 'scale(1.5)',
              zIndex: -2,
              animation: 'fireFlicker 0.5s ease-in-out infinite alternate'
            }}
          />
        </>
      )}
      
      {/* Button content */}
      <span className="relative z-10">{children}</span>
      
      {/* Inline keyframes */}
      <style>{`
        @keyframes fireFlicker {
          0% { opacity: 0.6; transform: scale(1.4); }
          100% { opacity: 1; transform: scale(1.6); }
        }
      `}</style>
    </button>
  );
};

export default FireButton;
