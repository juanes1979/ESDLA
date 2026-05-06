/**
 * RuneIgniteOverlay — animación que se reproduce sobre un personaje recién
 * aceptado en una campaña. Una runa élfica aparece en el centro, brilla
 * en ámbar, irradia un anillo de luz y se desvanece. Duración total ~1.6s.
 *
 * Uso:
 *   {igniting && <RuneIgniteOverlay onDone={() => setIgniting(false)} />}
 *
 * El componente se posiciona como `absolute inset-0` sobre el contenedor
 * relativo del jugador.
 */
import { useEffect } from 'react';

const RuneIgniteOverlay = ({ onDone }) => {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1700);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
      data-testid="rune-ignite-overlay"
    >
      {/* Pulse ring */}
      <div className="rune-pulse" />
      {/* Glow halo */}
      <div className="rune-halo" />
      {/* The rune */}
      <svg
        viewBox="0 0 100 100"
        className="rune-svg"
        aria-hidden="true"
      >
        {/* Stylized "Tengwar"-ish rune (vertical stem + branches) */}
        <g
          stroke="rgba(255,210,120,0.95)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        >
          <line x1="50" y1="18" x2="50" y2="82" />
          <line x1="50" y1="34" x2="68" y2="22" />
          <line x1="50" y1="50" x2="72" y2="50" />
          <line x1="50" y1="66" x2="68" y2="78" />
          <line x1="50" y1="34" x2="32" y2="22" />
          <line x1="50" y1="50" x2="28" y2="50" />
          <line x1="50" y1="66" x2="32" y2="78" />
          <circle cx="50" cy="50" r="3" fill="rgba(255,210,120,0.95)" />
        </g>
      </svg>

      <style>{`
        .rune-pulse {
          position: absolute;
          width: 28px;
          height: 28px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 200, 90, 0.9);
          box-shadow: 0 0 20px rgba(255, 160, 50, 0.7);
          animation: runePulse 1.6s ease-out forwards;
        }
        @keyframes runePulse {
          0%   { width: 28px;  height: 28px;  opacity: 0.9; }
          70%  { width: 220px; height: 220px; opacity: 0.6; }
          100% { width: 320px; height: 320px; opacity: 0;   }
        }
        .rune-halo {
          position: absolute;
          width: 140px;
          height: 140px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(255,200,90,0.55) 0%, transparent 65%);
          animation: runeHalo 1.6s ease-out forwards;
        }
        @keyframes runeHalo {
          0%   { opacity: 0;   transform: scale(0.4); }
          25%  { opacity: 1;   transform: scale(1);   }
          100% { opacity: 0;   transform: scale(1.4); }
        }
        .rune-svg {
          width: 56px;
          height: 56px;
          filter: drop-shadow(0 0 8px rgba(255,180,60,0.9))
                  drop-shadow(0 0 16px rgba(255,120,40,0.6));
          animation: runeFlicker 1.6s ease-out forwards;
        }
        @keyframes runeFlicker {
          0%   { opacity: 0;   transform: scale(0.3) rotate(-12deg); }
          20%  { opacity: 1;   transform: scale(1.15) rotate(0deg); }
          40%  { opacity: 0.85; }
          70%  { opacity: 1;   transform: scale(1) rotate(0deg); }
          100% { opacity: 0;   transform: scale(1.05) rotate(4deg); }
        }
      `}</style>
    </div>
  );
};

export default RuneIgniteOverlay;
