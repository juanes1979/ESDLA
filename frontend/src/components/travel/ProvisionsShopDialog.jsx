/**
 * ProvisionsShopDialog — Compra de provisiones para el viaje (Iteración 62).
 *
 * Sistema por PACKS (confirmado por el usuario):
 *   - Pack de Raciones de viaje:  5 mc → 10 raciones (10 días/persona)
 *   - Odre lleno (agua):          2 mc → 10 L (5 días/persona a 2 L/día)
 *   - Forraje montura (día):      1 me/día/animal
 *   - Agua animal (día):          5 me/día/animal (sólo en sombra/oscuras o muy_dificil)
 *
 * Cada personaje (miembro o acompañante) compra su propia ración/agua.
 * El dueño de cada montura paga el forraje/agua animal correspondiente.
 *
 * Modificadores: Región × Asentamiento × Relación × Contexto se aplican al total final.
 *
 * Sistema monetario:
 *   1 mo (oro) = 100 mp = 1.000 mc = 10.000 me
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBag, CheckCircle2, XCircle, Loader2, Calculator, Package, Droplets } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { computeShortfall, summarizeProvisions } from './inventoryProvisions';

// --- Sistema monetario (jerarquía):
//   1 mo (oro)    = 100 mp = 1.000 mc = 10.000 me
const ME_POR_MC = 10;
const ME_POR_MP = 100;
const ME_POR_MO = 10000;

// --- Pesos (kg) ---
const PESO_PACK_RACIONES_KG = 4.5;     // 10 raciones × 0,45 kg
const PESO_ODRE_LLENO_KG = 10;         // 10 L de agua

// --- Precios base (configurables en el modal) ---
// Pack 10 raciones = 5 mc = 50 me
const PRECIO_BASE_PACK_RACIONES_ME = 50;
// Odre lleno (10 L) = 2 mc = 20 me
const PRECIO_BASE_ODRE_ME = 20;
// Forraje animal: 1 me/día (= 10 me/10 días)
const PRECIO_BASE_FORRAJE_ME = 1;
// Agua animal: 5 me/día (sólo si terreno lo exige)
const PRECIO_BASE_AGUA_ANIMAL_ME = 5;

// Capacidades de cada pack
const RACIONES_POR_PACK = 10;          // 10 raciones / pack
const LITROS_POR_ODRE = 10;            // 10 L / odre
const LITROS_AGUA_POR_DIA = 2;         // 2 L/día/persona → 1 odre = 5 días/persona

// Convertir cantidades en monedas a unidad pequeña (me)
const coinsToME = (dinero = {}) => {
  const me = Number(dinero.me || 0);
  const mc = Number(dinero.mc || 0) * ME_POR_MC;
  const mp = Number(dinero.mp || 0) * ME_POR_MP;
  const mo = Number(dinero.mo || 0) * ME_POR_MO;
  return me + mc + mp + mo;
};

// Formatear precio en me a string legible (mo / mp / mc / me)
const formatPrice = (me) => {
  const total = Math.round(me);
  if (total <= 0) return '0 me';
  const mo = Math.floor(total / ME_POR_MO);
  let r = total - mo * ME_POR_MO;
  const mp = Math.floor(r / ME_POR_MP);
  r -= mp * ME_POR_MP;
  const mc = Math.floor(r / ME_POR_MC);
  r -= mc * ME_POR_MC;
  const meRest = r;
  const parts = [];
  if (mo) parts.push(`${mo} mo`);
  if (mp) parts.push(`${mp} mp`);
  if (mc) parts.push(`${mc} mc`);
  if (meRest) parts.push(`${meRest} me`);
  return parts.length ? parts.join(' ') : '0 me';
};

// ¿El terreno/tierra obliga a llevar comida/agua para los animales?
function animalNeeds(terreno, tipoTierra) {
  const tierra = (tipoTierra || '').toLowerCase();
  const t = (terreno || '').toLowerCase();
  const inSombraOscuras =
    tierra.includes('sombra') || tierra.includes('oscuras') || tierra.includes('oscuridad');
  const dificil = ['dificil', 'difícil', 'muy_dificil', 'muy difícil', 'desalentador',
                   'infranqueable', 'pantano', 'montaña', 'montana']
    .some((k) => t.includes(k));
  const muyDificil = ['muy_dificil', 'muy difícil', 'desalentador',
                      'infranqueable', 'pantano', 'montaña', 'montana']
    .some((k) => t.includes(k));
  return {
    needsFood: inSombraOscuras || dificil,
    needsWater: inSombraOscuras || muyDificil,
    sombraOscuras: inSombraOscuras,
  };
}

export default function ProvisionsShopDialog({
  open,
  onClose,
  miembros = [],
  acompanantes = [],
  characters = [],
  diasViaje = 1,
  origenRegionName = '',
  terreno = '',
  tipoTierra = '',
  onPurchaseComplete,
}) {
  const [modifiers, setModifiers] = useState(null);
  const [precioPack, setPrecioPack] = useState(PRECIO_BASE_PACK_RACIONES_ME);
  const [precioOdre, setPrecioOdre] = useState(PRECIO_BASE_ODRE_ME);
  const [precioForraje, setPrecioForraje] = useState(PRECIO_BASE_FORRAJE_ME);
  const [precioAguaAnimal, setPrecioAguaAnimal] = useState(PRECIO_BASE_AGUA_ANIMAL_ME);

  const [selRegion, setSelRegion] = useState('');
  const [selAsentamiento, setSelAsentamiento] = useState('');
  const [selRelacion, setSelRelacion] = useState('');
  const [selContexto, setSelContexto] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resultados, setResultados] = useState({});

  // Cargar modificadores
  useEffect(() => {
    if (!open) return;
    api.get('/data/modificadores-precio').then((res) => {
      setModifiers(res.data);
      if (origenRegionName && res.data?.region) {
        const found = res.data.region.find(
          (r) =>
            (r.nombre || '').toLowerCase().includes(origenRegionName.toLowerCase()) ||
            origenRegionName.toLowerCase().includes((r.nombre || '').toLowerCase())
        );
        if (found) setSelRegion(found.nombre);
      }
    }).catch(() => {});
  }, [open, origenRegionName]);

  const findMod = (cat, name) => {
    if (!modifiers || !modifiers[cat] || !name) return 1.0;
    const item = modifiers[cat].find((m) => m.nombre === name);
    return item ? Number(item.modificador) || 1.0 : 1.0;
  };

  const totalMod = useMemo(() => {
    const r = findMod('region', selRegion);
    const a = findMod('asentamiento', selAsentamiento);
    const rel = findMod('relacion', selRelacion);
    const c = findMod('contexto', selContexto);
    return { r, a, rel, c, total: r * a * rel * c };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifiers, selRegion, selAsentamiento, selRelacion, selContexto]);

  const needs = useMemo(() => animalNeeds(terreno, tipoTierra), [terreno, tipoTierra]);

  // Default packs/odres that ONE person would need (no inventory considered)
  const packsRacionesPorPersonaDefault = Math.ceil(diasViaje / RACIONES_POR_PACK);
  const odresPorPersonaDefault = Math.ceil((diasViaje * LITROS_AGUA_POR_DIA) / LITROS_POR_ODRE);

  // Personas a alimentar/dar de beber
  const todasPersonas = useMemo(() => {
    const ms = (miembros || []).map((m) => ({ ...m, _tipo: 'miembro' }));
    const as = (acompanantes || []).map((a) => ({ ...a, _tipo: 'acompanante' }));
    return [...ms, ...as];
  }, [miembros, acompanantes]);

  // Filas — cada persona ya cuenta con lo que tiene en su inventario.
  // Por defecto solo compra lo que le FALTA (rounded up to packs).
  // El maestro/jugador puede aumentar la cantidad si quiere llevar más.
  const [overrides, setOverrides] = useState({}); // {charId: {packs, odres}}
  const setRowOverride = (id, patch) =>
    setOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));

  // Filas de personas — cada una compra su pack + sus odres
  const rows = useMemo(() => {
    return todasPersonas.map((p) => {
      const char = characters.find((c) => c.id === p.id);
      const dinero = char?.dinero || {};
      const meDisp = coinsToME(dinero);

      // Lectura del inventario actual
      const inv = char?.inventario || [];
      const summary = summarizeProvisions(inv);
      const shortfall = computeShortfall(inv, diasViaje);

      // Compra propuesta = lo que le falta (rounded a packs/odres). El usuario
      // puede sobreescribir por arriba (no por debajo de 0).
      const ov = overrides[p.id] || {};
      const packsACompra = Math.max(
        0,
        ov.packs != null ? ov.packs : shortfall.packsRaciones
      );
      const odresACompra = Math.max(
        0,
        ov.odres != null ? ov.odres : shortfall.odres
      );

      const precioPersonaME =
        (packsACompra * precioPack + odresACompra * precioOdre) * totalMod.total;

      // Forraje/agua animal si tiene montura propia y la usa
      const tieneMonturaActiva = !!(p.tieneMontura && p.monturaPropia);
      let precioAnimalME = 0;
      const animalDetalles = [];
      if (tieneMonturaActiva) {
        if (needs.needsFood) {
          const c = precioForraje * diasViaje * totalMod.total;
          precioAnimalME += c;
          animalDetalles.push(`Forraje (${diasViaje}d): ${formatPrice(c)}`);
        }
        if (needs.needsWater) {
          const c = precioAguaAnimal * diasViaje * totalMod.total;
          precioAnimalME += c;
          animalDetalles.push(`Agua animal (${diasViaje}d): ${formatPrice(c)}`);
        }
      }

      const precioTotalME = precioPersonaME + precioAnimalME;
      const puedeComprar = meDisp >= precioTotalME;
      const yaTieneTodo =
        shortfall.racionesFaltantes === 0 && shortfall.litrosFaltantes === 0;

      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p._tipo,
        dinero,
        meDisp,
        // Inventario actual
        invRaciones: summary.raciones,
        invLitros: summary.totalLitros,
        // Lo que falta (en raciones/litros, no en packs)
        racionesFaltantes: shortfall.racionesFaltantes,
        litrosFaltantes: shortfall.litrosFaltantes,
        // Compra a realizar
        packsACompra,
        odresACompra,
        // Sugerido (lo que faltaba al inicio)
        packsSugeridos: shortfall.packsRaciones,
        odresSugeridos: shortfall.odres,
        // Precios
        precioPersonaME,
        precioAnimalME,
        precioTotalME,
        precioFmt: formatPrice(precioTotalME),
        puedeComprar,
        yaTieneTodo,
        tieneMonturaActiva,
        monturaNombre: p.monturaNombre,
        animalDetalles,
      };
    });
  }, [todasPersonas, characters, diasViaje, overrides, precioPack, precioOdre,
      needs, precioForraje, precioAguaAnimal, totalMod.total]);

  const totalGrupoME = rows.reduce((sum, r) => sum + r.precioTotalME, 0);

  const comprarPara = async (row) => {
    if (row.packsACompra === 0 && row.odresACompra === 0 && row.precioAnimalME === 0) {
      toast.info(`${row.nombre} ya tiene provisiones suficientes.`);
      setResultados((prev) => ({ ...prev, [row.id]: 'ok' }));
      return;
    }
    if (!row.puedeComprar) {
      toast.error(`${row.nombre} no tiene suficientes monedas (necesita ${row.precioFmt}).`);
      return;
    }
    setProcessing(true);
    try {
      const modPct = Math.round(totalMod.total * 100);
      const desc = `Mod. ${modPct}%`;

      // 1) Packs de raciones
      if (row.packsACompra > 0) {
        await api.post(`/characters/${row.id}/equipment/add`, {
          item_name: `Pack de Raciones de viaje (${RACIONES_POR_PACK} raciones) — ${desc}`,
          item_category: 'equipo_general',
          cantidad: row.packsACompra,
          is_purchase: true,
          precio: precioPack * totalMod.total,
          moneda: 'me',
          peso_kg: PESO_PACK_RACIONES_KG,
        });
      }

      // 2) Odres llenos
      if (row.odresACompra > 0) {
        await api.post(`/characters/${row.id}/equipment/add`, {
          item_name: `Odre lleno (${LITROS_POR_ODRE} L) — ${desc}`,
          item_category: 'equipo_general',
          cantidad: row.odresACompra,
          is_purchase: true,
          precio: precioOdre * totalMod.total,
          moneda: 'me',
          peso_kg: PESO_ODRE_LLENO_KG,
        });
      }

      // 3) Forraje + agua animal (si aplica)
      if (row.tieneMonturaActiva) {
        if (needs.needsFood) {
          await api.post(`/characters/${row.id}/equipment/add`, {
            item_name: `Forraje montura "${row.monturaNombre || 'caballo'}" (${diasViaje} días) — ${desc}`,
            item_category: 'equipo_general',
            cantidad: diasViaje,
            is_purchase: true,
            precio: precioForraje * totalMod.total,
            moneda: 'me',
            peso_kg: 0.5,
          });
        }
        if (needs.needsWater) {
          await api.post(`/characters/${row.id}/equipment/add`, {
            item_name: `Agua para montura "${row.monturaNombre || 'caballo'}" (${diasViaje} días) — ${desc}`,
            item_category: 'equipo_general',
            cantidad: diasViaje,
            is_purchase: true,
            precio: precioAguaAnimal * totalMod.total,
            moneda: 'me',
            peso_kg: 1.0,
          });
        }
      }

      setResultados((prev) => ({ ...prev, [row.id]: 'ok' }));
      toast.success(`${row.nombre} compró por ${row.precioFmt}.`);
      if (onPurchaseComplete) onPurchaseComplete(row.id);
      // Limpia el override para que la próxima sugerencia (raciones/odres
      // que aún falten) se calcule con el inventario actualizado y el
      // usuario pueda seguir comprando si lo desea.
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    } catch (err) {
      console.error(err);
      setResultados((prev) => ({ ...prev, [row.id]: 'error' }));
      toast.error(`Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const comprarTodos = async () => {
    setProcessing(true);
    for (const row of rows) {
      // Compra para todos los que pueden permitírselo Y todavía necesitan algo.
      const necesitaAlgo = row.packsACompra > 0 || row.odresACompra > 0 || row.precioAnimalME > 0;
      if (row.puedeComprar && necesitaAlgo) {
        // eslint-disable-next-line no-await-in-loop
        await comprarPara(row);
      }
    }
    setProcessing(false);
  };

  if (!modifiers) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
        <DialogContent>
          <Loader2 className="w-6 h-6 animate-spin mx-auto my-8" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0" data-testid="provisions-shop-dialog">
        <DialogHeader className="px-6 pt-6 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
            <ShoppingBag className="w-5 h-5" />
            Comprar Provisiones — {diasViaje} día(s) · {todasPersonas.length} viajero(s)
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
          {/* Resumen del grupo */}
          {(() => {
            const totalRaciones = rows.reduce((s, r) => s + r.invRaciones, 0);
            const totalLitros = rows.reduce((s, r) => s + r.invLitros, 0);
            const racionesNec = todasPersonas.length * diasViaje;
            const litrosNec = todasPersonas.length * diasViaje * LITROS_AGUA_POR_DIA;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/30">
                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-amber-400 mt-1" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-300">
                      Comida: {totalRaciones} / {racionesNec} raciones necesarias
                    </p>
                    <p className="text-muted-foreground">
                      {totalRaciones >= racionesNec
                        ? `✓ Suficiente (sobran ${totalRaciones - racionesNec})`
                        : `✗ Faltan ${racionesNec - totalRaciones} raciones`}
                      {' · '} {todasPersonas.length} viajero(s) × {diasViaje} días
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Droplets className="w-4 h-4 text-blue-400 mt-1" />
                  <div className="text-xs">
                    <p className="font-bold text-blue-300">
                      Agua: {totalLitros} / {litrosNec} L necesarios
                    </p>
                    <p className="text-muted-foreground">
                      {totalLitros >= litrosNec
                        ? `✓ Suficiente (sobran ${totalLitros - litrosNec} L)`
                        : `✗ Faltan ${litrosNec - totalLitros} L`}
                      {' · '} {LITROS_AGUA_POR_DIA} L/día/persona
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Selectores de modificadores */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded bg-black/20 border border-[hsl(var(--gold))]/30">
            <div>
              <Label className="text-xs">Región (auto)</Label>
              <Select value={selRegion} onValueChange={setSelRegion}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-region-select">
                  <SelectValue placeholder="Sin selección" />
                </SelectTrigger>
                <SelectContent>
                  {(modifiers.region || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>
                      {m.nombre} ({Math.round(m.modificador * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asentamiento</Label>
              <Select value={selAsentamiento} onValueChange={setSelAsentamiento}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-asentamiento-select">
                  <SelectValue placeholder="Sin selección" />
                </SelectTrigger>
                <SelectContent>
                  {(modifiers.asentamiento || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>
                      {m.nombre} ({Math.round(m.modificador * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Relación con vendedor</Label>
              <Select value={selRelacion} onValueChange={setSelRelacion}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-relacion-select">
                  <SelectValue placeholder="Sin selección" />
                </SelectTrigger>
                <SelectContent>
                  {(modifiers.relacion || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>
                      {m.nombre} ({Math.round(m.modificador * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contexto histórico</Label>
              <Select value={selContexto} onValueChange={setSelContexto}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-contexto-select">
                  <SelectValue placeholder="Sin selección" />
                </SelectTrigger>
                <SelectContent>
                  {(modifiers.contexto || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>
                      {m.nombre} ({Math.round(m.modificador * 100)}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3 text-xs bg-[hsl(var(--gold))]/10 p-2 rounded">
              <Calculator className="w-4 h-4 text-[hsl(var(--gold))]" />
              <span className="font-mono text-[hsl(var(--gold))]">
                {Math.round(totalMod.r * 100)}% × {Math.round(totalMod.a * 100)}% ×{' '}
                {Math.round(totalMod.rel * 100)}% × {Math.round(totalMod.c * 100)}% =
                <strong className="ml-1">{Math.round(totalMod.total * 100)}%</strong>
              </span>
              <span className="text-muted-foreground">
                {totalMod.total > 1 ? '↑ caro' : totalMod.total < 1 ? '↓ barato' : 'normal'}
              </span>
            </div>
          </div>

          {/* Precios base configurables */}
          <details className="bg-black/20 rounded p-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Precios base (configurables)
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              <div>
                <Label className="text-[10px]">Pack Raciones (me)</Label>
                <Input
                  type="number"
                  step="1"
                  value={precioPack}
                  onChange={(e) => setPrecioPack(parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                  data-testid="provisions-base-pack-raciones"
                />
                <p className="text-[9px] text-muted-foreground mt-0.5">10 raciones / 10 días</p>
              </div>
              <div>
                <Label className="text-[10px]">Odre lleno (me)</Label>
                <Input
                  type="number"
                  step="1"
                  value={precioOdre}
                  onChange={(e) => setPrecioOdre(parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                  data-testid="provisions-base-odre"
                />
                <p className="text-[9px] text-muted-foreground mt-0.5">10 L / 5 días</p>
              </div>
              <div>
                <Label className="text-[10px]">Forraje montura (me/día)</Label>
                <Input
                  type="number"
                  step="1"
                  value={precioForraje}
                  onChange={(e) => setPrecioForraje(parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-[10px]">Agua animal (me/día)</Label>
                <Input
                  type="number"
                  step="1"
                  value={precioAguaAnimal}
                  onChange={(e) => setPrecioAguaAnimal(parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Catálogo: Pack 10 raciones = 5 mc · Odre lleno 10 L = 2 mc · Forraje 1 me/día.
              1 mo = 100 mp = 1.000 mc = 10.000 me.
            </p>
          </details>

          {/* Aviso terreno animales */}
          {todasPersonas.some((p) => p.tieneMontura && p.monturaPropia) && (
            <div className="bg-black/20 rounded p-3 border border-[hsl(var(--torch-orange))]/30">
              <div className="text-xs">
                <span className="text-muted-foreground">Terreno: </span>
                <strong>{terreno || '?'}</strong>
                <span className="ml-3 text-muted-foreground">Tierra: </span>
                <strong>{tipoTierra || '?'}</strong>
              </div>
              <div className="mt-1 text-xs">
                {needs.sombraOscuras ? (
                  <p className="text-red-300">
                    ⚠️ Tierras de sombra/oscuras: las monturas <strong>requieren</strong> comida y
                    agua siempre.
                  </p>
                ) : needs.needsWater ? (
                  <p className="text-orange-300">
                    Terreno muy difícil: las monturas necesitan comida y agua.
                  </p>
                ) : needs.needsFood ? (
                  <p className="text-yellow-300">
                    Terreno difícil: las monturas necesitan comida (no agua extra).
                  </p>
                ) : (
                  <p className="text-green-300">
                    Terreno asequible: las monturas pueden pastar y beber por el camino.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tabla por persona */}
          <div className="space-y-2 pb-2">
              {rows.map((row) => {
                const estado = resultados[row.id];
                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded border ${
                      estado === 'ok'
                        ? 'border-green-500/50 bg-green-500/10'
                        : !row.puedeComprar
                        ? 'border-red-500/40 bg-red-500/10'
                        : row.yaTieneTodo && row.precioAnimalME === 0
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-muted bg-black/20'
                    }`}
                    data-testid={`provisions-row-${row.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {row.nombre}
                          {row.tipo === 'acompanante' && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Acompañante</Badge>
                          )}
                          {row.tieneMonturaActiva && (
                            <Badge variant="outline" className="ml-2 text-[10px] text-emerald-400 border-emerald-500/40">
                              🐎 {row.monturaNombre || 'Montura'}
                            </Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Monedas: {row.dinero.mo || 0} mo · {row.dinero.mp || 0} mp ·{' '}
                          {row.dinero.mc || 0} mc · {row.dinero.me || 0} me
                          <span className="ml-2 text-[hsl(var(--gold))]">(= {row.meDisp} me)</span>
                        </p>
                        <p className="text-[11px]">
                          <span className="text-muted-foreground">Inventario actual:</span>{' '}
                          <span className="text-amber-300">{row.invRaciones} raciones</span>
                          {' · '}
                          <span className="text-blue-300">{row.invLitros} L de agua</span>
                          {row.yaTieneTodo && (
                            <span className="ml-2 text-emerald-400">✓ Suficiente</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-[hsl(var(--gold))]">{row.precioFmt}</p>
                        {/* Estado: muestra badge de comprado anterior + botón
                            para seguir comprando si el usuario sube los packs/odres. */}
                        <div className="flex flex-col items-end gap-1">
                          {estado === 'ok' && (row.packsACompra === 0 && row.odresACompra === 0 && row.precioAnimalME === 0) ? (
                            <Badge className="bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Comprado
                            </Badge>
                          ) : !row.puedeComprar ? (
                            <Badge variant="outline" className="text-red-400">
                              <XCircle className="w-3 h-3 mr-1" />Sin fondos
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => comprarPara(row)}
                              disabled={processing || (row.packsACompra === 0 && row.odresACompra === 0 && row.precioAnimalME === 0)}
                              data-testid={`provisions-buy-${row.id}`}
                            >
                              {row.packsACompra === 0 && row.odresACompra === 0 && row.precioAnimalME === 0
                                ? (estado === 'ok' ? 'Comprado' : 'No necesita')
                                : (estado === 'ok' ? 'Comprar más' : 'Comprar')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Override de cantidades */}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground">Packs raciones</Label>
                        <Input
                          type="number"
                          min="0"
                          value={row.packsACompra}
                          onChange={(e) =>
                            setRowOverride(row.id, { packs: Math.max(0, parseInt(e.target.value, 10) || 0) })
                          }
                          className="h-6 w-16 text-xs"
                          data-testid={`provisions-packs-${row.id}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          (sugerido: {row.packsSugeridos})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground">Odres llenos</Label>
                        <Input
                          type="number"
                          min="0"
                          value={row.odresACompra}
                          onChange={(e) =>
                            setRowOverride(row.id, { odres: Math.max(0, parseInt(e.target.value, 10) || 0) })
                          }
                          className="h-6 w-16 text-xs"
                          data-testid={`provisions-odres-${row.id}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          (sugerido: {row.odresSugeridos})
                        </span>
                      </div>
                    </div>
                    {row.precioAnimalME > 0 && (
                      <p className="mt-1 text-[11px] text-emerald-300">
                        + Montura ({diasViaje}d): {formatPrice(row.precioAnimalME)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

          <div className="text-right text-xs text-muted-foreground">
            Total grupo:{' '}
            <span className="font-mono text-[hsl(var(--gold))]">
              {formatPrice(totalGrupoME)}
            </span>
          </div>
        </div>

        <DialogFooter className="flex gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} data-testid="provisions-close-btn">
            Cerrar
          </Button>
          <Button
            onClick={comprarTodos}
            disabled={
              processing ||
              rows.every((r) =>
                !r.puedeComprar ||
                (r.packsACompra === 0 && r.odresACompra === 0 && r.precioAnimalME === 0)
              )
            }
            className="bg-[hsl(var(--gold))] text-black hover:brightness-110"
            data-testid="provisions-buy-all-btn"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingBag className="w-4 h-4 mr-2" />
            )}
            Comprar todo el grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
