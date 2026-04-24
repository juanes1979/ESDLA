/**
 * ProvisionsShopDialog — Compra de provisiones para el viaje.
 *
 * Cada miembro compra su propio pack "ración + agua" por día de viaje:
 * - 1 ración de viaje: 0.45 kg
 * - 3.79 L de agua (1 galón): ~3.79 kg
 * - Precio por pack/día: configurable por el Maestro (por región)
 * Descuenta las monedas del PJ (prioridad: cobre → plata → electrum → oro → platino),
 * y añade el peso al inventario mediante /characters/{id}/equipment/add (is_purchase=True).
 *
 * Si el PJ no tiene suficientes monedas, NO puede comprar — el Maestro deberá
 * decidir si le presta el grupo o se sale de viaje sin provisiones completas.
 */
import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBag, Utensils, Droplets, Coins, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// Peso por día (kg). Humanoide mediano/pequeño en clima templado.
const PESO_COMIDA_DIA_KG = 0.45;
const PESO_AGUA_DIA_KG = 3.79;
const PESO_PACK_DIA = PESO_COMIDA_DIA_KG + PESO_AGUA_DIA_KG;

// Convierte monedas a piezas de cobre (unidad base)
const coinsToPC = (dinero = {}) => {
  const pc = Number(dinero.pc || 0);
  const pp = Number(dinero.pp || 0);
  const pe = Number(dinero.pe || 0);
  const po = Number(dinero.po || 0);
  const ppl = Number(dinero.ppl || 0);
  return pc + pp * 10 + pe * 50 + po * 100 + ppl * 1000;
};

export default function ProvisionsShopDialog({
  open,
  onClose,
  miembros = [],
  characters = [],
  diasViaje = 1,
  onPurchaseComplete,
}) {
  const [precioPP, setPrecioPP] = useState(5); // 5 pp por pack/día por defecto (Maestro puede ajustar por región)
  const [processing, setProcessing] = useState(false);
  const [resultados, setResultados] = useState({});

  const totalPackKgPorMiembro = diasViaje * PESO_PACK_DIA;
  const precioPCTotal = precioPP * 10 * diasViaje; // pp → pc

  const rows = useMemo(() => {
    return miembros.map((m) => {
      const char = characters.find((c) => c.id === m.id);
      const dinero = char?.dinero || {};
      const pcDisp = coinsToPC(dinero);
      const puedeComprar = pcDisp >= precioPCTotal;
      return {
        id: m.id,
        nombre: m.nombre,
        char,
        dinero,
        pcDisp,
        puedeComprar,
      };
    });
  }, [miembros, characters, precioPCTotal]);

  const comprarPara = async (row) => {
    if (!row.puedeComprar) {
      toast.error(`${row.nombre} no tiene suficientes monedas.`);
      return;
    }
    setProcessing(true);
    try {
      // Añadir las raciones
      await api.post(`/characters/${row.id}/equipment/add`, {
        item_name: `Ración de viaje (${diasViaje} días)`,
        item_category: 'equipo_general',
        cantidad: diasViaje,
        is_purchase: true,
        precio: (precioPP * diasViaje) / 2, // mitad del pack
        moneda: 'pp',
        peso_kg: PESO_COMIDA_DIA_KG,
      });
      // Añadir el odre de agua (1 por todo el viaje, recargable)
      await api.post(`/characters/${row.id}/equipment/add`, {
        item_name: `Odre de agua (${(diasViaje * PESO_AGUA_DIA_KG).toFixed(1)} L)`,
        item_category: 'equipo_general',
        cantidad: 1,
        is_purchase: true,
        precio: (precioPP * diasViaje) / 2,
        moneda: 'pp',
        peso_kg: diasViaje * PESO_AGUA_DIA_KG,
      });
      setResultados((prev) => ({ ...prev, [row.id]: 'ok' }));
      toast.success(`${row.nombre} compró su pack de ${diasViaje} día(s).`);
      if (onPurchaseComplete) onPurchaseComplete(row.id);
    } catch (err) {
      console.error(err);
      setResultados((prev) => ({ ...prev, [row.id]: 'error' }));
      toast.error(`Error comprando para ${row.nombre}: ${err.response?.data?.detail || err.message}`);
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-2xl" data-testid="provisions-shop-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--gold))]">
            <ShoppingBag className="w-5 h-5" />
            Comprar Provisiones — {diasViaje} día(s)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Config del Maestro: precio por día del pack */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded bg-black/20 border border-[hsl(var(--gold))]/30">
            <div>
              <Label className="text-xs">Precio pack / día (pp)</Label>
              <Input
                type="number"
                min="1"
                value={precioPP}
                onChange={(e) => setPrecioPP(Math.max(1, parseInt(e.target.value, 10) || 1))}
                data-testid="provisions-price-input"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Ajusta según región (Bree, Rivendel, tierras salvajes, etc.).
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Por miembro</p>
              <p className="text-sm">
                <Utensils className="w-3 h-3 inline mr-1 text-orange-400" />
                {diasViaje} ración(es) · <strong>{(diasViaje * PESO_COMIDA_DIA_KG).toFixed(2)} kg</strong>
              </p>
              <p className="text-sm">
                <Droplets className="w-3 h-3 inline mr-1 text-blue-400" />
                {(diasViaje * PESO_AGUA_DIA_KG).toFixed(1)} L · <strong>{(diasViaje * PESO_AGUA_DIA_KG).toFixed(1)} kg</strong>
              </p>
              <p className="text-sm font-bold text-[hsl(var(--gold))] mt-1">
                <Coins className="w-3 h-3 inline mr-1" />
                Coste: {precioPP * diasViaje} pp ({totalPackKgPorMiembro.toFixed(2)} kg)
              </p>
            </div>
          </div>

          {/* Tabla por miembro */}
          <ScrollArea className="max-h-[400px] pr-2">
            <div className="space-y-2">
              {rows.map((row) => {
                const estado = resultados[row.id];
                return (
                  <div
                    key={row.id}
                    className={`p-3 rounded border flex items-center justify-between gap-3 ${
                      estado === 'ok'
                        ? 'border-green-500/50 bg-green-500/10'
                        : !row.puedeComprar
                        ? 'border-red-500/40 bg-red-500/10'
                        : 'border-muted bg-black/20'
                    }`}
                    data-testid={`provisions-row-${row.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{row.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Monedas: {row.dinero.po || 0} po · {row.dinero.pe || 0} pe · {row.dinero.pp || 0} pp · {row.dinero.pc || 0} pc
                        <span className="ml-2 text-[hsl(var(--gold))]">
                          (= {row.pcDisp} pc total)
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      {estado === 'ok' ? (
                        <Badge className="bg-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Comprado
                        </Badge>
                      ) : !row.puedeComprar ? (
                        <Badge variant="outline" className="text-red-400">
                          <XCircle className="w-3 h-3 mr-1" />
                          Sin fondos
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
          <Button variant="outline" onClick={onClose} data-testid="provisions-close-btn">
            Cerrar
          </Button>
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
