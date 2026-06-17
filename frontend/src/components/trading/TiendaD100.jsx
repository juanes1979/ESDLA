/**
 * Tienda D100 — Nuevo flujo de comercio (Fases 2 a 5)
 *
 *  Fase 2: jugador → ubicación actual → PNJ presentes (gate) → comprar/vender → contexto.
 *  Fase 3: motor D100 (precio de referencia, desviación %, barra de enfado, tirada de aceptación,
 *          bucle de contraoferta).
 *  Fase 4: tirada de habilidad ENFRENTADA (Engaño vs Perspicacia…) con narrativa IA.
 *  Fase 5: cierre → persiste la relación + aplica oro/inventario reales.
 */
import { useState, useMemo, useEffect } from 'react';
import {
  Loader2, Store, User, MapPin, ShoppingCart, Dices, Handshake,
  Check, X, AlertTriangle, Sparkles, Search, Flame, RefreshCw, Coins, Backpack,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const fmt = (n) => (n === null || n === undefined ? '—' : `${Number(n).toFixed(2)} mp`);

const RESULT_STYLE = {
  acepta: { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-400', Icon: Check, label: 'Acepta' },
  contraoferta: { bg: 'bg-yellow-900/30', border: 'border-yellow-600', text: 'text-yellow-400', Icon: RefreshCw, label: 'Contraoferta' },
  enfado: { bg: 'bg-red-950/50', border: 'border-red-800', text: 'text-red-500', Icon: AlertTriangle, label: '¡Enfado!' },
};

const HABILIDADES = ['Engaño', 'Persuasión', 'Intimidación'];

const AngerBar = ({ value }) => {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct < 40 ? 'bg-green-500' : pct < 75 ? 'bg-yellow-500' : 'bg-red-600';
  return (
    <div className="w-full" data-testid="d100-anger-bar">
      <div className="flex justify-between text-xs mb-1">
        <span className="flex items-center gap-1 text-[hsl(var(--torch-orange))]"><Flame className="w-3 h-3" /> Barra de enfado</span>
        <span className="font-mono">{pct.toFixed(0)} / 100</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-black/40 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const TiendaD100 = ({ characters = [], equipment = {}, config }) => {
  // ── Fase 2: jugador + ubicación + PNJ ──────────────────────────────────────
  const [charSearch, setCharSearch] = useState('');
  const [character, setCharacter] = useState(null);
  const [charFull, setCharFull] = useState(null);
  const [charFocused, setCharFocused] = useState(false);
  const [availNpcs, setAvailNpcs] = useState([]);
  const [loadingNpcs, setLoadingNpcs] = useState(false);
  const [npc, setNpc] = useState(null);
  const [charLoc, setCharLoc] = useState(null);

  // ── Operación ──────────────────────────────────────────────────────────────
  const [modo, setModo] = useState('compra');
  const [itemSearch, setItemSearch] = useState('');
  const [item, setItem] = useState(null);
  const [precioBase, setPrecioBase] = useState(0);
  const [contexto, setContexto] = useState('');

  // ── Fase 3: negociación ──────────────────────────────────────────────────
  const [oferta, setOferta] = useState(0);
  const [anger, setAnger] = useState(0);
  const [opposedBonus, setOpposedBonus] = useState(0);
  const [negotiating, setNegotiating] = useState(false);
  const [result, setResult] = useState(null);

  // ── Fase 4: tirada enfrentada ──────────────────────────────────────────────
  const [intencion, setIntencion] = useState('');
  const [habilidad, setHabilidad] = useState('Engaño');
  const [modJugador, setModJugador] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [opposed, setOpposed] = useState(null);

  // ── Fase 5: cierre ──────────────────────────────────────────────────────────
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [destino, setDestino] = useState('mochila'); // mochila | equipado | montura

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const contextos = config?.historical_contexts || {};

  // Catálogo aplanado (categoria → items) para el buscador.
  const allItems = useMemo(() => {
    const out = [];
    Object.entries(equipment || {}).forEach(([cat, lista]) => {
      if (cat.startsWith('_') || !Array.isArray(lista)) return;
      lista.forEach((it) => { if (it?.nombre) out.push({ ...it, _categoria: cat }); });
    });
    return out;
  }, [equipment]);

  const filteredChars = useMemo(() => {
    const q = charSearch.toLowerCase().trim();
    if (!q) return characters;
    return characters.filter((c) =>
      (c.nombre || '').toLowerCase().includes(q) || (c.jugador || '').toLowerCase().includes(q)
    );
  }, [charSearch, characters]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.toLowerCase().trim();
    if (!q) return [];
    return allItems.filter((it) => it.nombre.toLowerCase().includes(q)).slice(0, 12);
  }, [itemSearch, allItems]);

  const resetNegotiation = () => {
    setOferta(precioBase || 0);
    setAnger(0);
    setOpposedBonus(0);
    setResult(null);
    setOpposed(null);
    setClosed(null);
    setWarnings(null);
  };

  // Al elegir personaje → cargar PNJ presentes (gate de ubicación) + ficha completa.
  const selectCharacter = async (c) => {
    setCharacter(c);
    setCharSearch(c.nombre);
    setNpc(null);
    setAvailNpcs([]);
    setCharFull(null);
    setLoadingNpcs(true);
    const cid = c.id || c._id;
    // Ficha completa (dinero + inventario) en paralelo.
    api.get(`/characters/${cid}`).then((r) => setCharFull(r.data)).catch(() => {});
    try {
      const res = await api.get('/trading/d100/available-npcs', { params: { character_id: cid } });
      setAvailNpcs(res.data?.npcs || []);
      setCharLoc(res.data?.character || null);
      if ((res.data?.npcs || []).length === 0) {
        toast.info(`No hay PNJs en ${res.data?.character?.ubicacion || 'esta ubicación'}.`);
      }
    } catch (e) {
      toast.error('Error al cargar PNJs de la ubicación');
    } finally {
      setLoadingNpcs(false);
    }
  };

  const refreshCharFull = async () => {
    const cid = character?.id || character?._id;
    if (!cid) return;
    try { const r = await api.get(`/characters/${cid}`); setCharFull(r.data); } catch (e) { /* noop */ }
  };

  const selectItem = (it) => {
    setItem(it);
    setItemSearch(it.nombre);
    const p = Number(it.precio) || 0;
    setPrecioBase(p);
    setOferta(p);
  };

  // ── Fase 3: negociar ─────────────────────────────────────────────────────
  const negotiate = async () => {
    if (!npc) { toast.error('Selecciona un PNJ comerciante'); return; }
    if (!precioBase || precioBase <= 0) { toast.error('Indica el precio base del artículo'); return; }
    setNegotiating(true);
    try {
      const res = await api.post('/trading/d100/negotiate', {
        npc_id: npc._id,
        character_id: character?.id || character?._id,
        precio_base: Number(precioBase),
        categoria: item?._categoria || 'general',
        modo,
        oferta: Number(oferta),
        contexto_historico: contexto,
        anger_actual: anger,
        opposed_bonus: opposedBonus,
      });
      setResult(res.data);
      setAnger(res.data.anger_nuevo ?? anger);
      // El bono de la tirada enfrentada se consume tras usarlo.
      setOpposedBonus(0);
      setClosed(null);
    } catch (e) {
      toast.error('Error en la negociación');
    } finally {
      setNegotiating(false);
    }
  };

  const acceptCounter = () => {
    if (result?.contraoferta == null) return;
    setOferta(Number(result.contraoferta));
    toast.info('Contraoferta aceptada. Pulsa "Negociar" para cerrar el precio.');
  };

  // ── Fase 4: tirada enfrentada ───────────────────────────────────────────────
  const rollOpposed = async () => {
    if (!npc) { toast.error('Selecciona un PNJ'); return; }
    setRolling(true);
    try {
      const res = await api.post('/trading/d100/opposed-roll', {
        npc_id: npc._id,
        character_id: character?.id || character?._id,
        intencion,
        habilidad,
        habilidad_pnj: 'Perspicacia',
        mod_jugador: Number(modJugador),
      });
      setOpposed(res.data);
      setOpposedBonus(res.data.opposed_bonus || 0);
    } catch (e) {
      toast.error('Error en la tirada enfrentada');
    } finally {
      setRolling(false);
    }
  };

  // ── Fase 5: cerrar trato (relación + oro/inventario) ─────────────────────────
  const closeDeal = async () => {
    if (!result || result.resultado !== 'acepta') return;
    if (!character) { toast.error('Falta el personaje'); return; }
    setClosing(true);
    setWarnings(null);
    try {
      // 1) Persistir relación.
      const closeRes = await api.post('/trading/d100/close', {
        character_id: character.id || character._id,
        npc_id: npc._id,
        relacion_delta: result.relacion_delta || 0,
        resumen: `${modo === 'compra' ? 'Compra' : 'Venta'} de ${item?.nombre || 'artículo'} por ${Number(oferta).toFixed(2)} mp`,
      });
      // 2) Aplicar oro/inventario real (reutiliza confirm-transaction).
      let warns = [];
      if (item) {
        const txn = await api.post('/trading/confirm-transaction', {
          character_id: character.id || character._id,
          modo,
          articulo: {
            nombre: item.nombre,
            categoria_catalogo: item._categoria,
            peso_kg: item.peso_kg,
            capacidad_carga: item.capacidad_carga,
          },
          cantidad: 1,
          precio_total: Number(oferta),
          moneda: 'mp',
          // Destino al comprar: equipado / mochila / montura.
          carried_by: modo === 'compra' && destino === 'montura' ? 'montura' : 'personaje',
          equipado: modo === 'compra' ? destino === 'equipado' : undefined,
        });
        warns = txn.data?.warnings || [];
      }
      setClosed(closeRes.data);
      setWarnings(warns);
      await refreshCharFull();
      toast.success('Trato cerrado y aplicado al personaje');
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Error al cerrar el trato';
      toast.error(detail);
    } finally {
      setClosing(false);
    }
  };

  const ubic = character?.ubicacion_actual;
  const ubicLabel = ubic ? `${ubic.nombre} (${ubic.region})` : (charLoc?.ubicacion ? `${charLoc.ubicacion} (${charLoc.region || ''})` : null);
  const rs = result ? RESULT_STYLE[result.resultado] : null;

  // Dinero del personaje (mo/mp/mc/me).
  const dinero = charFull?.dinero || {};
  const monedas = [['mo', dinero.mo], ['mp', dinero.mp], ['me', dinero.me], ['mc', dinero.mc]]
    .filter(([, v]) => Number(v) > 0);
  const tieneMonturas = (charFull?.monturas || []).length > 0 || !!charFull?.montura;

  // Equipo del personaje aplanado para el listado del lado derecho.
  const equipoChar = useMemo(() => {
    if (!charFull) return [];
    const rows = [];
    const push = (it, origen, extra) => {
      if (!it) return;
      const nombre = typeof it === 'string' ? it : it.nombre;
      if (!nombre) return;
      const equipado = it.activa || it.equipado || extra === 'equipado';
      const enMontura = it.portado_por === 'montura' || extra === 'montura';
      rows.push({ nombre, cantidad: it.cantidad || 1, origen, equipado, enMontura });
    };
    (charFull.armas || []).forEach((it) => push(it, 'Arma'));
    push(charFull.armadura, 'Armadura');
    (charFull.armadura_piezas || []).forEach((it) => push(it, 'Armadura'));
    (charFull.equipo || []).forEach((it) => push(it, 'Equipo'));
    (charFull.equipo_ocupacion || []).forEach((it) => push(it, 'Ocupación'));
    (charFull.inventario || []).forEach((it) => push(it, 'Mochila'));
    (charFull.monturas || []).forEach((m) => (m.equipo || []).forEach((it) => push(it, `Montura: ${m.nombre_personalizado || m.especie || ''}`, 'montura')));
    return rows;
  }, [charFull]);

  return (
    <div className="space-y-4" data-testid="tienda-d100">
      <div className="flex items-center gap-2 text-[hsl(var(--gold))]">
        <Store className="w-5 h-5" />
        <h3 className="font-heading text-lg">Tienda D100</h3>
        <span className="text-xs text-muted-foreground">Negociación con motor D100, enfado y tirada enfrentada</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
      {/* FASE 2 — Jugador + ubicación + PNJ */}
      <div className="bg-black/20 rounded-lg p-4 border border-border/30 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--magic-blue))]">
          <User className="w-4 h-4" /> 1. Jugador y ubicación
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={charSearch} onChange={(e) => { setCharSearch(e.target.value); setCharacter(null); }}
            onFocus={() => setCharFocused(true)}
            onBlur={() => setTimeout(() => setCharFocused(false), 150)}
            placeholder="Buscar o elegir personaje…" className="pl-8" data-testid="d100-char-search" />
          {!character && (charFocused || charSearch) && filteredChars.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-black/95 border border-border rounded-md max-h-[22rem] overflow-auto" data-testid="d100-char-dropdown">
              {filteredChars.map((c) => (
                <button key={c.id || c._id} onMouseDown={(e) => { e.preventDefault(); selectCharacter(c); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm flex justify-between"
                  data-testid={`d100-char-opt-${c.id || c._id}`}>
                  <span>{c.nombre}</span>
                  <span className="text-xs text-muted-foreground">{c.cultura_nombre}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {character && (
          <div className="text-sm flex items-center gap-2 flex-wrap" data-testid="d100-selected-char">
            <span className="px-2 py-0.5 rounded bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))]">{character.nombre}</span>
            {ubicLabel ? (
              <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> {ubicLabel}</span>
            ) : (
              <span className="text-red-400 text-xs">Sin ubicación actual asignada</span>
            )}
          </div>
        )}

        {/* PNJ presentes */}
        {character && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">PNJs presentes en la ubicación:</p>
            {loadingNpcs ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</div>
            ) : availNpcs.length === 0 ? (
              <p className="text-xs text-amber-400/80">No hay PNJs comerciantes en esta ubicación. Crea uno en la pestaña «PNJs».</p>
            ) : (
              <div className="flex flex-wrap gap-2" data-testid="d100-npc-list">
                {availNpcs.map((n) => (
                  <button key={n._id} onClick={() => { setNpc(n); resetNegotiation(); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      npc?._id === n._id ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]' : 'border-border/40 hover:border-border'
                    }`} data-testid={`d100-npc-opt-${n._id}`}>
                    {n.retrato_file_id ? (
                      <img src={`${API_URL}/api/trading/npcs/${n._id}/portrait`} alt={n.nombre} className="w-6 h-6 rounded object-cover" />
                    ) : <User className="w-4 h-4" />}
                    {n.nombre} <span className="text-xs text-muted-foreground">({n.profesion})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FASE 2/3 — Operación */}
      {npc && (
        <div className="bg-black/20 rounded-lg p-4 border border-border/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--magic-blue))]">
            <ShoppingCart className="w-4 h-4" /> 2. Operación con {npc.nombre}
          </div>
          {/* Comprar / Vender */}
          <div className="flex gap-2">
            <Button size="sm" variant={modo === 'compra' ? 'default' : 'outline'}
              className={modo === 'compra' ? 'bg-green-700 hover:bg-green-600' : ''}
              onClick={() => { setModo('compra'); resetNegotiation(); }} data-testid="d100-modo-compra">
              Comprar (el jugador paga)
            </Button>
            <Button size="sm" variant={modo === 'venta' ? 'default' : 'outline'}
              className={modo === 'venta' ? 'bg-blue-700 hover:bg-blue-600' : ''}
              onClick={() => { setModo('venta'); resetNegotiation(); }} data-testid="d100-modo-venta">
              Vender (el jugador cobra)
            </Button>
          </div>

          {/* Artículo + contexto */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="text-xs text-muted-foreground">Artículo</label>
              <Input value={itemSearch} onChange={(e) => { setItemSearch(e.target.value); setItem(null); }}
                placeholder="Buscar artículo del catálogo…" data-testid="d100-item-search" />
              {itemSearch && !item && filteredItems.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-black/95 border border-border rounded-md max-h-56 overflow-auto" data-testid="d100-item-dropdown">
                  {filteredItems.map((it) => (
                    <button key={`${it._categoria}-${it.nombre}`} onClick={() => selectItem(it)}
                      className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm flex justify-between"
                      data-testid={`d100-item-opt-${it.nombre}`}>
                      <span>{it.nombre}</span>
                      <span className="text-xs text-muted-foreground">{it.precio} mp</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Precio base (mp)</label>
              <Input type="number" value={precioBase}
                onChange={(e) => { const p = Number(e.target.value) || 0; setPrecioBase(p); setOferta(p); }}
                data-testid="d100-precio-base" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Contexto histórico (opcional)</label>
            <select value={contexto} onChange={(e) => setContexto(e.target.value)}
              className="w-full bg-black/30 border border-border rounded px-2 py-2 text-sm" data-testid="d100-contexto-select">
              <option value="">— Ninguno —</option>
              {Object.entries(contextos).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* FASE 3 — Negociación D100 */}
      {npc && (
        <div className="bg-black/20 rounded-lg p-4 border border-border/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--magic-blue))]">
            <Dices className="w-4 h-4" /> 3. Negociación (motor D100)
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground">{modo === 'compra' ? 'Oferta del jugador (paga)' : 'Precio que pide el jugador'}</label>
              <Input type="number" value={oferta} onChange={(e) => setOferta(Number(e.target.value) || 0)}
                className="w-40" data-testid="d100-oferta" />
            </div>
            <Button onClick={negotiate} disabled={negotiating} className="bg-[hsl(var(--torch-orange))] hover:opacity-90" data-testid="d100-negotiate-btn">
              {negotiating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Dices className="w-4 h-4 mr-2" />} Negociar
            </Button>
            <AngerBar value={anger} />
          </div>

          {result && rs && (
            <div className={`rounded-lg p-3 border ${rs.bg} ${rs.border}`} data-testid="d100-result">
              <div className={`flex items-center gap-2 font-medium ${rs.text}`}>
                <rs.Icon className="w-4 h-4" /> {rs.label}
                {result.resultado === 'enfado' && <span className="text-xs">{result.mensaje}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                <div>Precio ref.: <span className="font-mono text-foreground">{fmt(result.precio_referencia)}</span></div>
                <div>Desviación: <span className="font-mono text-foreground">{result.desviacion_pct}%</span></div>
                <div>Tolerancia: <span className="font-mono text-foreground">{result.tolerancia}%</span></div>
                <div>Rel. efectiva: <span className="font-mono text-foreground">{result.relacion_efectiva}</span></div>
                {result.tirada != null && <div>Tirada D100: <span className="font-mono text-foreground">{result.tirada}</span></div>}
                {result.prob_aceptacion != null && <div>Prob.: <span className="font-mono text-foreground">{result.prob_aceptacion}%</span></div>}
                <div>Sub/Ofi: <span className="font-mono text-foreground">{result.sub_mod}/{result.ofi_mod}</span></div>
                <div>Enfado +{result.anger_incremento}</div>
              </div>
              {result.resultado === 'contraoferta' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-yellow-300">Contraoferta: <strong>{fmt(result.contraoferta)}</strong></span>
                  <Button size="sm" variant="outline" onClick={acceptCounter} data-testid="d100-accept-counter">Aceptar contraoferta</Button>
                </div>
              )}
              {result.resultado === 'acepta' && (
                <div className="mt-3 space-y-2">
                  {modo === 'compra' && item && (
                    <div className="flex items-center gap-2 flex-wrap text-xs" data-testid="d100-destino">
                      <span className="text-muted-foreground">Guardar como:</span>
                      {[['mochila', 'Mochila'], ['equipado', 'Equipado'], ...(tieneMonturas ? [['montura', 'A la montura']] : [])].map(([val, label]) => (
                        <button key={val} onClick={() => setDestino(val)}
                          className={`px-2 py-1 rounded border ${destino === val ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/15 text-[hsl(var(--gold))]' : 'border-border/40'}`}
                          data-testid={`d100-destino-${val}`}>{label}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-green-300">Trato acordado por <strong>{fmt(oferta)}</strong>. Δrelación {result.relacion_delta >= 0 ? '+' : ''}{result.relacion_delta}.</span>
                    <Button size="sm" onClick={closeDeal} disabled={closing} className="bg-green-700 hover:bg-green-600" data-testid="d100-close-btn">
                      {closing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}
                      Cerrar trato y aplicar al personaje
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {closed && (
            <div className="rounded-lg p-3 border border-green-700 bg-green-950/30 text-sm" data-testid="d100-closed">
              <p className="text-green-300">✓ Trato cerrado. Relación con {npc.nombre}: {closed.relacion_anterior} → <strong>{closed.relacion_actual}</strong> ({closed.nivel}).</p>
              {warnings && warnings.length > 0 && (
                <ul className="mt-1 text-xs text-amber-300 list-disc pl-5" data-testid="d100-warnings">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* FASE 4 — Tirada enfrentada */}
      {npc && (
        <div className="bg-black/20 rounded-lg p-4 border border-[hsl(var(--torch-orange))]/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--torch-orange))]">
            <Sparkles className="w-4 h-4" /> 4. Tirada de habilidad enfrentada (Engaño/Persuasión vs Perspicacia)
          </div>
          <Input value={intencion} onChange={(e) => setIntencion(e.target.value)}
            placeholder="Intención del jugador (la narra el DJ)…" data-testid="d100-intencion" />
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-muted-foreground">Habilidad del jugador</label>
              <select value={habilidad} onChange={(e) => setHabilidad(e.target.value)}
                className="w-full bg-black/30 border border-border rounded px-2 py-2 text-sm" data-testid="d100-habilidad-select">
                {HABILIDADES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Mod. del jugador</label>
              <Input type="number" value={modJugador} onChange={(e) => setModJugador(Number(e.target.value) || 0)}
                className="w-24" data-testid="d100-mod-jugador" />
            </div>
            <Button onClick={rollOpposed} disabled={rolling} variant="outline" data-testid="d100-opposed-btn">
              {rolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Dices className="w-4 h-4 mr-2" />} Tirar enfrentada
            </Button>
          </div>

          {opposed && (
            <div className={`rounded-lg p-3 border text-sm ${opposed.gana_jugador ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`} data-testid="d100-opposed-result">
              <p className={opposed.gana_jugador ? 'text-green-400' : 'text-red-400'}>
                {opposed.gana_jugador ? '✓ El jugador gana la tirada' : '✗ El PNJ no se lo cree'} —
                Jugador {opposed.tirada_jugador.total} (d20 {opposed.tirada_jugador.d20}+{opposed.tirada_jugador.mod}) vs
                PNJ {opposed.tirada_pnj.total} (d20 {opposed.tirada_pnj.d20}+{opposed.tirada_pnj.mod})
              </p>
              <p className="text-xs text-muted-foreground mt-1">Bono a la próxima negociación: {opposed.opposed_bonus >= 0 ? '+' : ''}{opposed.opposed_bonus}% de tolerancia</p>
              {opposed.narrativa && <p className="mt-2 italic text-foreground/90">{opposed.narrativa}</p>}
            </div>
          )}
        </div>
      )}
        </div>

        {/* PANEL DERECHO — Dinero + equipo del personaje */}
        <aside className="space-y-3 lg:sticky lg:top-4" data-testid="d100-char-panel">
          {!character ? (
            <div className="bg-black/20 rounded-lg p-4 border border-border/30 text-xs text-muted-foreground">
              Selecciona un jugador para ver su dinero y su equipo.
            </div>
          ) : (
            <>
              {/* Dinero */}
              <div className="bg-black/20 rounded-lg p-4 border border-[hsl(var(--gold))]/30" data-testid="d100-dinero">
                <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--gold))] mb-2">
                  <Coins className="w-4 h-4" /> Dinero de {character.nombre}
                </div>
                {monedas.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {monedas.map(([k, v]) => (
                      <span key={k} className="px-2 py-1 rounded bg-black/40 text-sm font-mono">
                        {v} <span className="text-muted-foreground text-xs">{k}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{charFull ? 'Sin dinero registrado' : 'Cargando…'}</p>
                )}
              </div>

              {/* Equipo */}
              <div className="bg-black/20 rounded-lg p-4 border border-border/30" data-testid="d100-equipo">
                <div className="flex items-center justify-between text-sm font-medium text-[hsl(var(--magic-blue))] mb-2">
                  <span className="flex items-center gap-2"><Backpack className="w-4 h-4" /> Equipo</span>
                  <span className="text-xs text-muted-foreground">{equipoChar.length} obj.</span>
                </div>
                {!charFull ? (
                  <p className="text-xs text-muted-foreground">Cargando…</p>
                ) : equipoChar.length === 0 ? (
                  <p className="text-xs text-muted-foreground">El personaje no lleva equipo.</p>
                ) : (
                  <div className="max-h-[26rem] overflow-auto pr-1 space-y-1" data-testid="d100-equipo-list">
                    {equipoChar.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/15">
                        <span className="truncate">
                          {it.nombre}{it.cantidad > 1 ? <span className="text-muted-foreground"> ×{it.cantidad}</span> : null}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {it.equipado && <span className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-400 text-[10px]">Equipado</span>}
                          {it.enMontura && <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 text-[10px]">Montura</span>}
                          <span className="text-muted-foreground text-[10px]">{it.origen}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default TiendaD100;
