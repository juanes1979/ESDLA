/**
 * Referencia rápida de Reglas — SOLO CONSULTA en la Pantalla del DJ.
 * Chuleta curada de lo más usado en mesa. La edición completa de las tablas
 * sigue en /rules (accesible solo al equipo, botón visible para el DJ).
 */
import { useState } from 'react';
import { X, BookOpen, ExternalLink, ChevronDown } from 'lucide-react';

const SECTIONS = [
  {
    id: 'pruebas', title: 'Pruebas y CDs',
    rows: [
      ['Muy fácil', 'CD 5'], ['Fácil', 'CD 10'], ['Media', 'CD 15'],
      ['Difícil', 'CD 20'], ['Muy difícil', 'CD 25'], ['Casi imposible', 'CD 30'],
      ['Ventaja / Desventaja', 'tira 2d20 y toma el mayor / menor'],
      ['Inspiración', 'gasta para ganar ventaja en una tirada'],
    ],
  },
  {
    id: 'combate', title: 'Secuencia de combate',
    rows: [
      ['1. Iniciativa', '1d20 + mod. DES, orden descendente'],
      ['2. Ataque', 'd20 + bono de ataque vs CA del objetivo'],
      ['Crítico', 'un 20 natural impacta y duplica los DADOS de daño'],
      ['Pifia', 'un 1 natural falla siempre'],
      ['Daño', 'dados del arma + modificador'],
      ['0 PG', 'cae inconsciente; golpes cercanos son críticos'],
    ],
  },
  {
    id: 'condiciones', title: 'Condiciones',
    rows: [
      ['Cansado', 'desventaja en sus ataques y pruebas'],
      ['Inspirado', 'ventaja en su próximo ataque (se consume)'],
      ['Aturdido', 'no actúa; le atacan con ventaja'],
      ['Tumbado', 'desventaja al atacar; melé contra él con ventaja'],
      ['Apresado', 'velocidad 0'],
      ['Asustado', 'desventaja mientras vea la amenaza'],
      ['Envenenado', 'desventaja en ataques y pruebas'],
      ['Inconsciente', 'no actúa; golpes cercanos son críticos'],
    ],
  },
  {
    id: 'sombra', title: 'Sombra y Ojo de Mordor',
    rows: [
      ['Ganar Sombra', 'por actos viles, magia negra o pruebas de viaje falladas'],
      ['Umbral de Sombra', 'al superarlo, arranque de locura y posible mácula'],
      ['Ojo de Mordor', 'atención del Enemigo; al llegar al umbral → Episodio de Revelación'],
      ['Bandas del Ojo', 'Dormido → Entreabierto → Vigilante → Parpadeando → La Mirada'],
    ],
  },
  {
    id: 'viaje', title: 'Roles de viaje',
    rows: [
      ['Guía', 'lidera la ruta; evita perderse'],
      ['Explorador', 'localiza peligros y lugares de acampada'],
      ['Cazador', 'consigue alimento para el grupo'],
      ['Vigía', 'detecta emboscadas y amenazas'],
    ],
  },
  {
    id: 'descanso', title: 'Descanso y cansancio',
    rows: [
      ['Descanso corto', '~1 h: recupera algunos recursos'],
      ['Descanso largo', '~8 h: recupera PG y niveles de cansancio'],
      ['Cansancio', 'niveles acumulables; desventaja crecientes hasta la extenuación'],
    ],
  },
];

const RulesReferenceModal = ({ open, onClose, canOpenFull }) => {
  const [expanded, setExpanded] = useState('pruebas');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={onClose} data-testid="rules-modal">
      <div className="bg-zinc-900 rounded-xl border border-amber-700/40 p-4 max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-lg text-amber-300 flex items-center gap-2"><BookOpen className="w-5 h-5" /> Referencia rápida</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white" data-testid="rules-close"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {SECTIONS.map((s) => {
            const isOpen = expanded === s.id;
            return (
              <div key={s.id} className="rounded-lg border border-amber-900/40 bg-black/40 overflow-hidden" data-testid={`rules-section-${s.id}`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-amber-200 hover:bg-amber-900/20 transition-colors"
                  data-testid={`rules-toggle-${s.id}`}
                >
                  <span className="font-medium">{s.title}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-3 pb-2">
                    {s.rows.map(([k, v]) => (
                      <div key={k} className="flex gap-2 py-1 border-b border-stone-800/60 last:border-0 text-[12px]">
                        <span className="text-amber-300/90 w-40 shrink-0 font-medium">{k}</span>
                        <span className="text-stone-300">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {canOpenFull && (
          <a
            href="/rules" target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center gap-1 text-xs text-amber-300/80 hover:text-amber-200 border border-amber-800/40 rounded px-3 py-1.5 transition-colors"
            data-testid="rules-open-full"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir las Reglas completas (23 apartados)
          </a>
        )}
      </div>
    </div>
  );
};

export default RulesReferenceModal;
