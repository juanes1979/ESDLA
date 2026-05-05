/**
 * RegionHierarchyTree — Editor visual de jerarquía con cards grandes y
 * cambios pendientes (estilo "draft").
 *
 * Diseño:
 *  - Cada región se muestra como una CARD grande (estilo de la sección
 *    Regiones) con badges de dificultad / tipo de tierra y botones
 *    editar / eliminar.
 *  - Al arrastrar una región sobre otra, queda marcada como
 *    "PENDIENTE" (visual: indentada con borde ámbar discontinuo) pero
 *    NO se persiste hasta pulsar "Guardar cambios".
 *  - Botón "Cancelar" descarta todos los pendientes.
 *  - Botón "Cascadear" propaga valores a descendientes (respetando
 *    overrides). Sólo disponible para nodos sin pendientes.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, DragOverlay, useDroppable, useDraggable,
} from '@dnd-kit/core';
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  Edit3, Check, X, ArrowDownToLine, RefreshCw, MapPin, Loader2,
  Save, Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const TERRAIN_OPTIONS = [
  { value: 'facil', label: 'Fácil', color: 'bg-yellow-200/80 text-yellow-900' },
  { value: 'moderado', label: 'Moderado', color: 'bg-amber-300/80 text-amber-950' },
  { value: 'dificil', label: 'Difícil', color: 'bg-yellow-400/80 text-yellow-950' },
  { value: 'muy_dificil', label: 'Muy Difícil', color: 'bg-amber-700/80 text-amber-100' },
  { value: 'desalentador', label: 'Desalentador', color: 'bg-red-700/80 text-red-100' },
  { value: 'infranqueable', label: 'Infranqueable', color: 'bg-stone-600/80 text-stone-100' },
];

const LAND_TYPE_OPTIONS = [
  { value: 'tierras_libres', label: 'Tierras Libres', color: 'bg-emerald-500/80 text-emerald-50' },
  { value: 'fronterizas', label: 'Tierras Fronterizas', color: 'bg-yellow-400/80 text-yellow-950' },
  { value: 'tierras_salvajes', label: 'Tierras Salvajes', color: 'bg-orange-500/80 text-orange-50' },
  { value: 'tierras_sombra', label: 'Tierras de la Sombra', color: 'bg-rose-400/80 text-rose-950' },
  { value: 'tierras_oscuras', label: 'Tierras Oscuras', color: 'bg-red-600/80 text-red-50' },
];

const findOpt = (arr, v) => arr.find(o => o.value === v);
const labelLand = (v) => findOpt(LAND_TYPE_OPTIONS, v)?.label || '—';
const labelTerrain = (v) => findOpt(TERRAIN_OPTIONS, v)?.label || '—';
const colorLand = (v) => findOpt(LAND_TYPE_OPTIONS, v)?.color || 'bg-gray-700/60 text-gray-300';
const colorTerrain = (v) => findOpt(TERRAIN_OPTIONS, v)?.color || 'bg-gray-700/60 text-gray-300';

// ============== CARD ==============
const NodeCard = ({
  node, depth, expanded, onToggle, isPending, onEdit, onDelete, onCreateChild,
  onCascade, editing, draftName, setDraftName, onSaveEdit, onCancelEdit,
  onSetField, hasChildren, childCount,
}) => {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { type: 'node', node },
  });
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-${node.id}`,
    data: { type: 'drop-into', nodeId: node.id },
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: 0.4 }
    : {};

  return (
    <div ref={setDropRef} style={{ paddingLeft: `${depth * 32}px` }}>
      {/* Connector line para visualizar pertenencia al padre */}
      {depth > 0 && (
        <div
          className="absolute border-l-2 border-amber-700/40"
          style={{ marginLeft: `${(depth - 1) * 32 + 16}px`, height: '60px', marginTop: '-8px' }}
        />
      )}

      <div
        ref={setDragRef}
        style={style}
        className={`relative my-2 rounded-lg border overflow-hidden transition-all ${
          isDragging
            ? 'border-amber-400 bg-amber-500/15 shadow-xl scale-[0.99]'
            : isPending
              ? 'border-amber-500/70 border-dashed bg-amber-900/20'
              : isOver
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-amber-900/40 bg-black/40 hover:border-amber-700/60'
        }`}
        data-testid={`region-card-${node.id}`}
      >
        <div className="flex items-center gap-3 p-3">
          {/* Drag handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-amber-700/60 hover:text-amber-400 shrink-0"
            title="Arrastra para reasignar padre"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Pin icon */}
          <MapPin className="w-5 h-5 text-amber-400 shrink-0" />

          {/* Expand */}
          {hasChildren ? (
            <button
              onClick={() => onToggle(node.id)}
              className="text-amber-400 hover:text-amber-300 shrink-0"
              data-testid={`region-toggle-${node.id}`}
            >
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Name + meta */}
          {editing ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-8 max-w-[260px] text-base"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400" onClick={onSaveEdit}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-gray-400" onClick={onCancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-baseline gap-3 flex-1 min-w-0 flex-wrap">
              <span className="font-heading text-2xl text-amber-300 uppercase tracking-wide truncate">
                {node.name}
              </span>
              <span className="text-xs text-gray-500 italic">
                {childCount > 0 ? `(${childCount} sub-región${childCount === 1 ? '' : 'es'})` : node.locations_count > 0 ? `(${node.locations_count} ubicación${node.locations_count === 1 ? '' : 'es'})` : ''}
              </span>
              {isPending && (
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-100 font-bold">
                  Pendiente
                </span>
              )}
              {(node.tipo_tierra_override || node.dificultad_override) && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-700/30 text-amber-200 border border-amber-600/40" title="Tiene override propio (no se sobreescribe en cascada)">
                  override
                </span>
              )}
            </div>
          )}

          {/* Badges + actions */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={node.dificultad || ''}
              onChange={(e) => onSetField(node.id, 'dificultad', e.target.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded border-0 cursor-pointer ${colorTerrain(node.dificultad)}`}
              title="Dificultad"
              data-testid={`region-set-terrain-${node.id}`}
            >
              <option value="" className="bg-black text-white">— Dificultad —</option>
              {TERRAIN_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>
              ))}
            </select>
            <select
              value={node.tipo_tierra || node.clase_region || ''}
              onChange={(e) => onSetField(node.id, 'tipo_tierra', e.target.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded border-0 cursor-pointer ${colorLand(node.tipo_tierra || node.clase_region)}`}
              title="Tipo de tierra"
              data-testid={`region-set-land-${node.id}`}
            >
              <option value="" className="bg-black text-white">— Tierra —</option>
              {LAND_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value} className="bg-black text-white">{o.label}</option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-300 hover:bg-amber-700/30" onClick={() => onEdit(node)} title="Renombrar">
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-300 hover:bg-emerald-700/30" onClick={() => onCreateChild(node.id)} title="Añadir subregión">
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-300 hover:bg-amber-700/30" onClick={() => onCascade(node.id)} title="Cascadear valores a descendientes">
              <ArrowDownToLine className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-900/40" onClick={() => onDelete(node.id)} title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============== ROOT DROPZONE ==============
const RootDropzone = ({ children, isPending }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'drop-root',
    data: { type: 'drop-root' },
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] rounded-lg ${
        isOver
          ? 'bg-amber-700/15 border-2 border-amber-500/60 border-dashed'
          : isPending
            ? 'border-2 border-amber-700/30 border-dashed'
            : ''
      } transition-colors`}
    >
      {children}
    </div>
  );
};

// ============== MAIN ==============
const RegionHierarchyTree = () => {
  const [tree, setTree] = useState([]);
  const [orphanRegions, setOrphanRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [activeNode, setActiveNode] = useState(null);
  const [creatingForParent, setCreatingForParent] = useState(undefined);
  const [newName, setNewName] = useState('');
  // Pending moves: { [nodeId]: newParentId | null }
  const [pendingMoves, setPendingMoves] = useState({});
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/regions/tree');
      setTree(res.data.tree || []);
      setOrphanRegions(res.data.orphan_regions || []);
    } catch (err) {
      console.error('Load tree fail:', err);
      toast.error('Error al cargar la jerarquía');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // Aplica los pendingMoves al árbol original para visualizarlos.
  // Devolvemos un nuevo árbol con los nodos reasignados.
  const treeWithPending = useMemo(() => {
    if (Object.keys(pendingMoves).length === 0) return tree;
    // Aplanamos el árbol original
    const flat = [];
    const walk = (nodes) => {
      for (const n of nodes) {
        flat.push({ ...n, children: undefined });
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    // Sobreescribir parent_id según pendingMoves
    for (const f of flat) {
      if (Object.prototype.hasOwnProperty.call(pendingMoves, f.id)) {
        f.parent_id = pendingMoves[f.id];
      }
    }
    // Reconstruir árbol
    const byId = Object.fromEntries(flat.map(n => [n.id, { ...n, children: [] }]));
    const roots = [];
    for (const n of Object.values(byId)) {
      const pid = n.parent_id;
      if (pid && byId[pid]) byId[pid].children.push(n);
      else roots.push(n);
    }
    const sortRec = (arr) => {
      arr.sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.name.localeCompare(b.name));
      arr.forEach(n => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [tree, pendingMoves]);

  const flatNodes = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      for (const n of nodes) {
        out.push({ node: n, depth, hasChildren: (n.children || []).length > 0, childCount: (n.children || []).length });
        if (expanded[n.id] && (n.children || []).length > 0) {
          walk(n.children, depth + 1);
        }
      }
    };
    walk(treeWithPending);
    return out;
  }, [treeWithPending, expanded]);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Helpers
  const handleEdit = (node) => { setEditingId(node.id); setDraftName(node.name); };
  const saveEdit = async () => {
    if (!draftName.trim()) return;
    try {
      await api.patch(`/regions/node/${editingId}`, { name: draftName.trim() });
      toast.success('Nombre actualizado');
      setEditingId(null);
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al renombrar');
    }
  };

  const handleSetField = async (nodeId, field, value) => {
    try {
      await api.patch(`/regions/node/${nodeId}`, { [field]: value || null });
      toast.success(`${field} actualizado (override activado)`);
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    }
  };

  const handleDelete = async (nodeId) => {
    if (!window.confirm('¿Eliminar este nodo? Los hijos se reasignarán al abuelo.')) return;
    try {
      await api.delete(`/regions/node/${nodeId}`);
      // Limpia pending si estaba
      setPendingMoves(p => { const c = { ...p }; delete c[nodeId]; return c; });
      toast.success('Nodo eliminado');
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleCascade = async (nodeId) => {
    if (Object.keys(pendingMoves).length > 0) {
      toast.error('Tienes movimientos pendientes. Guárdalos primero o cancélalos.');
      return;
    }
    if (!window.confirm('Cascadear valores (tipo_tierra y dificultad) a TODOS los descendientes que NO tengan override propio. ¿Continuar?')) return;
    try {
      const res = await api.post(`/regions/node/${nodeId}/cascade`, {
        fields: ['tipo_tierra', 'dificultad', 'clase_region'],
        apply_to_locations: true,
      });
      const d = res.data;
      toast.success(`Cascada · ${d.nodes_updated} nodos · ${d.locations_updated} ubicaciones`);
      if ((d.nodes_skipped || []).length > 0) {
        toast.info(`${d.nodes_skipped.length} nodos omitidos por override propio`);
      }
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error en cascada');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/regions/node', { name: newName.trim(), parent_id: creatingForParent || null });
      toast.success(`Nodo "${newName}" creado`);
      setCreatingForParent(undefined);
      setNewName('');
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Crear automáticamente un nodo por cada región distinta encontrada en las ubicaciones?')) return;
    try {
      const res = await api.post('/regions/seed-from-locations');
      toast.success(`${res.data.total} nodos creados, ${res.data.skipped_existing.length} ya existían`);
      await loadTree();
    } catch (err) {
      toast.error('Error al sembrar regiones');
    }
  };

  // Drag handlers — solo registran intent, NO persisten.
  const handleDragStart = (e) => {
    setActiveNode(e.active?.data?.current?.node || null);
  };

  const handleDragEnd = (e) => {
    const activeId = e.active?.id;
    setActiveNode(null);
    if (!activeId) return;
    const overData = e.over?.data?.current;
    if (!overData) return;

    let newParentId = null;
    if (overData.type === 'drop-root') newParentId = null;
    else if (overData.type === 'drop-into') {
      newParentId = overData.nodeId;
      if (newParentId === activeId) return;

      // Evita ciclos: el nuevo parent no puede ser descendiente del activo
      // (en treeWithPending para detectar ciclos resultantes).
      const isDescendantOf = (candidate, ancestor) => {
        const flat = [];
        const walk = (arr) => arr.forEach(n => { flat.push(n); if (n.children) walk(n.children); });
        walk(treeWithPending);
        const byId = Object.fromEntries(flat.map(n => [n.id, n]));
        let cur = byId[candidate];
        while (cur) {
          if (cur.id === ancestor) return true;
          cur = cur.parent_id ? byId[cur.parent_id] : null;
        }
        return false;
      };
      if (isDescendantOf(newParentId, activeId)) {
        toast.error('Movimiento crearía un ciclo');
        return;
      }
    }

    setPendingMoves(p => ({ ...p, [activeId]: newParentId }));
    if (newParentId) setExpanded(p => ({ ...p, [newParentId]: true }));
    toast.info('Cambio pendiente. Pulsa "Guardar cambios" para aplicar.', { duration: 2500 });
  };

  const savePendingMoves = async () => {
    const ids = Object.keys(pendingMoves);
    if (ids.length === 0) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const nodeId of ids) {
      try {
        await api.patch(`/regions/node/${nodeId}/move`, { parent_id: pendingMoves[nodeId] });
        ok++;
      } catch (err) {
        fail++;
        console.error(`Move fail ${nodeId}:`, err);
      }
    }
    setSaving(false);
    setPendingMoves({});
    if (fail === 0) toast.success(`${ok} cambio${ok === 1 ? '' : 's'} guardado${ok === 1 ? '' : 's'}`);
    else toast.warning(`${ok} guardados, ${fail} fallaron`);
    await loadTree();
  };

  const cancelPendingMoves = () => {
    setPendingMoves({});
    toast.info('Cambios pendientes descartados');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  const pendingCount = Object.keys(pendingMoves).length;

  return (
    <div className="space-y-3" data-testid="region-hierarchy-tree">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-2xl text-amber-300 uppercase tracking-wide">Jerarquía de Regiones</h3>
          <p className="text-xs text-gray-400 mt-1">
            Arrastra una región sobre otra para anidarla, o suelta en el área superior para hacerla región principal. Los cambios quedan <span className="text-amber-300 font-semibold">pendientes</span> hasta pulsar Guardar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pendingCount > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-gray-500 text-gray-300"
                onClick={cancelPendingMoves}
                disabled={saving}
                data-testid="region-cancel-pending-btn"
              >
                <Undo2 className="w-3 h-3 mr-1" />
                Descartar ({pendingCount})
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                onClick={savePendingMoves}
                disabled={saving}
                data-testid="region-save-pending-btn"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Guardar {pendingCount} cambio{pendingCount === 1 ? '' : 's'}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleSeed} className="text-xs" data-testid="region-seed-btn">
            <RefreshCw className="w-3 h-3 mr-1" />
            Sincronizar desde ubicaciones
          </Button>
          <Button size="sm" onClick={() => { setCreatingForParent(null); setNewName(''); }} className="text-xs bg-amber-600 hover:bg-amber-500 text-black font-semibold" data-testid="region-create-root-btn">
            <Plus className="w-3 h-3 mr-1" />
            Nueva región raíz
          </Button>
        </div>
      </div>

      {creatingForParent !== undefined && (
        <div className="flex items-center gap-2 p-3 bg-amber-900/20 border border-amber-500/40 rounded">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={creatingForParent ? 'Nombre de la subregión' : 'Nombre de la región raíz'}
            className="h-9 max-w-[320px]"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreatingForParent(undefined); setNewName(''); } }}
            data-testid="region-new-name-input"
          />
          <Button size="sm" onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-500" data-testid="region-confirm-create-btn">
            Crear
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCreatingForParent(undefined); setNewName(''); }}>
            Cancelar
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 py-1 mb-1">
            Nivel raíz (suelta aquí para hacer región principal)
          </div>
          <RootDropzone isPending={pendingCount > 0}>
            {flatNodes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8 italic">
                No hay regiones. Pulsa &quot;Sincronizar desde ubicaciones&quot; o &quot;Nueva región raíz&quot;.
              </p>
            )}
            {flatNodes.map(({ node, depth, hasChildren, childCount }) => (
              <NodeCard
                key={node.id}
                node={node}
                depth={depth}
                expanded={!!expanded[node.id]}
                onToggle={toggleExpand}
                isPending={Object.prototype.hasOwnProperty.call(pendingMoves, node.id)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCreateChild={(pid) => { setCreatingForParent(pid); setNewName(''); }}
                onCascade={handleCascade}
                editing={editingId === node.id}
                draftName={draftName}
                setDraftName={setDraftName}
                onSaveEdit={saveEdit}
                onCancelEdit={() => { setEditingId(null); setDraftName(''); }}
                onSetField={handleSetField}
                hasChildren={hasChildren}
                childCount={childCount}
              />
            ))}
          </RootDropzone>
        </div>
        <DragOverlay>
          {activeNode ? (
            <div className="px-4 py-3 rounded-lg bg-amber-900/90 border-2 border-amber-400 text-amber-100 font-heading text-xl uppercase tracking-wide shadow-2xl">
              <MapPin className="w-4 h-4 inline mr-2" />
              {activeNode.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {orphanRegions.length > 0 && (
        <div className="text-[11px] text-gray-500 italic">
          {orphanRegions.length} región(es) referenciadas en ubicaciones pero sin nodo en la jerarquía. Pulsa &quot;Sincronizar&quot;.
        </div>
      )}
    </div>
  );
};

export default RegionHierarchyTree;
