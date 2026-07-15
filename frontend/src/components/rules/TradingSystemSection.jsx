/**
 * Trading System Section
 * Complete dynamic buy/sell system with NPC negotiation, relationship tracking, and AI dialogue
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Loader2, Save, RefreshCw, Plus, Trash2, Edit, ChevronDown, ChevronUp, 
  Coins, Package, User, Users, Settings, Calculator, MessageSquare, 
  Handshake, AlertTriangle, Check, X, Dices, TrendingUp, TrendingDown,
  ShoppingCart, Store, History, Sparkles, Wand2, Image as ImageIcon, EyeOff, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import TiendaD100 from '@/components/trading/TiendaD100';
import ConfigCellsEditor from '@/components/trading/ConfigCellsEditor';
import api from '@/services/api';

// ============================================================================
// CONSTANTS AND HELPERS
// ============================================================================

const TABS = [
  { id: 'tienda-d100', name: 'Tienda D100', icon: Store },
  { id: 'calculator', name: 'Calculadora', icon: Calculator },
  { id: 'config', name: 'Configuración', icon: Settings },
  { id: 'npcs', name: 'PNJs', icon: Users },
  { id: 'relationships', name: 'Relaciones', icon: Handshake },
];

const RELATIONSHIP_COLORS = {
  hostil: 'bg-red-900/50 border-red-600 text-red-400',
  desconocido: 'bg-gray-800/50 border-gray-600 text-gray-400',
  neutral: 'bg-gray-700/50 border-gray-500 text-gray-300',
  cordial: 'bg-yellow-900/50 border-yellow-600 text-yellow-400',
  amigo: 'bg-green-900/50 border-green-600 text-green-400',
  hermandad: 'bg-blue-900/50 border-blue-500 text-blue-300',
};

const RESULTADO_STYLES = {
  acepta: { bg: 'bg-green-900/30', border: 'border-green-600', text: 'text-green-400', icon: Check },
  rechaza: { bg: 'bg-red-900/30', border: 'border-red-600', text: 'text-red-400', icon: X },
  contraoferta: { bg: 'bg-yellow-900/30', border: 'border-yellow-600', text: 'text-yellow-400', icon: TrendingUp },
  enfado: { bg: 'bg-red-950/50', border: 'border-red-800', text: 'text-red-500', icon: AlertTriangle },
};

const formatCurrency = (amount, currency = 'mp') => {
  if (amount === null || amount === undefined) return '-';
  return `${amount.toFixed(2)} ${currency}`;
};

// Settlement levels hierarchy (higher number = more availability).
// Canonical types matching the DB tagging used by EquipmentSection
// (`item.nivel_asentamiento` is one of these strings).
const SETTLEMENT_LEVELS = {
  'aldea': 1,
  'pueblo': 2,
  'villa': 3,
  'ciudad': 4,
  'capital': 5,
};

const SETTLEMENT_LEVEL_NAMES = {
  1: 'Aldea',
  2: 'Pueblo',
  3: 'Villa',
  4: 'Ciudad',
  5: 'Capital',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const TradingSystemSection = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState('tienda-d100');
  const [loading, setLoading] = useState(true);
  
  // Config state
  const [config, setConfig] = useState(null);
  
  // Calculator state
  const [equipment, setEquipment] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [regions, setRegions] = useState([]);
  const [priceModifiers, setPriceModifiers] = useState(null);
  
  // Config tab expanded section
  const [expandedConfigSection, setExpandedConfigSection] = useState(null);
  
  // Calculator form
  const [calcForm, setCalcForm] = useState({
    articulo: null,
    precio_base: 0,
    bendicion: 'ninguna',
    categoria: 'general',
    region: '',
    nivel_asentamiento: 4, // Default: Ciudad
    modificador_region: 0,
    tipo_asentamiento: 'ciudad',
    modificador_asentamiento: 0,
    contexto_historico: '',
    relacion: 'neutral',
    perfil_comerciante: 'normal',
    modo: 'compra',
    oferta: 0,
    npc_id: null,
    character_id: null,
  });
  
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Item search state
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  // Player (character) selector state
  const [playerSearch, setPlayerSearch] = useState('');
  const [showPlayerDropdown, setShowPlayerDropdown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmWarnings, setConfirmWarnings] = useState(null);
  const [despedida, setDespedida] = useState(null);
  const [endingTrade, setEndingTrade] = useState(false);

  const filteredCharacters = useMemo(() => {
    const q = playerSearch.toLowerCase().trim();
    const list = characters || [];
    if (!q) return list.slice(0, 30);
    return list.filter(c =>
      (c.nombre || '').toLowerCase().includes(q) ||
      (c.jugador || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [characters, playerSearch]);

  const selectedCharacter = useMemo(
    () => (characters || []).find(c => c.id === calcForm.character_id) || null,
    [characters, calcForm.character_id]
  );

  const selectedNpc = useMemo(
    () => (npcs || []).find(n => n._id === calcForm.npc_id) || null,
    [npcs, calcForm.npc_id]
  );

  // "Jugador físicamente presente": solo se puede comerciar con un PNJ si el
  // personaje está en la misma ubicación. Solo bloquea si ambos datos existen.
  const presenciaError = useMemo(() => {
    if (!selectedNpc || !selectedCharacter) return null;
    const npcLoc = selectedNpc.ubicacion_id;
    const charLoc = selectedCharacter.ubicacion_actual?.id;
    if (!npcLoc || !charLoc) return null;  // no se puede determinar → no bloquea
    if (npcLoc !== charLoc) {
      return `${selectedCharacter.nombre} no está en ${selectedNpc.ubicacion} (está en ${selectedCharacter.ubicacion_actual?.nombre || 'otro lugar'}). No puede comerciar con este PNJ.`;
    }
    return null;
  }, [selectedNpc, selectedCharacter]);

  // Flatten equipment for selector (memo at component level)
  const allItems = useMemo(() => {
    const items = [];
    Object.entries(equipment).forEach(([categoria, lista]) => {
      if (Array.isArray(lista)) {
        lista.forEach(item => items.push({ ...item, _categoria: categoria }));
      }
    });
    return items;
  }, [equipment]);

  // Filter items based on search, region and settlement level
  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.toLowerCase().trim();
    const selectedRegion = calcForm.region;
    const selectedSettlement = calcForm.tipo_asentamiento;

    // Map our settlement type keys to the values in the database.
    // Now both sides use the same canonical names, so the mapping is identity.
    const settlementKeyToDbValue = {
      'aldea': 'aldea',
      'pueblo': 'pueblo',
      'villa': 'villa',
      'ciudad': 'ciudad',
      'capital': 'capital',
    };
    
    const dbSettlementValue = settlementKeyToDbValue[selectedSettlement] || selectedSettlement;

    return allItems.filter(item => {
      // Ensure item has a valid nombre
      if (!item.nombre || typeof item.nombre !== 'string') {
        return false;
      }
      
      // Filter by search query
      if (query && !item.nombre.toLowerCase().includes(query)) {
        return false;
      }
      
      // Filter by settlement level - item must be available at this settlement type.
      // Strict: only show items whose `nivel_asentamiento` array explicitly
      // includes the selected settlement type.
      if (selectedSettlement && item.nivel_asentamiento && Array.isArray(item.nivel_asentamiento)) {
        if (!item.nivel_asentamiento.includes(dbSettlementValue)) {
          return false;
        }
      }
      
      // Filter by region if item has region restrictions
      if (selectedRegion && item.regiones_disponibles?.length > 0) {
        // Check if item is available in the selected region
        const regionMatch = item.regiones_disponibles.some(r => 
          r && typeof r === 'string' && (
            r.toLowerCase() === 'todas' || 
            r === selectedRegion ||
            r.toLowerCase() === selectedRegion.toLowerCase()
          )
        );
        if (!regionMatch) {
          return false;
        }
      }

      // Filtro por PROFESIÓN del PNJ: solo el equipo asignado a su profesión.
      // Herencia: profesiones del objeto > profesiones del bloque. Si no hay
      // ninguna asignada, lo puede vender cualquiera (compatibilidad).
      if (selectedNpc?.profesion) {
        const propias = Array.isArray(item.profesiones) ? item.profesiones : [];
        const delBloque = (equipment._block_profesiones || {})[item._categoria] || [];
        const efectivas = propias.length > 0 ? propias : delBloque;
        if (efectivas.length > 0 && !efectivas.includes(selectedNpc.profesion)) {
          return false;
        }
      }
      
      return true;
    });
  }, [allItems, itemSearchQuery, calcForm.region, calcForm.tipo_asentamiento, selectedNpc, equipment]);

  // Group filtered items by category for display
  const groupedFilteredItems = useMemo(() => {
    const groups = {};
    filteredItems.forEach(item => {
      const cat = item._categoria || 'otros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [filteredItems]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadConfig(),
        loadEquipment(),
        loadCharacters(),
        loadNpcs(),
        loadRelationships(),
        loadRegions(),
        loadPriceModifiers(),
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await api.get('/trading/config');
      setConfig(res.data);
    } catch (err) {
      console.error('Error loading trading config:', err);
    }
  };

  const loadEquipment = async () => {
    try {
      const res = await api.get('/data/equipment-catalog');
      setEquipment(res.data || {});
    } catch (err) {
      console.error('Error loading equipment:', err);
    }
  };

  const loadCharacters = async () => {
    try {
      const res = await api.get('/characters/');
      setCharacters(res.data?.characters || []);
    } catch (err) {
      console.error('Error loading characters:', err);
    }
  };

  const loadNpcs = async () => {
    try {
      const res = await api.get('/trading/npcs');
      setNpcs(res.data?.npcs || []);
    } catch (err) {
      console.error('Error loading NPCs:', err);
    }
  };

  const loadRelationships = async () => {
    try {
      const res = await api.get('/trading/relationships');
      setRelationships(res.data?.relationships || []);
      const purged = res.data?.purged_orphans || 0;
      if (purged > 0) {
        toast.info(`Se limpiaron ${purged} relación(es) huérfana(s) (PJ o PNJ inexistentes).`);
      }
    } catch (err) {
      console.error('Error loading relationships:', err);
    }
  };

  const deleteRelationship = async (relId) => {
    if (!window.confirm('¿Eliminar esta relación PJ-PNJ?')) return;
    try {
      await api.delete(`/trading/relationships/${relId}`);
      toast.success('Relación eliminada');
      await loadRelationships();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al eliminar la relación');
    }
  };

  const loadRegions = async () => {
    try {
      const res = await api.get('/data/regions');
      setRegions(res.data?.regions || []);
    } catch (err) {
      console.error('Error loading regions:', err);
    }
  };

  const loadPriceModifiers = async () => {
    try {
      const res = await api.get('/data/modificadores-precio');
      setPriceModifiers(res.data);
    } catch (err) {
      console.error('Error loading price modifiers:', err);
    }
  };

  // ============================================================================
  // CONFIG HANDLERS
  // ============================================================================

  const saveConfig = async () => {
    try {
      await api.put('/trading/config', config);
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error('Error al guardar');
    }
  };

  const resetConfig = async () => {
    if (!confirm('¿Restablecer toda la configuración a valores por defecto?')) return;
    try {
      await api.post('/trading/config/reset');
      await loadConfig();
      toast.success('Configuración restablecida');
    } catch (err) {
      toast.error('Error al restablecer');
    }
  };

  // ============================================================================
  // CALCULATOR HANDLERS
  // ============================================================================

  const calculateTrade = async () => {
    if (!calcForm.precio_base || calcForm.precio_base <= 0) {
      toast.error('Selecciona un artículo o introduce un precio base');
      return;
    }
    
    setCalculating(true);
    try {
      const payload = {
        articulo: {
          nombre: calcForm.articulo?.nombre || 'Artículo',
          precio_base: calcForm.precio_base,
          categoria: calcForm.categoria,
          bendicion: calcForm.bendicion,
        },
        modificador_region: calcForm.modificador_region,
        modificador_asentamiento: calcForm.modificador_asentamiento,
        contexto_historico: calcForm.contexto_historico,
        relacion: calcForm.relacion,
        perfil_comerciante: calcForm.perfil_comerciante,
        modo: calcForm.modo,
        oferta: calcForm.oferta,
        npc_id: calcForm.npc_id,
      };
      
      const res = await api.post('/trading/calculate-with-dialogue', payload);
      setCalcResult(res.data);
      setConfirmWarnings(null);
    } catch (err) {
      console.error('Error calculating trade:', err);
      toast.error('Error al calcular');
    } finally {
      setCalculating(false);
    }
  };

  // Aplica la transacción negociada al personaje (inventario + dinero).
  const confirmTransaction = async (precioAcordado) => {
    if (!calcForm.character_id) {
      toast.error('Selecciona primero el personaje que realiza la transacción');
      return;
    }
    if (!calcForm.articulo) {
      toast.error('No hay artículo seleccionado');
      return;
    }
    setConfirming(true);
    setConfirmWarnings(null);
    try {
      const payload = {
        character_id: calcForm.character_id,
        modo: calcForm.modo,
        articulo: {
          nombre: calcForm.articulo.nombre,
          categoria_catalogo: calcForm.articulo._categoria || calcForm.categoria,
          peso_kg: calcForm.articulo.peso_kg,
          capacidad_carga: calcForm.articulo.capacidad_carga,
        },
        cantidad: 1,
        precio_total: precioAcordado,
        moneda: 'mp',
      };
      const res = await api.post('/trading/confirm-transaction', payload);
      toast.success(res.data?.message || 'Transacción confirmada');
      setConfirmWarnings(res.data?.warnings || []);
      // Actualiza la copia local del personaje para reflejar dinero/peso
      if (res.data?.character) {
        setCharacters(prev => prev.map(c => c.id === res.data.character.id ? res.data.character : c));
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Error al confirmar la transacción';
      toast.error(detail);
    } finally {
      setConfirming(false);
    }
  };

  // FASE 3: Terminar de comerciar → registra interacción y pide despedida IA.
  const terminarComercio = async () => {
    if (!calcForm.npc_id) { toast.error('Selecciona un PNJ comerciante'); return; }
    setEndingTrade(true);
    setDespedida(null);
    try {
      if (calcForm.character_id) {
        await api.post(`/trading/npcs/${calcForm.npc_id}/interaction`, {
          character_id: calcForm.character_id,
          interaccion: 'Sesión de comercio finalizada',
          impacto_modificador: 0,
        });
      }
      const res = await api.post(`/trading/npcs/${calcForm.npc_id}/farewell`, {
        character_id: calcForm.character_id,
      });
      setDespedida(res.data);
    } catch (e) {
      toast.error('Error al terminar de comerciar');
    } finally {
      setEndingTrade(false);
    }
  };

  const selectEquipmentItem = (item, categoria) => {
    setCalcForm(prev => ({
      ...prev,
      articulo: item,
      precio_base: item.precio || 0,
      categoria: getCategoryType(categoria),
      oferta: item.precio || 0,
    }));
  };

  const getCategoryType = (categoria) => {
    if (['armas_cuerpo_cuerpo', 'armas_distancia', 'municion'].includes(categoria)) return 'armas';
    if (['armaduras', 'escudos', 'cascos'].includes(categoria)) return 'armaduras';
    if (['comida_bebida', 'provisiones'].includes(categoria)) return 'comida';
    if (['gemas_preciosas', 'gemas_semipreciosas', 'joyas'].includes(categoria)) return 'lujo';
    return 'general';
  };

  // ============================================================================
  // NPC HANDLERS  
  // ============================================================================

  const [showNpcEditor, setShowNpcEditor] = useState(false);
  const [editingNpc, setEditingNpc] = useState(null);
  const [generatingNpc, setGeneratingNpc] = useState(false);

  const generateRandomNpc = async (params = {}) => {
    setGeneratingNpc(true);
    try {
      const res = await api.post('/trading/npcs/generate', {
        ...params,
        guardar: true,
      });
      await loadNpcs();
      toast.success('PNJ generado y guardado');
      return res.data.npc;
    } catch (err) {
      toast.error('Error al generar PNJ');
    } finally {
      setGeneratingNpc(false);
    }
  };

  const saveNpc = async (npcData) => {
    try {
      if (npcData._id) {
        await api.put(`/trading/npcs/${npcData._id}`, npcData);
        toast.success('PNJ actualizado');
      } else {
        await api.post('/trading/npcs', npcData);
        toast.success('PNJ creado');
      }
      await loadNpcs();
      setShowNpcEditor(false);
      setEditingNpc(null);
    } catch (err) {
      toast.error('Error al guardar PNJ');
    }
  };

  const deleteNpc = async (npcId) => {
    if (!confirm('¿Eliminar este PNJ?')) return;
    try {
      await api.delete(`/trading/npcs/${npcId}`);
      await loadNpcs();
      toast.success('PNJ eliminado');
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderTabs = () => (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map(tab => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? 'default' : 'outline'}
          onClick={() => setActiveTab(tab.id)}
          className={activeTab === tab.id ? 'bg-[hsl(var(--gold))] text-black' : ''}
          data-testid={`tab-${tab.id}`}
        >
          <tab.icon className="w-4 h-4 mr-2" />
          {tab.name}
        </Button>
      ))}
    </div>
  );

  // ============================================================================
  // CALCULATOR TAB
  // ============================================================================

  const renderCalculatorTab = () => {
    const handleSelectItem = (item) => {
      selectEquipmentItem(item, item._categoria);
      setItemSearchQuery(item.nombre);
      setShowItemDropdown(false);
    };

    return (
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Datos de la Transacción
          </h3>

          {/* Mode selector */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Modo</label>
            <div className="flex gap-2">
              <Button
                variant={calcForm.modo === 'compra' ? 'default' : 'outline'}
                onClick={() => setCalcForm(p => ({ ...p, modo: 'compra' }))}
                className={calcForm.modo === 'compra' ? 'bg-green-700' : ''}
                data-testid="mode-buy"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Comprar
              </Button>
              <Button
                variant={calcForm.modo === 'venta' ? 'default' : 'outline'}
                onClick={() => setCalcForm(p => ({ ...p, modo: 'venta' }))}
                className={calcForm.modo === 'venta' ? 'bg-blue-700' : ''}
                data-testid="mode-sell"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Vender
              </Button>
            </div>
          </div>

          {/* PLAYER SELECTOR */}
          <div className="bg-black/20 rounded-lg p-4 border border-[hsl(var(--magic-blue))]/40" data-testid="trade-player-section">
            <h4 className="text-sm font-medium text-[hsl(var(--magic-blue))] mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Personaje que realiza la transacción
            </h4>
            {selectedCharacter ? (
              <div className="flex items-center justify-between gap-2 bg-black/30 rounded px-3 py-2 border border-[hsl(var(--magic-blue))]/30">
                <div>
                  <p className="font-medium" data-testid="trade-selected-character">{selectedCharacter.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedCharacter.jugador ? `Jugador: ${selectedCharacter.jugador}` : 'Sin jugador'}
                    {selectedCharacter.dinero && ` · ${formatCurrency((selectedCharacter.dinero.mp || 0))} `}
                  </p>
                </div>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { setCalcForm(p => ({ ...p, character_id: null })); setPlayerSearch(''); setConfirmWarnings(null); }}
                  data-testid="trade-change-character"
                >
                  <X className="w-4 h-4 mr-1" /> Cambiar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Busca por nombre de personaje o jugador..."
                  value={playerSearch}
                  onChange={(e) => { setPlayerSearch(e.target.value); setShowPlayerDropdown(true); }}
                  onFocus={() => setShowPlayerDropdown(true)}
                  data-testid="trade-player-search"
                />
                {showPlayerDropdown && filteredCharacters.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full max-h-60 overflow-y-auto bg-[hsl(var(--background))] border border-border rounded shadow-lg" data-testid="trade-player-dropdown">
                    {filteredCharacters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-[hsl(var(--magic-blue))]/20 border-b border-border/30"
                        onClick={() => {
                          setCalcForm(p => ({ ...p, character_id: c.id }));
                          setPlayerSearch('');
                          setShowPlayerDropdown(false);
                          setConfirmWarnings(null);
                        }}
                        data-testid={`trade-player-option-${c.id}`}
                      >
                        <span className="font-medium">{c.nombre}</span>
                        {c.jugador && <span className="text-xs text-muted-foreground ml-2">({c.jugador})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* LOCATION SECTION - FIRST */}
          <div className="bg-black/20 rounded-lg p-4 border border-[hsl(var(--gold))]/30">
            <h4 className="text-sm font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              1. Ubicación del Comercio
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Selecciona primero la ubicación. El equipo disponible dependerá de la región y tipo de asentamiento.
            </p>
            
            {/* Region selector */}
            <div className="mb-3">
              <label className="text-sm text-muted-foreground mb-1 block">Región</label>
              <select
                className="w-full bg-black/30 border border-border rounded px-3 py-2"
                value={calcForm.region}
                onChange={(e) => {
                  const selectedRegion = e.target.value;
                  const regionData = priceModifiers?.region?.find(r => r.nombre === selectedRegion);
                  // Convert multiplier to percentage (1.1 -> 10, 0.9 -> -10)
                  const modPercent = regionData ? Math.round((regionData.modificador - 1) * 100) : 0;
                  setCalcForm(p => ({ 
                    ...p, 
                    region: selectedRegion,
                    modificador_region: modPercent,
                    articulo: null, // Reset article when region changes
                    precio_base: 0,
                    oferta: 0
                  }));
                  setItemSearchQuery('');
                }}
                data-testid="region-selector"
              >
                <option value="">-- Seleccionar región --</option>
                {(() => {
                  // Build the dropdown walking the actual region hierarchy
                  // (`regions` from /data/regions). Match the price modifier
                  // by exact `nombre`; default to 0% when missing. This keeps
                  // the dropdown in sync with what the user has created in
                  // Reglas → Regiones (no duplicates, no orphans, full tree).
                  const modByName = new Map();
                  (priceModifiers?.region || []).forEach(rr => {
                    if (rr?.nombre) modByName.set(rr.nombre.trim().toLowerCase(), rr);
                  });
                  const ordered = [];
                  (regions || []).forEach(top => {
                    ordered.push({
                      nombre: top.nombre,
                      modificador: modByName.get((top.nombre || '').trim().toLowerCase())?.modificador ?? 1,
                      depth: 0,
                    });
                    (top.subregions || []).forEach(sub => {
                      ordered.push({
                        nombre: sub.nombre,
                        modificador: modByName.get((sub.nombre || '').trim().toLowerCase())?.modificador ?? 1,
                        depth: 1,
                      });
                    });
                  });
                  return ordered.map(r => {
                    const modPercent = Math.round((r.modificador - 1) * 100);
                    const prefix = `${'\u00A0\u00A0'.repeat(r.depth)}${r.depth > 0 ? '└─ ' : ''}`;
                    return (
                      <option key={`${r.depth}-${r.nombre}`} value={r.nombre}>
                        {`${prefix}${r.nombre} (${modPercent >= 0 ? '+' : ''}${modPercent}%)`}
                      </option>
                    );
                  });
                })()}
              </select>
            </div>

            {/* Settlement type selector */}
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tipo de Asentamiento</label>
              <select
                className="w-full bg-black/30 border border-border rounded px-3 py-2"
                value={calcForm.tipo_asentamiento}
                onChange={(e) => {
                  const settlementType = e.target.value;
                  // Exact-match on canonical asentamiento name to avoid
                  // "Ciudad" matching "Ciudad pequeña" first.
                  const settlementData = priceModifiers?.asentamiento?.find(a =>
                    a.nombre.trim().toLowerCase() === settlementType.toLowerCase()
                  );
                  const level = SETTLEMENT_LEVELS[settlementType] || 4;
                  // Convert multiplier to percentage
                  const modPercent = settlementData ? Math.round((settlementData.modificador - 1) * 100) : 0;
                  setCalcForm(p => ({ 
                    ...p, 
                    tipo_asentamiento: settlementType,
                    nivel_asentamiento: level,
                    modificador_asentamiento: modPercent,
                    articulo: null, // Reset article when settlement changes
                    precio_base: 0,
                    oferta: 0
                  }));
                  setItemSearchQuery('');
                }}
                data-testid="settlement-selector"
              >
                <option value="">-- Seleccionar tipo --</option>
                {Object.entries(SETTLEMENT_LEVELS).map(([key, level]) => {
                  const settlementData = priceModifiers?.asentamiento?.find(a =>
                    a.nombre.trim().toLowerCase() === key.toLowerCase()
                  );
                  const modPercent = settlementData ? Math.round((settlementData.modificador - 1) * 100) : 0;
                  return (
                    <option key={key} value={key}>
                      {SETTLEMENT_LEVEL_NAMES[level]} (Nivel {level}) {settlementData ? `(${modPercent >= 0 ? '+' : ''}${modPercent}%)` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* ITEM SEARCH SECTION */}
          <div className="bg-black/20 rounded-lg p-4 border border-border/30">
            <h4 className="text-sm font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              2. Seleccionar Artículo
            </h4>
            {calcForm.region && calcForm.tipo_asentamiento ? (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Mostrando {filteredItems.length} artículos disponibles en {calcForm.region} ({SETTLEMENT_LEVEL_NAMES[calcForm.nivel_asentamiento] || 'Ciudad'})
                </p>
                
                {/* Search input with dropdown */}
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Buscar artículo... (ej: espada, caballo, rubí)"
                    value={itemSearchQuery}
                    onChange={(e) => {
                      setItemSearchQuery(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    className="w-full"
                    data-testid="item-search"
                  />
                  
                  {/* Dropdown with filtered items */}
                  {showItemDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-black/95 border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No hay artículos disponibles con ese nombre en esta ubicación.
                        </div>
                      ) : (
                        Object.entries(groupedFilteredItems).map(([cat, items]) => (
                          <div key={cat}>
                            <div className="px-3 py-2 bg-black/50 text-xs font-medium text-[hsl(var(--gold))] uppercase sticky top-0">
                              {cat.replace(/_/g, ' ')}
                            </div>
                            {items.slice(0, 10).map(item => (
                              <button
                                key={`${cat}-${item.nombre}`}
                                className="w-full px-3 py-2 text-left hover:bg-[hsl(var(--gold))]/10 flex justify-between items-center border-b border-border/20 last:border-0"
                                onClick={() => handleSelectItem(item)}
                              >
                                <span className="text-sm">{item.nombre}</span>
                                <span className="text-xs text-[hsl(var(--torch-orange))]">
                                  {item.precio} {item.moneda || 'mp'}
                                </span>
                              </button>
                            ))}
                            {items.length > 10 && (
                              <div className="px-3 py-1 text-xs text-muted-foreground italic">
                                ...y {items.length - 10} más. Escribe para filtrar.
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      
                      {/* Close button */}
                      <button
                        className="w-full px-3 py-2 text-xs text-center text-muted-foreground hover:bg-black/50 border-t border-border"
                        onClick={() => setShowItemDropdown(false)}
                      >
                        Cerrar
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Selected item display */}
                {calcForm.articulo && (
                  <div className="mt-3 p-3 bg-[hsl(var(--gold))]/10 rounded border border-[hsl(var(--gold))]/30">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-[hsl(var(--gold))]">{calcForm.articulo.nombre}</span>
                        <span className="text-xs text-muted-foreground ml-2">({calcForm.categoria})</span>
                      </div>
                      <span className="text-[hsl(var(--torch-orange))] font-bold">
                        {calcForm.precio_base} {calcForm.articulo.moneda || 'mp'}
                      </span>
                    </div>
                    {calcForm.articulo.nivel_asentamiento && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Requiere: {SETTLEMENT_LEVEL_NAMES[calcForm.articulo.nivel_asentamiento]} o superior
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Selecciona primero la región y tipo de asentamiento</p>
              </div>
            )}
          </div>

          {/* Manual price override */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Precio Base</label>
              <Input
                type="number"
                step="0.1"
                value={calcForm.precio_base}
                onChange={(e) => setCalcForm(p => ({ ...p, precio_base: parseFloat(e.target.value) || 0 }))}
                data-testid="base-price"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Tu Oferta</label>
              <Input
                type="number"
                step="0.1"
                value={calcForm.oferta}
                onChange={(e) => setCalcForm(p => ({ ...p, oferta: parseFloat(e.target.value) || 0 }))}
                data-testid="offer-price"
              />
            </div>
          </div>

          {/* Blessing */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Bendición/Mejora del Artículo</label>
            <select
              className="w-full bg-black/30 border border-border rounded px-3 py-2"
              value={calcForm.bendicion}
              onChange={(e) => setCalcForm(p => ({ ...p, bendicion: e.target.value }))}
              data-testid="blessing-selector"
            >
              {config?.blessing_modifiers && Object.entries(config.blessing_modifiers).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.nombre} ({val.modificador > 0 ? '+' : ''}{val.modificador}%)
                </option>
              ))}
            </select>
          </div>

          {/* Historical context */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Contexto Histórico</label>
            <select
              className="w-full bg-black/30 border border-border rounded px-3 py-2"
              value={calcForm.contexto_historico}
              onChange={(e) => setCalcForm(p => ({ ...p, contexto_historico: e.target.value }))}
              data-testid="context-selector"
            >
              <option value="">Normal (sin contexto especial)</option>
              {config?.historical_contexts && Object.entries(config.historical_contexts).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Relationship */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Relación con el Vendedor</label>
            <select
              className="w-full bg-black/30 border border-border rounded px-3 py-2"
              value={calcForm.relacion}
              onChange={(e) => setCalcForm(p => ({ ...p, relacion: e.target.value }))}
              data-testid="relationship-selector"
            >
              {config?.relationship_levels && Object.entries(config.relationship_levels)
                .sort((a, b) => a[1].orden - b[1].orden)
                .map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.nombre} (Compra: {val.mod_compra > 0 ? '+' : ''}{val.mod_compra}%, Venta: {val.mod_venta > 0 ? '+' : ''}{val.mod_venta}%)
                  </option>
                ))}
            </select>
          </div>

          {/* Merchant profile */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Perfil del Comerciante</label>
            <select
              className="w-full bg-black/30 border border-border rounded px-3 py-2"
              value={calcForm.perfil_comerciante}
              onChange={(e) => setCalcForm(p => ({ ...p, perfil_comerciante: e.target.value }))}
              data-testid="profile-selector"
            >
              {config?.merchant_profiles && Object.entries(config.merchant_profiles).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.nombre} - {val.descripcion}
                </option>
              ))}
            </select>
          </div>

          {/* NPC selector */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">PNJ (Opcional)</label>
            <select
              className="w-full bg-black/30 border border-border rounded px-3 py-2"
              value={calcForm.npc_id || ''}
              onChange={(e) => {
                const npc = npcs.find(n => n._id === e.target.value);
                setCalcForm(p => ({ 
                  ...p, 
                  npc_id: e.target.value || null,
                  perfil_comerciante: npc?.perfil_comerciante || p.perfil_comerciante
                }));
              }}
              data-testid="npc-selector"
            >
              <option value="">-- Sin PNJ específico --</option>
              {npcs.map(npc => (
                <option key={npc._id} value={npc._id}>
                  {npc.nombre} ({npc.profesion_comerciante || npc.ocupacion}) - {npc.ubicacion || 'Sin ubicación'}
                </option>
              ))}
            </select>
          </div>

          {presenciaError && (
            <div className="bg-red-900/30 border border-red-600/50 rounded px-3 py-2 text-sm text-red-300 flex items-start gap-2" data-testid="presencia-error">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {presenciaError}
            </div>
          )}

          {/* Calculate button */}
          <Button
            onClick={calculateTrade}
            disabled={calculating || !!presenciaError}
            className="w-full bg-[hsl(var(--torch-orange))] hover:bg-[hsl(var(--torch-orange))]/80 text-black font-bold"
            data-testid="calculate-btn"
          >
            {calculating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculando...</>
            ) : (
              <><Dices className="w-4 h-4 mr-2" /> Calcular Transacción</>
            )}
          </Button>
        </div>

        {/* Right: Result */}
        <div className="space-y-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Store className="w-5 h-5" />
            Resultado
          </h3>

          {calcResult ? (
            <div className="space-y-4">
              {/* Price breakdown */}
              <div className="bg-black/20 rounded-lg p-4 border border-border/30">
                <h4 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Desglose del Precio</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Precio base:</span>
                    <span>{formatCurrency(calcResult.desglose.precio_base)}</span>
                  </div>
                  {calcResult.desglose.precio_con_bendicion !== calcResult.desglose.precio_base && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">+ Bendición:</span>
                      <span className="text-[hsl(var(--magic-blue))]">{formatCurrency(calcResult.desglose.precio_con_bendicion)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Región ({((calcResult.desglose.factor_region - 1) * 100).toFixed(0)}%):</span>
                    <span>×{calcResult.desglose.factor_region.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Asentamiento ({((calcResult.desglose.factor_asentamiento - 1) * 100).toFixed(0)}%):</span>
                    <span>×{calcResult.desglose.factor_asentamiento.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Contexto ({((calcResult.desglose.factor_contexto - 1) * 100).toFixed(0)}%):</span>
                    <span>×{calcResult.desglose.factor_contexto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/30 pt-2">
                    <span className="text-muted-foreground">Precio mercado:</span>
                    <span className="text-[hsl(var(--gold))]">{formatCurrency(calcResult.desglose.precio_mercado)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Relación ({((calcResult.desglose.factor_relacion - 1) * 100).toFixed(0)}%):</span>
                    <span>×{calcResult.desglose.factor_relacion.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">× Perfil comerciante ({((calcResult.desglose.factor_perfil - 1) * 100).toFixed(0)}%):</span>
                    <span>×{calcResult.desglose.factor_perfil.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border/30 pt-2 font-bold">
                    <span className="text-[hsl(var(--torch-orange))]">PRECIO JUSTO:</span>
                    <span className="text-[hsl(var(--torch-orange))] text-lg">{formatCurrency(calcResult.desglose.precio_justo)}</span>
                  </div>
                </div>
              </div>

              {/* Offer comparison */}
              <div className="bg-black/20 rounded-lg p-4 border border-border/30">
                <h4 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Comparación de Oferta</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-black/30 rounded p-3">
                    <div className="text-xs text-muted-foreground mb-1">Tu oferta</div>
                    <div className="text-xl font-bold">{formatCurrency(calcResult.oferta)}</div>
                  </div>
                  <div className={`rounded p-3 ${calcResult.diferencia_porcentual >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                    <div className="text-xs text-muted-foreground mb-1">Diferencia</div>
                    <div className={`text-xl font-bold ${calcResult.diferencia_porcentual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {calcResult.diferencia_porcentual > 0 ? '+' : ''}{calcResult.diferencia_porcentual.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Dice roll */}
              <div className="bg-black/20 rounded-lg p-4 border border-border/30">
                <h4 className="text-sm font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
                  <Dices className="w-4 h-4" />
                  Tirada de Reacción (d100)
                </h4>
                <div className="flex items-center gap-4">
                  <div className="bg-[hsl(var(--torch-orange))]/20 rounded-lg px-4 py-2">
                    <span className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{calcResult.tirada.base}</span>
                  </div>
                  <div className="text-sm">
                    <div className="text-muted-foreground">
                      + Relación: <span className="text-white">{calcResult.tirada.bono_relacion > 0 ? '+' : ''}{calcResult.tirada.bono_relacion}</span>
                    </div>
                    <div className="text-muted-foreground">
                      + Contexto: <span className="text-white">{calcResult.tirada.bono_contexto > 0 ? '+' : ''}{calcResult.tirada.bono_contexto}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    = <span className="text-xl font-bold text-[hsl(var(--gold))]">{calcResult.tirada.total}</span>
                  </div>
                </div>
              </div>

              {/* Result */}
              {calcResult.resultado && (
                <div className={`rounded-lg p-4 border-2 ${RESULTADO_STYLES[calcResult.resultado.tipo]?.bg} ${RESULTADO_STYLES[calcResult.resultado.tipo]?.border}`}>
                  <div className="flex items-center gap-3 mb-3">
                    {RESULTADO_STYLES[calcResult.resultado.tipo]?.icon && (
                      <div className={`p-2 rounded-full ${RESULTADO_STYLES[calcResult.resultado.tipo]?.bg}`}>
                        {(() => {
                          const Icon = RESULTADO_STYLES[calcResult.resultado.tipo].icon;
                          return <Icon className={`w-6 h-6 ${RESULTADO_STYLES[calcResult.resultado.tipo]?.text}`} />;
                        })()}
                      </div>
                    )}
                    <div>
                      <h4 className={`font-bold text-lg uppercase ${RESULTADO_STYLES[calcResult.resultado.tipo]?.text}`}>
                        {calcResult.resultado.tipo === 'acepta' && '¡Trato cerrado!'}
                        {calcResult.resultado.tipo === 'rechaza' && 'Rechazado'}
                        {calcResult.resultado.tipo === 'contraoferta' && 'Contraoferta'}
                        {calcResult.resultado.tipo === 'enfado' && `¡Enfado ${calcResult.resultado.enfado}!`}
                      </h4>
                      {calcResult.resultado.contraoferta && (
                        <p className="text-sm">
                          Propuesta: <span className="font-bold">{formatCurrency(calcResult.resultado.contraoferta)}</span>
                        </p>
                      )}
                      {calcResult.resultado.cambio_relacion !== 0 && (
                        <p className="text-xs text-red-400">
                          Cambio de relación: {calcResult.resultado.cambio_relacion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CONFIRM TRANSACTION */}
              {calcResult.resultado && ['acepta', 'contraoferta'].includes(calcResult.resultado.tipo) && (
                <div className="bg-black/20 rounded-lg p-4 border border-[hsl(var(--gold))]/40" data-testid="trade-confirm-block">
                  {!calcForm.character_id ? (
                    <p className="text-sm text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Selecciona un personaje arriba para poder confirmar y aplicar la transacción.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Al confirmar se {calcForm.modo === 'compra' ? 'añadirá el artículo y se descontará' : 'retirará el artículo y se sumará'} el dinero
                        a <span className="font-medium text-white">{selectedCharacter?.nombre}</span>.
                      </p>
                      {calcResult.resultado.tipo === 'acepta' && (
                        <Button
                          className="w-full bg-green-700 hover:bg-green-600"
                          disabled={confirming}
                          onClick={() => confirmTransaction(calcResult.oferta)}
                          data-testid="trade-confirm-btn"
                        >
                          {confirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                          Confirmar {calcForm.modo === 'compra' ? 'compra' : 'venta'} por {formatCurrency(calcResult.oferta)}
                        </Button>
                      )}
                      {calcResult.resultado.tipo === 'contraoferta' && calcResult.resultado.contraoferta && (
                        <Button
                          className="w-full bg-yellow-700 hover:bg-yellow-600"
                          disabled={confirming}
                          onClick={() => confirmTransaction(calcResult.resultado.contraoferta)}
                          data-testid="trade-confirm-counter-btn"
                        >
                          {confirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Handshake className="w-4 h-4 mr-2" />}
                          Aceptar contraoferta y confirmar por {formatCurrency(calcResult.resultado.contraoferta)}
                        </Button>
                      )}
                    </div>
                  )}

                  {confirmWarnings && (
                    <div className="mt-3 space-y-1" data-testid="trade-confirm-warnings">
                      {confirmWarnings.length === 0 ? (
                        <p className="text-xs text-green-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Transacción aplicada sin incidencias.
                        </p>
                      ) : (
                        confirmWarnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-300 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {w}
                          </p>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* NPC Dialogue */}
              {calcResult.dialogo && (
                <div className="bg-[hsl(var(--gold))]/10 rounded-lg p-4 border border-[hsl(var(--gold))]/30">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-[hsl(var(--gold))] mt-1 flex-shrink-0" />
                    <div>
                      <p className="italic text-lg">"{calcResult.dialogo}"</p>
                      {calcResult.dialogo_fuente === 'llm' && (
                        <span className="text-xs text-[hsl(var(--magic-blue))] flex items-center gap-1 mt-2">
                          <Sparkles className="w-3 h-3" /> Generado con IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FASE 3: Terminar de comerciar + despedida */}
              {calcForm.npc_id && (
                <div className="bg-black/20 rounded-lg p-4 border border-border/40" data-testid="trade-end-block">
                  <Button variant="outline" onClick={terminarComercio} disabled={endingTrade}
                    className="w-full" data-testid="trade-end-btn">
                    {endingTrade ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Store className="w-4 h-4 mr-2" />}
                    Terminar de comerciar
                  </Button>
                  {despedida && (
                    <div className="mt-3 bg-[hsl(var(--gold))]/10 rounded-lg p-3 border border-[hsl(var(--gold))]/30" data-testid="trade-farewell">
                      <p className="italic">"{despedida.despedida}"</p>
                      <p className="text-xs text-muted-foreground mt-1">Despedida {despedida.tono}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-black/20 rounded-lg p-8 border border-border/30 text-center text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Configura los parámetros y pulsa "Calcular Transacción" para simular una negociación.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // CONFIG TAB
  // ============================================================================

  const renderConfigTab = () => {
    if (!config) return <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

    const sections = [
      { id: 'relationships', title: 'Niveles de Relación', data: config.relationship_levels, configKey: 'relationship_levels' },
      { id: 'blessings', title: 'Modificadores de Bendición', data: config.blessing_modifiers, configKey: 'blessing_modifiers' },
      { id: 'merchants', title: 'Perfiles de Comerciante', data: config.merchant_profiles, configKey: 'merchant_profiles' },
      { id: 'contexts', title: 'Contextos Históricos', data: config.historical_contexts, configKey: 'historical_contexts' },
      { id: 'thresholds', title: 'Umbrales de Reacción', data: config.trading_thresholds, configKey: 'trading_thresholds' },
      { id: 'contraoferta', title: 'Factores de Contraoferta', data: config.contraoferta_factors, configKey: 'contraoferta_factors' },
      { id: 'anger', title: 'Consecuencias del Enfado', data: config.anger_consequences, configKey: 'anger_consequences' },
    ];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Configuración del Sistema de Comercio</h3>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={resetConfig}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Restablecer
                </Button>
                <Button size="sm" onClick={saveConfig} className="bg-[hsl(var(--torch-orange))] text-black">
                  <Save className="w-4 h-4 mr-2" /> Guardar Todo
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Region modifiers — fully editable hierarchy with parent-to-child inheritance */}
        <RegionModifiersPanel
          regions={regions}
          priceModifiers={priceModifiers}
          isAdmin={isAdmin}
          onSaved={loadPriceModifiers}
        />

        {/* Listas editables de creación de PNJ comerciante */}
        <NpcConfigEditor config={config} setConfig={setConfig} isAdmin={isAdmin} />

        {/* Matrices de relación: subculturas y oficio×ocupación */}
        <RelationshipMatricesPanel isAdmin={isAdmin} />

        {/* Motor de Comercio D100 (regateo + tirada enfrentada) */}
        <D100EngineConfigPanel isAdmin={isAdmin} />

        {sections.map(section => (
          <div key={section.id} className="bg-black/20 rounded-lg border border-border/30">
            <button
              onClick={() => setExpandedConfigSection(expandedConfigSection === section.id ? null : section.id)}
              className="w-full flex justify-between items-center p-4 text-left"
            >
              <span className="font-medium text-[hsl(var(--gold))]">{section.title}</span>
              {expandedConfigSection === section.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
            
            {expandedConfigSection === section.id && (
              <div className="px-4 pb-4">
                <ConfigCellsEditor
                  data={section.data}
                  disabled={!isAdmin}
                  onChange={(newData) => setConfig({ ...config, [section.configKey]: newData })}
                />
                {isAdmin && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Edita las celdas y pulsa «Guardar Todo». Los cambios se aplicarán a todas las transacciones futuras.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // NPCs TAB
  // ============================================================================

  const renderNpcsTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))]">PNJs Comerciantes</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateRandomNpc()}
              disabled={generatingNpc}
            >
              {generatingNpc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Dices className="w-4 h-4 mr-2" />}
              Generar Aleatorio
            </Button>
            <Button
              size="sm"
              onClick={() => { setEditingNpc({}); setShowNpcEditor(true); }}
              className="bg-[hsl(var(--torch-orange))] text-black"
            >
              <Plus className="w-4 h-4 mr-2" /> Nuevo PNJ
            </Button>
          </div>
        </div>

        {npcs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay PNJs comerciantes creados.</p>
            <p className="text-sm">Genera uno aleatorio o crea uno nuevo.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {npcs.map(npc => (
              <NpcFichaCard
                key={npc._id}
                npc={npc}
                config={config}
                onEdit={() => { setEditingNpc(npc); setShowNpcEditor(true); }}
                onDelete={() => deleteNpc(npc._id)}
              />
            ))}
          </div>
        )}

        {/* NPC Editor Modal */}
        {showNpcEditor && (
          <NpcEditorModal
            npc={editingNpc}
            config={config}
            onSave={saveNpc}
            onClose={() => { setShowNpcEditor(false); setEditingNpc(null); }}
          />
        )}
      </div>
    );
  };

  // ============================================================================
  // RELATIONSHIPS TAB
  // ============================================================================

  const renderRelationshipsTab = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Relaciones PJ-PNJ</h3>
          <Button variant="outline" size="sm" onClick={loadRelationships}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>
        </div>

        {relationships.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Handshake className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No hay relaciones registradas.</p>
            <p className="text-sm">Las relaciones se crean automáticamente al realizar transacciones.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {relationships.map(rel => {
              const character = characters.find(c => c.id === rel.character_id);
              const npc = npcs.find(n => n._id === rel.npc_id);
              
              return (
                <div 
                  key={rel._id} 
                  className={`rounded-lg p-4 border ${RELATIONSHIP_COLORS[rel.nivel] || RELATIONSHIP_COLORS.neutral}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div>
                        <User className="w-5 h-5 text-[hsl(var(--gold))]" />
                      </div>
                      <div>
                        <p className="font-medium">{character?.nombre || rel.character_id}</p>
                        <p className="text-xs text-muted-foreground">Personaje</p>
                      </div>
                      <div className="text-2xl">↔</div>
                      <div>
                        <p className="font-medium">{npc?.nombre || rel.npc_id}</p>
                        <p className="text-xs text-muted-foreground">PNJ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-bold uppercase">{config?.relationship_levels?.[rel.nivel]?.nombre || rel.nivel}</span>
                        {rel.penalizacion_precio > 0 && (
                          <p className="text-xs text-red-400">Penalización: +{rel.penalizacion_precio}%</p>
                        )}
                        {rel.dias_sin_comercio > 0 && (
                          <p className="text-xs text-red-400">Sin comercio: {rel.dias_sin_comercio} días</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-300 hover:bg-rose-900/30"
                        onClick={() => deleteRelationship(rel._id)}
                        data-testid={`delete-relationship-${rel._id}`}
                        title="Eliminar relación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {rel.historial?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-muted-foreground mb-2">
                        <History className="w-3 h-3 inline mr-1" />
                        Últimas interacciones:
                      </p>
                      <div className="space-y-1">
                        {rel.historial.slice(-3).map((h, i) => (
                          <p key={i} className="text-xs">
                            {h.fecha?.split('T')[0]} - {h.tipo}: {h.razon || h.de + ' → ' + h.a}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="trading-system-section">
      {renderTabs()}
      
      {activeTab === 'tienda-d100' && (
        <TiendaD100 characters={characters} equipment={equipment} config={config} />
      )}
      {activeTab === 'calculator' && renderCalculatorTab()}
      {activeTab === 'config' && renderConfigTab()}
      {activeTab === 'npcs' && renderNpcsTab()}
      {activeTab === 'relationships' && renderRelationshipsTab()}
    </div>
  );
};

// ============================================================================
// NPC EDITOR MODAL
// ============================================================================

// ============================================================================
// EDITOR DE LISTAS DE CREACIÓN DE PNJ (profesiones, rasgos, modos, coherencia)
// ============================================================================
const NpcConfigEditor = ({ config, setConfig, isAdmin }) => {
  const [open, setOpen] = useState('');
  const ro = !isAdmin;
  const upd = (key, value) => setConfig(p => ({ ...p, [key]: value }));
  const inputCls = "bg-black/30 border border-border rounded px-2 py-1 text-sm";

  const toggle = (id) => setOpen(o => (o === id ? '' : id));

  const Section = ({ id, title, count, children }) => (
    <div className="bg-black/20 rounded-lg border border-border/30">
      <button onClick={() => toggle(id)} className="w-full flex justify-between items-center p-3 text-left">
        <span className="font-medium text-[hsl(var(--gold))]">{title} <span className="text-xs text-muted-foreground">({count})</span></span>
        {open === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open === id && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );

  // --- Lista de strings (Profesiones) ---
  const renderStringList = (key) => {
    const list = config[key] || [];
    return (
      <>
        {list.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${inputCls} flex-1`} value={val} disabled={ro}
              onChange={(e) => { const n = [...list]; n[i] = e.target.value; upd(key, n); }}
              data-testid={`cfg-${key}-input-${i}`} />
            {!ro && <Button size="sm" variant="ghost" onClick={() => upd(key, list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
          </div>
        ))}
        {!ro && <Button size="sm" variant="outline" onClick={() => upd(key, [...list, ''])} data-testid={`cfg-${key}-add`}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>}
      </>
    );
  };

  // --- Lista de objetos {nombre, descripcion[, tags]} ---
  const renderObjList = (key, withTags) => {
    const list = config[key] || [];
    const setItem = (i, patch) => { const n = [...list]; n[i] = { ...n[i], ...patch }; upd(key, n); };
    return (
      <>
        {list.map((it, i) => (
          <div key={i} className="bg-black/20 rounded p-2 border border-border/20 space-y-1">
            <div className="flex gap-2">
              <input className={`${inputCls} flex-1`} placeholder="Nombre" value={it.nombre || ''} disabled={ro}
                onChange={(e) => setItem(i, { nombre: e.target.value })} data-testid={`cfg-${key}-nombre-${i}`} />
              {!ro && <Button size="sm" variant="ghost" onClick={() => upd(key, list.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
            </div>
            <textarea className={`${inputCls} w-full h-12`} placeholder="Descripción" value={it.descripcion || ''} disabled={ro}
              onChange={(e) => setItem(i, { descripcion: e.target.value })} />
            {withTags && (
              <input className={`${inputCls} w-full`} placeholder="Tags (coma): suciedad, mala_artesania, criminal, santo..."
                value={(it.tags || []).join(', ')} disabled={ro}
                onChange={(e) => setItem(i, { tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
            )}
          </div>
        ))}
        {!ro && <Button size="sm" variant="outline" onClick={() => upd(key, [...list, withTags ? { nombre: '', descripcion: '', tags: [] } : { nombre: '', descripcion: '' }])} data-testid={`cfg-${key}-add`}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>}
      </>
    );
  };

  // --- Mapa de exclusiones {clave: [tags]} ---
  const renderExclusion = (key, placeholder) => {
    const map = config[key] || {};
    const entries = Object.entries(map);
    const setKeyName = (oldK, newK) => {
      const n = {}; entries.forEach(([k, v]) => { n[k === oldK ? newK : k] = v; }); upd(key, n);
    };
    const setTags = (k, tags) => upd(key, { ...map, [k]: tags });
    return (
      <>
        <p className="text-xs text-muted-foreground">Tags prohibidos por {placeholder}. El rasgo se oculta si comparte algún tag.</p>
        {entries.map(([k, tags], i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className={`${inputCls} w-40`} value={k} disabled={ro} placeholder={placeholder}
              onChange={(e) => setKeyName(k, e.target.value)} data-testid={`cfg-${key}-key-${i}`} />
            <input className={`${inputCls} flex-1`} value={(tags || []).join(', ')} disabled={ro} placeholder="tags (coma)"
              onChange={(e) => setTags(k, e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
            {!ro && <Button size="sm" variant="ghost" onClick={() => { const n = { ...map }; delete n[k]; upd(key, n); }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
          </div>
        ))}
        {!ro && <Button size="sm" variant="outline" onClick={() => upd(key, { ...map, '': [] })} data-testid={`cfg-${key}-add`}><Plus className="w-4 h-4 mr-1" /> Añadir</Button>}
      </>
    );
  };

  // --- Mapa profesión -> razas permitidas (excepciones; vacío = todas) ---
  const renderProfRaza = () => {
    const map = config.npc_profesiones_por_raza || {};
    const entries = Object.entries(map);
    const setKeyName = (oldK, newK) => {
      const n = {}; entries.forEach(([k, v]) => { n[k === oldK ? newK : k] = v; }); upd('npc_profesiones_por_raza', n);
    };
    const setRazas = (k, razas) => upd('npc_profesiones_por_raza', { ...map, [k]: razas });
    return (
      <>
        <p className="text-xs text-muted-foreground">Solo excepciones. Una profesión que NO aparezca aquí la puede tener CUALQUIER raza. Razas separadas por comas (Elfos, Enanos, Hobbits, Hombres).</p>
        {entries.map(([k, razas], i) => (
          <div key={i} className="flex gap-2 items-center">
            <input className={`${inputCls} w-48`} value={k} disabled={ro} placeholder="profesión"
              onChange={(e) => setKeyName(k, e.target.value)} data-testid={`cfg-profraza-key-${i}`} />
            <input className={`${inputCls} flex-1`} value={(razas || []).join(', ')} disabled={ro} placeholder="razas permitidas (coma)"
              onChange={(e) => setRazas(k, e.target.value.split(',').map(t => t.trim()).filter(Boolean))} data-testid={`cfg-profraza-val-${i}`} />
            {!ro && <Button size="sm" variant="ghost" onClick={() => { const n = { ...map }; delete n[k]; upd('npc_profesiones_por_raza', n); }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
          </div>
        ))}
        {!ro && <Button size="sm" variant="outline" onClick={() => upd('npc_profesiones_por_raza', { ...map, '': [] })} data-testid="cfg-profraza-add"><Plus className="w-4 h-4 mr-1" /> Añadir</Button>}
      </>
    );
  };

  return (
    <div className="bg-black/20 rounded-lg border border-[hsl(var(--gold))]/30 p-4 space-y-3" data-testid="npc-config-editor">
      <h4 className="font-heading text-[hsl(var(--gold))] flex items-center gap-2"><Users className="w-4 h-4" /> Creación de PNJ Comerciante</h4>
      <p className="text-xs text-muted-foreground">Edita las listas usadas al crear PNJs. Pulsa "Guardar Todo" arriba para aplicar los cambios.</p>
      <Section id="prof" title="Profesiones" count={(config.npc_profesiones || []).length}>{renderStringList('npc_profesiones')}</Section>
      <Section id="profraza" title="Profesiones permitidas por Raza" count={Object.keys(config.npc_profesiones_por_raza || {}).length}>{renderProfRaza()}</Section>
      <Section id="pos" title="Rasgos Positivos" count={(config.npc_rasgos_positivos || []).length}>{renderObjList('npc_rasgos_positivos', true)}</Section>
      <Section id="neg" title="Rasgos Negativos" count={(config.npc_rasgos_negativos || []).length}>{renderObjList('npc_rasgos_negativos', true)}</Section>
      <Section id="modos" title="Modos de Hablar" count={(config.npc_modos_habla || []).length}>{renderObjList('npc_modos_habla', false)}</Section>
      <Section id="exr" title="Coherencia: Exclusiones por Raza" count={Object.keys(config.npc_exclusion_raza || {}).length}>{renderExclusion('npc_exclusion_raza', 'raza')}</Section>
      <Section id="exp" title="Coherencia: Exclusiones por Profesión" count={Object.keys(config.npc_exclusion_profesion || {}).length}>{renderExclusion('npc_exclusion_profesion', 'profesión')}</Section>
    </div>
  );
};

// ============================================================================
// MATRICES DE RELACIÓN — Subcultura×Subcultura y Oficio×Ocupación
// ============================================================================
const RelationshipMatricesPanel = ({ isAdmin }) => {
  const [open, setOpen] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [subM, setSubM] = useState({});
  const [ofiM, setOfiM] = useState({});
  const ro = !isAdmin;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trading/config/matrices');
      setData(res.data);
      setSubM(res.data.subcultura_matrix || {});
      setOfiM(res.data.oficio_ocupacion_matrix || {});
    } catch (e) { toast.error('Error cargando matrices'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/trading/config/matrices', {
        subcultura_matrix: subM, oficio_ocupacion_matrix: ofiM,
      });
      toast.success('Matrices guardadas');
    } catch (e) { toast.error('Error al guardar matrices'); }
    finally { setSaving(false); }
  };

  const resetDefaults = async () => {
    if (!window.confirm('¿Restablecer ambas matrices a los valores por defecto? Se perderán tus ajustes.')) return;
    setSaving(true);
    try {
      await api.post('/trading/config/matrices/reset');
      await load();
      toast.success('Matrices restablecidas');
    } catch (e) { toast.error('Error al restablecer'); }
    finally { setSaving(false); }
  };

  const cellColor = (v) => {
    const n = Number(v) || 0;
    if (n > 0) return 'text-emerald-400';
    if (n < 0) return 'text-red-400';
    return 'text-muted-foreground';
  };

  const setSubCell = (a, b, val) => {
    const n = val === '' || val === '-' ? 0 : parseInt(val, 10);
    setSubM(prev => ({ ...prev, [a]: { ...(prev[a] || {}), [b]: isNaN(n) ? 0 : n } }));
  };
  const setOfiCell = (p, o, val) => {
    const n = val === '' || val === '-' ? 0 : parseInt(val, 10);
    setOfiM(prev => ({ ...prev, [p]: { ...(prev[p] || {}), [o]: isNaN(n) ? 0 : n } }));
  };

  const cellInputCls = "w-12 bg-black/30 border border-border rounded px-1 py-0.5 text-xs text-center";

  const renderMatrix = (rows, cols, matrix, setCell, rowLabel) => (
    <div className="overflow-auto max-h-[60vh] border border-border/30 rounded">
      <table className="text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 bg-[hsl(var(--background))] border border-border/30 px-2 py-1 text-left text-[hsl(var(--gold))]">{rowLabel} ↓ / Personaje →</th>
            {cols.map(c => (
              <th key={c} className="bg-[hsl(var(--background))] border border-border/30 px-1 py-1 whitespace-nowrap text-muted-foreground" title={c}>
                <div className="max-w-[90px] truncate">{c}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r}>
              <td className="sticky left-0 z-10 bg-[hsl(var(--background))] border border-border/30 px-2 py-1 whitespace-nowrap text-[hsl(var(--gold))]/90" title={r}>
                <div className="max-w-[160px] truncate">{r}</div>
              </td>
              {cols.map(c => {
                const v = (matrix[r] || {})[c] ?? 0;
                return (
                  <td key={c} className="border border-border/20 px-0.5 py-0.5 text-center">
                    {ro ? (
                      <span className={cellColor(v)}>{v}</span>
                    ) : (
                      <input type="number" className={`${cellInputCls} ${cellColor(v)}`} value={v}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        data-testid={`matrix-cell-${r}-${c}`} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const toggle = (id) => setOpen(o => (o === id ? '' : id));

  const subNames = (data?.subculturas || []).map(s => s.nombre);
  const ocupaciones = data?.ocupaciones || [];
  const profesiones = data?.profesiones || [];

  return (
    <div className="bg-black/20 rounded-lg border border-[hsl(var(--magic-blue))]/30 p-4 space-y-3" data-testid="relationship-matrices-panel">
      <div className="flex items-center justify-between">
        <h4 className="font-heading text-[hsl(var(--magic-blue))] flex items-center gap-2"><Handshake className="w-4 h-4" /> Matrices de Relación</h4>
        {!ro && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resetDefaults} disabled={saving || loading} data-testid="matrices-reset-btn">
              <RefreshCw className="w-4 h-4 mr-1" /> Por defecto
            </Button>
            <Button size="sm" onClick={save} disabled={saving || loading}
              className="bg-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/90" data-testid="matrices-save-btn">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar matrices
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Modificadores (en puntos) que afectan a la tirada de negociación. Verde = favorable, rojo = desfavorable. Las filas son el PNJ y las columnas el personaje. Se amplían solas al añadir nuevas subculturas, ocupaciones o profesiones.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando matrices…</div>
      ) : (
        <>
          <div className="bg-black/20 rounded-lg border border-border/30">
            <button onClick={() => toggle('sub')} className="w-full flex justify-between items-center p-3 text-left">
              <span className="font-medium text-[hsl(var(--gold))]">Subcultura del PNJ × Subcultura del Personaje <span className="text-xs text-muted-foreground">({subNames.length}×{subNames.length})</span></span>
              {open === 'sub' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {open === 'sub' && <div className="px-3 pb-3">{renderMatrix(subNames, subNames, subM, setSubCell, 'Subcultura PNJ')}</div>}
          </div>

          <div className="bg-black/20 rounded-lg border border-border/30">
            <button onClick={() => toggle('ofi')} className="w-full flex justify-between items-center p-3 text-left">
              <span className="font-medium text-[hsl(var(--gold))]">Oficio del PNJ × Ocupación del Aventurero <span className="text-xs text-muted-foreground">({profesiones.length}×{ocupaciones.length})</span></span>
              {open === 'ofi' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {open === 'ofi' && <div className="px-3 pb-3">{renderMatrix(profesiones, ocupaciones, ofiM, setOfiCell, 'Oficio PNJ')}</div>}
          </div>
        </>
      )}
    </div>
  );
};


// ============================================================================
// PANEL EDITABLE DEL MOTOR D100 (Bloques A, A-2, B, C, D)
// ============================================================================
const D100_GROUPS = [
  {
    title: 'A · Negociación normal', keys: [
      ['venta_ratio', 'Ratio de venta (el PNJ paga este % del catálogo)'],
      ['tolerancia_base', 'Tolerancia base (% sin enfadar)'],
      ['tolerancia_por_relacion', '+Tolerancia por punto de relación'],
      ['anger_factor', 'Factor de enfado (por % de desviación abusiva)'],
      ['anger_umbral', 'Umbral de enfado (rompe el trato)'],
      ['d100_base_aceptacion', 'Prob. base de aceptación (%)'],
      ['aceptacion_por_relacion', '+Prob. por punto de relación'],
      ['aceptacion_por_desviacion', '−Prob. por % de desviación'],
      ['relacion_delta_exito', 'Δrelación al cerrar buen trato'],
      ['relacion_delta_enfado', 'Δrelación si se enfada'],
    ],
  },
  {
    title: 'A-2 · Contraoferta balanceada', keys: [
      ['descuento_base_relacion', 'Descuento base si relación > 0 (fracción)'],
      ['descuento_por_punto_relacion', 'Descuento por punto positivo de relación'],
      ['descuento_maximo', 'Descuento máximo (tope)'],
    ],
  },
  {
    title: 'B · Tirada enfrentada', keys: [
      ['divisor_desviacion', 'Divisor de desviación (desv.% ÷ esto → al PNJ)'],
      ['mod_rel_hostil', 'Mod. relación · Hostil'],
      ['mod_rel_receloso', 'Mod. relación · Receloso'],
      ['mod_rel_neutral', 'Mod. relación · Neutral'],
      ['mod_rel_cordial', 'Mod. relación · Cordial'],
      ['mod_rel_amigo', 'Mod. relación · Amigo'],
      ['mod_rel_hermandad', 'Mod. relación · Hermandad'],
    ],
  },
  {
    title: 'C · Resultado de la tirada enfrentada', keys: [
      ['umbral_pillado', 'Umbral de "Pillado" (diff ≥ esto)'],
      ['enfado_duda', 'Enfado que suma una "Duda"'],
      ['enfado_pillado', 'Enfado que suma un "Pillado"'],
      ['relacion_pillado', 'Δrelación en un "Pillado"'],
    ],
  },
  {
    title: 'D · Subida de precio si gana el PNJ', keys: [
      ['subida_precio_duda', 'Subida de precio en "Duda" (%)'],
      ['subida_precio_pillado', 'Subida de precio en "Pillado" (%)'],
    ],
  },
];

const D100EngineConfigPanel = ({ isAdmin }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({});
  const ro = !isAdmin;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trading/d100/config');
      setCfg(res.data || {});
    } catch (e) { toast.error('Error cargando el motor D100'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/trading/d100/config', cfg);
      toast.success('Motor D100 guardado');
    } catch (e) { toast.error('Error al guardar el motor D100'); }
    finally { setSaving(false); }
  };

  const setVal = (k, v) => {
    const n = v === '' || v === '-' ? '' : Number(v);
    setCfg(prev => ({ ...prev, [k]: isNaN(n) ? 0 : n }));
  };

  return (
    <div className="bg-black/20 rounded-lg border border-[hsl(var(--torch-orange))]/30 p-4 space-y-3" data-testid="d100-engine-panel">
      <div className="flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left">
          <span className="font-heading text-[hsl(var(--torch-orange))] flex items-center gap-2">
            <Dices className="w-4 h-4" /> Motor de Comercio D100
          </span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {!ro && open && (
          <Button size="sm" onClick={save} disabled={saving || loading}
            className="bg-[hsl(var(--torch-orange))] text-black hover:opacity-90" data-testid="d100-engine-save-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar motor D100
          </Button>
        )}
      </div>
      {open && (
        loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Parámetros del regateo y de la tirada enfrentada. Se aplican a todas las negociaciones futuras.</p>
            {D100_GROUPS.map(grp => (
              <div key={grp.title} className="bg-black/20 rounded border border-border/30 p-3">
                <p className="text-sm font-medium text-[hsl(var(--gold))] mb-2">{grp.title}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {grp.keys.map(([k, label]) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <label className="text-xs text-muted-foreground flex-1" htmlFor={`d100-${k}`}>{label}</label>
                      <input id={`d100-${k}`} type="number" step="any" disabled={ro}
                        className="w-24 bg-black/30 border border-border rounded px-2 py-1 text-sm text-right font-mono"
                        value={cfg[k] ?? 0} onChange={(e) => setVal(k, e.target.value)}
                        data-testid={`d100-cfg-${k}`} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};



// ============================================================================
// FICHA COMPLETA DEL PNJ (estilo bestiario: retrato + atributos + datos)
// ============================================================================
const ABILITIES = [
  { key: 'fuerza', label: 'FUE' },
  { key: 'destreza', label: 'DES' },
  { key: 'constitucion', label: 'CON' },
  { key: 'inteligencia', label: 'INT' },
  { key: 'sabiduria', label: 'SAB' },
  { key: 'carisma', label: 'CAR' },
];
const abilityMod = (score) => Math.floor(((Number(score) || 10) - 10) / 2);
const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

const StatBox = ({ label, value, sub, accent }) => (
  <div className={`flex flex-col items-center justify-center rounded border px-1.5 py-1 min-w-[44px] ${accent || 'border-border/40 bg-black/30'}`}>
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="text-base font-bold text-[hsl(var(--gold))] leading-none">{value}</span>
    {sub !== undefined && <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{sub}</span>}
  </div>
);

export const NpcFichaCard = ({ npc, config, onEdit, onDelete }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const portraitSrc = npc.retrato_file_id ? `${API_URL}/api/trading/npcs/${npc._id}/portrait` : null;
  const car = npc.caracteristicas || {};
  const subtitulo = [npc.raza, npc.subcultura].filter(Boolean).join(' · ');
  const cardRef = useRef(null);
  const [zoom, setZoom] = useState(false);
  const Line = ({ label, children }) => (
    <p className="text-xs"><span className="text-muted-foreground">{label}:</span> {children}</p>
  );

  const handlePrint = () => {
    const el = cardRef.current;
    if (!el) return;
    el.classList.add('npc-print-area');
    document.body.classList.add('npc-printing');
    const cleanup = () => {
      el.classList.remove('npc-print-area');
      document.body.classList.remove('npc-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  };

  return (
    <div ref={cardRef} className="bg-black/20 rounded-lg border border-border/30 hover:border-[hsl(var(--gold))]/50 transition-colors overflow-hidden flex flex-col"
      data-testid={`npc-ficha-${npc._id}`}>
      {/* Cabecera: retrato + nombre + acciones */}
      <div className="flex gap-3 p-3 border-b border-border/30 bg-gradient-to-r from-black/40 to-transparent ficha-print-header">
        <div className="shrink-0">
          {portraitSrc ? (
            <img src={portraitSrc} alt={npc.nombre} onClick={() => setZoom(true)}
              className="w-20 h-20 rounded-md object-cover border border-[hsl(var(--gold))]/40 cursor-zoom-in hover:border-[hsl(var(--gold))] transition-colors"
              title="Ampliar retrato" data-testid={`npc-ficha-portrait-${npc._id}`} />
          ) : (
            <div className="w-20 h-20 rounded-md border border-border/40 bg-black/40 flex items-center justify-center">
              <User className="w-8 h-8 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <h4 className="font-heading text-lg text-[hsl(var(--gold))] truncate">{npc.nombre}{npc.apodo ? ` "${npc.apodo}"` : ''}</h4>
              <p className="text-sm text-muted-foreground">{npc.profesion_comerciante || npc.profesion || npc.ocupacion}</p>
              {subtitulo && <p className="text-xs italic text-muted-foreground/80 truncate">Humanoide ({subtitulo}{npc.edad ? `, ${npc.edad} años` : ''})</p>}
            </div>
            <div className="flex gap-1 shrink-0 no-print">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrint} title="Imprimir ficha (A4)" data-testid={`npc-print-${npc._id}`}><Printer className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit} data-testid={`npc-edit-${npc._id}`}><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={onDelete} data-testid={`npc-delete-${npc._id}`}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      {/* Atributos: CA, PG y las 6 características con sus modificadores */}
      <div className="flex flex-wrap gap-1.5 p-3 border-b border-border/30">
        <StatBox label="CA" value={npc.ca ?? 10} accent="border-[hsl(var(--magic-blue))]/50 bg-[hsl(var(--magic-blue))]/10" />
        <StatBox label="PG" value={npc.pg ?? '—'} accent="border-red-500/40 bg-red-500/10" />
        {ABILITIES.map(a => (
          <StatBox key={a.key} label={a.label} value={car[a.key] ?? 10} sub={fmtMod(abilityMod(car[a.key]))} />
        ))}
      </div>

      {/* Datos completos */}
      <div className="p-3 space-y-1 flex-1">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {npc.ubicacion && <Line label="Ubicación">{npc.ubicacion}</Line>}
          {npc.region && <Line label="Región">{npc.region}</Line>}
          {npc.sexo && <Line label="Sexo">{npc.sexo}</Line>}
          <Line label="Perfil">
            <span className="px-2 py-0.5 rounded bg-black/30">{config?.merchant_profiles?.[npc.perfil_comerciante]?.nombre || npc.perfil_comerciante}</span>
          </Line>
        </div>

        {npc.rasgo && (
          <p className="text-xs"><span className="text-muted-foreground">Rasgo ({npc.rasgo_tipo || '—'}):</span> <span className="text-[hsl(var(--gold))]/90">{npc.rasgo}</span>
            {npc.rasgo_descripcion && <span className="text-muted-foreground/80 italic"> — {npc.rasgo_descripcion}</span>}</p>
        )}
        {npc.modo_hablar && <Line label="Modo de hablar">{npc.modo_hablar}{npc.modo_hablar_desc ? ` (${npc.modo_hablar_desc})` : ''}</Line>}
        {npc.apariencia && <p className="text-xs text-muted-foreground/90">{npc.apariencia}</p>}

        {(npc.habilidades?.length > 0) && <Line label="Habilidades"><span className="text-foreground/90">{
          (npc.habilidades_mods?.length > 0)
            ? npc.habilidades_mods.map((h) => `${h.nombre} ${h.modificador >= 0 ? '+' : ''}${h.modificador}`).join(', ')
            : npc.habilidades.join(', ')
        }</span></Line>}
        {(npc.herramientas?.length > 0) && <Line label="Herramientas"><span className="text-foreground/90">{npc.herramientas.join(', ')}</span></Line>}
        {(npc.sentidos?.length > 0) && <Line label="Sentidos"><span className="text-foreground/90">{npc.sentidos.join(', ')}</span></Line>}
        {(npc.idiomas?.length > 0) && <Line label="Idiomas"><span className="text-foreground/90">{npc.idiomas.join(', ')}</span></Line>}

        {npc.historia && <p className="text-xs text-muted-foreground/80 italic pt-1 border-t border-border/20 whitespace-pre-line">{npc.historia}</p>}
        {npc.notas && <p className="text-xs text-muted-foreground/70"><span className="text-[hsl(var(--torch-orange))]/70">Notas DJ:</span> {npc.notas}</p>}
      </div>

      {zoom && portraitSrc && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 no-print" onClick={() => setZoom(false)} data-testid={`npc-portrait-zoom-${npc._id}`}>
          <img src={portraitSrc} alt={npc.nombre} className="max-h-[90vh] max-w-[90vw] rounded-lg border border-[hsl(var(--gold))]/40 object-contain" />
          <button className="absolute top-4 right-4 text-white text-3xl leading-none" onClick={() => setZoom(false)} title="Cerrar">×</button>
        </div>
      )}
    </div>
  );
};


// ============================================================================
// HISTÓRICO / RELACIÓN PERSONAL del PNJ con cada personaje (Relacion_Actual)
// ============================================================================
const NIVEL_LABELS = {
  hostil: 'Hostil', desconocido: 'Desconocido', neutral: 'Neutral',
  cordial: 'Cordial', amigo: 'Amigo', hermandad: 'Hermandad',
};
const nivelFromValor = (v) => {
  const n = Number(v) || 0;
  if (n <= -60) return 'hostil';
  if (n <= -20) return 'desconocido';
  if (n < 20) return 'neutral';
  if (n < 50) return 'cordial';
  if (n < 80) return 'amigo';
  return 'hermandad';
};

const NpcRelationshipHistory = ({ npcId }) => {
  const [rels, setRels] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [addChar, setAddChar] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([
        api.get(`/trading/relationships?npc_id=${npcId}`),
        api.get('/characters/'),
      ]);
      setRels(r.data?.relationships || []);
      setCharacters(c.data?.characters || c.data || []);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [npcId]);

  const charName = (id) => {
    const c = characters.find(x => (x.id || x._id) === id);
    return c?.nombre || id;
  };

  const setLocalVal = (relId, val) => {
    setRels(prev => prev.map(r => r._id === relId ? { ...r, relacion_actual: val } : r));
  };

  const saveRel = async (characterId, valor) => {
    setSavingId(characterId);
    try {
      const v = Math.max(-100, Math.min(100, parseInt(valor, 10) || 0));
      await api.post('/trading/relationships', { character_id: characterId, npc_id: npcId, relacion_actual: v });
      toast.success('Relación guardada');
      await load();
    } catch (e) { toast.error('Error al guardar relación'); }
    finally { setSavingId(null); }
  };

  const existingCharIds = new Set(rels.map(r => r.character_id));
  const addableChars = characters.filter(c => !existingCharIds.has(c.id || c._id));

  return (
    <div className="bg-black/20 rounded-lg p-3 border border-[hsl(var(--magic-blue))]/30 space-y-2" data-testid="npc-relationship-history">
      <div className="flex items-center gap-2">
        <Handshake className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
        <span className="text-sm font-medium text-[hsl(var(--magic-blue))]">Relación personal / Histórico</span>
        <span className="text-xs text-muted-foreground">(−100 a 100, neutral = 0)</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 className="w-3 h-3 animate-spin" /> Cargando…</div>
      ) : (
        <>
          {rels.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay relaciones registradas con este PNJ.</p>}
          {rels.map(rel => {
            const valor = rel.relacion_actual ?? 0;
            const nivel = nivelFromValor(valor);
            return (
              <div key={rel._id} className="flex items-center gap-2 flex-wrap bg-black/20 rounded px-2 py-1.5">
                <span className="text-sm text-[hsl(var(--gold))] flex-1 min-w-[120px]">{charName(rel.character_id)}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-black/40 text-muted-foreground">{NIVEL_LABELS[nivel]}</span>
                <input type="number" min={-100} max={100} value={valor}
                  onChange={(e) => setLocalVal(rel._id, e.target.value)}
                  className="w-16 bg-black/30 border border-border rounded px-2 py-1 text-sm text-center"
                  data-testid={`rel-valor-${rel.character_id}`} />
                <Button size="sm" variant="outline" onClick={() => saveRel(rel.character_id, valor)} disabled={savingId === rel.character_id}
                  data-testid={`rel-save-${rel.character_id}`}>
                  {savingId === rel.character_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </Button>
                {(rel.historial?.length > 0) && (
                  <span className="text-xs text-muted-foreground w-full">Histórico: {rel.historial.length} entrada(s)</span>
                )}
              </div>
            );
          })}

          {addableChars.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <select value={addChar} onChange={(e) => setAddChar(e.target.value)}
                className="flex-1 bg-black/30 border border-border rounded px-2 py-1 text-sm" data-testid="rel-add-char-select">
                <option value="">-- Añadir personaje --</option>
                {addableChars.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.nombre}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!addChar} onClick={() => { saveRel(addChar, 0); setAddChar(''); }}
                data-testid="rel-add-btn"><Plus className="w-3 h-3 mr-1" /> Añadir</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};


export const NpcEditorModal = ({ npc, config, onSave, onClose }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const [formData, setFormData] = useState({
    nombre: '',
    apodo: '',
    raza: '',
    subcultura: '',
    sexo: 'Masculino',
    edad: '',
    profesion: '',
    perfil_comerciante: 'normal',
    ubicacion: '',
    ubicacion_id: '',
    region: '',
    apariencia: '',
    rasgo: '',
    rasgo_tipo: 'positivo',
    rasgo_descripcion: '',
    modo_hablar: '',
    modo_hablar_desc: '',
    habilidades: [],
    herramientas: [],
    sentidos: [],
    idiomas: [],
    caracteristicas: {},
    ca: 10,
    pg: '',
    historia: '',
    retrato_file_id: null,
    notas: '',
    ...npc,
  });
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState(null);
  const [locations, setLocations] = useState([]);
  const [validRasgos, setValidRasgos] = useState({ positivos: [], negativos: [] });
  const [genName, setGenName] = useState(false);
  const [genProfile, setGenProfile] = useState(false);
  const [cuerpoEntero, setCuerpoEntero] = useState(true); // retrato de cuerpo entero (reversible)
  const [imageB64, setImageB64] = useState(null);

  const set = (patch) => setFormData(p => ({ ...p, ...patch }));

  // Cargar metadatos y ubicaciones
  useEffect(() => {
    (async () => {
      try {
        const [m, l] = await Promise.all([
          api.get('/trading/npc-meta'),
          api.get('/data/locations'),
        ]);
        setMeta(m.data);
        setLocations((l.data?.locations || []).slice().sort((a, b) =>
          (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
        ));
      } catch (e) { toast.error('Error cargando datos del PNJ'); }
    })();
  }, []);

  // Subculturas disponibles para la raza elegida
  const subculturas = useMemo(
    () => (meta?.razas?.[formData.raza] || []),
    [meta, formData.raza]
  );

  // Profesiones permitidas para la raza elegida (mapa editable de excepciones).
  const profesionesDisponibles = useMemo(() => {
    const todas = meta?.profesiones || [];
    const mapa = meta?.profesiones_por_raza || {};
    if (!formData.raza) return todas;
    return todas.filter((p) => {
      const permitidas = mapa[p];
      return !permitidas || permitidas.length === 0 || permitidas.includes(formData.raza);
    });
  }, [meta, formData.raza]);

  // Si la profesión elegida deja de ser válida al cambiar la raza, se limpia.
  useEffect(() => {
    if (formData.profesion && !profesionesDisponibles.includes(formData.profesion)) {
      set({ profesion: '' });
    }
  }, [profesionesDisponibles]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar rasgos válidos al cambiar raza/profesión
  useEffect(() => {
    if (!formData.raza && !formData.profesion) return;
    (async () => {
      try {
        const res = await api.post('/trading/npc-meta/rasgos', {
          raza: formData.raza, profesion: formData.profesion,
        });
        setValidRasgos(res.data || { positivos: [], negativos: [] });
      } catch (e) { /* noop */ }
    })();
  }, [formData.raza, formData.profesion]);

  const rasgoOptions = formData.rasgo_tipo === 'negativo' ? validRasgos.negativos : validRasgos.positivos;

  const onSelectUbicacion = (locId) => {
    const loc = locations.find(l => l.id === locId);
    set({ ubicacion_id: locId, ubicacion: loc?.nombre || '', region: loc?.region || '' });
  };

  const onSelectRasgo = (nombre) => {
    const found = rasgoOptions.find(r => r.nombre === nombre);
    set({ rasgo: nombre, rasgo_descripcion: found?.descripcion || '' });
  };

  // --- Bloques de estadísticas (Habilidades / Herramientas / Sentidos / Idiomas) ---
  const [rollingStats, setRollingStats] = useState(false);
  const statPools = useMemo(
    () => (meta?.stat_blocks?.[formData.profesion] || { habilidades: [], herramientas: [], sentidos: [], idiomas: [] }),
    [meta, formData.profesion]
  );

  const toggleStat = (field, value) => {
    const cur = Array.isArray(formData[field]) ? formData[field] : [];
    set({ [field]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] });
  };

  const rerollStats = async () => {
    if (!formData.profesion) { toast.warning('Elige una profesión primero'); return; }
    setRollingStats(true);
    try {
      const res = await api.post('/trading/npc-meta/stats', { profesion: formData.profesion });
      set({
        habilidades: res.data?.habilidades || [],
        herramientas: res.data?.herramientas || [],
        sentidos: res.data?.sentidos || [],
        idiomas: res.data?.idiomas || [],
      });
    } catch (e) { toast.error('Error al tirar estadísticas'); }
    finally { setRollingStats(false); }
  };

  const [rollingAttrs, setRollingAttrs] = useState(false);
  const rerollAtributos = async () => {
    setRollingAttrs(true);
    try {
      const res = await api.post('/trading/npc-meta/caracteristicas', { profesion: formData.profesion });
      set({ caracteristicas: res.data?.caracteristicas || {}, ca: res.data?.ca ?? 10, pg: res.data?.pg ?? '' });
    } catch (e) { toast.error('Error al generar atributos'); }
    finally { setRollingAttrs(false); }
  };
  const attrMod = (s) => Math.floor(((Number(s) || 10) - 10) / 2);
  const setAttr = (key, val) => {
    const n = parseInt(val, 10);
    set({ caracteristicas: { ...(formData.caracteristicas || {}), [key]: isNaN(n) ? '' : n } });
  };

  const handleGenerateName = async () => {
    setGenName(true);
    try {
      const res = await api.post('/trading/npcs/generate-name', {
        raza: formData.raza, subcultura: formData.subcultura,
        sexo: formData.sexo, profesion: formData.profesion,
      });
      set({ nombre: res.data?.nombre || '' });
    } catch (e) { toast.error('Error generando nombre'); }
    finally { setGenName(false); }
  };

  const handleGenerateProfile = async () => {
    setGenProfile(true);
    try {
      const res = await api.post('/trading/npcs/generate-profile', { ...formData, full_body: cuerpoEntero });
      if (res.data?.historia) set({ historia: res.data.historia });
      if (res.data?.retrato_file_id) set({ retrato_file_id: res.data.retrato_file_id });
      if (res.data?.image_base64) setImageB64(res.data.image_base64);
      const errs = res.data?.errors || [];
      if (errs.length) toast.warning('Generado con avisos: ' + errs.join('; '));
      else toast.success('Trasfondo y retrato generados');
    } catch (e) { toast.error('Error generando trasfondo/retrato'); }
    finally { setGenProfile(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  const portraitSrc = imageB64
    ? `data:image/png;base64,${imageB64}`
    : (npc?._id && formData.retrato_file_id ? `${API_URL}/api/trading/npcs/${npc._id}/portrait` : null);

  const labelCls = "text-sm text-muted-foreground";
  const selectCls = "w-full bg-black/30 border border-border rounded px-3 py-2";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" data-testid="npc-editor-modal">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))] z-10">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {npc?._id ? 'Editar PNJ' : 'Nuevo PNJ'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Ubicación + Región */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Ubicación*</label>
              <select className={selectCls} value={formData.ubicacion_id}
                onChange={(e) => onSelectUbicacion(e.target.value)} data-testid="npc-ubicacion-select">
                <option value="">-- Selecciona ubicación --</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.nombre}{l.region ? ` (${l.region})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Región (automática)</label>
              <Input value={formData.region} readOnly disabled placeholder="Se rellena al elegir ubicación" data-testid="npc-region" />
            </div>
          </div>

          {/* Raza + Subcultura + Sexo */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Raza</label>
              <select className={selectCls} value={formData.raza}
                onChange={(e) => set({ raza: e.target.value, subcultura: '' })} data-testid="npc-raza-select">
                <option value="">-- Raza --</option>
                {meta && Object.keys(meta.razas || {}).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subcultura</label>
              <select className={selectCls} value={formData.subcultura}
                onChange={(e) => set({ subcultura: e.target.value })} disabled={!formData.raza} data-testid="npc-subcultura-select">
                <option value="">-- Subcultura --</option>
                {subculturas.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sexo</label>
              <select className={selectCls} value={formData.sexo}
                onChange={(e) => set({ sexo: e.target.value })} data-testid="npc-sexo-select">
                {(meta?.sexos || ['Masculino', 'Femenino']).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Profesión + Perfil */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Profesión {!formData.raza && <span className="text-xs">(elige raza primero)</span>}</label>
              <select className={selectCls} value={formData.profesion} disabled={!formData.raza}
                onChange={(e) => set({ profesion: e.target.value })} data-testid="npc-profesion-select">
                <option value="">{formData.raza ? '-- Profesión --' : '-- Elige raza primero --'}</option>
                {profesionesDisponibles.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Perfil comerciante</label>
              <select className={selectCls} value={formData.perfil_comerciante}
                onChange={(e) => set({ perfil_comerciante: e.target.value })} data-testid="npc-perfil-select">
                {config?.merchant_profiles && Object.entries(config.merchant_profiles).map(([k, v]) => (
                  <option key={k} value={k}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Nombre + Apodo + Edad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nombre <span className="text-xs">(vacío = automático)</span></label>
              <div className="flex gap-2">
                <Input value={formData.nombre} onChange={(e) => set({ nombre: e.target.value })}
                  placeholder="Se autogenera si lo dejas vacío" data-testid="npc-nombre-input" />
                <Button type="button" variant="outline" onClick={handleGenerateName} disabled={genName}
                  title="Generar nombre aleatorio" data-testid="npc-generate-name-btn">
                  {genName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Apodo</label>
                <Input value={formData.apodo} onChange={(e) => set({ apodo: e.target.value })} placeholder="Opcional" />
              </div>
              <div>
                <label className={labelCls}>Edad <span className="text-xs">(auto)</span></label>
                <Input type="number" value={formData.edad} onChange={(e) => set({ edad: e.target.value })}
                  placeholder="Auto" data-testid="npc-edad-input" />
              </div>
            </div>
          </div>

          {/* Rasgo único */}
          <div className="bg-black/20 rounded-lg p-3 border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Rasgo único <span className="text-xs">(vacío = aleatorio coherente)</span></label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant={formData.rasgo_tipo === 'positivo' ? 'default' : 'outline'}
                  onClick={() => set({ rasgo_tipo: 'positivo', rasgo: '', rasgo_descripcion: '' })} data-testid="npc-rasgo-positivo-btn">Positivo</Button>
                <Button type="button" size="sm" variant={formData.rasgo_tipo === 'negativo' ? 'default' : 'outline'}
                  onClick={() => set({ rasgo_tipo: 'negativo', rasgo: '', rasgo_descripcion: '' })} data-testid="npc-rasgo-negativo-btn">Negativo</Button>
              </div>
            </div>
            <select className={selectCls} value={formData.rasgo}
              onChange={(e) => onSelectRasgo(e.target.value)} data-testid="npc-rasgo-select">
              <option value="">-- Aleatorio al guardar --</option>
              {rasgoOptions.map(r => <option key={r.nombre} value={r.nombre}>{r.nombre}</option>)}
            </select>
            {formData.rasgo_descripcion && (
              <p className="text-xs text-muted-foreground mt-2 italic" data-testid="npc-rasgo-desc">{formData.rasgo_descripcion}</p>
            )}
          </div>

          {/* Modo de hablar */}
          <div>
            <label className={labelCls}>Modo de hablar <span className="text-xs">(vacío = automático 50/50)</span></label>
            <select className={selectCls} value={formData.modo_hablar}
              onChange={(e) => {
                const sel = (meta?.modos_habla || []).find(m => m.nombre === e.target.value);
                set({ modo_hablar: e.target.value, modo_hablar_desc: e.target.value === 'Normal' ? 'Habla de forma normal.' : (sel?.descripcion || '') });
              }} data-testid="npc-modo-hablar-select">
              <option value="">-- Automático --</option>
              <option value="Normal">Normal</option>
              {(meta?.modos_habla || []).map(m => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
            </select>
          </div>

          {/* === BLOQUE SECRETO DEL DJ: Estadísticas === */}
          <div className="bg-[hsl(var(--torch-orange))]/5 rounded-lg p-3 border border-[hsl(var(--torch-orange))]/40 space-y-3" data-testid="npc-secret-dj-block">
            <div className="flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-[hsl(var(--torch-orange))]" />
              <span className="text-sm font-medium text-[hsl(var(--torch-orange))]">Datos secretos del DJ</span>
              <span className="text-xs text-muted-foreground">(el jugador no los ve sin tirada enfrentada)</span>
            </div>

            {/* Atributos: 6 características + CA + PG */}
            <div data-testid="npc-atributos-block">
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Atributos <span className="text-xs">(array 15/13/12/11/9/8, CA 10, PG 8-20; vacío = auto)</span></label>
                <Button type="button" size="sm" variant="outline" onClick={rerollAtributos} disabled={rollingAttrs}
                  title="Regenerar atributos según la profesión" data-testid="npc-reroll-attrs-btn">
                  {rollingAttrs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
                  <span className="ml-1 text-xs">Generar</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-[hsl(var(--magic-blue))]">CA</span>
                  <input type="number" className="w-14 bg-black/30 border border-border rounded px-1 py-1 text-sm text-center"
                    value={formData.ca} onChange={(e) => set({ ca: parseInt(e.target.value, 10) || 0 })} data-testid="npc-ca-input" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase text-red-400">PG</span>
                  <input type="number" className="w-14 bg-black/30 border border-border rounded px-1 py-1 text-sm text-center"
                    value={formData.pg} onChange={(e) => set({ pg: parseInt(e.target.value, 10) || 0 })} placeholder="auto" data-testid="npc-pg-input" />
                </div>
                {[['fuerza','FUE'],['destreza','DES'],['constitucion','CON'],['inteligencia','INT'],['sabiduria','SAB'],['carisma','CAR']].map(([key,lab]) => {
                  const v = (formData.caracteristicas || {})[key] ?? '';
                  return (
                    <div key={key} className="flex flex-col items-center">
                      <span className="text-[10px] uppercase text-muted-foreground">{lab} {v !== '' ? `(${attrMod(v) >= 0 ? '+' : ''}${attrMod(v)})` : ''}</span>
                      <input type="number" className="w-14 bg-black/30 border border-border rounded px-1 py-1 text-sm text-center text-[hsl(var(--gold))]"
                        value={v} onChange={(e) => setAttr(key, e.target.value)} placeholder="auto" data-testid={`npc-attr-${key}`} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloques de estadísticas por profesión */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>Estadísticas <span className="text-xs">(vacío = aleatorio según profesión)</span></label>
                <Button type="button" size="sm" variant="outline" onClick={rerollStats} disabled={rollingStats || !formData.profesion}
                  title="Tirar estadísticas al azar para esta profesión" data-testid="npc-reroll-stats-btn">
                  {rollingStats ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
                  <span className="ml-1 text-xs">Tirar</span>
                </Button>
              </div>
              {!formData.profesion && (
                <p className="text-xs text-muted-foreground italic">Elige una profesión para ver las opciones de estadísticas.</p>
              )}
              {[
                { field: 'habilidades', label: 'Habilidades' },
                { field: 'herramientas', label: 'Herramientas' },
                { field: 'sentidos', label: 'Sentidos' },
                { field: 'idiomas', label: 'Idiomas' },
              ].map(({ field, label }) => {
                const pool = Array.from(new Set([...(statPools[field] || []), ...((formData[field]) || [])]));
                return (
                  <div key={field} className="mt-2">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {pool.length === 0 && <span className="text-xs text-muted-foreground italic">—</span>}
                      {pool.map(opt => {
                        const active = (formData[field] || []).includes(opt);
                        return (
                          <button key={opt} type="button" onClick={() => toggleStat(field, opt)}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${active ? 'bg-[hsl(var(--torch-orange))]/30 border-[hsl(var(--torch-orange))] text-[hsl(var(--torch-orange))]' : 'bg-black/30 border-border text-muted-foreground hover:border-[hsl(var(--torch-orange))]/50'}`}
                            data-testid={`npc-stat-${field}-${opt}`}>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Apariencia + Trasfondo + Retrato */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelCls}>Detalles físicos (apariencia)</label>
              <Button type="button" size="sm" onClick={handleGenerateProfile} disabled={genProfile}
                className="bg-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/90"
                data-testid="npc-generate-profile-btn">
                {genProfile ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
                Generar trasfondo + retrato
              </Button>
            </div>
            <textarea className="w-full bg-black/30 border border-border rounded px-3 py-2 h-16"
              value={formData.apariencia} onChange={(e) => set({ apariencia: e.target.value })}
              placeholder="Ej: cicatriz en la cara, nariz grande, barba trenzada" data-testid="npc-apariencia-input" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer mt-1" data-testid="npc-cuerpo-entero-label">
              <input type="checkbox" checked={cuerpoEntero} onChange={(e) => setCuerpoEntero(e.target.checked)} data-testid="npc-cuerpo-entero-toggle" />
              Retrato de cuerpo entero (para apreciar piernas, cicatrices, muletas…)
            </label>
          </div>

          {portraitSrc && (
            <div className="flex justify-center">
              <img src={portraitSrc} alt="Retrato del PNJ" className="max-h-56 rounded-lg border border-[hsl(var(--gold))]/40"
                data-testid="npc-portrait-preview" />
            </div>
          )}

          <div>
            <label className={labelCls}>Trasfondo / Historia</label>
            <textarea className="w-full bg-black/30 border border-border rounded px-3 py-2 h-28"
              value={formData.historia} onChange={(e) => set({ historia: e.target.value })}
              placeholder="Se redacta con el botón de arriba o puedes escribirlo a mano" data-testid="npc-historia-input" />
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea className="w-full bg-black/30 border border-border rounded px-3 py-2 h-16"
              value={formData.notas} onChange={(e) => set({ notas: e.target.value })} placeholder="Notas del DJ" />
          </div>

          {npc?._id && <NpcRelationshipHistory npcId={npc._id} />}
        </div>

        <div className="p-4 border-t border-border/30 flex justify-end gap-2 sticky bottom-0 bg-[hsl(var(--background))]">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !formData.ubicacion_id}
            className="bg-[hsl(var(--torch-orange))] hover:bg-[hsl(var(--torch-orange))]/90 text-black"
            data-testid="npc-save-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TradingSystemSection;


// ============================================================================
// REGION MODIFIERS PANEL — editable hierarchy with parent-to-child inheritance
// ============================================================================

const RegionModifiersPanel = ({ regions, priceModifiers, isAdmin, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [pctByName, setPctByName] = useState({}); // { regionName: integer pct }
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Build a flat list of {nombre, depth, parent} from the regions hierarchy.
  const flat = useMemo(() => {
    const out = [];
    (regions || []).forEach(top => {
      out.push({ nombre: top.nombre, depth: 0, parent: null });
      (top.subregions || []).forEach(sub => {
        out.push({ nombre: sub.nombre, depth: 1, parent: top.nombre });
      });
    });
    return out;
  }, [regions]);

  // Initialise/reset local state when the source data changes.
  useEffect(() => {
    if (!flat.length) return;
    const modByName = new Map();
    (priceModifiers?.region || []).forEach(rr => {
      if (rr?.nombre) modByName.set(rr.nombre.trim().toLowerCase(), rr.modificador);
    });
    const next = {};
    flat.forEach(row => {
      const m = modByName.get(row.nombre.trim().toLowerCase());
      next[row.nombre] = m !== undefined ? Math.round((m - 1) * 100) : 0;
    });
    setPctByName(next);
    setDirty(false);
  }, [flat, priceModifiers]);

  const setPct = (nombre, value) => {
    const n = Number.parseInt(value, 10);
    setPctByName(prev => ({ ...prev, [nombre]: Number.isFinite(n) ? n : 0 }));
    setDirty(true);
  };

  // Apply parent's % to all of its direct subregions.
  const inheritToChildren = (parentName) => {
    const parentPct = pctByName[parentName] ?? 0;
    const children = flat.filter(r => r.parent === parentName);
    if (children.length === 0) {
      toast.info(`"${parentName}" no tiene sub-regiones`);
      return;
    }
    setPctByName(prev => {
      const next = { ...prev };
      children.forEach(c => { next[c.nombre] = parentPct; });
      return next;
    });
    setDirty(true);
    toast.success(`Aplicado ${parentPct >= 0 ? '+' : ''}${parentPct}% a ${children.length} sub-región(es) de "${parentName}"`);
  };

  const save = async () => {
    setSaving(true);
    try {
      const items = flat.map(r => ({
        nombre: r.nombre,
        modificador: 1 + ((pctByName[r.nombre] ?? 0) / 100),
        descripcion: '',
      }));
      await api.put('/data/modificadores-precio/region', { items });
      toast.success(`Guardados ${items.length} modificadores de región`);
      setDirty(false);
      onSaved?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar modificadores');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-black/20 rounded-lg border border-[hsl(var(--gold))]/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center p-4 text-left"
        data-testid="region-modifiers-toggle"
      >
        <div>
          <span className="font-medium text-[hsl(var(--gold))]">Modificadores por Región</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define el % de más/menos por cada región. Los valores se heredan a las sub-regiones con el botón ↓.
          </p>
        </div>
        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {flat.length === 0 ? (
            <p className="text-sm text-muted-foreground italic px-2 py-3">
              No hay regiones cargadas. Ve a Reglas → Regiones para crearlas primero.
            </p>
          ) : (
            <>
              <div className="max-h-[28rem] overflow-y-auto pr-1 border border-border/30 rounded">
                {flat.map(row => {
                  const pct = pctByName[row.nombre] ?? 0;
                  const isParent = row.depth === 0;
                  const childCount = isParent
                    ? flat.filter(r => r.parent === row.nombre).length
                    : 0;
                  return (
                    <div
                      key={`${row.depth}-${row.nombre}`}
                      className={`flex items-center gap-2 px-3 py-1.5 ${
                        row.depth === 0 ? 'bg-black/30' : 'bg-black/10'
                      } border-b border-border/20`}
                      data-testid={`region-mod-row-${row.nombre}`}
                    >
                      <span
                        className={`flex-1 text-sm truncate ${
                          isParent ? 'font-medium text-amber-100' : 'text-amber-200/80'
                        }`}
                      >
                        {row.depth > 0 && <span className="text-muted-foreground">└─ </span>}
                        {row.nombre}
                      </span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step={1}
                          value={pct}
                          onChange={(e) => setPct(row.nombre, e.target.value)}
                          className="w-20 h-8 text-right"
                          disabled={!isAdmin}
                          data-testid={`region-mod-input-${row.nombre}`}
                        />
                        <span className="text-xs text-muted-foreground w-4">%</span>
                      </div>
                      {isAdmin && isParent && childCount > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => inheritToChildren(row.nombre)}
                          className="h-7 text-xs text-amber-300 hover:bg-amber-900/30"
                          title={`Aplicar ${pct >= 0 ? '+' : ''}${pct}% a las ${childCount} sub-región(es)`}
                          data-testid={`inherit-to-children-${row.nombre}`}
                        >
                          ↓ Heredar ({childCount})
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground italic">
                    {dirty ? '● Hay cambios sin guardar' : 'Sin cambios pendientes'}
                  </p>
                  <Button
                    size="sm"
                    onClick={save}
                    disabled={!dirty || saving}
                    className="bg-[hsl(var(--torch-orange))] text-black hover:bg-[hsl(var(--torch-orange))]/90"
                    data-testid="region-mods-save-btn"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Guardar modificadores
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

