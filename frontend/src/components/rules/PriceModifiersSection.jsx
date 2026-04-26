/**
 * Price Modifiers Section — admin editable.
 * Each row has the modifier as a percentage that the maestro can edit inline.
 * Saves via PUT /api/data/modificadores-precio/{category}/{index}.
 */
import { useState, useEffect, useCallback } from 'react';
import { Coins, MapPin, Users, User, BookOpen, Save, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import { useUser } from '@/contexts/UserContext';

const PriceModifiersSection = ({ data: dataProp }) => {
  const { isAdmin } = useUser();
  const [data, setData] = useState(dataProp || null);
  const [drafts, setDrafts] = useState({}); // { "region:0": {nombre, modificador, descripcion} }
  const [savingKey, setSavingKey] = useState(null);

  // Sync from prop on first mount
  useEffect(() => { if (dataProp && !data) setData(dataProp); }, [dataProp, data]);

  const reload = useCallback(async () => {
    try {
      const res = await api.get('/data/modificadores-precio');
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const formatModifier = (mod) => {
    const percent = Math.round((mod ?? 1) * 100);
    const diff = percent - 100;
    return `${percent}% (${diff >= 0 ? '+' : ''}${diff}%)`;
  };

  const getModifierColor = (mod) => {
    if (mod < 1) return 'text-green-400';
    if (mod > 1) return 'text-red-400';
    return 'text-muted-foreground';
  };

  const draftKey = (cat, i) => `${cat}:${i}`;

  const setDraft = (cat, i, item) => {
    setDrafts(prev => ({ ...prev, [draftKey(cat, i)]: item }));
  };

  const isDirty = (cat, i, original) => {
    const k = draftKey(cat, i);
    if (!(k in drafts)) return false;
    const d = drafts[k];
    return (
      d.nombre !== original.nombre ||
      Number(d.modificador) !== Number(original.modificador) ||
      (d.descripcion || '') !== (original.descripcion || '')
    );
  };

  const save = async (cat, i) => {
    const k = draftKey(cat, i);
    const d = drafts[k];
    if (!d) return;
    setSavingKey(k);
    try {
      await api.put(`/data/modificadores-precio/${cat}/${i}`, {
        nombre: d.nombre,
        modificador: Number(d.modificador),
        descripcion: d.descripcion || '',
      });
      toast.success(`Modificador "${d.nombre}" guardado`);
      setDrafts(prev => { const n = { ...prev }; delete n[k]; return n; });
      await reload();
    } catch (err) {
      toast.error('Error al guardar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingKey(null);
    }
  };

  const addRow = async (cat) => {
    try {
      await api.post(`/data/modificadores-precio/${cat}`, {
        nombre: 'Nuevo modificador',
        modificador: 1.0,
        descripcion: '',
      });
      toast.success('Fila añadida');
      await reload();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const deleteRow = async (cat, i, name) => {
    if (!confirm(`¿Eliminar "${name}" de ${cat}?`)) return;
    try {
      await api.delete(`/data/modificadores-precio/${cat}/${i}`);
      toast.success('Eliminado');
      await reload();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  if (!data) return <p className="text-muted-foreground">No hay modificadores de precio cargados</p>;

  const renderTable = (cat, items, title, icon, colorClass, description) => {
    if (!items) return null;
    return (
      <div className="card-parchment rounded-lg p-4" data-testid={`price-mod-${cat}`}>
        <div className="flex justify-between items-center mb-2">
          <h4 className={`font-heading text-lg ${colorClass} flex items-center gap-2`}>{icon} {title}</h4>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => addRow(cat)} data-testid={`price-mod-add-${cat}`}>
              <Plus className="w-3 h-3 mr-1" /> Añadir
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2 w-1/4">{title.split(' ').pop()}</th>
                <th className="text-center py-2 px-2 w-32">Modificador</th>
                <th className="text-left py-2 px-2">Descripción</th>
                {isAdmin && <th className="w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((m, i) => {
                const k = draftKey(cat, i);
                const d = drafts[k] || m;
                const dirty = isDirty(cat, i, m);
                return (
                  <tr key={i} className="border-b border-border/10 hover:bg-black/5">
                    <td className="py-1 px-2">
                      {isAdmin ? (
                        <Input
                          value={d.nombre}
                          onChange={(e) => setDraft(cat, i, { ...d, nombre: e.target.value })}
                          className="h-7 text-sm"
                          data-testid={`price-mod-${cat}-${i}-name`}
                        />
                      ) : (
                        <span className="font-medium">{m.nombre}</span>
                      )}
                    </td>
                    <td className="text-center py-1 px-2">
                      {isAdmin ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={Math.round((d.modificador ?? 1) * 100)}
                            onChange={(e) => setDraft(cat, i, { ...d, modificador: (parseFloat(e.target.value) || 100) / 100 })}
                            className="h-7 w-16 text-sm text-center"
                            data-testid={`price-mod-${cat}-${i}-pct`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <span className={`font-mono font-bold ${getModifierColor(m.modificador)}`}>
                          {formatModifier(m.modificador)}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-xs text-muted-foreground">
                      {isAdmin ? (
                        <Input
                          value={d.descripcion || ''}
                          onChange={(e) => setDraft(cat, i, { ...d, descripcion: e.target.value })}
                          placeholder="(opcional)"
                          className="h-7 text-xs"
                        />
                      ) : (
                        m.descripcion
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-1 px-2 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant={dirty ? 'default' : 'ghost'}
                            disabled={!dirty || savingKey === k}
                            onClick={() => save(cat, i)}
                            data-testid={`price-mod-${cat}-${i}-save`}
                            className="h-7 px-2"
                          >
                            {savingKey === k ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : dirty ? (
                              <Save className="w-3 h-3" />
                            ) : (
                              <Check className="w-3 h-3 opacity-50" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRow(cat, i, m.nombre)}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            data-testid={`price-mod-${cat}-${i}-delete`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="price-modifiers-section">
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-xl text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Modificadores de Precio
          {isAdmin && <span className="text-xs text-muted-foreground ml-auto">(Editable como Maestro)</span>}
        </h3>
        <p className="text-sm text-muted-foreground mb-2">
          Estos modificadores afectan al precio base de los artículos al comprar equipamiento.
          Los modificadores se multiplican entre sí para calcular el precio final.
        </p>
        <p className="text-[hsl(var(--magic-blue))] text-xs">
          Ejemplo: Un artículo de 100mp en Bosque Negro (115%) + Aldea pequeña (115%) = 100 × 1.15 × 1.15 = 132.25mp
        </p>
      </div>

      {renderTable('region', data.region, 'Por Región', <MapPin className="w-4 h-4" />, 'text-[hsl(var(--gold))]', 'El coste de vida y disponibilidad varían según la región de la Tierra Media.')}
      {renderTable('asentamiento', data.asentamiento, 'Por Tipo de Asentamiento', <Users className="w-4 h-4" />, 'text-[hsl(var(--torch-orange))]', 'El tamaño del asentamiento afecta la disponibilidad y precios.')}
      {renderTable('relacion', data.relacion, 'Por Relación con el Vendedor', <User className="w-4 h-4" />, 'text-[hsl(var(--magic-blue))]', 'La relación personal del personaje con el vendedor puede mejorar o empeorar los precios.')}
      {renderTable('contexto', data.contexto, 'Por Contexto Histórico', <BookOpen className="w-4 h-4" />, 'text-destructive', 'Eventos y circunstancias históricas que afectan el comercio.')}
    </div>
  );
};

export default PriceModifiersSection;
