/**
 * NPCStatBlockPreview — ficha estilo libro (Jaco, el trol de piedra) para
 * previsualizar un PNJ creado a medida en el wizard.
 *
 * Renderiza nombre, tipo, atributos con modificador, CA, PG, velocidad,
 * sentidos, idiomas, desafío, especiales (rasgos) y ataques formateados
 * con el patrón clásico "Ataque con arma cuerpo a cuerpo: +X al impacto…".
 */
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

const Hr = () => <div className="border-t border-rose-300/40 my-2" />;

const NPCStatBlockPreview = ({ name, npc }) => {
  if (!npc) return null;

  const fmtMod = (v) => {
    const m = attrModifier(v);
    return m === null ? '—' : m >= 0 ? `+${m}` : `${m}`;
  };

  const armas = npc.armas || [];
  const especiales = npc.especiales || [];
  const reacciones = npc.reacciones || [];

  return (
    <div
      className="rounded-lg bg-amber-50 text-stone-900 p-5 font-serif shadow-lg"
      data-testid="npc-statblock-preview"
    >
      <h3 className="text-center text-2xl italic font-bold text-rose-700 leading-tight">
        {name || npc.nombre || '(Sin nombre)'}
      </h3>
      {npc.tipo && (
        <p className="text-center italic text-stone-700">{npc.tipo}</p>
      )}

      <Hr />

      <div className="grid grid-cols-6 gap-1 text-center">
        {ATTR_KEYS.map((k) => (
          <div key={k}>
            <div className="text-rose-700 font-bold text-xs">{ATTR_LABELS[k]}</div>
            <div className="text-sm">
              {npc.atributos?.[k] ?? '—'}{' '}
              <span className="text-stone-700">({fmtMod(npc.atributos?.[k])})</span>
            </div>
          </div>
        ))}
      </div>

      <Hr />

      <div className="text-sm space-y-0.5">
        {npc.clase_armadura !== undefined && npc.clase_armadura !== null && (
          <div>
            <strong className="text-rose-700">CLASE DE ARMADURA</strong>{' '}
            {npc.clase_armadura}
            {npc.descripcion_armadura && (
              <span className="text-stone-700"> ({npc.descripcion_armadura})</span>
            )}
          </div>
        )}
        {npc.puntos_golpe !== undefined && npc.puntos_golpe !== null && (
          <div>
            <strong className="text-rose-700">PUNTOS DE GOLPE</strong>{' '}
            {npc.puntos_golpe}
            {npc.dados_golpe && <span className="text-stone-700"> ({npc.dados_golpe})</span>}
          </div>
        )}
        {npc.velocidad !== undefined && npc.velocidad !== null && (
          <div>
            <strong className="text-rose-700">VELOCIDAD</strong> {npc.velocidad} m
          </div>
        )}
      </div>

      {(npc.resistencias?.length ||
        npc.inmunidades_dano?.length ||
        npc.inmunidades_estados?.length ||
        npc.vulnerabilidades?.length ||
        npc.sentidos?.length ||
        npc.idiomas?.length ||
        npc.desafio) && <Hr />}

      <div className="text-sm space-y-0.5">
        {npc.resistencias?.length > 0 && (
          <div>
            <strong className="text-rose-700">RESISTENCIA AL DAÑO</strong>{' '}
            {npc.resistencias.join(', ')}
          </div>
        )}
        {npc.inmunidades_dano?.length > 0 && (
          <div>
            <strong className="text-rose-700">INMUNIDADES AL DAÑO</strong>{' '}
            {npc.inmunidades_dano.join(', ')}
          </div>
        )}
        {npc.inmunidades_estados?.length > 0 && (
          <div>
            <strong className="text-rose-700">INMUNIDAD A ESTADOS</strong>{' '}
            {npc.inmunidades_estados.join(', ')}
          </div>
        )}
        {npc.vulnerabilidades?.length > 0 && (
          <div>
            <strong className="text-rose-700">VULNERABILIDADES</strong>{' '}
            {npc.vulnerabilidades.join(', ')}
          </div>
        )}
        {npc.sentidos?.length > 0 && (
          <div>
            <strong className="text-rose-700">SENTIDOS</strong> {npc.sentidos.join(', ')}
          </div>
        )}
        {npc.idiomas?.length > 0 && (
          <div>
            <strong className="text-rose-700">IDIOMAS</strong> {npc.idiomas.join(', ')}
          </div>
        )}
        {npc.desafio && (
          <div>
            <strong className="text-rose-700">DESAFÍO</strong> {npc.desafio}
          </div>
        )}
      </div>

      {especiales.length > 0 && (
        <>
          <Hr />
          <div className="text-sm space-y-1">
            {especiales.map((e, i) => (
              <div key={i}>
                <strong className="uppercase text-stone-900">{e.nombre || `Rasgo ${i + 1}`}.</strong>{' '}
                <span className="text-stone-800">{e.descripcion || ''}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(armas.length > 0 || npc.ataque_multiple) && (
        <>
          <div className="border-t-2 border-rose-700 my-2" />
          <div className="text-center text-rose-700 font-bold tracking-wider">ACCIONES</div>
          <Hr />
          <div className="text-sm space-y-2">
            {npc.ataque_multiple && (
              <div>
                <strong className="uppercase">Ataque múltiple.</strong>{' '}
                <span className="italic text-stone-800">{npc.ataque_multiple}</span>
              </div>
            )}
            {armas.map((a, i) => (
              <div key={i}>
                <strong className="uppercase">{a.nombre || `Ataque ${i + 1}`}.</strong>{' '}
                <em className="text-stone-700">
                  {a.tipo_arma === 'a_distancia'
                    ? 'Ataque con arma a distancia:'
                    : 'Ataque con arma cuerpo a cuerpo:'}
                </em>{' '}
                {a.alcance && <span>alcance {a.alcance}, </span>}
                un objetivo. <em className="text-stone-700">Impacto:</em>{' '}
                {a.dano || '—'}
                {a.special_text && (
                  <span className="text-stone-800"> {a.special_text}</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {reacciones.length > 0 && (
        <>
          <div className="border-t-2 border-rose-700 my-2" />
          <div className="text-center text-rose-700 font-bold tracking-wider">REACCIONES</div>
          <Hr />
          <div className="text-sm space-y-1">
            {reacciones.map((r, i) => (
              <div key={i}>
                <strong className="uppercase">{r.nombre || `Reacción ${i + 1}`}.</strong>{' '}
                <span className="text-stone-800">{r.descripcion || ''}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default NPCStatBlockPreview;
