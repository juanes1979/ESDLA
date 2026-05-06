/**
 * ForgedRingReveal — animación cinemática que se reproduce al generar
 * una Campaña activa (Fase 2). Muestra el `campaign_code` apareciendo
 * letra a letra como si fuera grabado en oro fundido sobre un anillo.
 *
 * Flujo:
 *   1. Anillo dorado emerge desde el centro con resplandor cálido.
 *   2. Ráfagas de chispas (CSS keyframes) durante la "forja".
 *   3. Cada carácter del código aparece secuencialmente con tinte ámbar.
 *   4. Sub-leyenda "Un código para gobernarlos a todos…" + acciones.
 *
 * Usado por <CampaignActivatedDialog> tras un POST /api/campaign-runs.
 */
import { useEffect, useState } from 'react';

const SPARK_COUNT = 28;

const ForgedRingReveal = ({ code }) => {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!code) return;
    setRevealed(0);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= code.length) clearInterval(interval);
    }, 180);
    return () => clearInterval(interval);
  }, [code]);

  return (
    <div
      className="relative flex flex-col items-center justify-center py-10 select-none"
      data-testid="forged-ring-reveal"
    >
      {/* Halo glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl animate-pulse" />
      </div>

      {/* The Ring */}
      <div className="relative w-48 h-48 mb-4">
        {/* Outer halo */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(255,180,60,0.45) 0%, rgba(255,120,30,0.2) 45%, transparent 70%)',
            animation: 'ringGlow 2.4s ease-in-out infinite',
          }}
        />
        {/* Ring body */}
        <div className="absolute inset-4 rounded-full ring-shape">
          <div className="absolute inset-3 rounded-full bg-black" />
        </div>
        {/* Inscription overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-heading text-2xl tracking-[0.4em] text-amber-200"
            style={{
              textShadow:
                '0 0 6px rgba(255,180,60,0.9), 0 0 12px rgba(255,120,30,0.7)',
            }}
            data-testid="forged-code-inscription"
          >
            {code.slice(0, revealed)}
            <span className="opacity-30">{'·'.repeat(Math.max(0, code.length - revealed))}</span>
          </span>
        </div>
        {/* Sparks */}
        {Array.from({ length: SPARK_COUNT }).map((_, i) => (
          <span
            key={i}
            className="spark"
            style={{
              left: `${50 + 38 * Math.cos((2 * Math.PI * i) / SPARK_COUNT)}%`,
              top: `${50 + 38 * Math.sin((2 * Math.PI * i) / SPARK_COUNT)}%`,
              animationDelay: `${(i * 80) % 1600}ms`,
            }}
          />
        ))}
      </div>

      {/* Big code display */}
      <div
        className="font-heading text-5xl sm:text-6xl tracking-[0.35em] text-amber-300 mt-2 mb-1"
        style={{
          textShadow:
            '0 0 10px rgba(255,180,60,0.8), 0 0 24px rgba(255,100,20,0.5)',
        }}
        data-testid="forged-code-bigtext"
      >
        {code.slice(0, revealed) || '—'}
      </div>

      <p className="text-sm italic text-amber-300/60 mt-2">
        Un código para gobernarlos a todos…
      </p>

      <style>{`
        @keyframes ringGlow {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        .ring-shape {
          background:
            conic-gradient(from 0deg,
              #4a2c0d 0deg,
              #d4a050 60deg,
              #f6d97a 120deg,
              #d4a050 180deg,
              #8a5a1a 240deg,
              #d4a050 300deg,
              #4a2c0d 360deg);
          box-shadow:
            inset 0 0 18px rgba(255, 200, 80, 0.55),
            0 0 28px rgba(255, 130, 30, 0.45),
            0 0 60px rgba(255, 100, 30, 0.25);
          animation: ringRotate 16s linear infinite;
        }
        @keyframes ringRotate {
          to { transform: rotate(360deg); }
        }
        .spark {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 200, 80, 0.95);
          box-shadow:
            0 0 4px rgba(255, 200, 80, 0.9),
            0 0 10px rgba(255, 140, 40, 0.7);
          transform: translate(-50%, -50%);
          animation: sparkPulse 1.6s ease-out infinite;
        }
        @keyframes sparkPulse {
          0%   { opacity: 0;   transform: translate(-50%, -50%) scale(0.4); }
          30%  { opacity: 1;   transform: translate(-50%, -50%) scale(1);   }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(0.6); }
        }
      `}</style>
    </div>
  );
};

export default ForgedRingReveal;
