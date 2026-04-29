/**
 * ShadowDefectsCard
 * Defectos de la Sombra que el personaje ha sufrido.
 *
 * Reglas (acordadas con el usuario):
 *  • El catálogo viene de la senda asignada al personaje (`/api/data/sombra`,
 *    campo `sendas_sombra` filtrado por `senda` == `character.senda_sombra`).
 *  • Una vez registrado, el defecto NO se borra a la ligera.
 *  • Por cada defecto: nombre + descripción auto-rellenada + cuadro libre
 *    de contexto (cuándo, campaña, por qué).
 *  • Se puede añadir cualquier defecto del catálogo a posteriori.
 */
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skull, Plus, X, Calendar, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const ShadowDefectsCard = ({ character, onUpdate }) => {
  const [catalogo, setCatalogo] = useState([]);  // [{nombre, descripcion, efecto_juego}]
  const [seleccion, setSeleccion] = useState('');
  const [contexto, setContexto] = useState('');
  const [campana, setCampana] = useState('');
  const [loading, setLoading] = useState(false);
  const sendaPersonaje = (character?.senda_sombra || '').trim();
  const defectosActuales = character?.defectos_sombra || [];

  // Carga el catálogo de defectos para la senda del personaje.
  useEffect(() => {
    let alive = true;
    api.get('/data/sombra').then(res => {
      if (!alive) return;
      const sendas = res.data?.sendas_sombra || [];
      // Si no hay senda en el personaje, mostramos TODO el catálogo
      // (el DJ podría asignar un defecto de cualquier senda excepcionalmente).
      const filtered = sendaPersonaje
        ? sendas.filter(s => (s.senda || '').toUpperCase() === sendaPersonaje.toUpperCase())
        : sendas;
      // Deduplicar por nombre
      const dedup = [];
      const seen = new Set();
      for (const s of filtered) {
        const key = (s.defecto || '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        dedup.push({
          nombre: s.defecto,
          descripcion: s.descripcion || '',
          efecto_juego: s.efecto_juego || '',
          senda: s.senda,
          ocupacion: s.ocupacion,
        });
      }
      setCatalogo(dedup);
    }).catch(() => setCatalogo([]));
    return () => { alive = false; };
  }, [sendaPersonaje]);

  const seleccionInfo = useMemo(
    () => catalogo.find(c => c.nombre === seleccion),
    [seleccion, catalogo]
  );

  const persist = async (next) => {
    setLoading(true);
    try {
      const res = await api.patch(`/characters/${character.id}`, { defectos_sombra: next });
      if (onUpdate) onUpdate(res.data);
    } catch (e) {
      toast.error('No se pudo guardar el defecto.');
    } finally {
      setLoading(false);
    }
  };

  const addDefecto = async () => {
    if (!seleccion || !seleccionInfo) {
      toast.error('Selecciona un defecto del catálogo.');
      return;
    }
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nombre: seleccionInfo.nombre,
      descripcion: seleccionInfo.descripcion,
      efecto_juego: seleccionInfo.efecto_juego,
      senda: seleccionInfo.senda,
      contexto: (contexto || '').trim(),
      campana: (campana || '').trim(),
      fecha: new Date().toISOString(),
    };
    const next = [...defectosActuales, entry];
    await persist(next);
    toast.success(`Defecto registrado: ${entry.nombre}`);
    setSeleccion('');
    setContexto('');
    setCampana('');
  };

  const removeDefecto = async (idx) => {
    if (!confirm('¿Borrar este defecto del historial? (esta acción debería ser excepcional)')) return;
    const next = defectosActuales.filter((_, i) => i !== idx);
    await persist(next);
    toast.success('Defecto eliminado.');
  };

  return (
    <Card className="card-parchment border border-purple-500/30" data-testid="shadow-defects-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-purple-300 flex items-center gap-2">
          <Skull className="w-5 h-5" /> Defectos de la Sombra
          {sendaPersonaje && (
            <Badge variant="outline" className="ml-2 border-purple-500/50 text-purple-300">
              Senda: {sendaPersonaje}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground italic">
          Defectos que se activan al sucumbir a la Sombra. El registro es
          permanente; sólo se borra excepcionalmente. El DJ los añade desde
          la pantalla de juego o a posteriori desde aquí.
        </p>

        {/* Lista de defectos registrados */}
        <div className="space-y-2" data-testid="shadow-defects-list">
          {defectosActuales.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              Sin defectos registrados.
            </p>
          )}
          {defectosActuales.map((d, i) => (
            <div
              key={d.id || i}
              className="bg-purple-950/20 border border-purple-500/30 p-3 rounded space-y-1"
              data-testid={`shadow-defect-item-${i}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-bold text-purple-300">{d.nombre}</p>
                  {d.senda && (
                    <p className="text-[10px] text-muted-foreground">
                      Senda: {d.senda}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.fecha && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(d.fecha).toLocaleDateString('es-ES')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDefecto(i)}
                    className="h-6 w-6 p-0 text-red-400/70 hover:text-red-400"
                    data-testid={`remove-defect-${i}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {d.descripcion && (
                <p className="text-xs text-muted-foreground">{d.descripcion}</p>
              )}
              {d.efecto_juego && (
                <p className="text-xs text-purple-200/80 italic">
                  Efecto: {d.efecto_juego}
                </p>
              )}
              {(d.contexto || d.campana) && (
                <div className="mt-2 pt-2 border-t border-purple-500/20 text-xs">
                  {d.campana && (
                    <p><span className="text-purple-300/70">Campaña:</span> {d.campana}</p>
                  )}
                  {d.contexto && (
                    <p className="whitespace-pre-wrap">
                      <span className="text-purple-300/70">Contexto:</span> {d.contexto}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Añadir nuevo defecto */}
        <div className="border-t border-purple-500/20 pt-3 space-y-2">
          <Label className="text-xs text-purple-300">Añadir defecto al historial</Label>
          <Select value={seleccion} onValueChange={setSeleccion}>
            <SelectTrigger data-testid="defect-select">
              <SelectValue placeholder={
                catalogo.length === 0
                  ? (sendaPersonaje
                      ? `Sin catálogo para la senda "${sendaPersonaje}"`
                      : 'Personaje sin senda asignada')
                  : `Elige un defecto (${catalogo.length} disponibles)`
              } />
            </SelectTrigger>
            <SelectContent>
              {catalogo.map(c => (
                <SelectItem key={c.nombre} value={c.nombre} data-testid={`defect-option-${c.nombre}`}>
                  {c.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {seleccionInfo && (
            <div className="bg-black/30 p-2 rounded border border-purple-500/20 text-xs space-y-1">
              {seleccionInfo.descripcion && (
                <p className="text-muted-foreground">{seleccionInfo.descripcion}</p>
              )}
              {seleccionInfo.efecto_juego && (
                <p className="text-purple-200/80 italic">Efecto: {seleccionInfo.efecto_juego}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Campaña</Label>
              <input
                value={campana}
                onChange={e => setCampana(e.target.value)}
                placeholder="Nombre de la campaña"
                className="w-full bg-black/20 border border-border/40 rounded px-2 py-1 text-xs"
                data-testid="defect-campana-input"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Contexto (cuándo, por qué…)</Label>
            <Textarea
              value={contexto}
              onChange={e => setContexto(e.target.value)}
              placeholder="Tras el ataque del balrog, al ver caer a su mentor…"
              rows={2}
              className="text-xs"
              data-testid="defect-contexto-input"
            />
          </div>

          <Button
            onClick={addDefecto}
            disabled={!seleccion || loading}
            size="sm"
            className="w-full bg-purple-700 hover:bg-purple-600"
            data-testid="add-defect-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            Registrar defecto
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShadowDefectsCard;
