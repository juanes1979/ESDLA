/**
 * Home Page - Landing page for LOTR 5e RPG
 * DEMO: Icon-based navigation with hover tooltips
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scroll, BookOpen, Users, FileText, Map, Compass, Sword, Shield } from 'lucide-react';

// Navigation items with icons and descriptions
const NAV_ITEMS = [
  {
    id: 'create',
    icon: Scroll,
    title: 'Crear Personaje',
    description: 'Crea héroes únicos de las culturas de la Tierra Media.',
    path: '/create-character',
    color: 'gold',
    position: { top: '25%', left: '15%' }
  },
  {
    id: 'characters',
    icon: FileText,
    title: 'Mis Personajes',
    description: 'Accede a tus fichas de personajes creados.',
    path: '/characters',
    color: 'orange',
    position: { top: '35%', right: '12%' }
  },
  {
    id: 'rules',
    icon: BookOpen,
    title: 'Reglas',
    description: 'Culturas, ocupaciones, equipo y precios.',
    path: '/rules',
    color: 'blue',
    position: { bottom: '35%', left: '10%' }
  },
  {
    id: 'travel',
    icon: Compass,
    title: 'Generador de Viajes',
    description: 'Genera viajes con clima, acontecimientos y fatiga.',
    path: '/travel',
    color: 'gold',
    position: { bottom: '25%', right: '15%' }
  },
  {
    id: 'map',
    icon: Map,
    title: 'Mapa Interactivo',
    description: '216 ubicaciones de la Tierra Media con rutas y distancias.',
    path: '/map',
    color: 'green',
    position: { top: '60%', left: '20%' }
  },
  {
    id: 'online',
    icon: Users,
    title: 'Juego en Línea',
    description: 'Mapas, chat y herramientas para el Director.',
    path: null, // Coming soon
    color: 'gray',
    position: { top: '50%', right: '8%' },
    comingSoon: true
  }
];

const COLOR_MAP = {
  gold: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/30',
    hover: 'hover:bg-amber-500/30 hover:shadow-amber-500/50'
  },
  orange: {
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/50',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/30',
    hover: 'hover:bg-orange-500/30 hover:shadow-orange-500/50'
  },
  blue: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/30',
    hover: 'hover:bg-blue-500/30 hover:shadow-blue-500/50'
  },
  green: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/30',
    hover: 'hover:bg-emerald-500/30 hover:shadow-emerald-500/50'
  },
  gray: {
    bg: 'bg-gray-500/20',
    border: 'border-gray-500/50',
    text: 'text-gray-400',
    glow: 'shadow-gray-500/30',
    hover: ''
  }
};

const FloatingNavIcon = ({ item, onNavigate }) => {
  const [isHovered, setIsHovered] = useState(false);
  const colors = COLOR_MAP[item.color];
  const Icon = item.icon;
  
  return (
    <div 
      className="absolute z-20 group"
      style={item.position}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon Button */}
      <button
        onClick={() => !item.comingSoon && onNavigate(item.path)}
        disabled={item.comingSoon}
        className={`
          relative w-16 h-16 rounded-full 
          ${colors.bg} ${colors.border} border-2
          flex items-center justify-center
          transition-all duration-300 ease-out
          ${!item.comingSoon ? colors.hover : 'cursor-not-allowed'}
          shadow-lg ${colors.glow}
          ${isHovered ? 'scale-125 shadow-xl' : 'scale-100'}
          backdrop-blur-sm
        `}
        data-testid={`nav-icon-${item.id}`}
      >
        <Icon className={`w-7 h-7 ${colors.text} transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`} />
        
        {/* Coming Soon Badge */}
        {item.comingSoon && (
          <span className="absolute -top-1 -right-1 bg-red-500/80 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">
            Soon
          </span>
        )}
        
        {/* Pulse animation */}
        {!item.comingSoon && (
          <span className={`absolute inset-0 rounded-full ${colors.bg} animate-ping opacity-30`} />
        )}
      </button>
      
      {/* Expanded Info Card on Hover */}
      <div 
        className={`
          absolute left-1/2 -translate-x-1/2 top-full mt-3
          w-56 p-4 rounded-xl
          bg-black/90 backdrop-blur-md
          border ${colors.border}
          shadow-2xl ${colors.glow}
          transition-all duration-300 ease-out
          ${isHovered ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}
        `}
      >
        <h3 className={`font-heading text-lg ${colors.text} mb-1`}>
          {item.title}
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          {item.description}
        </p>
        {!item.comingSoon && (
          <div className={`mt-3 text-xs ${colors.text} flex items-center gap-1`}>
            <span>Click para entrar</span>
            <span className="animate-pulse">→</span>
          </div>
        )}
        {item.comingSoon && (
          <div className="mt-3 text-xs text-red-400">
            Próximamente disponible
          </div>
        )}
      </div>
    </div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="home-page">
      {/* Background Image - ESDLA artwork */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/50" />
      </div>
      
      {/* Floating torch glow effects */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-orange-500 rounded-full blur-[100px] opacity-20 animate-pulse" />
      <div className="absolute top-32 right-20 w-40 h-40 bg-orange-600 rounded-full blur-[120px] opacity-15 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-40 left-1/4 w-36 h-36 bg-amber-500 rounded-full blur-[80px] opacity-15 animate-pulse" style={{ animationDelay: '0.5s' }} />
      
      {/* Navigation Icons */}
      <div className="relative z-10 min-h-screen">
        {NAV_ITEMS.map(item => (
          <FloatingNavIcon 
            key={item.id} 
            item={item} 
            onNavigate={navigate}
          />
        ))}
      </div>
      
      {/* Subtitle at bottom */}
      <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
        <p className="text-amber-200/60 text-sm font-heading tracking-widest">
          5e Mod — La Tierra Media te espera
        </p>
      </div>
      
      {/* Sheet Editor Link - Developer tool */}
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={() => navigate('/sheet-editor')}
          className="text-xs text-gray-500 hover:text-amber-400 transition-colors"
          data-testid="sheet-editor-link"
        >
          🛠️ Editor
        </button>
      </div>
    </div>
  );
};

export default HomePage;
