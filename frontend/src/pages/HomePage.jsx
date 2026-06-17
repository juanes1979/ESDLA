/**
 * Home Page - Landing page for LOTR 5e RPG
 * Custom medallion icons with hover tooltips in arc formation
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
    position: { top: '50%', left: '6%' },
    side: 'left',
    roles: ['maestro', 'director_de_juego']
  },
  {
    id: 'aventura',
    image: 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/96t25ngc_Aventura.png',
    title: 'Aventuras',
    description: 'Crea, gestiona y juega aventuras y campañas en la Tierra Media.',
    path: '/aventuras',
    position: { top: '72%', left: '3%' },
    side: 'left',
    roles: ['maestro', 'director_de_juego'],
  },
  {
    id: 'mis-campanas',
    image: 'https://customer-assets.emergentagent.com/job_83678a44-91d5-44d8-bd9c-fd3a28e2ac42/artifacts/96t25ngc_Aventura.png',
    title: 'Mis Campañas',
    description: 'Únete a una campaña con un código y revisa tus solicitudes.',
    path: '/mis-campanas',
    position: { top: '72%', left: '3%' },
    side: 'left',
    roles: ['jugador'],
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
    side: 'right',
    // Esta imagen trae un halo blanco horneado; lo recortamos escalando
    // un poco la <img> dentro del contenedor `overflow-hidden`.
    imgScale: 1.12
  },
  {
    id: 'comercio',
    image: 'https://customer-assets.emergentagent.com/job_6bbcf5e7-1a95-4fc6-b685-bb8bddbd29e7/artifacts/qsc1f0u7_Icono%20comercio.png',
    transparent: true,
    title: 'Compra-Venta',
    description: 'Negocia compras y ventas con PNJs y aplica la transacción al personaje (dinero, inventario, monturas).',
    path: '/comercio',
    position: { top: '74%', right: '3%' },
    side: 'right',
    roles: ['maestro', 'director_de_juego'],
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
          ${item.transparent ? '' : 'overflow-hidden'}
          transition-all duration-300 ease-out
          ${!item.comingSoon ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed opacity-70'}
          ${isHovered ? 'scale-115 z-30' : 'scale-100'}
        `}
        style={{
          boxShadow: item.transparent ? 'none' : (isHovered 
            ? '0 0 30px 10px rgba(255,100,30,0.6), 0 0 60px 20px rgba(255,60,0,0.3)' 
            : '0 0 15px 5px rgba(255,100,30,0.4), 0 0 30px 10px rgba(255,60,0,0.2)')
        }}
        data-testid={`nav-icon-${item.id}`}
      >
        {/* Medallion Image (or lucide icon fallback) */}
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.title}
            className={`w-full h-full ${item.transparent ? 'object-contain' : 'object-cover'}`}
            style={item.transparent
              ? { animation: 'firePulse 1.8s ease-in-out infinite' }
              : (item.imgScale ? { transform: `scale(${item.imgScale})` } : undefined)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 35% 30%, #3a2a12 0%, #1a1206 70%, #0d0903 100%)' }}
          >
            {item.icon && <item.icon className="w-9 h-9 md:w-11 md:h-11 text-[hsl(var(--gold))]" strokeWidth={1.5} />}
          </div>
        )}
        
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
        @keyframes firePulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 6px rgba(255,140,30,0.85)) drop-shadow(0 0 14px rgba(255,80,0,0.55));
          }
          50% {
            transform: scale(1.08);
            filter: drop-shadow(0 0 14px rgba(255,180,60,1)) drop-shadow(0 0 28px rgba(255,90,0,0.75));
          }
        }
      `}</style>
    </div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuth();

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
        {NAV_ITEMS
          .filter(item => !item.roles || (user && item.roles.includes(user.role)))
          .map((item, index) => (
            <FloatingNavIcon
              key={item.id}
              item={item}
              index={index}
              onNavigate={navigate}
            />
          ))}
      </div>
      
      {/* User chip + logout (top-right) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {user && (
          <>
            <span className="text-xs text-amber-200/80 px-2 py-1 rounded bg-black/50 border border-amber-700/40">
              {user.name} · <span className="text-amber-400/80">{user.role}</span>
            </span>
            {hasRole('maestro') && (
              <button
                onClick={() => navigate('/admin/users')}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-900/30 border border-amber-700/40 text-amber-200 hover:bg-amber-800/50"
                data-testid="home-admin-users-btn"
                title="Gestionar cuentas y roles"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Cuentas
              </button>
            )}
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-black/50 border border-rose-700/40 text-rose-200 hover:bg-rose-900/40"
              data-testid="home-logout-btn"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
              Salir
            </button>
          </>
        )}
      </div>

      {/* Subtitle at bottom */}
      <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
        <p className="text-amber-200/50 text-sm font-heading tracking-widest">
          5e Mod — La Tierra Media te espera
        </p>
      </div>
      
      {/* Developer/Debug Links — only for staff (Maestro / DJ) */}
      {hasRole('maestro', 'director_de_juego') && (
        <div className="absolute bottom-4 left-4 z-10 flex gap-4">
          <button
            onClick={() => navigate('/terrain-editor')}
            className="text-xs text-gray-600 hover:text-amber-400 transition-colors"
            title="Editor de Terrenos (temporal)"
          >
            Terrenos
          </button>
          <button
            onClick={() => navigate('/path-debugger')}
            className="text-xs text-gray-600 hover:text-amber-400 transition-colors"
            title="Depurador de Caminos (temporal)"
          >
            Caminos
          </button>
          <button
            onClick={() => navigate('/sheet-editor')}
            className="text-xs text-gray-600 hover:text-amber-400 transition-colors"
            data-testid="sheet-editor-link"
          >
            Editor
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
