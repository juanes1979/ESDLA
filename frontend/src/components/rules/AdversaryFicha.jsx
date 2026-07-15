/**
 * Ficha completa de un ADVERSARIO concreto (creado desde «PNJs»).
 * Reutiliza el mismo bloque de combate que el Bestiario (armas, acciones,
 * especiales, reacciones, defensas, sentidos, idiomas, atributos, desafío)
 * y añade datos propios del PNJ (ubicación, apariencia, historia, relaciones, notas).
 */
import { Skull, Shield, Heart, Zap, Eye, Swords, Sparkles, BookOpen, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const XP_TO_CR = [
  [0, '0'], [25, '1/8'], [50, '1/4'], [100, '1/2'], [200, '1'], [450, '2'],
  [700, '3'], [1100, '4'], [1800, '5'], [2300, '6'], [2900, '7'], [3900, '8'],
  [5000, '9'], [5900, '10'], [7200, '11'], [8400, '12'], [10000, '13'],
  [11500, '14'], [13000, '15'], [15000, '16'], [18000, '17'], [20000, '18'],
];
const xpToCr = (xp) => {
  if (xp == null || xp === '') return null;
  const n = Number(xp);
  if (!Number.isFinite(n)) return null;
  let cr = '0';
  for (const [t, c] of XP_TO_CR) { if (n >= t) cr = c; else break; }
  return cr;
};
const formatDesafio = (npc) => {
  if (npc?.desafio && String(npc.desafio).trim()) return String(npc.desafio).trim();
  const cr = xpToCr(npc?.experiencia);
  return cr == null ? null : `${cr} (${npc?.experiencia || 0} PX)`;
};
const getModifier = (v) => { const m = Math.floor(((Number(v) || 10) - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

const ATTRS = [
  { key: 'fuerza', abbr: 'FUE' }, { key: 'destreza', abbr: 'DES' }, { key: 'constitucion', abbr: 'CON' },
  { key: 'inteligencia', abbr: 'INT' }, { key: 'sabiduria', abbr: 'SAB' }, { key: 'carisma', abbr: 'CAR' },
];

const Block = ({ title, icon: Icon, color, children }) => (
  <div className="space-y-2">
    <p className="text-xs font-bold flex items-center gap-1" style={{ color }}><Icon className="w-4 h-4" /> {title}</p>
    {children}
  </div>
);

const AdversaryFicha = ({ npc, onEdit, onDelete }) => {
  if (!npc) return null;
  const portrait = npc.retrato_file_id ? `${API_URL}/api/trading/npcs/${npc._id}/portrait` : null;
  const atributos = npc.atributos || npc.caracteristicas || null;
  const ca = npc.clase_armadura ?? npc.ca;
  const pg = npc.puntos_golpe ?? npc.pg;
  const desafio = formatDesafio(npc);
  const rasgos = Array.isArray(npc.rasgos) ? npc.rasgos : (npc.rasgos ? [npc.rasgos] : []);

  return (
    <div className="bg-card border border-[hsl(var(--destructive))]/40 rounded-xl p-4 space-y-4" data-testid="adversary-ficha">
      {/* Cabecera */}
      <div className="flex items-start gap-3">
        {portrait
          ? <img src={portrait} alt={npc.nombre} className="w-20 h-20 rounded-lg object-cover border border-[hsl(var(--gold))]/40" data-testid="adversary-ficha-portrait" />
          : <div className="w-20 h-20 rounded-lg border border-border/40 bg-black/40 flex items-center justify-center"><Skull className="w-8 h-8 text-muted-foreground/50" /></div>}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-2xl text-[hsl(var(--gold))] leading-tight">{npc.nombre}{npc.apodo ? ` "${npc.apodo}"` : ''}</h3>
          <p className="text-sm text-muted-foreground">{npc.tipo_adversario || npc.profesion}</p>
          {npc.tipo && <p className="text-xs italic text-muted-foreground/70">{npc.tipo}</p>}
        </div>
        <div className="flex gap-1">
          {onEdit && <button onClick={onEdit} className="p-2 rounded hover:bg-white/10 text-muted-foreground" title="Editar" data-testid="adversary-ficha-edit"><Swords className="w-4 h-4" /></button>}
          {onDelete && <button onClick={onDelete} className="p-2 rounded hover:bg-white/10 text-red-400" title="Borrar" data-testid="adversary-ficha-delete"><Skull className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Datos de PNJ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        {npc.ubicacion && <div><span className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Ubicación</span><span className="font-semibold">{npc.ubicacion}</span></div>}
        {npc.region && <div><span className="text-muted-foreground text-xs">Región</span><br /><span className="font-semibold">{npc.region}</span></div>}
        {npc.sexo && <div><span className="text-muted-foreground text-xs">Sexo</span><br /><span className="font-semibold">{npc.sexo}</span></div>}
        {npc.edad && <div><span className="text-muted-foreground text-xs">Edad</span><br /><span className="font-semibold">{npc.edad}</span></div>}
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-[hsl(var(--magic-blue))]/10 p-2 rounded text-center"><Shield className="w-4 h-4 mx-auto text-[hsl(var(--magic-blue))]" /><p className="text-xs text-muted-foreground mt-1">CA</p><p className="text-lg font-bold text-[hsl(var(--magic-blue))]">{ca}</p></div>
        <div className="bg-red-500/10 p-2 rounded text-center"><Heart className="w-4 h-4 mx-auto text-red-400" /><p className="text-xs text-muted-foreground mt-1">PG</p><p className="text-lg font-bold text-red-400">{pg}</p></div>
        {npc.velocidad != null && <div className="bg-yellow-500/10 p-2 rounded text-center"><Zap className="w-4 h-4 mx-auto text-yellow-400" /><p className="text-xs text-muted-foreground mt-1">Velocidad</p><p className="text-lg font-bold text-yellow-400">{npc.velocidad}m</p></div>}
        <div className="bg-[hsl(var(--gold))]/10 p-2 rounded text-center"><Sparkles className="w-4 h-4 mx-auto text-[hsl(var(--gold))]" /><p className="text-xs text-muted-foreground mt-1">Desafío</p><p className="text-sm font-bold text-[hsl(var(--gold))]">{desafio || '—'}</p></div>
        <div className="bg-cyan-500/10 p-2 rounded text-center"><Eye className="w-4 h-4 mx-auto text-cyan-400" /><p className="text-xs text-muted-foreground mt-1">Percepción</p><p className="text-lg font-bold text-cyan-400">{npc.percepcion_pasiva || 10}</p></div>
      </div>

      {/* Atributos */}
      {atributos && (
        <div className="grid grid-cols-6 gap-2">
          {ATTRS.map((a) => (
            <div key={a.key} className="bg-black/20 p-2 rounded text-center">
              <p className="text-xs text-[hsl(var(--gold))] font-bold">{a.abbr}</p>
              <p className="text-lg font-bold">{atributos[a.key]}</p>
              <p className="text-xs text-muted-foreground">{getModifier(atributos[a.key])}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rasgos (Fase 2) */}
      {rasgos.length > 0 && (
        <Block title="Rasgos" icon={Sparkles} color="hsl(var(--gold))">
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">{rasgos.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </Block>
      )}
      {npc.modo_hablar && <p className="text-sm text-muted-foreground"><span className="text-[hsl(var(--gold))] text-xs font-bold">Forma de hablar: </span>{npc.modo_hablar}</p>}

      {/* Sentidos / Idiomas */}
      {npc.sentidos && (Array.isArray(npc.sentidos) ? npc.sentidos.length > 0 : npc.sentidos) && (
        <p className="text-sm"><span className="text-[hsl(var(--magic-blue))] text-xs font-bold">Sentidos: </span>{Array.isArray(npc.sentidos) ? npc.sentidos.join(', ') : npc.sentidos}</p>
      )}
      {npc.idiomas?.length > 0 && <p className="text-sm"><span className="text-[hsl(var(--gold))] text-xs font-bold">Idiomas: </span>{npc.idiomas.join(', ')}</p>}

      {/* Defensas */}
      {npc.resistencias?.length > 0 && <p className="text-sm"><span className="text-emerald-400 text-xs font-bold">Resistencias: </span>{npc.resistencias.join(', ')}</p>}
      {npc.inmunidades_dano?.length > 0 && <p className="text-sm"><span className="text-emerald-400 text-xs font-bold">Inmunidades al daño: </span>{npc.inmunidades_dano.join(', ')}</p>}
      {npc.inmunidades_estados?.length > 0 && <p className="text-sm"><span className="text-emerald-400 text-xs font-bold">Inmunidades a estados: </span>{npc.inmunidades_estados.join(', ')}</p>}
      {npc.vulnerabilidades?.length > 0 && <p className="text-sm"><span className="text-red-400 text-xs font-bold">Vulnerabilidades: </span>{npc.vulnerabilidades.join(', ')}</p>}

      {/* Especiales */}
      {npc.especiales?.length > 0 && (
        <Block title="Habilidades Especiales" icon={Sparkles} color="rgb(192 132 252)">
          {npc.especiales.map((e, i) => <div key={i} className="p-2 bg-purple-500/10 rounded"><p className="font-semibold text-purple-300">{e.nombre}</p><p className="text-sm text-muted-foreground">{e.descripcion}</p></div>)}
        </Block>
      )}
      {npc.especial && !npc.especiales?.length && <p className="text-sm"><span className="text-purple-300 text-xs font-bold">Especial: </span>{npc.especial}</p>}

      {/* Armas */}
      {(npc.armas?.length > 0 || npc.ataque_multiple) && (
        <Block title="Ataques" icon={Swords} color="hsl(var(--destructive))">
          {npc.ataque_multiple && <p className="text-sm text-muted-foreground italic"><strong>Ataque Múltiple:</strong> {npc.ataque_multiple}</p>}
          {npc.armas?.map((arma, i) => (
            <div key={i} className="p-2 bg-[hsl(var(--destructive))]/10 rounded">
              <div className="flex items-center justify-between"><p className="font-semibold text-[hsl(var(--destructive))]">{arma.nombre}</p><Badge variant="outline" className="text-xs">{arma.tipo}</Badge></div>
              <div className="grid grid-cols-3 gap-2 mt-1 text-sm"><span><strong>+{arma.bonificador_impacto}</strong> al impacto</span><span>{arma.alcance_metros}</span><span><strong>{arma.dano}</strong> {arma.tipo_dano}</span></div>
              {arma.efecto && <p className="text-xs text-muted-foreground mt-1 italic">{arma.efecto}</p>}
            </div>
          ))}
        </Block>
      )}

      {/* Acciones / Reacciones */}
      {Array.isArray(npc.acciones) && npc.acciones.length > 0 && (
        <Block title="Otras Acciones" icon={Zap} color="hsl(var(--gold))">
          {npc.acciones.map((a, i) => <div key={i} className="p-2 bg-[hsl(var(--gold))]/10 rounded"><p className="font-semibold text-[hsl(var(--gold))]">{a.nombre}</p><p className="text-sm text-muted-foreground">{a.descripcion}</p></div>)}
        </Block>
      )}
      {typeof npc.acciones === 'string' && npc.acciones && <p className="text-sm"><span className="text-[hsl(var(--gold))] text-xs font-bold">Acciones: </span>{npc.acciones}</p>}
      {npc.reacciones?.length > 0 && (
        <Block title="Reacciones" icon={Zap} color="hsl(var(--torch-orange))">
          {npc.reacciones.map((r, i) => <div key={i} className="p-2 bg-[hsl(var(--torch-orange))]/10 rounded"><p className="font-semibold text-[hsl(var(--torch-orange))]">{r.nombre}</p><p className="text-sm text-muted-foreground">{r.descripcion}</p></div>)}
        </Block>
      )}

      {/* Apariencia */}
      {npc.apariencia && <div><p className="text-xs text-[hsl(var(--gold))] font-bold">Apariencia</p><p className="text-sm text-muted-foreground italic">{npc.apariencia}</p></div>}
      {npc.descripcion && <p className="text-sm text-muted-foreground italic">{npc.descripcion}</p>}

      {/* Historia */}
      {npc.historia && (
        <div className="p-3 bg-[hsl(var(--gold))]/10 rounded border border-[hsl(var(--gold))]/30">
          <p className="text-xs text-[hsl(var(--gold))] font-bold flex items-center gap-1"><BookOpen className="w-4 h-4" /> Historia / Trasfondo</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{npc.historia}</p>
        </div>
      )}

      {/* Relaciones con PJs (notas del DJ) */}
      {npc.relaciones_dj && (
        <div className="p-3 bg-[hsl(var(--magic-blue))]/10 rounded border border-[hsl(var(--magic-blue))]/30">
          <p className="text-xs text-[hsl(var(--magic-blue))] font-bold flex items-center gap-1"><Users className="w-4 h-4" /> Relaciones con personajes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{npc.relaciones_dj}</p>
        </div>
      )}

      {/* Notas del DJ */}
      {npc.notas && <div><p className="text-xs text-muted-foreground font-bold">Notas del DJ</p><p className="text-sm text-muted-foreground whitespace-pre-line">{npc.notas}</p></div>}
    </div>
  );
};

export default AdversaryFicha;
