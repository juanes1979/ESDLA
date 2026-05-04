/**
 * DistributionView — vista visual del gestor de equipamiento (it79).
 *
 * Implementa el diseño confirmado:
 *   • Layout A: cards de portadores (Equipado · Carga Personal · monturas · baúles)
 *     con anillo de carga grueso y % central.
 *   • Layout B: tabla con scroll independiente por filas; comparte estado con A.
 *   • Banner superior: ubicación actual + montura activa.
 *   • Validación de capacidad: rechaza el movimiento si la montura quedaría
 *     sobrecargada (toast "Esta montura no puede cargar más peso.").
 *   • Baúles: bloqueados visualmente cuando el personaje no está en su ubicación.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Lock, MapPin, ChevronDown } from 'lucide-react';
import iconPersonaje from '@/assets/equipment/icon-personaje.png';
import iconMochila from '@/assets/equipment/icon-mochila.png';
import iconCaballo from '@/assets/equipment/icon-caballo.png';
import iconBaul from '@/assets/equipment/icon-baul.png';

// ============== ANILLO DE CARGA ==============

const RING_RADIUS = 47;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const getRingColor = (pct) => {
  if (pct >= 95) return 'red';
  if (pct >= 70) return 'amber';
  return 'green';
};

const LoadRing = ({ pct = 0, size = 110, hidden = false }) => {
  if (hidden) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = RING_CIRC - (RING_CIRC * clamped) / 100;
  const color = getRingColor(clamped);
  return (
    <svg
      className={`dv-ring dv-ring-${color}`}
      width={size}
      height={size}
      viewBox="0 0 110 110"
      style={{ position: 'absolute', inset: 0 }}
      data-testid="load-ring"
    >
      <circle className="dv-ring-track" cx="55" cy="55" r={RING_RADIUS} />
      <circle
        className={`dv-ring-progress dv-ring-${color}`}
        cx="55"
        cy="55"
        r={RING_RADIUS}
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
      />
    </svg>
  );
};

// ============== HELPERS PARA CONSTRUIR PORTADORES + ITEMS ==============

/**
 * Construye la lista de portadores a partir del personaje + weightSummary + chests.
 * Cada portador tiene: { id, kind, label, sublabel, icon, capacity, current,
 *                       pct, locked, badge, tone }
 */
const buildPortadores = (character, weightSummary, chestsApi) => {
  const list = [];
  const ws = weightSummary || {};

  // 1) Equipado — sin anillo (no compite por capacidad propia, pero se suma a la carga personal)
  list.push({
    id: 'equipado',
    kind: 'equipado',
    label: 'Equipado',
    sublabel: 'Lo que llevo puesto / blandido',
    icon: iconPersonaje,
    showRing: false,
    current: 0,  // se calcula en pintura: suma de items.activa
    capacity: null,
    badge: null,
  });

  // 2) Carga Personal — anillo basado en limite_muy_cargado
  const personajeKg = Number(ws.peso_personaje || 0);
  const cargado = Number(ws.limite_cargado || 0);
  const muyCargado = Number(ws.limite_muy_cargado || 0);
  const capacidadPersonaje = Number(ws.capacidad_personaje || 0);
  list.push({
    id: 'personaje',
    kind: 'personaje',
    label: 'Carga Personal',
    sublabel: 'Equipado + transportado',
    icon: iconMochila,
    showRing: true,
    current: personajeKg,
    capacity: capacidadPersonaje || muyCargado || 0,
    pct: capacidadPersonaje ? (personajeKg / capacidadPersonaje) * 100 : 0,
    paraCargado: cargado,
    paraMuyCargado: muyCargado,
    estado: ws.estado_carga || 'normal',
    badge: null,
  });

  // 3) Monturas — anillo por capacidad
  const monturas = character?.monturas || [];
  const detalles = ws?.monturas_detalle || [];
  monturas.forEach((m) => {
    const det = detalles.find((d) => d.id === m.id) || {};
    const cap = Number(det.capacidad || m.capacidad_carga || 0);
    const cur = Number(det.peso_cargado || 0);
    list.push({
      id: `mount:${m.id}`,
      kind: 'mount',
      mountId: m.id,
      label: m.nombre_personalizado || m.nombre_original,
      sublabel: m.nombre_original && m.nombre_original !== (m.nombre_personalizado || m.nombre_original)
        ? m.nombre_original
        : 'Montura',
      icon: iconCaballo,
      showRing: true,
      current: cur,
      capacity: cap,
      pct: cap ? (cur / cap) * 100 : 0,
      sobrecargada: !!det.sobrecargada,
      llevaJinete: !!det.lleva_jinete,
      badge: det.lleva_jinete ? 'Montado' : (m.es_jinete_activo ? 'Activa' : null),
    });
  });

  // 4) Baúles
  const chestsList = (chestsApi?.chests || character?.chests || []).map((c) => ({
    ...c,
    accesible: c.accesible !== undefined
      ? c.accesible
      : (chestsApi?.ubicacion_actual?.id || character?.ubicacion_actual?.id) === c.location_id,
  }));
  chestsList.forEach((c) => {
    list.push({
      id: `chest:${c.location_id}`,
      kind: 'chest',
      locationId: c.location_id,
      label: `Baúl · ${c.location_nombre || 'lugar'}`,
      sublabel: c.location_region || 'almacén',
      icon: iconBaul,
      showRing: false,
      capacity: null,
      current: null,
      locked: !c.accesible,
      badge: c.accesible ? 'Accesible' : 'Bloqueado',
      tone: c.accesible ? 'haven' : 'locked',
    });
  });

  return list;
};

/**
 * Construye una lista plana de ítems con metadatos para mover.
 * Cada ítem: { uid, nombre, peso, cantidad, source, itemIndex, mountId, locationId,
 *              portadorId, activa, posicion, raw }
 */
const buildItems = (character, chestsApi) => {
  const items = [];
  let uid = 0;

  const pushItem = ({ raw, source, itemIndex, mountId, locationId, kind }) => {
    if (!raw) return;
    const isObj = typeof raw === 'object';
    const nombre = isObj ? (raw.nombre || raw.name || '?') : String(raw);
    const peso = isObj ? Number(raw.peso_kg || 0) : 0;
    const cantidad = isObj ? (raw.cantidad ?? 1) : 1;
    const activa = isObj ? !!raw.activa : false;
    const posicion = isObj ? (raw.posicion || null) : null;
    const portadoPor = isObj ? raw.portado_por : null;

    // Determina portadorId
    let portadorId;
    if (kind === 'chest') portadorId = `chest:${locationId}`;
    else if (kind === 'mount') portadorId = `mount:${mountId}`;
    else if (portadoPor === 'montura' && (raw.mount_id || mountId)) {
      portadorId = `mount:${raw.mount_id || mountId}`;
    } else if (activa) {
      portadorId = 'equipado';
    } else {
      portadorId = 'personaje';
    }

    items.push({
      uid: ++uid,
      nombre,
      peso,
      cantidad,
      activa,
      posicion,
      source,
      itemIndex,
      mountId: mountId || raw.mount_id || null,
      locationId: locationId || null,
      portadorId,
      raw,
      kind,
    });
  };

  // Inventario
  (character?.inventario || []).forEach((it, i) =>
    pushItem({ raw: it, source: 'inventario', itemIndex: i, kind: 'carry' })
  );
  // Equipo (escudos, herramientas)
  (character?.equipo || []).forEach((it, i) =>
    pushItem({ raw: it, source: 'equipo', itemIndex: i, kind: 'carry' })
  );
  // Equipo de ocupación
  (character?.equipo_ocupacion || []).forEach((it, i) =>
    pushItem({ raw: it, source: 'equipo_ocupacion', itemIndex: i, kind: 'carry' })
  );
  // Armas
  (character?.armas || []).forEach((it, i) =>
    pushItem({ raw: it, source: 'armas', itemIndex: i, kind: 'carry' })
  );
  // Armadura principal
  if (character?.armadura?.nombre) {
    pushItem({
      raw: { ...character.armadura, activa: character.armadura.activa !== false },
      source: 'armadura',
      itemIndex: 0,
      kind: 'carry',
    });
  }
  // Piezas de armadura
  (character?.armadura_piezas || []).forEach((it, i) =>
    pushItem({ raw: it, source: 'armadura_piezas', itemIndex: i, kind: 'carry' })
  );
  // Equipo de cada montura
  (character?.monturas || []).forEach((m) => {
    (m.equipo || []).forEach((it, i) =>
      pushItem({ raw: it, source: 'mount', itemIndex: i, mountId: m.id, kind: 'mount' })
    );
  });
  // Baúles
  (chestsApi?.chests || character?.chests || []).forEach((c) => {
    (c.items || []).forEach((it, i) =>
      pushItem({
        raw: it,
        source: 'chest',
        itemIndex: i,
        locationId: c.location_id,
        kind: 'chest',
      })
    );
  });

  return items;
};

// ============== LAYOUT A · COLUMN CARD ==============

const ColumnCard = ({ portador, items, onItemClick }) => {
  const colItems = items.filter((it) => it.portadorId === portador.id);
  const ringColor = portador.showRing ? getRingColor(portador.pct || 0) : null;

  return (
    <div className={`dv-col ${portador.locked ? 'dv-col-locked' : ''}`} data-testid={`column-${portador.id}`}>
      <div className="dv-col-header">
        {portador.badge && (
          <span className={`dv-badge dv-badge-${portador.tone || 'gold'}`}>
            {portador.tone === 'locked' && <Lock size={10} className="dv-badge-icon" />}
            {portador.badge}
          </span>
        )}
        <div className="dv-icon-wrap">
          {portador.showRing && (
            <LoadRing pct={portador.pct} size={110} />
          )}
          <div className={`dv-icon-disc ${portador.locked ? 'dv-icon-locked' : ''}`}>
            <img src={portador.icon} alt={portador.label} draggable="false" />
          </div>
          {portador.showRing && (
            <div className={`dv-load-pct dv-load-pct-${ringColor}`}>
              {Math.round(portador.pct)}%
            </div>
          )}
        </div>
        <div className="dv-col-title">{portador.label}</div>
        <div className="dv-col-meta">{portador.sublabel}</div>
        {portador.kind === 'personaje' && (
          <div className={`dv-col-load dv-load-${getRingColor(portador.pct || 0)}`}>
            {portador.current.toFixed(1)} / {portador.capacity || '∞'} kg
          </div>
        )}
        {portador.kind === 'mount' && (
          <div className={`dv-col-load dv-load-${ringColor}`}>
            {portador.current.toFixed(1)} / {portador.capacity || '∞'} kg
          </div>
        )}
        {portador.kind === 'equipado' && (
          <div className="dv-col-load dv-load-green">
            {colItems.reduce((s, it) => s + (it.peso || 0) * (it.cantidad || 1), 0).toFixed(1)} kg
          </div>
        )}
      </div>

      {portador.kind === 'personaje' && portador.capacity > 0 && (
        <div className="dv-stats">
          <div className="dv-stats-row">
            <span className="dv-stats-k">Para "cargado"</span>
            <span className="dv-stats-v">{portador.paraCargado?.toFixed?.(1) || 0} kg</span>
          </div>
          <div className="dv-stats-row">
            <span className="dv-stats-k">Para "muy cargado"</span>
            <span className="dv-stats-v">{portador.paraMuyCargado?.toFixed?.(1) || 0} kg</span>
          </div>
          <div className="dv-stats-bar">
            <div
              className="dv-stats-bar-fill"
              style={{ width: `${Math.min(100, portador.pct)}%` }}
            />
            {portador.capacity > 0 && (
              <>
                <div
                  className="dv-stats-bar-marker"
                  style={{
                    left: `${Math.min(100, (portador.paraCargado / portador.capacity) * 100)}%`,
                  }}
                />
                <div
                  className="dv-stats-bar-marker"
                  style={{
                    left: `${Math.min(100, (portador.paraMuyCargado / portador.capacity) * 100)}%`,
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {portador.locked && (
        <p className="dv-lock-msg">
          <MapPin size={12} /> Para acceder, regresa a {portador.label.replace('Baúl · ', '')}
        </p>
      )}

      <ul className="dv-item-list">
        {colItems.length === 0 && !portador.locked && (
          <li className="dv-empty">Sin objetos en este portador</li>
        )}
        {colItems.map((it) => (
          <li
            key={it.uid}
            className={`dv-item ${it.activa ? 'dv-item-active' : ''} ${portador.locked ? 'dv-item-inaccessible' : ''}`}
            onClick={() => !portador.locked && onItemClick?.(it)}
            data-testid={`item-${it.uid}`}
          >
            <div>
              <div className="dv-item-name">{it.nombre}</div>
              <div className="dv-item-meta">
                {it.activa && it.posicion ? `${it.posicion} · activa` : null}
                {it.cantidad > 1 ? `×${it.cantidad}` : ''}
                {it.peso > 0 ? ` · ${(it.peso * (it.cantidad || 1)).toFixed(2)} kg` : ''}
              </div>
            </div>
            <div className="dv-checkmark">
              {portador.locked ? <Lock size={10} /> : '✓'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ============== LAYOUT B · TABLE (scroll vertical interno) ==============

const EquipmentTable = ({ items, portadores, onMove, processing, selectedItem }) => {
  return (
    <div className="dv-table" data-testid="equipment-table">
      <div
        className="dv-table-grid"
        style={{ gridTemplateColumns: `2.4fr repeat(${portadores.length}, 1fr)` }}
      >
        <div className="dv-th dv-th-first">Objeto · peso</div>
        {portadores.map((p) => {
          const ringColor = p.showRing ? getRingColor(p.pct || 0) : null;
          return (
            <div key={p.id} className="dv-th">
              <div className="dv-th-icon"><img src={p.icon} alt="" /></div>
              <span className="dv-th-label">{p.label}</span>
              {p.showRing && (
                <span className={`dv-th-pct dv-th-pct-${ringColor}`}>
                  {Math.round(p.pct || 0)}%
                </span>
              )}
              {p.kind === 'chest' && (
                <span className={`dv-th-pct ${p.locked ? 'dv-th-pct-locked' : 'dv-th-pct-green'}`}>
                  {p.locked ? '🔒' : 'aquí'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="dv-table-body">
        <div
          className="dv-table-grid"
          style={{ gridTemplateColumns: `2.4fr repeat(${portadores.length}, 1fr)` }}
        >
          {items.map((it) => (
            <React.Fragment key={it.uid}>
              <div
                className={`dv-tr-first ${selectedItem === it.uid ? 'dv-tr-selected' : ''}`}
              >
                <div className="dv-tr-name">
                  {it.nombre}
                  <small>
                    {it.cantidad > 1 ? `×${it.cantidad} · ` : ''}
                    {(it.peso * (it.cantidad || 1)).toFixed(2)} kg
                    {it.kind === 'chest' ? ` · guardado en ${it.locationId}` : ''}
                  </small>
                </div>
              </div>
              {portadores.map((p) => {
                const isCurrent = it.portadorId === p.id;
                const disabled =
                  processing ||
                  (p.locked) ||
                  // No mover armas/armadura entre portadores extraños
                  (it.source === 'armadura' && p.kind === 'chest' && false);
                return (
                  <div key={p.id} className="dv-tr">
                    <button
                      type="button"
                      disabled={disabled || isCurrent}
                      className={`dv-radio ${isCurrent ? 'dv-radio-active' : ''} ${p.locked ? 'dv-radio-locked' : ''} ${disabled && !isCurrent ? 'dv-radio-disabled' : ''}`}
                      onClick={() => onMove(it, p)}
                      data-testid={`radio-${it.uid}-${p.id}`}
                      title={p.locked ? 'Bloqueado por ubicación' : (isCurrent ? 'Aquí' : `Mover a ${p.label}`)}
                    >
                      {p.locked ? <Lock size={11} /> : null}
                    </button>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============== MAIN COMPONENT ==============

const DistributionView = ({
  character,
  weightSummary,
  chestsApi,
  onMoveItem,        // (item, targetPortador) => Promise
  processing,
}) => {
  const [selectedItem, setSelectedItem] = useState(null);

  const portadores = useMemo(
    () => buildPortadores(character, weightSummary, chestsApi),
    [character, weightSummary, chestsApi]
  );
  const items = useMemo(
    () => buildItems(character, chestsApi),
    [character, chestsApi]
  );

  const ubic = chestsApi?.ubicacion_actual || character?.ubicacion_actual || null;
  const monturaActiva = (character?.monturas || []).find((m) => m.es_jinete_activo);
  const montado = !!character?.montado && monturaActiva;

  const handleMove = async (item, portador) => {
    setSelectedItem(item.uid);
    // Validación de capacidad antes de pedir al backend (UX inmediata).
    if (portador.kind === 'mount' && portador.capacity > 0) {
      const itemKg = (item.peso || 0) * (item.cantidad || 1);
      // Si NO viene de esa misma montura, calcula carga proyectada
      const sameMount = item.portadorId === portador.id;
      if (!sameMount) {
        const projected = (portador.current || 0) + itemKg;
        if (projected > portador.capacity) {
          toast.error('Esta montura no puede cargar más peso.');
          setSelectedItem(null);
          return;
        }
      }
    }
    if (portador.locked) {
      toast.error('Este baúl no es accesible desde tu ubicación actual.');
      setSelectedItem(null);
      return;
    }
    try {
      await onMoveItem(item, portador);
    } finally {
      setSelectedItem(null);
    }
  };

  return (
    <div className="dv-root" data-testid="distribution-view">
      <DistributionStyles />

      {/* Top bar */}
      <div className="dv-top-bar">
        <div className="dv-pill">
          <MapPin size={14} className="dv-pill-icon" />
          <span className="dv-pill-label">Ubicación</span>
          <span className="dv-pill-value">
            {ubic?.nombre || 'sin ubicar'}
            {ubic?.region ? <span className="dv-pill-sub"> · {ubic.region}</span> : null}
          </span>
          {ubic?.tipo === 'pueblo' || ubic?.tipo === 'refugio_elfico' || ubic?.tipo === 'refugio' ? (
            <span className="dv-haven-badge">Refugio seguro</span>
          ) : null}
        </div>
        {montado && (
          <div className="dv-pill dv-pill-mount">
            <span className="dv-pill-emoji">🐎</span>
            <span className="dv-pill-label">Cabalga sobre</span>
            <span className="dv-pill-value">
              {monturaActiva.nombre_personalizado || monturaActiva.nombre_original}
            </span>
          </div>
        )}
      </div>

      {/* Layout A — cards */}
      <div className="dv-layout-label">A · Resumen visual</div>
      <div
        className="dv-columns"
        style={{ gridTemplateColumns: `repeat(${portadores.length}, minmax(0, 1fr))` }}
      >
        {portadores.map((p) => (
          <ColumnCard
            key={p.id}
            portador={p}
            items={items}
            onItemClick={(it) => setSelectedItem(it.uid)}
          />
        ))}
      </div>

      {/* Layout B — tabla con scroll independiente */}
      <div className="dv-layout-label">B · Tabla de portadores</div>
      <p className="dv-layout-sub">
        <ChevronDown size={12} /> Scroll vertical interno.
        Marca un radio para mover el ítem; los baúles fuera de tu ubicación están bloqueados (<Lock size={10} />).
      </p>
      <EquipmentTable
        items={items}
        portadores={portadores}
        onMove={handleMove}
        processing={processing}
        selectedItem={selectedItem}
      />
    </div>
  );
};

// ============== STYLES (scoped via class prefix dv-) ==============

const DistributionStyles = () => (
  <style>{`
    .dv-root {
      --parchment: #f4e9cf;
      --parchment-soft: rgba(255, 250, 230, 0.55);
      --ink: #2b1d12;
      --ink-soft: #5a4332;
      --gold: #c9a44c;
      --gold-deep: #8a6d2c;
      --gold-soft: #b08a3a;
      --green: #3a6b3a;
      --green-bright: #5fa44b;
      --green-soft: #5e8a4f;
      --amber: #d68a14;
      --amber-bright: #f3a72d;
      --red: #b22d2d;
      --red-bright: #e04141;
      --locked: #6b5a40;
      font-family: 'Cinzel', 'Trajan Pro', 'Georgia', serif;
      color: var(--ink);
      padding: 8px 4px 24px;
    }
    .dv-top-bar { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .dv-pill {
      background: linear-gradient(90deg, rgba(201,164,76,0.18), transparent 70%);
      border-left: 3px solid var(--gold);
      padding: 9px 14px;
      border-radius: 4px;
      font-size: 13px;
      display: flex; align-items: center; gap: 10px;
    }
    .dv-pill-mount { background: linear-gradient(90deg, rgba(58,107,58,0.18), transparent 70%); border-left-color: var(--green); }
    .dv-pill-icon { color: var(--gold-deep); }
    .dv-pill-emoji { font-size: 16px; }
    .dv-pill-label { font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-size: 10px; color: var(--ink); }
    .dv-pill-value { color: var(--ink); font-weight: 600; }
    .dv-pill-sub { font-style: italic; color: var(--ink-soft); font-weight: 400; }
    .dv-haven-badge { margin-left: auto; background: var(--green); color: var(--parchment);
      font-size: 9px; padding: 3px 8px; border-radius: 8px; text-transform: uppercase;
      letter-spacing: 1px; font-weight: 700; }

    .dv-layout-label {
      text-align: center; margin: 22px 0 12px;
      color: var(--ink); font-size: 12px; text-transform: uppercase;
      letter-spacing: 4px; font-weight: 700;
    }
    .dv-layout-label::before, .dv-layout-label::after {
      content:''; display: inline-block; width: 50px; height: 1px;
      background: var(--gold-soft); vertical-align: middle; margin: 0 12px;
    }
    .dv-layout-sub {
      text-align: center; color: var(--ink-soft); font-style: italic;
      font-size: 11px; margin: -4px 0 12px;
      display: flex; align-items: center; gap: 4px; justify-content: center;
    }

    /* Columns */
    .dv-columns { display: grid; gap: 12px; margin-bottom: 14px; }
    .dv-col {
      background: var(--parchment-soft);
      border: 1px solid var(--gold-soft);
      border-radius: 8px;
      padding: 12px; display: flex; flex-direction: column;
      min-height: 280px;
    }
    .dv-col-locked {
      background: repeating-linear-gradient(45deg,
        rgba(107,90,64,0.05) 0 8px,
        rgba(107,90,64,0.10) 8px 16px);
      opacity: 0.85;
    }
    .dv-col-header {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; margin-bottom: 10px; position: relative;
    }
    .dv-icon-wrap { position: relative; width: 110px; height: 110px; display: grid; place-items: center; }
    .dv-icon-disc {
      width: 88px; height: 88px; border-radius: 50%;
      overflow: hidden; background: var(--parchment);
      box-shadow: 0 4px 10px rgba(43,29,18,0.3);
      z-index: 1;
    }
    .dv-icon-disc img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .dv-icon-locked img { filter: grayscale(0.6) opacity(0.85); }

    /* Anillo de carga grueso con glow */
    .dv-ring { transform: rotate(-90deg); pointer-events: none; z-index: 2; }
    .dv-ring-track { stroke: rgba(43,29,18,0.18); fill: none; stroke-width: 9; }
    .dv-ring-progress { fill: none; stroke-width: 9; stroke-linecap: round;
      transition: stroke-dashoffset .35s ease, stroke .25s ease;
    }
    .dv-ring-progress.dv-ring-green  { stroke: var(--green-bright); filter: drop-shadow(0 0 4px var(--green-bright)); }
    .dv-ring-progress.dv-ring-amber  { stroke: var(--amber-bright); filter: drop-shadow(0 0 4px var(--amber-bright)); }
    .dv-ring-progress.dv-ring-red    { stroke: var(--red-bright);   filter: drop-shadow(0 0 9px var(--red-bright));
      animation: dvPulseRed 1.4s ease-in-out infinite; }
    @keyframes dvPulseRed { 50% { filter: drop-shadow(0 0 12px var(--red-bright)); } }

    .dv-load-pct {
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--ink); color: var(--parchment); font-size: 11px;
      font-weight: 700; padding: 2px 6px; border-radius: 8px;
      border: 1px solid var(--gold); z-index: 3; letter-spacing: 0.5px;
    }
    .dv-load-pct-green { background: var(--green); }
    .dv-load-pct-amber { background: var(--amber); }
    .dv-load-pct-red   { background: var(--red); }

    .dv-col-title { margin-top: 8px; font-size: 13px; letter-spacing: 1.5px;
      text-transform: uppercase; color: var(--ink); font-weight: 700; }
    .dv-col-meta { font-size: 10px; color: var(--ink-soft); font-style: italic; margin-top: 1px; }
    .dv-col-load { margin-top: 4px; font-size: 12px; font-weight: 700; }
    .dv-load-green { color: var(--green-soft); }
    .dv-load-amber { color: var(--amber); }
    .dv-load-red   { color: var(--red); }

    .dv-badge {
      position: absolute; top: -6px; right: -2px;
      background: var(--gold); color: var(--ink);
      font-size: 9px; letter-spacing: 1px; padding: 2px 8px;
      border-radius: 10px; text-transform: uppercase;
      box-shadow: 0 2px 4px rgba(0,0,0,.2); font-weight: 700;
      z-index: 5; display: inline-flex; align-items: center; gap: 3px;
    }
    .dv-badge-haven { background: var(--green); color: var(--parchment); }
    .dv-badge-locked { background: var(--locked); color: var(--parchment); }
    .dv-badge-icon { display: inline-block; }

    /* Stats panel for Carga Personal */
    .dv-stats {
      background: rgba(244,233,207,0.7);
      border: 1px solid rgba(176,138,58,0.4);
      border-radius: 5px;
      padding: 7px 9px; margin: 6px 0;
      font-size: 10px; color: var(--ink);
      display: flex; flex-direction: column; gap: 3px;
    }
    .dv-stats-row { display: flex; justify-content: space-between; }
    .dv-stats-k { color: var(--ink-soft); font-style: italic; }
    .dv-stats-v { font-weight: 700; }
    .dv-stats-bar { height: 7px; background: rgba(43,29,18,0.12);
      border-radius: 4px; margin-top: 3px; overflow: visible; position: relative; }
    .dv-stats-bar-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, var(--green-bright), var(--amber-bright) 70%, var(--red-bright));
      transition: width .3s;
    }
    .dv-stats-bar-marker {
      position: absolute; top: -2px; bottom: -2px; width: 1px; background: var(--ink);
    }

    .dv-lock-msg {
      text-align: center; font-size: 11px;
      color: var(--locked); font-style: italic;
      padding: 9px 6px;
      background: rgba(107,90,64,0.1);
      border-radius: 4px; margin: 0 0 8px;
      display: flex; align-items: center; justify-content: center; gap: 4px;
    }

    /* Items */
    .dv-item-list { list-style: none; padding: 0; margin: 4px 0 0; flex: 1;
      display: flex; flex-direction: column; gap: 4px; }
    .dv-item {
      display: grid; grid-template-columns: 1fr auto;
      align-items: center; gap: 8px; padding: 6px 9px;
      border-radius: 4px;
      background: rgba(244,233,207,0.65);
      border: 1px solid rgba(176,138,58,0.35);
      font-size: 11px; cursor: pointer;
      transition: all .12s ease;
    }
    .dv-item:hover { background: rgba(244,233,207,0.95); border-color: var(--gold-soft); }
    .dv-item-active {
      background: linear-gradient(90deg, rgba(95,164,75,0.2), rgba(95,164,75,0.05));
      border-color: var(--green-soft);
    }
    .dv-item-active .dv-checkmark { background: var(--green); border-color: var(--green-soft); color: #fff; }
    .dv-item-inaccessible { opacity: 0.55; cursor: not-allowed;
      background: rgba(107,90,64,0.08); }
    .dv-item-name { color: var(--ink); font-weight: 600; line-height: 1.2; }
    .dv-item-meta { font-size: 9px; color: var(--ink-soft); font-style: italic; }
    .dv-checkmark {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid var(--gold-soft);
      display: grid; place-items: center;
      background: var(--parchment); font-size: 11px; font-weight: 700; color: var(--green);
      flex-shrink: 0;
    }
    .dv-empty { text-align: center; font-size: 10px; color: var(--ink-soft);
      font-style: italic; padding: 14px 4px;
      border: 1px dashed rgba(176,138,58,0.45); border-radius: 4px; }

    /* TABLE — scroll independiente en cuerpo, header sticky */
    .dv-table {
      background: var(--parchment-soft);
      border: 1px solid var(--gold-soft);
      border-radius: 8px;
      overflow: hidden;
    }
    .dv-table-grid { display: grid; }
    .dv-th {
      padding: 9px 8px;
      background: linear-gradient(180deg, rgba(201,164,76,0.22), rgba(201,164,76,0.06));
      font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
      color: var(--ink); font-weight: 700;
      border-bottom: 1px solid var(--gold-soft);
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 3px;
    }
    .dv-th-first { text-align: left; align-items: flex-start; padding-left: 14px; }
    .dv-th-icon { width: 26px; height: 26px; border-radius: 50%; overflow: hidden; }
    .dv-th-icon img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .dv-th-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .dv-th-pct { font-size: 9px; padding: 1px 5px; border-radius: 6px; color: #fff; font-weight: 700; }
    .dv-th-pct-green  { background: var(--green); }
    .dv-th-pct-amber  { background: var(--amber); }
    .dv-th-pct-red    { background: var(--red); }
    .dv-th-pct-locked { background: var(--locked); }

    .dv-table-body {
      max-height: 280px;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .dv-table-body::-webkit-scrollbar { width: 8px; }
    .dv-table-body::-webkit-scrollbar-thumb { background: var(--gold-soft); border-radius: 4px; }
    .dv-table-body::-webkit-scrollbar-track { background: rgba(43,29,18,0.06); }

    .dv-tr-first {
      padding: 7px 14px; border-bottom: 1px solid rgba(176,138,58,0.2);
    }
    .dv-tr-selected { background: rgba(201,164,76,0.18); }
    .dv-tr-name { color: var(--ink); font-weight: 600; font-size: 12px; }
    .dv-tr-name small { display: block; font-weight: 400; color: var(--ink-soft);
      font-size: 10px; font-style: italic; }
    .dv-tr {
      padding: 7px 4px; border-bottom: 1px solid rgba(176,138,58,0.2);
      display: flex; align-items: center; justify-content: center;
    }
    .dv-radio {
      width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid rgba(176,138,58,0.55);
      background: var(--parchment); cursor: pointer;
      display: grid; place-items: center;
      transition: all .15s; padding: 0;
    }
    .dv-radio:hover:not(:disabled) {
      border-color: var(--gold);
      background: rgba(201,164,76,0.1);
    }
    .dv-radio-active {
      background: var(--green-bright);
      border-color: var(--green);
      box-shadow: 0 0 8px rgba(95,164,75,0.6);
    }
    .dv-radio-active::after {
      content: ''; width: 8px; height: 8px;
      border-radius: 50%; background: var(--parchment);
    }
    .dv-radio-disabled {
      background: rgba(176,138,58,0.1);
      border-color: rgba(176,138,58,0.3);
      cursor: not-allowed;
    }
    .dv-radio-locked {
      background: rgba(107,90,64,0.15);
      border-color: rgba(107,90,64,0.45);
      cursor: not-allowed;
      color: var(--locked);
    }

    /* Responsivo: en pantallas estrechas baja a 2 columnas */
    @media (max-width: 1100px) {
      .dv-columns { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
    }
    @media (max-width: 760px) {
      .dv-top-bar { grid-template-columns: 1fr; }
      .dv-columns { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    }
  `}</style>
);

export default DistributionView;
