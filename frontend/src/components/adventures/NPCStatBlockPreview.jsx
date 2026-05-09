/**
 * NPCStatBlockPreview — ficha visual estilo libro "Saqueador Sureño":
 *  - Fondo pergamino con borde ornamentado dorado
 *  - Cabecera maroon con nombre en oro + retrato a la izquierda
 *  - Bloques de stats coloreados (CA, PG, Velocidad, Iniciativa, PX)
 *  - Fila de atributos con dados estilizados por color (FUE rojo, DES verde, etc.)
 *  - Secciones HABILIDADES ESPECIALES y ATAQUES con icono floral rojo
 *  - Ataques en formato tabla con botones de tipo redondeados
 *
 * Mantiene la interfaz `(name, npc)` de drop-in replacement.
 */
import { Heart, Footprints, Award, Zap, Sparkles, Swords } from 'lucide-react';
import AuthenticatedImage from '@/components/AuthenticatedImage';
import { attrModifier } from './NPCStatBlockEditor';

const ATTR_KEYS = ['fuerza', 'destreza', 'constitucion', 'inteligencia', 'sabiduria', 'carisma'];
const ATTR_LABELS = {
  fuerza: 'FUE',
  destreza: 'DES',
  constitucion: 'CON',
  inteligencia: 'INT',
  sabiduria: 'SAB',
  carisma: 'CAR',
};
// Tonos coloreados por atributo (al estilo de los dados de libro de rol)
const ATTR_COLORS = {
  fuerza: 'from-red-900 to-red-700 border-red-400',
  destreza: 'from-emerald-900 to-emerald-700 border-emerald-400',
  constitucion: 'from-orange-900 to-orange-700 border-orange-400',
  inteligencia: 'from-cyan-900 to-cyan-700 border-cyan-400',
  sabiduria: 'from-indigo-900 to-indigo-700 border-indigo-400',
  carisma: 'from-fuchsia-900 to-fuchsia-700 border-fuchsia-400',
};

const fmtMod = (v) => {
  const m = attrModifier(v);
  return m === null ? '—' : m >= 0 ? `+${m}` : `${m}`;
};

const SectionHeader = ({ icon: Icon, label }) => (
  <div className="relative my-3" data-testid={`section-${label.toLowerCase()}`}>
    <div className="bg-gradient-to-r from-stone-800 via-stone-900 to-stone-800 px-3 py-1.5 flex items-center gap-2 border-y-2 border-amber-700/60">
      <Icon className="w-4 h-4 text-rose-400 fill-rose-500/40" />
      <span className="font-bold tracking-[0.2em] text-amber-200 text-sm uppercase">
        {label}
      </span>
      <div className="flex-1 h-px bg-amber-700/40" />
    </div>
  </div>
);

// Pequeño bloque "stat de combate" (CA, PG, Vel, Ini, PX)
const CombatStat = ({ icon: Icon, label, value, sub, color = 'amber', testid }) => (
  <div
    className={`flex flex-col items-center justify-center px-2 py-1.5 rounded border-2 border-${color}-600/50 bg-gradient-to-b from-stone-900 to-stone-800 shadow-md min-w-[68px]`}
    data-testid={testid}
  >
    <Icon className={`w-4 h-4 text-${color}-300 mb-0.5`} />
    <div className="text-[9px] uppercase tracking-wider text-amber-200/70 font-bold">{label}</div>
    <div className={`text-lg font-extrabold leading-none text-${color}-100`}>{value ?? '—'}</div>
    {sub && <div className="text-[9px] text-stone-300/70 mt-0.5">{sub}</div>}
  </div>
);

const AttrBlock = ({ k, value }) => {
  const mod = attrModifier(value);
  return (
    <div
      className={`flex flex-col items-center bg-gradient-to-b ${ATTR_COLORS[k]} border-2 rounded-lg shadow-lg p-2 min-w-[52px]`}
      data-testid={`attr-block-${k}`}
    >
      <div className="text-[10px] font-bold tracking-wider text-amber-100/90">{ATTR_LABELS[k]}</div>
      <div className="text-2xl font-extrabold text-white leading-tight drop-shadow">{value ?? '—'}</div>
      <div className="text-[10px] font-semibold text-amber-100/85">
        ({mod === null ? '—' : mod >= 0 ? `+${mod}` : mod})
      </div>
    </div>
  );
};

const AttackTypeChip = ({ tipo }) => {
  const isRanged = tipo === 'a_distancia' || /distancia/i.test(tipo || '');
  const label = isRanged ? 'distancia' : 'cuerpo a cuerpo';
  return (
    <span className="inline-block px-2 py-0.5 rounded-full bg-amber-200/90 text-stone-900 text-[10px] font-bold uppercase tracking-wider shadow-sm border border-amber-700/40">
      {label}
    </span>
  );
};

const NPCStatBlockPreview = ({ name, npc, portraitFileId, portraitB64 }) => {
  if (!npc) return null;

  const armas = npc.armas || [];
  const especiales = npc.especiales || [];
  const reacciones = npc.reacciones || [];
  const desMod = attrModifier(npc.atributos?.destreza);
  const iniciativa = desMod !== null ? (desMod >= 0 ? `+${desMod}` : desMod) : '—';

  const subtitle = [npc.tamanio, npc.tipo, npc.alineamiento].filter(Boolean).join(' · ');

  return (
    <div
      className="relative rounded-lg overflow-hidden font-serif shadow-2xl"
      data-testid="npc-statblock-preview"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65'/><feColorMatrix values='0 0 0 0 0.32 0 0 0 0 0.22 0 0 0 0 0.12 0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\"), linear-gradient(to bottom, #f3e7c8 0%, #e8d5a8 100%)",
        backgroundColor: '#efdcb1',
      }}
    >
      {/* Outer ornate border (double frame) */}
      <div className="absolute inset-0 pointer-events-none border-[3px] border-stone-900 rounded-lg" />
      <div className="absolute inset-1.5 pointer-events-none border border-amber-700/60 rounded-md" />

      {/* ===== HEADER BAND ===== */}
      <div className="relative bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900 px-4 py-3 border-b-4 border-amber-700/50">
        <div className="flex items-start gap-3">
          {/* Portrait */}
          <div className="shrink-0 w-20 h-24 rounded border-2 border-amber-600/60 overflow-hidden bg-stone-950 shadow-inner">
            {portraitFileId ? (
              <AuthenticatedImage fileId={portraitFileId} alt="retrato" className="w-full h-full object-cover" />
            ) : portraitB64 ? (
              <img src={`data:image/png;base64,${portraitB64}`} alt="retrato" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-amber-700/40 text-[10px] italic text-center px-1">
                Sin retrato
              </div>
            )}
          </div>

          {/* Name + subtitle */}
          <div className="flex-1 text-center">
            <h2
              className="text-2xl sm:text-3xl font-extrabold uppercase tracking-wider leading-none"
              style={{
                color: '#f5d27e',
                textShadow:
                  '0 0 1px #000, 1px 1px 0 #3b2410, 2px 2px 4px rgba(0,0,0,0.8)',
                fontFamily: '"Cinzel", "Trajan Pro", Georgia, serif',
              }}
              data-testid="npc-name"
            >
              {name || npc.nombre || 'Sin nombre'}
            </h2>
            {subtitle && (
              <p className="italic text-amber-200/80 text-xs mt-1">{subtitle}</p>
            )}
          </div>

          {/* Combat stats column */}
          <div className="grid grid-cols-2 gap-1 shrink-0">
            <CombatStat
              icon={Award}
              label="CA"
              value={npc.clase_armadura}
              color="amber"
              testid="combat-ca"
            />
            <CombatStat
              icon={Heart}
              label="PG"
              value={npc.puntos_golpe}
              sub={npc.dados_golpe || ''}
              color="rose"
              testid="combat-hp"
            />
            <CombatStat
              icon={Footprints}
              label="VEL"
              value={npc.velocidad ? `${npc.velocidad}m` : null}
              color="emerald"
              testid="combat-speed"
            />
            <CombatStat
              icon={Zap}
              label="INI"
              value={iniciativa}
              color="cyan"
              testid="combat-init"
            />
          </div>
        </div>

        {/* Optional XP chip */}
        {npc.experiencia != null && (
          <div className="absolute top-1 right-2 bg-amber-600 text-stone-950 text-[10px] font-extrabold px-2 py-0.5 rounded shadow border border-amber-300/60">
            {npc.experiencia} PX
            {npc.desafio && <span className="ml-1 opacity-80">· {npc.desafio}</span>}
          </div>
        )}
      </div>

      {/* ===== BODY ===== */}
      <div className="relative px-4 py-3 text-stone-900">
        {/* Description / armor description */}
        {(npc.descripcion_armadura || npc.descripcion) && (
          <p className="italic text-stone-700 text-xs mb-2" data-testid="npc-flavor">
            {[npc.descripcion_armadura && `Armadura: ${npc.descripcion_armadura}`, npc.descripcion]
              .filter(Boolean)
              .join(' — ')}
          </p>
        )}

        {/* Attribute dice row */}
        <div className="grid grid-cols-6 gap-1.5 my-2" data-testid="attr-row">
          {ATTR_KEYS.map((k) => (
            <AttrBlock key={k} k={k} value={npc.atributos?.[k]} />
          ))}
        </div>

        {/* Saves / skills / senses / langs / challenge */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-xs mt-2">
          {npc.tiradas_salvacion?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Tir. Salvación: </strong>
              {npc.tiradas_salvacion.join(', ')}
            </div>
          )}
          {npc.habilidades?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Habilidades: </strong>
              {npc.habilidades.join(', ')}
            </div>
          )}
          {npc.resistencias?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Resist. Daño: </strong>
              {npc.resistencias.join(', ')}
            </div>
          )}
          {npc.inmunidades_dano?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Inmun. Daño: </strong>
              {npc.inmunidades_dano.join(', ')}
            </div>
          )}
          {npc.inmunidades_estados?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Inmun. Estados: </strong>
              {npc.inmunidades_estados.join(', ')}
            </div>
          )}
          {npc.vulnerabilidades?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Vulnerab.: </strong>
              {npc.vulnerabilidades.join(', ')}
            </div>
          )}
          {npc.sentidos?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Sentidos: </strong>
              {npc.sentidos.join(', ')}
            </div>
          )}
          {npc.idiomas?.length > 0 && (
            <div>
              <strong className="text-rose-800 uppercase tracking-wider">Idiomas: </strong>
              {npc.idiomas.join(', ')}
            </div>
          )}
        </div>

        {/* === HABILIDADES ESPECIALES === */}
        {especiales.length > 0 && (
          <>
            <SectionHeader icon={Sparkles} label="Habilidades especiales" />
            <div className="space-y-2 text-xs">
              {especiales.map((e, i) => (
                <div key={i} data-testid={`especial-${i}`}>
                  <strong className="font-bold text-stone-900">{e.nombre || `Rasgo ${i + 1}`}.</strong>{' '}
                  <span className="text-stone-800">{e.descripcion || ''}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* === ATAQUES === */}
        {(armas.length > 0 || npc.ataque_multiple) && (
          <>
            <SectionHeader icon={Swords} label="Ataques" />
            <div className="space-y-2 text-xs">
              {npc.ataque_multiple && (
                <div className="italic text-stone-800">
                  <strong className="not-italic">Ataque múltiple.</strong> {npc.ataque_multiple}
                </div>
              )}
              {armas.map((a, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-700/20 pb-1 last:border-b-0"
                  data-testid={`attack-${i}`}
                >
                  <strong className="font-bold text-stone-900 min-w-[80px]">
                    {a.nombre || `Ataque ${i + 1}`}
                  </strong>
                  {a.bono_ataque != null && a.bono_ataque !== '' && (
                    <span className="text-stone-800">
                      {Number(a.bono_ataque) >= 0 ? '+' : ''}
                      {a.bono_ataque} al impacto
                    </span>
                  )}
                  {a.alcance && <span className="text-stone-700">· alc. {a.alcance}</span>}
                  {a.dano && (
                    <span className="text-stone-900 font-semibold">
                      · {a.dano}
                      {a.tipo_dano && <span className="font-normal text-stone-700"> {a.tipo_dano}</span>}
                    </span>
                  )}
                  <AttackTypeChip tipo={a.tipo_arma || a.tipo_dano} />
                  {a.special_text && (
                    <div className="basis-full text-stone-700 italic">{a.special_text}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* === REACCIONES === */}
        {reacciones.length > 0 && (
          <>
            <SectionHeader icon={Zap} label="Reacciones" />
            <div className="space-y-1 text-xs">
              {reacciones.map((r, i) => (
                <div key={i}>
                  <strong className="font-bold text-stone-900">
                    {r.nombre || `Reacción ${i + 1}`}.
                  </strong>{' '}
                  <span className="text-stone-800">{r.descripcion || ''}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NPCStatBlockPreview;
