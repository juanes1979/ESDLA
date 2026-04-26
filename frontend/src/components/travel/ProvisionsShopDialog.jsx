/**
 * ProvisionsShopDialog — Compra de provisiones para el viaje (Iteración 57+).
 *
 * Precio = (base ración + base agua) × Mod.Región × Mod.Asentamiento ×
 *          Mod.Relación × Mod.Contexto.
 *
 * Compra por miembro: 1 pack = 1 ración + 1 odre de agua/día.
 * Animales (caballos/ponis): según el terreno previsto del viaje:
 *   - terreno_dificil/muy_dificil          → comida para animales
 *   - tipo_tierra=sombra/oscuras (siempre) → comida + agua para animales
 *   - resto                                → ni comida ni agua para animales
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBag, Utensils, Droplets, Coins, CheckCircle2, XCircle, Loader2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// --- Sistema monetario (jerarquía):
//   1 mo (oro)    = 100 mp = 1.000 mc = 10.000 me
//   1 mp (plata)  =          10 mc =     100 me
//   1 mc (cobre)  =                       10 me
//   1 me (estaño) = unidad más pequeña ---
const ME_POR_MC = 10;
const ME_POR_MP = 100;
const ME_POR_MO = 10000;

// --- Defaults (configurables por el Maestro en el modal) ---
const PESO_COMIDA_DIA_KG = 0.45;
const PESO_AGUA_DIA_KG = 3.79;

// Precios base en MONEDAS DE ESTAÑO (me) — la más pequeña.
// Catálogo: Ración 5 mc/día = 50 me ; Jarra de agua 1 me/día.
const PRECIO_BASE_RACION_ME = 50;       // me/día por persona (= 5 mc, catálogo)
const PRECIO_BASE_AGUA_ME = 1;          // me/día por persona (catálogo)
const PRECIO_BASE_FORRAJE_ME = 100;     // me/día por animal (= 1 mp, los caballos comen mucho)
const PRECIO_BASE_AGUA_ANIMAL_ME = 5;   // me/día por animal (un poco más que una persona)

// --- Helpers ---
// Modelo de monedas del personaje: mo (oro), mp (plata), mc (cobre), me (estaño).
// Convertimos todo a piezas de ESTAÑO (la unidad más pequeña) para comparar.
const coinsToME = (dinero = {}) => {
  const me = Number(dinero.me || 0);                    // estaño
  const mc = Number(dinero.mc || 0) * ME_POR_MC;        // cobre = 10 estaños
  const mp = Number(dinero.mp || 0) * ME_POR_MP;        // plata = 100 estaños
  const mo = Number(dinero.mo || 0) * ME_POR_MO;        // oro = 1000 estaños
  return me + mc + mp + mo;
};

// Devuelve si los animales necesitan comida y/o agua según terreno + tipo de tierra
function animalNeeds(terreno, tipoTierra) {
  const tierra = (tipoTierra || '').toLowerCase();
  const t = (terreno || '').toLowerCase();
  const inSombraOscuras = tierra.includes('sombra') || tierra.includes('oscuras') || tierra.includes('oscuridad');
  const dificil = ['dificil', 'difícil', 'muy_dificil', 'muy difícil', 'desalentador', 'infranqueable', 'pantano', 'montaña', 'montana'].some(k => t.includes(k));
  const muyDificil = ['muy_dificil', 'muy difícil', 'desalentador', 'infranqueable', 'pantano', 'montaña', 'montana'].some(k => t.includes(k));
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
  characters = [],
  diasViaje = 1,
  origenRegionName = '',
  terreno = '',
  tipoTierra = '',
  numeroAnimales = 0,
  onPurchaseComplete,
}) {
  const [modifiers, setModifiers] = useState(null);
  const [precioRacion, setPrecioRacion] = useState(PRECIO_BASE_RACION_ME);
  const [precioAgua, setPrecioAgua] = useState(PRECIO_BASE_AGUA_ME);
  const [precioForraje, setPrecioForraje] = useState(PRECIO_BASE_FORRAJE_ME);
  const [precioAguaAnimal, setPrecioAguaAnimal] = useState(PRECIO_BASE_AGUA_ANIMAL_ME);
  const [animales, setAnimales] = useState(numeroAnimales);
  const [selRegion, setSelRegion] = useState('');
  const [selAsentamiento, setSelAsentamiento] = useState('');
  const [selRelacion, setSelRelacion] = useState('');
  const [selContexto, setSelContexto] = useState('');
  const [processing, setProcessing] = useState(false);
  const [resultados, setResultados] = useState({});

  // Load modifiers
  useEffect(() => {
    if (!open) return;
    api.get('/data/modificadores-precio').then(res => {
      setModifiers(res.data);
      // Auto-pick region from origen
      if (origenRegionName && res.data?.region) {
        const found = res.data.region.find(r => (r.nombre || '').toLowerCase().includes(origenRegionName.toLowerCase()) ||
                                                 origenRegionName.toLowerCase().includes((r.nombre || '').toLowerCase()));
        if (found) setSelRegion(found.nombre);
      }
    }).catch(() => {});
    setAnimales(numeroAnimales);
  }, [open, origenRegionName, numeroAnimales]);

  const findMod = (cat, name) => {
    if (!modifiers || !modifiers[cat] || !name) return 1.0;
    const item = modifiers[cat].find(m => m.nombre === name);
    return item ? Number(item.modificador) || 1.0 : 1.0;
  };

  const totalMod = useMemo(() => {
    const r = findMod('region', selRegion);
    const a = findMod('asentamiento', selAsentamiento);
    const rel = findMod('relacion', selRelacion);
    const c = findMod('contexto', selContexto);
    return { r, a, rel, c, total: r * a * rel * c };
  }, [modifiers, selRegion, selAsentamiento, selRelacion, selContexto]);

  const needs = useMemo(() => animalNeeds(terreno, tipoTierra), [terreno, tipoTierra]);

  // Precio final por miembro (humanos) y por animal — TODO en piezas de estaño (me)
  const precioFinalPersonaME = useMemo(() => {
    return (precioRacion + precioAgua) * diasViaje * totalMod.total;
  }, [precioRacion, precioAgua, diasViaje, totalMod.total]);

  const precioFinalAnimalME = useMemo(() => {
    if (animales <= 0) return 0;
    let perAnimal = 0;
    if (needs.needsFood) perAnimal += precioForraje;
    if (needs.needsWater) perAnimal += precioAguaAnimal;
    return perAnimal * diasViaje * animales * totalMod.total;
  }, [animales, needs, precioForraje, precioAguaAnimal, diasViaje, totalMod.total]);

  const precioGrupoAnimalesME = precioFinalAnimalME;

  // Helper: formatea un precio en `me` como string compacto usando la moneda más alta razonable
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

  const rows = useMemo(() => {
    return miembros.map((m) => {
      const char = characters.find((c) => c.id === m.id);
      const dinero = char?.dinero || {};
      const meDisp = coinsToME(dinero);
      const puedeComprar = meDisp >= precioFinalPersonaME;
      return {
        id: m.id,
        nombre: m.nombre,
        char,
        dinero,
        meDisp,
        precioME: precioFinalPersonaME,
        precioFmt: formatPrice(precioFinalPersonaME),
        puedeComprar,
      };
    });
  }, [miembros, characters, precioFinalPersonaME]);

  const comprarPara = async (row) => {
    if (!row.puedeComprar) {
      toast.error(`${row.nombre} no tiene suficientes monedas (necesita ${row.precioFmt}).`);
      return;
    }
    setProcessing(true);
    try {
      const desc = `Pack viaje ${diasViaje}d (×${totalMod.total.toFixed(2)})`;
      // Compramos en piezas de estaño (la moneda más pequeña).
      const halfME = row.precioME / 2;
      await api.post(`/characters/${row.id}/equipment/add`, {
        item_name: `Ración de viaje (${diasViaje} días) — ${desc}`,
        item_category: 'equipo_general',
        cantidad: diasViaje,
        is_purchase: true,
        precio: halfME,
        moneda: 'me',
        peso_kg: PESO_COMIDA_DIA_KG,
      });
      await api.post(`/characters/${row.id}/equipment/add`, {
        item_name: `Odre de agua (${(diasViaje * PESO_AGUA_DIA_KG).toFixed(1)} L)`,
        item_category: 'equipo_general',
        cantidad: 1,
        is_purchase: true,
        precio: halfME,
        moneda: 'me',
        peso_kg: diasViaje * PESO_AGUA_DIA_KG,
      });
      setResultados((prev) => ({ ...prev, [row.id]: 'ok' }));
      toast.success(`${row.nombre} compró por ${row.precioFmt}.`);
      if (onPurchaseComplete) onPurchaseComplete(row.id);
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
      if (row.puedeComprar && resultados[row.id] !== 'ok') {
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="provisions-shop-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
            <ShoppingBag className="w-5 h-5" />
            Comprar Provisiones — {diasViaje} día(s)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Selectores de modificadores */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded bg-black/20 border border-[hsl(var(--gold))]/30">
            <div>
              <Label className="text-xs">Región (auto)</Label>
              <Select value={selRegion} onValueChange={setSelRegion}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-region-select"><SelectValue placeholder="Sin selección" /></SelectTrigger>
                <SelectContent>
                  {(modifiers.region || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>{m.nombre} ({Math.round(m.modificador * 100)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asentamiento</Label>
              <Select value={selAsentamiento} onValueChange={setSelAsentamiento}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-asentamiento-select"><SelectValue placeholder="Sin selección" /></SelectTrigger>
                <SelectContent>
                  {(modifiers.asentamiento || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>{m.nombre} ({Math.round(m.modificador * 100)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Relación con vendedor</Label>
              <Select value={selRelacion} onValueChange={setSelRelacion}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-relacion-select"><SelectValue placeholder="Sin selección" /></SelectTrigger>
                <SelectContent>
                  {(modifiers.relacion || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>{m.nombre} ({Math.round(m.modificador * 100)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contexto histórico</Label>
              <Select value={selContexto} onValueChange={setSelContexto}>
                <SelectTrigger className="h-8 text-xs" data-testid="provisions-contexto-select"><SelectValue placeholder="Sin selección" /></SelectTrigger>
                <SelectContent>
                  {(modifiers.contexto || []).map((m, i) => (
                    <SelectItem key={i} value={m.nombre}>{m.nombre} ({Math.round(m.modificador * 100)}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3 text-xs bg-[hsl(var(--gold))]/10 p-2 rounded">
              <Calculator className="w-4 h-4 text-[hsl(var(--gold))]" />
              <span className="font-mono text-[hsl(var(--gold))]">
                {Math.round(totalMod.r * 100)}% × {Math.round(totalMod.a * 100)}% × {Math.round(totalMod.rel * 100)}% × {Math.round(totalMod.c * 100)}% =
                <strong className="ml-1">{Math.round(totalMod.total * 100)}%</strong>
              </span>
              <span className="text-muted-foreground">
                {totalMod.total > 1 ? '↑ caro' : totalMod.total < 1 ? '↓ barato' : 'normal'}
              </span>
            </div>
          </div>

          {/* Precios base configurables */}
          <details className="bg-black/20 rounded p-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Precios base (me/día, configurables)</summary>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <div>
                <Label className="text-[10px]">Ración / día (me)</Label>
                <Input type="number" step="1" value={precioRacion} onChange={(e) => setPrecioRacion(parseFloat(e.target.value) || 0)} className="h-7 text-xs" data-testid="provisions-base-racion" />
              </div>
              <div>
                <Label className="text-[10px]">Agua / día (me)</Label>
                <Input type="number" step="1" value={precioAgua} onChange={(e) => setPrecioAgua(parseFloat(e.target.value) || 0)} className="h-7 text-xs" data-testid="provisions-base-agua" />
              </div>
              <div>
                <Label className="text-[10px]">Forraje animal / día (me)</Label>
                <Input type="number" step="1" value={precioForraje} onChange={(e) => setPrecioForraje(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">Agua animal / día (me)</Label>
                <Input type="number" step="1" value={precioAguaAnimal} onChange={(e) => setPrecioAguaAnimal(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Catálogo: Ración 5 mc/día (= 50 me) · Agua 1 me/día. 1 mo = 10 mp = 100 mc = 1000 me.
            </p>
          </details>

          {/* Animales */}
          <div className="bg-black/20 rounded p-3 border border-[hsl(var(--torch-orange))]/30" data-testid="provisions-animals-block">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm">🐎 Animales (caballos/ponis):</span>
                <Input
                  type="number"
                  min="0"
                  value={animales}
                  onChange={(e) => setAnimales(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="h-7 w-16 text-sm"
                  data-testid="provisions-animals-count"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Terreno: <strong>{terreno || '?'}</strong> · Tierra: <strong>{tipoTierra || '?'}</strong>
              </div>
            </div>
            {animales > 0 && (
              <div className="mt-2 text-xs">
                {needs.sombraOscuras ? (
                  <p className="text-red-300">
                    ⚠️ Tierras de sombra/oscuras: los animales <strong>requieren</strong> comida y agua siempre.
                  </p>
                ) : needs.needsWater ? (
                  <p className="text-orange-300">Terreno muy difícil: animales necesitan comida + agua.</p>
                ) : needs.needsFood ? (
                  <p className="text-yellow-300">Terreno difícil: animales necesitan comida (no agua extra).</p>
                ) : (
                  <p className="text-green-300">Terreno asequible: los animales pueden pastar y beber por el camino. No hace falta comprar.</p>
                )}
                {(needs.needsFood || needs.needsWater) && (
                  <p className="mt-1 font-mono text-[hsl(var(--torch-orange))]">
                    Coste animales (todo el grupo): <strong>{formatPrice(precioGrupoAnimalesMC)}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tabla por miembro */}
          <ScrollArea className="max-h-[300px] pr-2">
            <div className="space-y-2">
              {rows.map((row) => {
                const estado = resultados[row.id];
                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded border flex items-center justify-between gap-3 ${
                      estado === 'ok' ? 'border-green-500/50 bg-green-500/10' :
                      !row.puedeComprar ? 'border-red-500/40 bg-red-500/10' :
                      'border-muted bg-black/20'
                    }`}
                    data-testid={`provisions-row-${row.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Monedas: {row.dinero.mo || 0} mo · {row.dinero.me || 0} me · {row.dinero.mp || 0} mp · {row.dinero.mc || 0} mc
                        <span className="ml-2 text-[hsl(var(--gold))]">(= {row.mcDisp} mc total)</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono text-[hsl(var(--gold))]">{row.precioFmt}</p>
                      {estado === 'ok' ? (
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
                          disabled={processing}
                          data-testid={`provisions-buy-${row.id}`}
                        >
                          Comprar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} data-testid="provisions-close-btn">Cerrar</Button>
          <Button
            onClick={comprarTodos}
            disabled={processing || rows.every((r) => !r.puedeComprar || resultados[r.id] === 'ok')}
            className="bg-[hsl(var(--gold))] text-black hover:brightness-110"
            data-testid="provisions-buy-all-btn"
          >
            {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShoppingBag className="w-4 h-4 mr-2" />}
            Comprar todo el grupo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
