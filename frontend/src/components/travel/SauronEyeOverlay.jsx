/**
 * SauronEyeOverlay — overlay a pantalla completa con el Ojo de Sauron ardiendo
 * mientras se automatiza un viaje. Muestra una barra de progreso y un mensaje
 * dinámico ("Calculando tirada de orientación…", "Resolviendo evento…", etc.).
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
        background: 'radial-gradient(circle at center, rgba(40,5,5,0.85) 0%, rgba(0,0,0,0.95) 70%)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div className="flex flex-col items-center gap-6 max-w-lg px-6">
        <div className="relative w-72 h-72 sauron-pulse">
          <img
            src="/ojo_sauron.jpg"
            alt="Ojo de Sauron"
            className="w-full h-full object-cover rounded-full shadow-2xl sauron-spin"
            style={{
              boxShadow: '0 0 80px 20px rgba(255, 90, 0, 0.6), 0 0 200px 40px rgba(180, 30, 0, 0.3)',
            }}
          />
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{
            boxShadow: 'inset 0 0 60px 10px rgba(0,0,0,0.5)',
          }} />
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
            Detener automatización
          </button>
        )}
      </div>

      <style>{`
        @keyframes sauron-spin {
          from { transform: rotate(0deg) scale(1); }
          50%  { transform: rotate(180deg) scale(1.04); }
          to   { transform: rotate(360deg) scale(1); }
        }
        @keyframes sauron-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.03); }
        }
        .sauron-spin { animation: sauron-spin 12s linear infinite; }
        .sauron-pulse { animation: sauron-pulse 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default SauronEyeOverlay;
