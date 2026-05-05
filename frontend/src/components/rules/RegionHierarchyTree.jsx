/**
 * RegionHierarchyTree — Editor visual de jerarquía de regiones con
 * drag-and-drop (dnd-kit).
 *
 * Funcionalidad:
 *  - Muestra el árbol completo de regiones (Eriador → Angmar → ...).
 *  - Permite arrastrar nodos para reasignar su padre.
 *  - Edición inline de nombre, tipo_tierra, dificultad por nodo.
 *  - Botón "Cascadear" propaga valores a descendientes (saltando
 *    aquellos con override).
 *  - Crear nodo nuevo y eliminar nodo (reasigna hijos al abuelo).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  closestCenter, DragOverlay,
} from '@dnd-kit/core';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import {
  ChevronRight, ChevronDown, Plus, Trash2, GripVertical,
  Edit3, Check, X, ArrowDownToLine, RefreshCw, MapPin, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const TERRAIN_OPTIONS = [
  { value: 'facil', label: 'Fácil' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'dificil', label: 'Difícil' },
  { value: 'muy_dificil', label: 'Muy Difícil' },
  { value: 'desalentador', label: 'Desalentador' },
  { value: 'infranqueable', label: 'Infranqueable' },
];

const LAND_TYPE_OPTIONS = [
  { value: 'tierras_libres', label: 'Tierras Libres', color: 'text-emerald-300' },
  { value: 'fronterizas', label: 'Fronterizas', color: 'text-amber-300' },
  { value: 'tierras_salvajes', label: 'Tierras Salvajes', color: 'text-orange-300' },
  { value: 'tierras_sombra', label: 'Tierras de la Sombra', color: 'text-red-300' },
  { value: 'tierras_oscuras', label: 'Tierras Oscuras', color: 'text-purple-300' },
];

const labelLand = (v) => LAND_TYPE_OPTIONS.find(o => o.value === v)?.label || v || '—';
const labelTerrain = (v) => TERRAIN_OPTIONS.find(o => o.value === v)?.label || v || '—';
const colorLand = (v) => LAND_TYPE_OPTIONS.find(o => o.value === v)?.color || 'text-gray-400';

// =============== NODE ROW ===============
const NodeRow = ({
  node, depth, expanded, onToggle, onEdit, onDelete, onCreateChild,
  onCascade, editing, draftName, setDraftName, onSaveEdit, onCancelEdit,
  onSetField,
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
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: 0.5 }
    : {};

  const hasChildren = (node.children || []).length > 0 || (node.locations_count || 0) > 0;

  return (
    <div
      ref={setDropRef}
      className={`relative ${isOver ? 'bg-amber-500/15' : ''}`}
      style={{ paddingLeft: `${depth * 18}px` }}
    >
      <div
        ref={setDragRef}
        style={style}
        className={`flex items-center gap-2 py-2 px-2 my-0.5 rounded border ${
          isDragging ? 'border-amber-400 bg-amber-500/20' : 'border-transparent hover:bg-white/5'
        } transition-colors`}
        data-testid={`region-node-row-${node.id}`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-amber-400"
          title="Arrastra para reasignar padre"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="text-gray-400 hover:text-white"
            data-testid={`region-toggle-${node.id}`}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {editing ? (
          <>
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="h-7 max-w-[200px] text-sm"
              autoFocus
              data-testid={`region-edit-name-${node.id}`}
            />
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-400" onClick={onSaveEdit}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-400" onClick={onCancelEdit}>
              <X className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <span className="font-semibold text-amber-100 text-sm">{node.name}</span>
            <span className={`text-[10px] ${colorLand(node.tipo_tierra || node.clase_region)}`}>
              {labelLand(node.tipo_tierra || node.clase_region)}
            </span>
            <span className="text-[10px] text-gray-500">·</span>
            <span className="text-[10px] text-gray-400">
              {labelTerrain(node.dificultad)}
            </span>
            {(node.tipo_tierra_override || node.dificultad_override) && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-700/30 text-amber-200 border border-amber-600/40" title="Tiene override propio (no se sobreescribe en cascada)">
                override
              </span>
            )}
            {node.locations_count > 0 && (
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {node.locations_count}
              </span>
            )}
            {(node.children || []).length > 0 && (
              <span className="text-[10px] text-gray-500">
                · {node.children.length} subregión(es)
              </span>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <select
            value={node.tipo_tierra || node.clase_region || ''}
            onChange={(e) => onSetField(node.id, 'tipo_tierra', e.target.value)}
            className="bg-black/40 border border-gray-700 rounded text-[10px] px-1 py-0.5 text-white"
            data-testid={`region-set-land-${node.id}`}
            title="Tipo de tierra"
          >
            <option value="">—</option>
            {LAND_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            value={node.dificultad || ''}
            onChange={(e) => onSetField(node.id, 'dificultad', e.target.value)}
            className="bg-black/40 border border-gray-700 rounded text-[10px] px-1 py-0.5 text-white"
            data-testid={`region-set-terrain-${node.id}`}
            title="Dificultad"
          >
            <option value="">—</option>
            {TERRAIN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onEdit(node)} title="Renombrar">
            <Edit3 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onCreateChild(node.id)} title="Crear subregión">
            <Plus className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-amber-300" onClick={() => onCascade(node.id)} title="Cascadear valores a descendientes">
            <ArrowDownToLine className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400" onClick={() => onDelete(node.id)} title="Eliminar">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// =============== ROOT DROPZONE ===============
const RootDropzone = ({ children }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'drop-root',
    data: { type: 'drop-root' },
  });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[40px] rounded p-1 ${isOver ? 'bg-amber-700/15 border border-amber-500/40' : ''}`}
    >
      {children}
    </div>
  );
};

// =============== MAIN COMPONENT ===============
const RegionHierarchyTree = () => {
  const [tree, setTree] = useState([]);
  const [orphanRegions, setOrphanRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [activeNode, setActiveNode] = useState(null);
  const [creatingForParent, setCreatingForParent] = useState(undefined); // undefined = no, null = root, id = parent
  const [newName, setNewName] = useState('');

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

  // Aplanado para drag-and-drop (dnd-kit necesita IDs únicos)
  const flatNodes = useMemo(() => {
    const out = [];
    const walk = (nodes, depth = 0) => {
      for (const n of nodes) {
        out.push({ node: n, depth });
        if (expanded[n.id] && (n.children || []).length > 0) {
          walk(n.children, depth + 1);
        }
      }
    };
    walk(tree);
    return out;
  }, [tree, expanded]);

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const handleEdit = (node) => {
    setEditingId(node.id);
    setDraftName(node.name);
  };

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
      toast.success('Nodo eliminado');
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleCascade = async (nodeId) => {
    if (!window.confirm('Cascadear valores (tipo_tierra y dificultad) a TODOS los descendientes que NO tengan override propio. ¿Continuar?')) return;
    try {
      const res = await api.post(`/regions/node/${nodeId}/cascade`, {
        fields: ['tipo_tierra', 'dificultad', 'clase_region'],
        apply_to_locations: true,
      });
      const d = res.data;
      toast.success(`Cascada aplicada · ${d.nodes_updated} nodos · ${d.locations_updated} ubicaciones`);
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
      await api.post('/regions/node', {
        name: newName.trim(),
        parent_id: creatingForParent || null,
      });
      toast.success(`Nodo "${newName}" creado`);
      setCreatingForParent(undefined);
      setNewName('');
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear');
    }
  };

  const handleSeed = async () => {
    if (!window.confirm('Crear automáticamente un nodo por cada región distinta encontrada en las ubicaciones (no recrea los existentes)?')) return;
    try {
      const res = await api.post('/regions/seed-from-locations');
      toast.success(`${res.data.total} nodos creados, ${res.data.skipped_existing.length} ya existían`);
      await loadTree();
    } catch (err) {
      toast.error('Error al sembrar regiones');
    }
  };

  const handleDragStart = (e) => {
    setActiveNode(e.active?.data?.current?.node || null);
  };

  const handleDragEnd = async (e) => {
    setActiveNode(null);
    const overData = e.over?.data?.current;
    const activeId = e.active?.id;
    if (!overData || !activeId) return;
    let newParentId = null;
    if (overData.type === 'drop-root') {
      newParentId = null;
    } else if (overData.type === 'drop-into') {
      newParentId = overData.nodeId;
      if (newParentId === activeId) return; // sí mismo
    }
    try {
      await api.patch(`/regions/node/${activeId}/move`, { parent_id: newParentId });
      toast.success('Nodo reasignado');
      // expandir destino para verlo
      if (newParentId) setExpanded(p => ({ ...p, [newParentId]: true }));
      await loadTree();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo mover');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="region-hierarchy-tree">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-lg text-amber-300">Jerarquía de Regiones</h3>
          <p className="text-[11px] text-gray-400">
            Arrastra nodos por el icono <GripVertical className="inline w-3 h-3" /> para reasignar su padre. Los cambios manuales activan un override y NO se sobreescriben en cascada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} className="text-xs" data-testid="region-seed-btn">
            <RefreshCw className="w-3 h-3 mr-1" />
            Sincronizar regiones desde ubicaciones
          </Button>
          <Button size="sm" onClick={() => { setCreatingForParent(null); setNewName(''); }} className="text-xs bg-amber-600 hover:bg-amber-500 text-black" data-testid="region-create-root-btn">
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
            placeholder={creatingForParent ? "Nombre de la subregión" : "Nombre de la región raíz"}
            className="h-8 max-w-[280px]"
            autoFocus
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
        <div className="bg-black/30 border border-gray-700 rounded-lg p-2 group">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 px-2 py-1 mb-1">
            Raíz (suelta aquí para hacer una región principal)
          </div>
          <RootDropzone>
            {flatNodes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6 italic">
                Aún no hay regiones. Pulsa &quot;Sincronizar regiones desde ubicaciones&quot; para crearlas automáticamente.
              </p>
            )}
            {flatNodes.map(({ node, depth }) => (
              <NodeRow
                key={node.id}
                node={node}
                depth={depth}
                expanded={!!expanded[node.id]}
                onToggle={toggleExpand}
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
              />
            ))}
          </RootDropzone>
        </div>
        <DragOverlay>
          {activeNode ? (
            <div className="px-3 py-2 rounded bg-amber-900/80 border border-amber-400 text-amber-100 font-semibold text-sm shadow-xl">
              {activeNode.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {orphanRegions.length > 0 && (
        <div className="text-[11px] text-gray-500 italic">
          {orphanRegions.length} región(es) referenciadas en ubicaciones pero sin nodo en la jerarquía. Pulsa &quot;Sincronizar&quot; para crearlas.
        </div>
      )}
    </div>
  );
};

export default RegionHierarchyTree;
