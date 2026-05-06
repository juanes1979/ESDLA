/**
 * ScrollOfDeedsReveal — animación cinemática de cierre de campaña.
 * Despliega un "rollo de pergamino" por cada personaje aceptado, con un
 * contador de XP que sube de 0 al total otorgado y luego se desliza al
 * `experiencia` total del personaje.
 *
 * Props:
 *   entries: [{ character_id, character_name, xp_earned }]
 *   open: boolean
 *   onClose: () => void
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const COUNT_DURATION_MS = 1400;

const AnimatedCounter = ({ target, durationMs = COUNT_DURATION_MS }) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return <span>{value.toLocaleString('es-ES')}</span>;
};

const Scroll = ({ entry, index }) => (
  <div
    className="scroll-row"
    style={{ animationDelay: `${index * 320}ms` }}
    data-testid={`scroll-row-${entry.character_id}`}
  >
    <div className="scroll-rod scroll-rod-left" />
    <div className="scroll-paper">
      <div className="scroll-name">{entry.character_name || '—'}</div>
      <div className="scroll-xp">
        <span className="text-amber-300/70 text-sm">+ </span>
        <span className="text-3xl font-heading text-amber-300">
          <AnimatedCounter target={entry.xp_earned} />
        </span>
        <span className="text-amber-300/70 text-sm ml-1">PX</span>
      </div>
      <div className="scroll-caption">consolidados a {entry.character_name}</div>
    </div>
    <div className="scroll-rod scroll-rod-right" />
  </div>
);

const ScrollOfDeedsReveal = ({ entries, open, onClose }) => {
  if (!entries || entries.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl bg-gradient-to-b from-black to-[#1a0d05] border-amber-700/60"
        data-testid="scroll-of-deeds-dialog"
      >
        <DialogTitle className="font-heading text-3xl text-center text-amber-300 tracking-widest">
          GESTAS DE LA CAMPAÑA
        </DialogTitle>
        <p className="text-center text-sm italic text-amber-300/60 -mt-1 mb-4">
          Las hazañas se sellan en el pergamino — la experiencia es vuestra.
        </p>

        <div className="space-y-4 py-3">
          {entries.map((entry, i) => (
            <Scroll key={entry.character_id} entry={entry} index={i} />
          ))}
        </div>

        <div className="text-center mt-4">
          <Button
            onClick={onClose}
            data-testid="close-scroll-btn"
            className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
          >
            Cerrar
          </Button>
        </div>

        <style>{`
          .scroll-row {
            display: flex;
            align-items: stretch;
            gap: 0;
            opacity: 0;
            animation: scrollAppear 0.85s ease-out forwards;
          }
          @keyframes scrollAppear {
            0%   { opacity: 0; transform: translateY(20px) scaleX(0.05); }
            40%  { opacity: 1; transform: translateY(0)    scaleX(0.05); }
            100% { opacity: 1; transform: translateY(0)    scaleX(1);    }
          }
          .scroll-rod {
            width: 14px;
            background:
              linear-gradient(to right,
                #3a2008 0%, #6c4015 30%,
                #b07832 50%, #6c4015 70%, #3a2008 100%);
            border-radius: 4px;
            box-shadow:
              inset 0 0 6px rgba(255,200,90,0.35),
              0 0 8px rgba(0,0,0,0.6);
            position: relative;
          }
          .scroll-rod::before, .scroll-rod::after {
            content: '';
            position: absolute;
            left: -4px;
            right: -4px;
            height: 10px;
            background:
              radial-gradient(ellipse at center,
                #c4892f 0%, #6c4015 60%, #3a2008 100%);
            border-radius: 6px;
          }
          .scroll-rod::before { top: -5px; }
          .scroll-rod::after  { bottom: -5px; }
          .scroll-paper {
            flex: 1;
            background:
              linear-gradient(180deg,
                #f4e3b8 0%, #ead49b 50%, #d8bd7c 100%);
            color: #3a2008;
            padding: 14px 22px;
            position: relative;
            box-shadow:
              inset 0 6px 12px rgba(0,0,0,0.18),
              inset 0 -6px 12px rgba(0,0,0,0.18);
            transform-origin: left center;
            animation: paperUnroll 0.85s ease-out forwards;
          }
          @keyframes paperUnroll {
            0%   { transform: scaleX(0.05); opacity: 0.4; }
            100% { transform: scaleX(1);    opacity: 1;   }
          }
          .scroll-name {
            font-family: var(--font-heading, 'Cinzel', serif);
            font-size: 1.05rem;
            font-weight: 600;
            letter-spacing: 0.03em;
            color: #4a2906;
            margin-bottom: 2px;
          }
          .scroll-xp {
            line-height: 1.1;
          }
          .scroll-caption {
            font-size: 0.72rem;
            font-style: italic;
            color: rgba(74, 41, 6, 0.6);
            margin-top: 2px;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
};

export default ScrollOfDeedsReveal;
