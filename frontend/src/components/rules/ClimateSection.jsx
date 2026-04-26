/**
 * Climate Section
 * Manages 18 climate regions (12 months x 16 fields each) + per-location field-level overrides.
 * Inheritance: location -> climate region (via match keywords) -> base + overrides.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { CloudSun, Snowflake, MapPin, Save, Trash2, RotateCcw, Loader2, ChevronDown, ChevronUp, Search, AlertCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import api from '@/services/api';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_FULL = {
  Ene: 'Nénimë (Ene)', Feb: 'Súlimë (Feb)', Mar: 'Coiviennë (Mar)', Abr: 'Víressë (Abr)',
  May: 'Lótessë (May)', Jun: 'Nárië (Jun)', Jul: 'Cermië (Jul)', Ago: 'Urimë (Ago)',
  Sep: 'Yavannië (Sep)', Oct: 'Narquelië (Oct)', Nov: 'Hísimë (Nov)', Dic: 'Ringarë (Dic)'
};

// Field definitions: key, label, type, format
const FIELDS = [
  { key: 'temp_min', label: 'T. Mín (°C)', type: 'number', step: 0.1 },
  { key: 'temp_max', label: 'T. Máx (°C)', type: 'number', step: 0.1 },
  { key: 'temp_media', label: 'T. Media (°C)', type: 'number', step: 0.1 },
  { key: 'ext_min', label: 'Ext. Mín', type: 'number', step: 0.1 },
  { key: 'ext_max', label: 'Ext. Máx', type: 'number', step: 0.1 },
  { key: 'viento_kmh', label: 'Viento km/h', type: 'number', step: 0.1 },
  { key: 'dir_viento', label: 'Dir. Viento', type: 'text' },
  { key: 'lluvias_mm', label: 'Lluvia (mm)', type: 'number', step: 1 },
  { key: 'pct_lluvia', label: '% Lluvia', type: 'number', step: 1 },
  { key: 'pct_tormenta', label: '% Tormenta', type: 'number', step: 1 },
  { key: 'horas_sol', label: 'Horas Sol', type: 'number', step: 0.1 },
  { key: 'pct_calima', label: '% Calima', type: 'number', step: 1 },
  { key: 'pct_nieve_helada', label: '% Nieve/Helada', type: 'number', step: 1 },
  { key: 'pct_niebla', label: '% Niebla', type: 'number', step: 1 },
  { key: 'notas_extremas', label: 'Notas extremas', type: 'text' },
];

// ----- Icon picker (shared with backend logic) -----
function pickIcon(m) {
  if (!m) return { icon: '❓', label: 'Sin datos' };
  const nieve = +m.pct_nieve_helada || 0;
  const lluvia = +m.pct_lluvia || 0;
  const tormenta = +m.pct_tormenta || 0;
  const calima = +m.pct_calima || 0;
  const niebla = +m.pct_niebla || 0;
  const sol = +m.horas_sol || 0;
  const tmax = m.temp_max ?? 99;
  if (nieve >= 30 || tmax < 0) return { icon: '❄️', label: 'Nieve' };
  if (tormenta >= 25) return { icon: '⛈️', label: 'Tormenta' };
  if (lluvia + tormenta >= 40) return { icon: '🌧️', label: 'Lluvia' };
  if (calima >= 30) return { icon: '🌫️', label: 'Calima' };
  if (niebla >= 35) return { icon: '🌫️', label: 'Niebla' };
  if (sol >= 9 && lluvia < 25 && niebla < 20) return { icon: '☀️', label: 'Despejado' };
  return { icon: '☁️', label: 'Nublado' };
}

const ClimateSection = () => {
  const [tab, setTab] = useState('regions'); // 'regions' | 'overrides'
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [draft, setDraft] = useState({}); // local edits keyed by `${mes}.${field}`
  const [savingRegion, setSavingRegion] = useState(false);
  const [keywordsDraft, setKeywordsDraft] = useState('');

  // Overrides tab state
  const [locations, setLocations] = useState([]);
  const [locFilter, setLocFilter] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [effective, setEffective] = useState(null);
  const [overrideDraft, setOverrideDraft] = useState({}); // { mes: { field: value } }
  const [savingOverride, setSavingOverride] = useState(false);

  const loadRegions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/climate/regions');
      const list = res.data?.regions || [];
      setRegions(list);
      if (!selectedRegionId && list.length) setSelectedRegionId(list[0].id);
    } catch (err) {
      toast.error('Error cargando regiones de clima');
    } finally {
      setLoading(false);
    }
  }, [selectedRegionId]);

  useEffect(() => {
    loadRegions();
    // Pre-load locations list for overrides tab
    api.get('/data/locations').then(r => {
      setLocations((r.data?.locations || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
    }).catch(() => {});
  }, [loadRegions]);

  // When region selection changes, reset draft & keyword editor
  useEffect(() => {
    setDraft({});
    const r = regions.find(x => x.id === selectedRegionId);
    setKeywordsDraft(((r?.match_keywords) || []).join(', '));
  }, [selectedRegionId, regions]);

  const selectedRegion = useMemo(
    () => regions.find(r => r.id === selectedRegionId),
    [regions, selectedRegionId]
  );

  // Build hierarchy for sidebar (parents first, then children indented)
  const hierarchicalRegions = useMemo(() => {
    const parents = regions.filter(r => !r.parent_id);
    const children = regions.filter(r => r.parent_id);
    const out = [];
    parents.forEach(p => {
      out.push({ ...p, _depth: 0 });
      children.filter(c => c.parent_id === p.id).forEach(c => out.push({ ...c, _depth: 1 }));
    });
    // Append any orphan children at the end
    children.filter(c => !parents.some(p => p.id === c.parent_id)).forEach(c => {
      out.push({ ...c, _depth: 0 });
    });
    return out;
  }, [regions]);

  const handleSeed = async () => {
    if (!confirm('Esto reemplazará TODA la información de clima con los datos del Excel original. ¿Continuar?')) return;
    setSeeding(true);
    try {
      const res = await api.post('/climate/seed?force=true');
      toast.success(res.data?.message || 'Re-cargado');
      await loadRegions();
    } catch (err) {
      toast.error('Error al cargar datos: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSeeding(false);
    }
  };

  const handleCellChange = (mes, field, value) => {
    setDraft(prev => ({ ...prev, [`${mes}.${field}`]: value }));
  };

  const getCellValue = (mes, field) => {
    const k = `${mes}.${field}`;
    if (k in draft) return draft[k];
    return selectedRegion?.meses?.[mes]?.[field] ?? '';
  };

  const handleSaveRegion = async () => {
    if (!selectedRegion || Object.keys(draft).length === 0) {
      toast.info('No hay cambios para guardar');
      return;
    }
    setSavingRegion(true);
    try {
      // Group draft by month
      const mesesPayload = {};
      Object.entries(draft).forEach(([k, v]) => {
        const [mes, field] = k.split('.');
        if (!mesesPayload[mes]) mesesPayload[mes] = {};
        const fieldDef = FIELDS.find(f => f.key === field);
        mesesPayload[mes][field] = (fieldDef?.type === 'number' && v !== '') ? parseFloat(v) : v;
      });
      await api.put(`/climate/regions/${selectedRegion.id}`, { meses: mesesPayload });
      toast.success(`${selectedRegion.nombre}: ${Object.keys(draft).length} celdas guardadas`);
      setDraft({});
      await loadRegions();
    } catch (err) {
      toast.error('Error al guardar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingRegion(false);
    }
  };

  const handleSaveKeywords = async () => {
    if (!selectedRegion) return;
    const list = keywordsDraft.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await api.put(`/climate/regions/${selectedRegion.id}`, { match_keywords: list });
      toast.success('Keywords guardadas');
      await loadRegions();
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  // ===== OVERRIDES TAB =====
  const loadEffective = useCallback(async (locId) => {
    if (!locId) { setEffective(null); setOverrideDraft({}); return; }
    try {
      const res = await api.get(`/climate/effective/${locId}`);
      setEffective(res.data);
      setOverrideDraft(res.data?.overrides || {});
    } catch (err) {
      toast.error('Error cargando clima efectivo');
    }
  }, []);

  useEffect(() => {
    if (selectedLocationId) loadEffective(selectedLocationId);
  }, [selectedLocationId, loadEffective]);

  const filteredLocations = useMemo(() => {
    if (!locFilter) return locations.slice(0, 200);
    const q = locFilter.toLowerCase();
    return locations.filter(l =>
      (l.nombre || '').toLowerCase().includes(q) ||
      (l.region || '').toLowerCase().includes(q)
    ).slice(0, 200);
  }, [locations, locFilter]);

  const handleOverrideChange = (mes, field, value) => {
    setOverrideDraft(prev => {
      const next = { ...prev, [mes]: { ...(prev[mes] || {}) } };
      if (value === '' || value === null) {
        delete next[mes][field];
        if (Object.keys(next[mes]).length === 0) delete next[mes];
      } else {
        const fd = FIELDS.find(f => f.key === field);
        next[mes][field] = fd?.type === 'number' ? parseFloat(value) : value;
      }
      return next;
    });
  };

  const handleSaveOverride = async () => {
    if (!selectedLocationId) return;
    setSavingOverride(true);
    try {
      await api.put(`/climate/locations/${selectedLocationId}/override`, { overrides: overrideDraft });
      toast.success('Overrides guardados');
      await loadEffective(selectedLocationId);
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingOverride(false);
    }
  };

  const handleClearAllOverrides = async () => {
    if (!selectedLocationId) return;
    if (!confirm('¿Eliminar TODOS los overrides de esta ubicación? Heredará 100% de su región.')) return;
    try {
      await api.delete(`/climate/locations/${selectedLocationId}/override`);
      toast.success('Overrides eliminados');
      await loadEffective(selectedLocationId);
    } catch (err) {
      toast.error('Error: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleClearCellOverride = (mes, field) => {
    setOverrideDraft(prev => {
      const next = { ...prev, [mes]: { ...(prev[mes] || {}) } };
      delete next[mes][field];
      if (Object.keys(next[mes] || {}).length === 0) delete next[mes];
      return next;
    });
  };

  // ============= RENDER =============
  return (
    <div className="space-y-4" data-testid="climate-section">
      {/* Header */}
      <div className="card-parchment rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudSun className="w-6 h-6 text-[hsl(var(--magic-blue))]" />
          <div>
            <h2 className="font-heading text-xl text-[hsl(var(--gold))]">Sistema de Clima</h2>
            <p className="text-xs text-muted-foreground">
              {regions.length} regiones × 12 meses × {FIELDS.length} campos. Las ubicaciones heredan de su región y pueden sobrescribir campos puntuales.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSeed}
          disabled={seeding}
          data-testid="climate-seed-btn"
        >
          {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
          Recargar datos del Excel
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border/30">
        <button
          onClick={() => setTab('regions')}
          className={`px-4 py-2 text-sm transition-colors ${tab === 'regions' ? 'text-[hsl(var(--gold))] border-b-2 border-[hsl(var(--gold))]' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="climate-tab-regions"
        >
          Regiones (Plantillas)
        </button>
        <button
          onClick={() => setTab('overrides')}
          className={`px-4 py-2 text-sm transition-colors ${tab === 'overrides' ? 'text-[hsl(var(--gold))] border-b-2 border-[hsl(var(--gold))]' : 'text-muted-foreground hover:text-foreground'}`}
          data-testid="climate-tab-overrides"
        >
          Overrides por Ubicación
        </button>
      </div>

      {tab === 'regions' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3 card-parchment rounded-lg p-2 max-h-[70vh] overflow-y-auto" data-testid="climate-region-list">
            {loading && <div className="p-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div>}
            {hierarchicalRegions.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRegionId(r.id)}
                data-testid={`climate-region-item-${r.id}`}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedRegionId === r.id ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]' : 'hover:bg-black/20'} ${r._depth > 0 ? 'pl-8 text-xs italic' : 'font-medium'}`}
              >
                {r._depth > 0 && '↳ '}
                {r.nombre}
              </button>
            ))}
          </div>

          {/* Matrix */}
          <div className="col-span-12 md:col-span-9 card-parchment rounded-lg p-4">
            {!selectedRegion ? (
              <p className="text-sm text-muted-foreground text-center py-8">Selecciona una región</p>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{selectedRegion.nombre}</h3>
                    {selectedRegion.parent_climate_name && (
                      <p className="text-xs text-muted-foreground">
                        Sub-clima dentro de <span className="text-[hsl(var(--magic-blue))]">{selectedRegion.parent_climate_name}</span>
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveRegion}
                    disabled={savingRegion || Object.keys(draft).length === 0}
                    size="sm"
                    className="bg-[hsl(var(--gold))]/20 hover:bg-[hsl(var(--gold))]/30 text-[hsl(var(--gold))]"
                    data-testid="climate-save-region-btn"
                  >
                    {savingRegion ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar cambios ({Object.keys(draft).length})
                  </Button>
                </div>

                {/* Match keywords editor */}
                <div className="mb-4 p-3 bg-black/20 rounded">
                  <label className="text-xs text-muted-foreground">
                    Keywords (regiones/sub-regiones de las ubicaciones que se mapean a este clima — separadas por coma):
                  </label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={keywordsDraft}
                      onChange={(e) => setKeywordsDraft(e.target.value)}
                      placeholder="Eriador, La Comarca, Arthedain…"
                      className="text-xs"
                      data-testid="climate-keywords-input"
                    />
                    <Button size="sm" onClick={handleSaveKeywords} variant="outline" data-testid="climate-save-keywords-btn">
                      Guardar keywords
                    </Button>
                  </div>
                </div>

                {/* Climate Matrix */}
                <div className="overflow-x-auto" data-testid="climate-matrix">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-1 sticky left-0 bg-[hsl(var(--background))] z-10 border-b border-border/30">Mes</th>
                        <th className="text-center p-1 border-b border-border/30">Icono</th>
                        {FIELDS.map(f => (
                          <th key={f.key} className="text-left p-1 border-b border-border/30 whitespace-nowrap text-[hsl(var(--gold))]/80">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map(mes => {
                        const mData = selectedRegion.meses?.[mes] || {};
                        // Build merged view including draft for icon preview
                        const merged = { ...mData };
                        Object.entries(draft).forEach(([k, v]) => {
                          const [m, fld] = k.split('.');
                          if (m === mes) {
                            const fd = FIELDS.find(f => f.key === fld);
                            merged[fld] = fd?.type === 'number' ? parseFloat(v) : v;
                          }
                        });
                        const ic = pickIcon(merged);
                        return (
                          <tr key={mes} className="hover:bg-black/10">
                            <td className="p-1 sticky left-0 bg-[hsl(var(--background))] z-10 font-medium text-[hsl(var(--torch-orange))] whitespace-nowrap border-b border-border/10">
                              {MONTH_FULL[mes]}
                            </td>
                            <td className="text-center text-lg p-1 border-b border-border/10" title={ic.label}>
                              {ic.icon}
                            </td>
                            {FIELDS.map(f => {
                              const k = `${mes}.${f.key}`;
                              const isDirty = k in draft;
                              return (
                                <td key={f.key} className="p-1 border-b border-border/10">
                                  <input
                                    type={f.type}
                                    step={f.step}
                                    value={getCellValue(mes, f.key)}
                                    onChange={(e) => handleCellChange(mes, f.key, e.target.value)}
                                    className={`w-full px-1 py-0.5 text-xs bg-black/20 border rounded ${isDirty ? 'border-[hsl(var(--torch-orange))]' : 'border-border/20'}`}
                                    style={{ minWidth: f.type === 'text' ? 120 : 60 }}
                                    data-testid={`climate-cell-${mes}-${f.key}`}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-[11px] text-muted-foreground">
                  Los iconos se calculan automáticamente desde los porcentajes (nieve, lluvia, tormenta, calima, niebla, sol). Cambia los % y se actualizarán al guardar.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'overrides' && (
        <div className="grid grid-cols-12 gap-4">
          {/* Locations */}
          <div className="col-span-12 md:col-span-3 card-parchment rounded-lg p-3 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input
                value={locFilter}
                onChange={(e) => setLocFilter(e.target.value)}
                placeholder="Buscar ubicación…"
                className="pl-8 text-xs"
                data-testid="climate-loc-search"
              />
            </div>
            <ScrollArea className="flex-1 pr-2">
              {filteredLocations.map(l => (
                <button
                  key={l.id}
                  onClick={() => setSelectedLocationId(l.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs mb-0.5 transition-colors ${selectedLocationId === l.id ? 'bg-[hsl(var(--magic-blue))]/20 text-[hsl(var(--magic-blue))]' : 'hover:bg-black/20'}`}
                  data-testid={`climate-loc-item-${l.id}`}
                >
                  <div className="font-medium truncate">{l.nombre}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{l.region}</div>
                </button>
              ))}
              {filteredLocations.length === 0 && <p className="text-xs text-muted-foreground p-2">Sin resultados</p>}
            </ScrollArea>
          </div>

          {/* Override editor */}
          <div className="col-span-12 md:col-span-9 card-parchment rounded-lg p-4">
            {!selectedLocationId ? (
              <div className="text-sm text-muted-foreground text-center py-12 flex flex-col items-center gap-3">
                <MapPin className="w-8 h-8 opacity-30" />
                Selecciona una ubicación para ver/sobrescribir su clima
              </div>
            ) : !effective ? (
              <Loader2 className="w-6 h-6 animate-spin mx-auto my-12" />
            ) : (
              <>
                <div className="flex flex-wrap gap-2 justify-between items-start mb-4">
                  <div>
                    <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{effective.location?.nombre}</h3>
                    <p className="text-xs text-muted-foreground">
                      Región del mapa: <span className="text-foreground">{effective.location?.region}</span>
                      {' → Hereda clima de '}
                      <span className="text-[hsl(var(--magic-blue))]">{effective.climate_region?.nombre || '— sin match —'}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearAllOverrides}
                      disabled={!effective.has_override}
                      data-testid="climate-clear-all-overrides-btn"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Limpiar todos
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveOverride}
                      disabled={savingOverride}
                      className="bg-[hsl(var(--gold))]/20 hover:bg-[hsl(var(--gold))]/30 text-[hsl(var(--gold))]"
                      data-testid="climate-save-override-btn"
                    >
                      {savingOverride ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Guardar overrides
                    </Button>
                  </div>
                </div>

                {!effective.climate_region && (
                  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-300 text-xs flex gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    Esta ubicación no encontró clima padre. Añade su región (<b>{effective.location?.region}</b>) a las keywords de algún clima en la pestaña anterior.
                  </div>
                )}

                {/* Override matrix */}
                <div className="overflow-x-auto" data-testid="climate-override-matrix">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left p-1 sticky left-0 bg-[hsl(var(--background))] z-10 border-b border-border/30">Mes</th>
                        <th className="text-center p-1 border-b border-border/30">Icono</th>
                        {FIELDS.map(f => (
                          <th key={f.key} className="text-left p-1 border-b border-border/30 whitespace-nowrap text-[hsl(var(--gold))]/80">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map(mes => {
                        // Compute live merged with current local override draft
                        const base = effective.climate_region?.meses?.[mes] || {};
                        const ov = overrideDraft[mes] || {};
                        const merged = { ...base, ...ov };
                        const ic = pickIcon(merged);
                        return (
                          <tr key={mes}>
                            <td className="p-1 sticky left-0 bg-[hsl(var(--background))] z-10 font-medium text-[hsl(var(--torch-orange))] whitespace-nowrap border-b border-border/10">
                              {MONTH_FULL[mes]}
                            </td>
                            <td className="text-center text-lg p-1 border-b border-border/10" title={ic.label}>
                              {ic.icon}
                            </td>
                            {FIELDS.map(f => {
                              const overrideVal = ov[f.key];
                              const baseVal = base[f.key];
                              const isOverridden = f.key in ov;
                              const displayVal = isOverridden ? overrideVal : '';
                              return (
                                <td key={f.key} className="p-1 border-b border-border/10 relative">
                                  <input
                                    type={f.type}
                                    step={f.step}
                                    value={displayVal}
                                    placeholder={baseVal !== undefined ? String(baseVal) : ''}
                                    onChange={(e) => handleOverrideChange(mes, f.key, e.target.value)}
                                    className={`w-full px-1 py-0.5 text-xs bg-black/20 border rounded ${isOverridden ? 'border-[hsl(var(--magic-blue))] text-[hsl(var(--magic-blue))] font-bold' : 'border-border/20 text-muted-foreground'}`}
                                    style={{ minWidth: f.type === 'text' ? 120 : 60 }}
                                    data-testid={`climate-override-cell-${mes}-${f.key}`}
                                  />
                                  {isOverridden && (
                                    <button
                                      onClick={() => handleClearCellOverride(mes, f.key)}
                                      className="absolute -right-0.5 -top-0.5 w-4 h-4 bg-black/60 rounded-full text-[10px] hover:bg-red-500/60"
                                      title="Quitar override (heredar de región)"
                                    >
                                      ×
                                    </button>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Vacío = hereda de la región (placeholder muestra el valor base). En azul = override activo. La × elimina ese override puntualmente.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClimateSection;
