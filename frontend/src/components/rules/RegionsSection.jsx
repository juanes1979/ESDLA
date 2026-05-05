/**
 * Regions Section Component (Tree View)
 * Manages regions and sub-regions hierarchically with terrain & danger class
 * settings, plus locations belonging to each region. Shows orphan locations
 * (without a valid region) at the top with inline region reassignment.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin, Plus, Edit, Trash2, Loader2, ChevronDown, ChevronRight, Network, Building2, Sparkles, GripVertical, Save, Undo2,
} from 'lucide-react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, DragOverlay, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import RegionHierarchyTree from './RegionHierarchyTree';

// Terrain types (difficulty)
const TIPOS_TERRENO = [
  { value: 'facil', label: 'Fácil', color: '#d3ba84' },
  { value: 'moderado', label: 'Moderado', color: '#948c4d' },
  { value: 'dificil', label: 'Difícil', color: '#c38d4f' },
  { value: 'muy_dificil', label: 'Muy Difícil', color: '#a57044' },
  { value: 'desalentador', label: 'Desalentador', color: '#af4b27' },
  { value: 'infranqueable', label: 'Infranqueable', color: '#664540' },
];

// Region classes (danger level)
const CLASES_REGION = [
  { value: 'tierras_libres', label: 'Tierras Libres', color: '#4ade80' },
  { value: 'tierras_fronterizas', label: 'Tierras Fronterizas', color: '#facc15' },
  { value: 'tierras_salvajes', label: 'Tierras Salvajes', color: '#fb923c' },
  { value: 'tierras_sombra', label: 'Tierras de la Sombra', color: '#f87171' },
  { value: 'tierras_oscuras', label: 'Tierras Oscuras', color: '#991b1b' },
];

// ============== HELPERS ==============
const buildTree = (flatList) => {
  const byId = Object.fromEntries(flatList.map(r => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const n of Object.values(byId)) {
    if (n.parent_id && byId[n.parent_id]) byId[n.parent_id].children.push(n);
    else roots.push(n);
  }
  const sortRec = (arr) => {
    arr.sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.nombre || '').localeCompare(b.nombre || ''));
    arr.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
};

const countDescendants = (node) => {
  let n = node.children?.length || 0;
  for (const c of (node.children || [])) n += countDescendants(c);
  return n;
};

const getTerrenoBadge = (tipo) => {
  const t = TIPOS_TERRENO.find(t => t.value === tipo);
  if (!t) return null;
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: t.color, color: '#000' }}>
      {t.label}
    </span>
  );
};

const getClaseBadge = (clase) => {
  const c = CLASES_REGION.find(c => c.value === clase);
  if (!c) return null;
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: c.color, color: c.value === 'tierras_oscuras' ? '#fff' : '#000' }}>
      {c.label}
    </span>
  );
};

// ============== LOCATION ROW ==============
const LocationRow = ({ loc, depth, isAdmin, regionOptions, onChangeRegion, dragEnabled = false, isPending = false, pendingRegion = null, originalRegion = null }) => {
  const [editing, setEditing] = useState(false);
  const [selVal, setSelVal] = useState(loc.region || '');
  const [busy, setBusy] = useState(false);

  // Draggable hook (only enabled when admin + drag mode is on).
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `loc-${loc.id}`,
    data: { type: 'location', loc },
    disabled: !dragEnabled,
  });

  const save = async () => {
    setBusy(true);
    try {
      await onChangeRegion(loc, selVal);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const containerStyle = {
    paddingLeft: `${depth * 24 + 36}px`,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 py-1 px-2 rounded text-sm ${
        isPending
          ? 'bg-amber-900/30 border border-amber-500/60 border-dashed'
          : 'hover:bg-amber-900/10'
      } ${dragEnabled ? 'cursor-grab' : ''}`}
      style={containerStyle}
      data-testid={`location-row-${loc.id}`}
    >
      {dragEnabled && (
        <button
          type="button"
          {...listeners}
          {...attributes}
          className="text-amber-500/60 hover:text-amber-300 cursor-grab active:cursor-grabbing shrink-0"
          title="Arrastrar a otra región"
          data-testid={`location-drag-handle-${loc.id}`}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}
      <Building2 className="w-3.5 h-3.5 text-cyan-400/70 shrink-0" />
      <span className="text-foreground/90 truncate">{loc.nombre}</span>
      {loc.tipo && (
        <span className="text-[10px] text-muted-foreground italic shrink-0">({String(loc.tipo).replace(/_/g, ' ')})</span>
      )}
      <div className="flex-1" />
      {editing ? (
        <>
          <select
            value={selVal}
            onChange={(e) => setSelVal(e.target.value)}
            className="h-7 px-1 text-xs bg-background border border-border rounded min-w-[260px] max-w-[360px]"
            data-testid={`location-region-select-${loc.id}`}
          >
            <option value="">Sin región</option>
            {regionOptions.map(r => (
              <option key={r.id} value={r.nombre}>
                {`${'\u00A0\u00A0'.repeat(r.depth || 0)}${(r.depth || 0) > 0 ? '└─ ' : ''}${r.nombre}`}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={save} disabled={busy} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setSelVal(loc.region || ''); }} className="h-7 text-xs">
            Cancelar
          </Button>
        </>
      ) : (
        <>
          {isPending && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-700/40 text-amber-100 shrink-0 font-semibold">
              → {pendingRegion || 'Sin región'}
            </span>
          )}
          {isPending && originalRegion ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/20 text-cyan-300/60 line-through shrink-0">
              {originalRegion}
            </span>
          ) : loc.region ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-200 shrink-0">
              {loc.region}
            </span>
          ) : (
            !isPending && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-200 shrink-0">Sin región</span>
          )}
          {isAdmin && !dragEnabled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="h-6 px-2 text-[11px]"
              data-testid={`location-edit-region-btn-${loc.id}`}
            >
              <Edit className="w-3 h-3 mr-1" />
              {loc.region ? 'Cambiar' : 'Asignar'}
            </Button>
          )}
        </>
      )}
    </div>
  );
};

// ============== RECURSIVE REGION NODE ==============
const RegionNode = ({
  node, depth, expanded, toggle, isAdmin, editingRegion, setEditingRegion,
  loading, updateRegion, updateRegionTerrain, deleteRegion, beginAddSub, openAddSubFor,
  newSubregionName, setNewSubregionName, createRegion, cancelAddSub,
  locationsByRegion, regionOptions, onChangeLocationRegion,
  dragEnabled = false, pendingMoves = {}, originalRegionByLocId = {},
}) => {
  const isOpen = expanded[node.id] !== false; // default open
  const subCount = node.children?.length || 0;
  const totalDescendants = useMemo(() => countDescendants(node), [node]);
  const myLocs = locationsByRegion[node.nombre] || [];
  const totalLocsRecursive = useMemo(() => {
    const collect = (n) => {
      let arr = [...((locationsByRegion[n.nombre]) || [])];
      for (const c of (n.children || [])) arr = arr.concat(collect(c));
      return arr;
    };
    return collect(node);
  }, [node, locationsByRegion]);
  const isEditingName = editingRegion === node.id;

  // Make this region a drop target so a dragged location can be assigned
  // to it. Only active when drag mode is enabled.
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-region-${node.id}`,
    data: { type: 'drop-region', regionName: node.nombre, regionId: node.id },
    disabled: !dragEnabled,
  });

  return (
    <div data-testid={`region-node-${node.id}`}>
      <div
        ref={setDropRef}
        className={`flex items-center gap-2 py-2 px-3 rounded-md border transition-colors ${
          depth === 0 ? 'bg-black/30 border-amber-700/40' : 'bg-black/15 border-border/30'
        } ${
          isOver
            ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40'
            : 'hover:border-amber-500/50'
        }`}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <button
          type="button"
          onClick={() => toggle(node.id)}
          className="text-amber-400/80 hover:text-amber-300 shrink-0"
          aria-label={isOpen ? 'Colapsar' : 'Expandir'}
          data-testid={`toggle-region-${node.id}`}
        >
          {(subCount > 0 || myLocs.length > 0) ? (
            isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="inline-block w-4" />
          )}
        </button>
        <MapPin className={`w-4 h-4 shrink-0 ${depth === 0 ? 'text-[hsl(var(--gold))]' : 'text-amber-300/70'}`} />

        {isEditingName ? (
          <div className="flex gap-2 flex-1">
            <Input
              defaultValue={node.nombre}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateRegion(node.id, e.target.value);
                if (e.key === 'Escape') setEditingRegion(null);
              }}
              className="h-7 flex-1"
              autoFocus
              data-testid={`edit-region-input-${node.id}`}
            />
            <Button
              onClick={(e) => {
                const input = e.target.closest('div').querySelector('input');
                updateRegion(node.id, input?.value || node.nombre);
              }}
              size="sm"
              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Guardar'}
            </Button>
            <Button onClick={() => setEditingRegion(null)} variant="ghost" size="sm" className="h-7 text-xs">
              Cancelar
            </Button>
          </div>
        ) : (
          <>
            <h4 className={`font-heading truncate ${depth === 0 ? 'text-base text-[hsl(var(--gold))]' : 'text-sm text-amber-300/90'}`}>
              {node.nombre}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
              {subCount > 0 && (
                <span>
                  {subCount} sub{totalDescendants > subCount ? ` (${totalDescendants} total)` : ''}
                </span>
              )}
              {totalLocsRecursive.length > 0 && (
                <span className="text-cyan-300/80">
                  · <Building2 className="w-3 h-3 inline" /> {myLocs.length}{totalLocsRecursive.length > myLocs.length ? `/${totalLocsRecursive.length}` : ''}
                </span>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">
              {getTerrenoBadge(node.tipo_terreno)}
              {getClaseBadge(node.clase_region)}
              {isAdmin && (
                <>
                  <select
                    value={node.tipo_terreno || ''}
                    onChange={(e) => updateRegionTerrain(node.id, 'tipo_terreno', e.target.value)}
                    className="h-7 px-1 text-[11px] bg-background border border-border rounded"
                    title="Tipo de terreno"
                    data-testid={`region-terreno-${node.id}`}
                  >
                    <option value="">Terreno</option>
                    {TIPOS_TERRENO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <select
                    value={node.clase_region || ''}
                    onChange={(e) => updateRegionTerrain(node.id, 'clase_region', e.target.value)}
                    className="h-7 px-1 text-[11px] bg-background border border-border rounded"
                    title="Clase de región"
                    data-testid={`region-clase-${node.id}`}
                  >
                    <option value="">Clase</option>
                    {CLASES_REGION.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => beginAddSub(node.id)} className="h-7 w-7 p-0" title="Añadir sub-región">
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingRegion(node.id)} className="h-7 w-7 p-0" title="Renombrar">
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteRegion(node.id, node.nombre)} className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Inline add subregion form */}
      {openAddSubFor === node.id && (
        <div className="flex gap-2 my-1 p-2 bg-black/10 rounded" style={{ marginLeft: `${(depth + 1) * 20}px` }}>
          <Input
            value={newSubregionName}
            onChange={(e) => setNewSubregionName(e.target.value)}
            placeholder="Nombre de la sub-región..."
            className="flex-1 h-8"
            autoFocus
            data-testid={`new-subregion-input-${node.id}`}
          />
          <Button onClick={() => createRegion(newSubregionName, node.id)} disabled={!newSubregionName.trim() || loading} size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-xs">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Crear'}
          </Button>
          <Button onClick={cancelAddSub} variant="ghost" size="sm" className="h-8 text-xs">Cancelar</Button>
        </div>
      )}

      {isOpen && (
        <div className="mt-1 space-y-1">
          {/* Children regions */}
          {node.children?.map(child => (
            <RegionNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              isAdmin={isAdmin}
              editingRegion={editingRegion}
              setEditingRegion={setEditingRegion}
              loading={loading}
              updateRegion={updateRegion}
              updateRegionTerrain={updateRegionTerrain}
              deleteRegion={deleteRegion}
              beginAddSub={beginAddSub}
              openAddSubFor={openAddSubFor}
              newSubregionName={newSubregionName}
              setNewSubregionName={setNewSubregionName}
              createRegion={createRegion}
              cancelAddSub={cancelAddSub}
              locationsByRegion={locationsByRegion}
              regionOptions={regionOptions}
              onChangeLocationRegion={onChangeLocationRegion}
              dragEnabled={dragEnabled}
              pendingMoves={pendingMoves}
              originalRegionByLocId={originalRegionByLocId}
            />
          ))}
          {/* Locations of this region */}
          {myLocs.map(loc => (
            <LocationRow
              key={loc.id}
              loc={loc}
              depth={depth}
              isAdmin={isAdmin}
              regionOptions={regionOptions}
              onChangeRegion={onChangeLocationRegion}
              dragEnabled={dragEnabled}
              isPending={Object.prototype.hasOwnProperty.call(pendingMoves, loc.id)}
              pendingRegion={pendingMoves[loc.id]}
              originalRegion={originalRegionByLocId[loc.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============== MAIN ==============
const RegionsSection = ({ data, isAdmin = false, onRefresh }) => {
  // Local fetch (independent of `data` prop) so the listing always reflects
  // the real hierarchy via /data/regions/flat instead of the legacy 1-level
  // /data/regions response.
  const [flatRegions, setFlatRegions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const [editingRegion, setEditingRegion] = useState(null);
  const [newRegionName, setNewRegionName] = useState('');
  const [newSubregionName, setNewSubregionName] = useState('');
  const [openAddSubFor, setOpenAddSubFor] = useState(null);
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showHierarchyEditor, setShowHierarchyEditor] = useState(false);
  const [showOrphans, setShowOrphans] = useState(true);

  // ===== Drag & drop state for re-assigning locations =====
  const [dragMode, setDragMode] = useState(false);          // toggled via toolbar
  const [pendingLocMoves, setPendingLocMoves] = useState({}); // { locId: newRegionName }
  const [activeDragLoc, setActiveDragLoc] = useState(null);
  const [savingLocMoves, setSavingLocMoves] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [regsRes, locsRes] = await Promise.all([
        api.get('/data/regions/flat'),
        api.get('/data/locations'),
      ]);
      setFlatRegions(regsRes.data?.regions || []);
      setLocations(locsRes.data?.locations || []);
    } catch (err) {
      console.error('Error loading regions/locations:', err);
      toast.error('Error al cargar regiones y ubicaciones');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshAll = useCallback(async () => {
    await fetchAll();
    onRefresh?.();
  }, [fetchAll, onRefresh]);

  const tree = useMemo(() => buildTree(flatRegions), [flatRegions]);

  // Apply pending moves to locations array — used to render the tree as
  // it WILL look after saving, so the user gets immediate visual feedback.
  const effectiveLocations = useMemo(() => {
    if (!Object.keys(pendingLocMoves).length) return locations;
    return locations.map(l => (
      Object.prototype.hasOwnProperty.call(pendingLocMoves, l.id)
        ? { ...l, region: pendingLocMoves[l.id] }
        : l
    ));
  }, [locations, pendingLocMoves]);

  // Map of locationId → ORIGINAL region (before any pending move). Used
  // by `LocationRow` to render the strikethrough "old" region badge.
  const originalRegionByLocId = useMemo(() => {
    const m = {};
    locations.forEach(l => { m[l.id] = l.region || ''; });
    return m;
  }, [locations]);

  const locationsByRegion = useMemo(() => {
    const map = {};
    effectiveLocations.forEach(l => {
      const rn = (l.region || '').trim();
      if (!rn) return;
      (map[rn] ||= []).push(l);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
    return map;
  }, [effectiveLocations]);

  const regionNamesSet = useMemo(() => new Set(flatRegions.map(r => r.nombre)), [flatRegions]);
  const orphanLocations = useMemo(
    () => effectiveLocations.filter(l => {
      const rn = (l.region || '').trim();
      return !rn || !regionNamesSet.has(rn);
    }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')),
    [effectiveLocations, regionNamesSet]
  );

  // ============== ACTIONS ==============
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: p[id] === false ? true : false }));

  const updateRegionTerrain = async (regionId, field, value) => {
    try {
      await api.put(`/data/regions/${regionId}`, { [field]: value });
      await refreshAll();
    } catch (err) {
      toast.error('Error al actualizar la región');
    }
  };

  const createRegion = async (name, parentId = null) => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.post('/data/regions', { nombre: name.trim(), parent_id: parentId });
      toast.success(`Región "${name}" creada`);
      setNewRegionName('');
      setNewSubregionName('');
      setIsAddingRegion(false);
      setOpenAddSubFor(null);
      if (parentId) setExpanded(p => ({ ...p, [parentId]: true }));
      await refreshAll();
    } catch (err) {
      toast.error('Error al crear la región');
    } finally {
      setLoading(false);
    }
  };

  const updateRegion = async (regionId, newName) => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.put(`/data/regions/${regionId}`, { nombre: newName.trim() });
      toast.success('Región actualizada');
      setEditingRegion(null);
      await refreshAll();
    } catch (err) {
      toast.error('Error al actualizar la región');
    } finally {
      setLoading(false);
    }
  };

  const deleteRegion = async (regionId, regionName) => {
    if (!window.confirm(`¿Eliminar la región "${regionName}" y todas sus sub-regiones?`)) return;
    setLoading(true);
    try {
      await api.delete(`/data/regions/${regionId}`);
      toast.success(`Región "${regionName}" eliminada`);
      await refreshAll();
    } catch (err) {
      toast.error('Error al eliminar la región');
    } finally {
      setLoading(false);
    }
  };

  const seedRegions = async () => {
    setLoading(true);
    try {
      await api.post('/data/regions/seed');
      toast.success('Regiones iniciales cargadas');
      await refreshAll();
    } catch (err) {
      toast.error('Error al cargar las regiones iniciales');
    } finally {
      setLoading(false);
    }
  };

  const onChangeLocationRegion = async (loc, newRegionName) => {
    try {
      await api.put(`/data/locations/${loc.id}`, { ...loc, region: newRegionName || '' });
      toast.success(newRegionName ? `Ubicación "${loc.nombre}" → ${newRegionName}` : `Ubicación "${loc.nombre}" sin región`);
      await refreshAll();
    } catch (err) {
      toast.error('Error al actualizar la ubicación');
    }
  };

  const beginAddSub = (parentId) => {
    setOpenAddSubFor(parentId);
    setNewSubregionName('');
  };
  const cancelAddSub = () => { setOpenAddSubFor(null); setNewSubregionName(''); };

  // ===== DnD handlers (location → region) =====
  const handleDragStart = (e) => {
    setActiveDragLoc(e.active?.data?.current?.loc || null);
  };

  const handleDragEnd = (e) => {
    setActiveDragLoc(null);
    const data = e.active?.data?.current;
    const overData = e.over?.data?.current;
    if (!data || data.type !== 'location' || !overData || overData.type !== 'drop-region') return;
    const loc = data.loc;
    const targetRegion = overData.regionName;
    if (!targetRegion || loc.region === targetRegion) return;
    setPendingLocMoves(p => ({ ...p, [loc.id]: targetRegion }));
    toast.info('Cambio pendiente. Pulsa "Guardar" para aplicar.', { duration: 1800 });
  };

  const savePendingLocMoves = async () => {
    const ids = Object.keys(pendingLocMoves);
    if (!ids.length) return;
    setSavingLocMoves(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      const loc = locations.find(l => l.id === id);
      if (!loc) { fail++; continue; }
      try {
        await api.put(`/data/locations/${id}`, { ...loc, region: pendingLocMoves[id] || '' });
        ok++;
      } catch (err) {
        console.error('Move location fail:', id, err);
        fail++;
      }
    }
    setSavingLocMoves(false);
    setPendingLocMoves({});
    if (fail === 0) toast.success(`${ok} ubicación${ok === 1 ? '' : 'es'} reasignada${ok === 1 ? '' : 's'}`);
    else toast.warning(`${ok} guardadas, ${fail} fallaron`);
    await refreshAll();
  };

  const discardPendingLocMoves = () => {
    setPendingLocMoves({});
    toast.info('Cambios pendientes descartados');
  };

  const expandAll = () => {
    const e = {};
    flatRegions.forEach(r => { e[r.id] = true; });
    setExpanded(e);
  };
  const collapseAll = () => {
    const e = {};
    flatRegions.forEach(r => { e[r.id] = false; });
    setExpanded(e);
  };

  const regionOptions = useMemo(() => {
    // Flatten the tree as DFS to preserve hierarchy in dropdowns.
    // Each entry includes `depth` so the option label can render with
    // indentation (e.g. Eriador → ⤷ Angmar → ⤷ ⤷ Colinas de Angmar).
    const out = [];
    const walk = (nodes, depth) => {
      for (const n of nodes) {
        out.push({ id: n.id, nombre: n.nombre, depth });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    };
    walk(tree, 0);
    return out;
  }, [tree]);

  // ============== RENDER ==============
  return (
    <div className="space-y-6" data-testid="regions-section">
      {/* Hierarchy editor — sólo se activa al pulsar "Editar jerarquía" */}
      {isAdmin && showHierarchyEditor && (
        <div className="card-parchment rounded-lg p-4 border border-amber-500/40">
          <RegionHierarchyTree
            onClose={() => setShowHierarchyEditor(false)}
            onSaved={refreshAll}
          />
        </div>
      )}

      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/30">
        <div>
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            <MapPin className="w-5 h-5 inline mr-2" />
            Gestión de Regiones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vista en árbol con sub-regiones anidadas y ubicaciones por región. Las ubicaciones sin región aparecen arriba.
          </p>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            {flatRegions.length === 0 && (
              <Button variant="outline" size="sm" onClick={seedRegions} disabled={loading} data-testid="seed-regions-btn">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Cargar Regiones Iniciales
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={expandAll} data-testid="regions-expand-all-btn">
              <ChevronDown className="w-4 h-4 mr-1" /> Expandir
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll} data-testid="regions-collapse-all-btn">
              <ChevronRight className="w-4 h-4 mr-1" /> Colapsar
            </Button>
            <Button
              variant={showHierarchyEditor ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowHierarchyEditor(v => !v)}
              className={showHierarchyEditor ? 'bg-amber-600 hover:bg-amber-500 text-black' : ''}
              data-testid="toggle-hierarchy-editor-btn"
            >
              <Network className="w-4 h-4 mr-1" />
              {showHierarchyEditor ? 'Ocultar editor' : 'Editar jerarquía'}
            </Button>
            <Button
              variant={dragMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (dragMode && Object.keys(pendingLocMoves).length > 0) {
                  if (!window.confirm('Hay cambios pendientes. ¿Salir del modo arrastrar y descartarlos?')) return;
                  setPendingLocMoves({});
                }
                setDragMode(v => !v);
              }}
              className={dragMode ? 'bg-amber-600 hover:bg-amber-500 text-black' : ''}
              data-testid="toggle-locations-drag-mode-btn"
            >
              <GripVertical className="w-4 h-4 mr-1" />
              {dragMode ? 'Salir modo arrastrar' : 'Arrastrar ubicaciones'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAddingRegion(true)}
              disabled={loading}
              className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
              data-testid="add-region-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Región Principal
            </Button>
          </div>
        )}
      </div>

      {/* Pending moves bar (shown only in drag mode with pending) */}
      {dragMode && (
        <div className={`flex items-center justify-between gap-3 p-3 rounded-md border ${Object.keys(pendingLocMoves).length > 0 ? 'border-amber-500/60 bg-amber-900/15' : 'border-border/40 bg-black/30'}`}>
          <div className="text-xs">
            {Object.keys(pendingLocMoves).length > 0 ? (
              <span className="text-amber-200">
                <span className="font-bold">{Object.keys(pendingLocMoves).length}</span> ubicación(es) con cambios pendientes. Pulsa "Guardar" para aplicar todo de una vez.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Modo arrastrar activo. Coge una ubicación por el agarre y suéltala sobre la región destino. Los cambios quedarán pendientes hasta pulsar Guardar.
              </span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={discardPendingLocMoves}
              disabled={Object.keys(pendingLocMoves).length === 0 || savingLocMoves}
              data-testid="discard-loc-moves-btn"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Descartar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={savePendingLocMoves}
              disabled={Object.keys(pendingLocMoves).length === 0 || savingLocMoves}
              data-testid="save-loc-moves-btn"
            >
              {savingLocMoves ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Guardar {Object.keys(pendingLocMoves).length || ''} cambio{Object.keys(pendingLocMoves).length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {/* Add new main region form */}
      {isAddingRegion && (
        <div className="card-parchment p-4 rounded-lg border-2 border-dashed border-[hsl(var(--gold))]/50">
          <h3 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Nueva Región Principal</h3>
          <div className="flex gap-2">
            <Input
              value={newRegionName}
              onChange={(e) => setNewRegionName(e.target.value)}
              placeholder="Nombre de la región..."
              className="flex-1"
              autoFocus
              data-testid="new-region-input"
            />
            <Button
              onClick={() => createRegion(newRegionName)}
              disabled={!newRegionName.trim() || loading}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
            </Button>
            <Button onClick={() => { setIsAddingRegion(false); setNewRegionName(''); }} variant="ghost" size="sm">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-3">
            Dificultad del Terreno (Afecta tiempo de viaje)
          </h4>
          <div className="space-y-1.5 text-xs">
            {TIPOS_TERRENO.map(t => (
              <div key={t.value} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: t.color }}></span>
                <span className="font-medium w-24">{t.label}</span>
                <span className="text-muted-foreground">
                  {t.value === 'facil' && '×1.0 - Caminos, llanuras'}
                  {t.value === 'moderado' && '×1.25 - Colinas, bosques claros'}
                  {t.value === 'dificil' && '×1.5 - Bosques densos, páramos'}
                  {t.value === 'muy_dificil' && '×2.0 - Montañas, pantanos'}
                  {t.value === 'desalentador' && '×3.0 - Volcánico, maldito'}
                  {t.value === 'infranqueable' && '⛔ Solo por pasos de montaña'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-3">
            Clase de Peligro (Afecta encuentros)
          </h4>
          <div className="space-y-1.5 text-xs">
            {CLASES_REGION.map(c => (
              <div key={c.value} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: c.color }}></span>
                <span className="font-medium w-32">{c.label}</span>
                <span className="text-muted-foreground">
                  {c.value === 'tierras_libres' && '5% encuentros - Seguro'}
                  {c.value === 'tierras_fronterizas' && '15% encuentros - Ocasional'}
                  {c.value === 'tierras_salvajes' && '25% encuentros - Regular'}
                  {c.value === 'tierras_sombra' && '40% encuentros - Frecuente'}
                  {c.value === 'tierras_oscuras' && '60% encuentros - Constante'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orphan locations */}
      {orphanLocations.length > 0 && (
        <div className="card-parchment rounded-lg p-3 border border-rose-500/40 bg-rose-950/10" data-testid="orphan-locations-section">
          <button
            type="button"
            onClick={() => setShowOrphans(v => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {showOrphans ? <ChevronDown className="w-4 h-4 text-rose-300" /> : <ChevronRight className="w-4 h-4 text-rose-300" />}
            <Sparkles className="w-4 h-4 text-rose-300" />
            <span className="font-heading text-rose-200">
              Ubicaciones sin región asignada
            </span>
            <span className="text-xs text-rose-300/80">
              ({orphanLocations.length})
            </span>
          </button>
          {showOrphans && (
            <div className="mt-2 space-y-1">
              {orphanLocations.map(loc => (
                <LocationRow
                  key={loc.id}
                  loc={loc}
                  depth={0}
                  isAdmin={isAdmin}
                  regionOptions={regionOptions}
                  onChangeRegion={onChangeLocationRegion}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tree */}
      {loadingData ? (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400 inline" />
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay regiones definidas.</p>
          {isAdmin && <p className="text-sm mt-2">Haz clic en "Cargar Regiones Iniciales" para empezar con las regiones de la Tierra Media.</p>}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2" data-testid="regions-tree">
            {tree.map(root => (
              <RegionNode
                key={root.id}
                node={root}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                isAdmin={isAdmin}
                editingRegion={editingRegion}
                setEditingRegion={setEditingRegion}
                loading={loading}
                updateRegion={updateRegion}
                updateRegionTerrain={updateRegionTerrain}
                deleteRegion={deleteRegion}
                beginAddSub={beginAddSub}
                openAddSubFor={openAddSubFor}
                newSubregionName={newSubregionName}
                setNewSubregionName={setNewSubregionName}
                createRegion={createRegion}
                cancelAddSub={cancelAddSub}
                locationsByRegion={locationsByRegion}
                regionOptions={regionOptions}
                onChangeLocationRegion={onChangeLocationRegion}
                dragEnabled={dragMode && isAdmin}
                pendingMoves={pendingLocMoves}
                originalRegionByLocId={originalRegionByLocId}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDragLoc ? (
              <div className="px-3 py-1.5 rounded-md bg-cyan-900/95 border-2 border-cyan-300 text-cyan-100 text-sm shadow-2xl flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {activeDragLoc.nombre}
                {activeDragLoc.tipo && (
                  <span className="text-[10px] italic opacity-70">({String(activeDragLoc.tipo).replace(/_/g, ' ')})</span>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};

export default RegionsSection;
