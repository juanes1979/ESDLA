/**
 * SauronEyeOverlay — overlay a pantalla completa con el Ojo de Sauron ardiendo
 * mientras se simula el "Viaje global". El dibujo del ojo se muestra sin recorte
 * visible: una máscara radial difumina los bordes hacia el negro de fondo, y
 * varias capas de gradiente animado simulan llamas saliendo del propio ojo.
 *
 * El header de la app (con los botones de inicio) queda visible por encima
 * gracias a su z-index (típicamente 50). Este overlay usa z-40.
 */
import { Loader2 } from 'lucide-react';

const SauronEyeOverlay = ({ visible, percent = 0, message = '', subtitle = '', onCancel }) => {
  if (!visible) return null;
  const pct = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      data-testid="sauron-eye-overlay"
      style={{
        background: 'radial-gradient(circle at center, rgba(40,5,5,0.92) 0%, rgba(0,0,0,0.98) 70%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg px-6">
        {/* Contenedor del ojo + capas de fuego */}
        <div className="relative w-80 h-80 flex items-center justify-center">
          {/* Capa 1 — resplandor exterior naranja (lento) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full sauron-fire-outer pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255,120,40,0.55) 0%, rgba(255,80,10,0.35) 35%, rgba(160,30,0,0.15) 60%, transparent 75%)',
              filter: 'blur(18px)',
              transform: 'scale(1.55)',
              mixBlendMode: 'screen',
            }}
          />
          {/* Capa 2 — núcleo de fuego más cercano (rápido) */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full sauron-fire-inner pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255,200,80,0.55) 0%, rgba(255,140,40,0.35) 30%, transparent 60%)',
              filter: 'blur(10px)',
              transform: 'scale(1.25)',
              mixBlendMode: 'screen',
            }}
          />
          {/* Capa 3 — ascuas amarillas que tiemblan */}
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full sauron-fire-embers pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255,230,120,0.45) 0%, rgba(255,180,80,0.25) 20%, transparent 45%)',
              filter: 'blur(6px)',
              transform: 'scale(1.1)',
              mixBlendMode: 'screen',
            }}
          />

          {/* Imagen del Ojo, con máscara radial para fundir los bordes con el fondo */}
          <img
            src="/ojo_sauron.png"
            alt="Ojo de Sauron"
            className="relative w-full h-full object-contain sauron-pulse"
            style={{
              // La máscara radial hace que los bordes del PNG se fundan con el
              // fondo, eliminando cualquier corte rectangular o halo cuadrado.
              WebkitMaskImage:
                'radial-gradient(circle at center, #000 38%, rgba(0,0,0,0.85) 48%, rgba(0,0,0,0.4) 60%, transparent 75%)',
              maskImage:
                'radial-gradient(circle at center, #000 38%, rgba(0,0,0,0.85) 48%, rgba(0,0,0,0.4) 60%, transparent 75%)',
              filter:
                'drop-shadow(0 0 30px rgba(255,120,40,0.85)) drop-shadow(0 0 80px rgba(220,60,0,0.5))',
            }}
          />
        </div>

        <div className="w-full">
          <div className="flex items-center gap-3 justify-center mb-2">
            <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
            <h2 className="font-heading text-2xl text-orange-300 tracking-wide">
              {message || 'El Ojo todo lo ve…'}
            </h2>
          </div>
          {subtitle && (
            <p className="text-sm text-orange-200/70 italic text-center mb-4" data-testid="sauron-eye-subtitle">
              {subtitle}
            </p>
          )}

          <div className="w-full bg-black/60 rounded-full h-3 overflow-hidden border border-orange-900/50">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #b91c1c 0%, #ea580c 50%, #f59e0b 100%)',
                boxShadow: '0 0 12px rgba(255,140,0,0.7)',
              }}
              data-testid="sauron-eye-progress-bar"
            />
          </div>
          <p className="text-center text-orange-200 text-sm mt-2 font-mono" data-testid="sauron-eye-percent">
            {pct}%
          </p>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-2 px-4 py-1.5 text-xs text-orange-200/80 border border-orange-900/50 rounded hover:bg-orange-900/20 transition-colors"
            data-testid="sauron-eye-cancel-btn"
          >
            Detener viaje global
          </button>
        )}
      </div>

      <style>{`
        @keyframes sauron-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.04); opacity: 0.95; }
        }
        @keyframes sauron-fire-outer {
          0%, 100% { opacity: 0.7; transform: scale(1.55); }
          50%      { opacity: 1;   transform: scale(1.7); }
        }
        @keyframes sauron-fire-inner {
          0%, 100% { opacity: 0.6; transform: scale(1.25); }
          50%      { opacity: 1;   transform: scale(1.4); }
        }
        @keyframes sauron-fire-embers {
          0%, 100% { opacity: 0.5; transform: scale(1.1) translateY(0px); }
          25%      { opacity: 0.9; transform: scale(1.15) translateY(-2px); }
          75%      { opacity: 0.7; transform: scale(1.12) translateY(2px); }
        }
        .sauron-pulse        { animation: sauron-pulse 2.6s ease-in-out infinite; }
        .sauron-fire-outer   { animation: sauron-fire-outer 3.2s ease-in-out infinite; }
        .sauron-fire-inner   { animation: sauron-fire-inner 2s ease-in-out infinite; }
        .sauron-fire-embers  { animation: sauron-fire-embers 1.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default SauronEyeOverlay;
