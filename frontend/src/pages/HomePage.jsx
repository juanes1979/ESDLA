/**
 * Home Page - Landing page for LOTR 5e RPG
 * Custom medallion icons with hover tooltips in arc formation
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Navigation items with custom images - Arc formation (3 left, 3 right)
const NAV_ITEMS = [
  // LEFT SIDE (top to bottom)
  {
    id: 'create',
    image: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/iqkeec1q_Crear%20Personaje.png',
    title: 'Crear Personaje',
    description: 'Crea héroes únicos de las culturas de la Tierra Media.',
    path: '/create-character',
    position: { top: '12%', left: '6%' },
    side: 'left'
  },
  {
    id: 'characters',
    image: 'https://customer-assets.emergentagent.com/job_43646a93-aa78-4a0d-8146-f59889732d98/artifacts/69qs0ncp_Mis%20Personajes.png',
    title: 'Mis Personajes',
    description: 'Accede a tus fichas de personajes creados.',
    path: '/characters',
    position: { top: '32%', left: '3%' },
    side: 'left'
  },
  {
    id: 'rules',
    image: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/1zm6l45i_Reglas.png',
    title: 'Reglas',
    description: 'Culturas, ocupaciones, equipo y precios.',
    path: '/rules',
    position: { top: '54%', left: '6%' },
    side: 'left'
  },
  // RIGHT SIDE (top to bottom)
  {
    id: 'travel',
    image: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/ug4mj9xw_Viaje.png',
    title: 'Generador de Viajes',
    description: 'Genera viajes con clima, acontecimientos y fatiga.',
    path: '/travel',
    position: { top: '12%', right: '6%' },
    side: 'right'
  },
  {
    id: 'map',
    image: 'https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/93mcloc1_Mapa%20interactivo.png',
    title: 'Mapa Interactivo',
    description: '216 ubicaciones de la Tierra Media con rutas y distancias.',
    path: '/map',
    position: { top: '32%', right: '3%' },
    side: 'right'
  },
  {
    id: 'storage',
    image: 'https://static.prod-images.emergentagent.com/jobs/303cda52-759b-4671-9089-2a2509ec220b/images/30f9e524439f848dad502dde45b2fedb93b1633570a068c9221bbf6e285a20d5.png',
    title: 'Almacén de Archivos',
    description: 'Gestiona tus campañas, fichas y documentos.',
    path: '/storage',
    position: { top: '54%', right: '6%' },
    side: 'right'
  }
];

const FloatingNavIcon = ({ item, onNavigate, index }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Determine tooltip position based on which side the icon is on
  const tooltipPosition = item.side === 'left' 
    ? 'left-full ml-4' 
    : 'right-full mr-4';
  
  return (
    <div 
      className="absolute z-20 group"
      style={item.position}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Fire glow effect behind medallion */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,120,50,0.8) 0%, rgba(255,80,20,0.4) 40%, rgba(200,50,0,0.2) 60%, transparent 70%)',
          filter: 'blur(8px)',
          transform: 'scale(1.4)',
          animation: `fireGlow${index} 2s ease-in-out infinite`,
          animationDelay: `${index * 0.3}s`
        }}
      />
      
      {/* Secondary fire layer for depth */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,200,100,0.6) 0%, rgba(255,150,50,0.3) 30%, transparent 60%)',
          filter: 'blur(12px)',
          transform: 'scale(1.6)',
          animation: `fireGlow${(index + 3) % 6} 3s ease-in-out infinite`,
          animationDelay: `${index * 0.5}s`
        }}
      />
      
      {/* Medallion Button */}
      <button
        onClick={() => !item.comingSoon && onNavigate(item.path)}
        disabled={item.comingSoon}
        className={`
          relative w-20 h-20 md:w-24 md:h-24 rounded-full 
          overflow-hidden
          transition-all duration-300 ease-out
          ${!item.comingSoon ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-70'}
          ${isHovered ? 'scale-115 z-30' : 'scale-100'}
        `}
        style={{
          boxShadow: isHovered 
            ? '0 0 30px 10px rgba(255,100,30,0.6), 0 0 60px 20px rgba(255,60,0,0.3)' 
            : '0 0 15px 5px rgba(255,100,30,0.4), 0 0 30px 10px rgba(255,60,0,0.2)'
        }}
        data-testid={`nav-icon-${item.id}`}
      >
        {/* Medallion Image */}
        <img 
          src={item.image} 
          alt={item.title}
          className="w-full h-full object-cover"
        />
        
        {/* Coming Soon Badge */}
        {item.comingSoon && (
          <span className="absolute top-0 right-0 bg-red-600/90 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg">
            Pronto
          </span>
        )}
      </button>
      
      {/* Expanded Info Card on Hover */}
      <div 
        className={`
          absolute top-1/2 -translate-y-1/2 ${tooltipPosition}
          w-64 p-4 rounded-xl
          bg-black/95 backdrop-blur-md
          border border-orange-500/40
          shadow-2xl
          transition-all duration-300 ease-out
          ${isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          ${item.side === 'left' ? 'translate-x-0' : 'translate-x-0'}
        `}
        style={{
          boxShadow: isHovered ? '0 0 30px 5px rgba(255,100,30,0.3)' : 'none'
        }}
      >
        <h3 className="font-heading text-lg text-orange-300 mb-2">
          {item.title}
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed">
          {item.description}
        </p>
        {!item.comingSoon && (
          <div className="mt-3 text-xs text-orange-400 flex items-center gap-1">
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
      
      {/* CSS for fire animation */}
      <style>{`
        @keyframes fireGlow0 {
          0%, 100% { opacity: 0.6; transform: scale(1.3); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        @keyframes fireGlow1 {
          0%, 100% { opacity: 0.7; transform: scale(1.4); }
          50% { opacity: 0.9; transform: scale(1.6); }
        }
        @keyframes fireGlow2 {
          0%, 100% { opacity: 0.5; transform: scale(1.35); }
          50% { opacity: 0.95; transform: scale(1.55); }
        }
        @keyframes fireGlow3 {
          0%, 100% { opacity: 0.65; transform: scale(1.45); }
          50% { opacity: 0.85; transform: scale(1.65); }
        }
        @keyframes fireGlow4 {
          0%, 100% { opacity: 0.55; transform: scale(1.38); }
          50% { opacity: 0.92; transform: scale(1.58); }
        }
        @keyframes fireGlow5 {
          0%, 100% { opacity: 0.72; transform: scale(1.42); }
          50% { opacity: 0.88; transform: scale(1.62); }
        }
      `}</style>
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
        {/* Subtle vignette overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>
      
      {/* Navigation Medallions in Arc Formation */}
      <div className="relative z-10 min-h-screen">
        {NAV_ITEMS.map((item, index) => (
          <FloatingNavIcon 
            key={item.id} 
            item={item} 
            index={index}
            onNavigate={navigate}
          />
        ))}
      </div>
      
      {/* Subtitle at bottom */}
      <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
        <p className="text-amber-200/50 text-sm font-heading tracking-widest">
          5e Mod — La Tierra Media te espera
        </p>
      </div>
      
      {/* Sheet Editor Link - Developer tool */}
      <div className="absolute bottom-4 right-4 z-10">
        <button
          onClick={() => navigate('/sheet-editor')}
          className="text-xs text-gray-600 hover:text-amber-400 transition-colors"
          data-testid="sheet-editor-link"
        >
          Editor
        </button>
      </div>
    </div>
  );
};

export default HomePage;
