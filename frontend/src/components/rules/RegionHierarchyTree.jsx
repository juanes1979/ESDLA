/**
 * RegionHierarchyTree — Editor de jerarquía drag-and-drop con cambios
 * pendientes. Lee y escribe en la MISMA colección `regions` que la
 * lista existente (endpoint /data/regions), por lo que ambas vistas
 * muestran siempre la misma información.
 *
 * Diseño compacto (sólo orientado a MOVER):
 *  - Cards finas con nombre, conteos y badges.
 *  - Drag para reasignar padre. Cambios quedan PENDIENTES hasta pulsar
 *    "Guardar cambios". "Descartar" los limpia.
 *  - Para editar tipo_tierra / dificultad / nombre / borrar, usa la
 *    lista de Regiones existente (el editor sólo mueve).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, DragOverlay, useDroppable, useDraggable,
} from '@dnd-kit/core';
import {
  ChevronRight, ChevronDown, GripVertical, MapPin, Loader2, Save, Undo2, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/services/api';

const TERRENO_LABEL = {
  facil: 'Fácil', moderado: 'Moderado', dificil: 'Difícil',
  muy_dificil: 'Muy Difícil', desalentador: 'Desalentador', infranqueable: 'Infranqueable',
};
const TERRENO_COLOR = {
  facil: 'bg-yellow-200/70 text-yellow-900',
  moderado: 'bg-amber-300/70 text-amber-950',
  dificil: 'bg-yellow-400/70 text-yellow-950',
  muy_dificil: 'bg-amber-700/70 text-amber-100',
  desalentador: 'bg-red-700/70 text-red-100',
  infranqueable: 'bg-stone-600/70 text-stone-100',
};
const CLASE_LABEL = {
  tierras_libres: 'Tierras Libres', tierras_fronterizas: 'Fronterizas',
  tierras_salvajes: 'Salvajes', tierras_sombra: 'Sombra', tierras_oscuras: 'Oscuras',
  // alias por compatibilidad con datos viejos
  fronterizas: 'Fronterizas',
};
const CLASE_COLOR = {
  tierras_libres: 'bg-emerald-500/70 text-emerald-50',
  tierras_fronterizas: 'bg-yellow-400/70 text-yellow-950',
  fronterizas: 'bg-yellow-400/70 text-yellow-950',
  tierras_salvajes: 'bg-orange-500/70 text-orange-50',
  tierras_sombra: 'bg-rose-400/70 text-rose-950',
  tierras_oscuras: 'bg-red-600/70 text-red-50',
};

// ============== CARD ==============
const NodeCard = ({ node, depth, expanded, onToggle, isPending, hasChildren, childCount }) => {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id, data: { type: 'node', node },
  });
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `drop-${node.id}`, data: { type: 'drop-into', nodeId: node.id },
  });
  // El movimiento físico lo gestiona el `DragOverlay` global; aquí
  // sólo atenuamos la card de origen para indicar que se está
  // arrastrando. NO aplicamos `transform` porque desplazaría la card
  // sobre las demás del listado y crearía la sensación visual de
  // "todas las regiones se mueven a la vez".
  const sourceStyle = isDragging ? { opacity: 0.25 } : {};

  return (
    <div ref={setDropRef} style={{ paddingLeft: `${depth * 28}px` }}>
      <div
        ref={setDragRef}
        style={sourceStyle}
        className={`relative my-1.5 rounded-lg border overflow-hidden transition-all ${
          isDragging ? 'border-amber-400/60'
          : isPending ? 'border-amber-500/70 border-dashed bg-amber-900/20'
          : isOver ? 'border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40'
          : 'border-amber-900/40 bg-black/40 hover:border-amber-700/60'
        }`}
        data-testid={`region-card-${node.id}`}
      >
        <div className="flex items-center gap-2 p-2.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-amber-700/60 hover:text-amber-400 shrink-0"
            title="Arrastra para reasignar padre"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
          {hasChildren ? (
            <button onClick={() => onToggle(node.id)} className="text-amber-400 hover:text-amber-300 shrink-0">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span className="font-heading text-lg text-amber-300 uppercase tracking-wide truncate flex-1">
            {node.nombre}
          </span>
          {childCount > 0 && (
            <span className="text-xs text-gray-500 italic shrink-0">({childCount} sub)</span>
          )}
          {isPending && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-100 font-bold shrink-0">
              Pendiente
            </span>
          )}
          {node.tipo_terreno && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${TERRENO_COLOR[node.tipo_terreno] || ''}`}>
              {TERRENO_LABEL[node.tipo_terreno] || node.tipo_terreno}
            </span>
          )}
          {node.clase_region && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${CLASE_COLOR[node.clase_region] || ''}`}>
              {CLASE_LABEL[node.clase_region] || node.clase_region}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ============== ROOT DROPZONE ==============
const RootDropzone = ({ children, isPending }) => {
  const { isOver, setNodeRef } = useDroppable({ id: 'drop-root', data: { type: 'drop-root' } });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] rounded-lg ${
        isOver ? 'bg-amber-700/15 border-2 border-amber-500/60 border-dashed'
        : isPending ? 'border-2 border-amber-700/30 border-dashed' : ''
      } transition-colors`}
    >
      {children}
    </div>
  );
};

// ============== MAIN ==============
const RegionHierarchyTree = ({ onClose, onSaved }) => {
  const [regions, setRegions] = useState([]); // flat list
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [activeNode, setActiveNode] = useState(null);
  const [pendingMoves, setPendingMoves] = useState({}); // { id: parent_id|null }
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/data/regions/flat');
      setRegions(res.data?.regions || []);
    } catch (err) {
      toast.error('Error al cargar regiones');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Aplica los pendingMoves para mostrar el árbol resultante.
  const treeWithPending = useMemo(() => {
    const list = regions.map(r => {
      const pid = Object.prototype.hasOwnProperty.call(pendingMoves, r.id) ? pendingMoves[r.id] : (r.parent_id ?? null);
      return { ...r, parent_id: pid, children: [] };
    });
    const byId = Object.fromEntries(list.map(n => [n.id, n]));
    const roots = [];
    for (const n of list) {
      if (n.parent_id && byId[n.parent_id]) byId[n.parent_id].children.push(n);
      else roots.push(n);
    }
    const sortRec = (arr) => {
      arr.sort((a, b) => (a.orden || 0) - (b.orden || 0) || (a.nombre || '').localeCompare(b.nombre || ''));
      arr.forEach(n => sortRec(n.children));
    };
    sortRec(roots);
    return roots;
  }, [regions, pendingMoves]);

  const flatNodes = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      for (const n of nodes) {
        out.push({ node: n, depth, hasChildren: n.children.length > 0, childCount: n.children.length });
        if (expanded[n.id] && n.children.length > 0) walk(n.children, depth + 1);
      }
    };
    walk(treeWithPending);
    return out;
  }, [treeWithPending, expanded]);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const handleDragStart = (e) => setActiveNode(e.active?.data?.current?.node || null);

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
      // Detección de ciclos contra el árbol con pendientes aplicado
      const byId = {};
      const flat = [];
      const walk = (arr) => arr.forEach(n => { flat.push(n); byId[n.id] = n; if (n.children) walk(n.children); });
      walk(treeWithPending);
      let cur = byId[newParentId];
      while (cur) {
        if (cur.id === activeId) { toast.error('Movimiento crearía un ciclo'); return; }
        cur = cur.parent_id ? byId[cur.parent_id] : null;
      }
    }
    setPendingMoves(p => ({ ...p, [activeId]: newParentId }));
    if (newParentId) setExpanded(p => ({ ...p, [newParentId]: true }));
    toast.info('Cambio pendiente. Pulsa "Guardar" para aplicar.', { duration: 2000 });
  };

  const savePending = async () => {
    const ids = Object.keys(pendingMoves);
    if (!ids.length) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      try {
        await api.patch(`/data/regions/${id}/move`, { parent_id: pendingMoves[id] });
        ok++;
      } catch (err) {
        console.error('Move fail:', err); fail++;
      }
    }
    setSaving(false);
    setPendingMoves({});
    if (fail === 0) toast.success(`${ok} cambio${ok === 1 ? '' : 's'} guardado${ok === 1 ? '' : 's'}`);
    else toast.warning(`${ok} guardados, ${fail} fallaron`);
    await load();
    if (onSaved) onSaved();
  };

  const cancel = () => {
    setPendingMoves({});
    toast.info('Cambios pendientes descartados');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  const pendingCount = Object.keys(pendingMoves).length;

  return (
    <div className="space-y-3" data-testid="region-hierarchy-tree">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-lg text-amber-300 uppercase tracking-wide flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Modo Edición de Jerarquía
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Arrastra una región sobre otra para anidarla, o suelta arriba para hacerla principal. Los cambios quedan <span className="text-amber-300 font-semibold">pendientes</span> hasta pulsar Guardar.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pendingCount > 0 ? (
            <>
              <Button size="sm" variant="outline" className="border-gray-500 text-gray-300" onClick={cancel} disabled={saving} data-testid="region-cancel-pending-btn">
                <Undo2 className="w-3 h-3 mr-1" />
                Descartar ({pendingCount})
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold" onClick={savePending} disabled={saving} data-testid="region-save-pending-btn">
                {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Guardar {pendingCount} cambio{pendingCount === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={onClose} data-testid="region-close-editor-btn">
              Cerrar editor
            </Button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 py-1">
          Nivel raíz (suelta aquí para hacer región principal)
        </div>
        <RootDropzone isPending={pendingCount > 0}>
          {flatNodes.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6 italic">No hay regiones cargadas.</p>
          )}
          {flatNodes.map(({ node, depth, hasChildren, childCount }) => (
            <NodeCard
              key={node.id}
              node={node}
              depth={depth}
              expanded={!!expanded[node.id]}
              onToggle={toggleExpand}
              isPending={Object.prototype.hasOwnProperty.call(pendingMoves, node.id)}
              hasChildren={hasChildren}
              childCount={childCount}
            />
          ))}
        </RootDropzone>
        <DragOverlay>
          {activeNode ? (
            <div className="px-3 py-2 rounded-lg bg-amber-900/90 border-2 border-amber-400 text-amber-100 font-heading text-base uppercase tracking-wide shadow-2xl">
              <MapPin className="w-3 h-3 inline mr-2" />
              {activeNode.nombre}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default RegionHierarchyTree;
