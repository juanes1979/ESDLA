/**
 * Trading System Section
 * Complete dynamic buy/sell system with NPC negotiation, relationship tracking, and AI dialogue
 */
import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Save, RefreshCw, Plus, Trash2, Edit, ChevronDown, ChevronUp, 
  Coins, Package, User, Users, Settings, Calculator, MessageSquare, 
  Handshake, AlertTriangle, Check, X, Dices, TrendingUp, TrendingDown,
  ShoppingCart, Store, History, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import api from '@/services/api';

// ============================================================================
// CONSTANTS AND HELPERS
// ============================================================================

const TABS = [
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
  const [activeTab, setActiveTab] = useState('calculator');
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
      
      return true;
    });
  }, [allItems, itemSearchQuery, calcForm.region, calcForm.tipo_asentamiento]);

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
      const res = await api.get('/characters');
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
    } catch (err) {
      console.error('Error calculating trade:', err);
      toast.error('Error al calcular');
    } finally {
      setCalculating(false);
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

          {/* Calculate button */}
          <Button
            onClick={calculateTrade}
            disabled={calculating}
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
      { id: 'relationships', title: 'Niveles de Relación', data: config.relationship_levels },
      { id: 'blessings', title: 'Modificadores de Bendición', data: config.blessing_modifiers },
      { id: 'merchants', title: 'Perfiles de Comerciante', data: config.merchant_profiles },
      { id: 'contexts', title: 'Contextos Históricos', data: config.historical_contexts },
      { id: 'thresholds', title: 'Umbrales de Reacción', data: config.trading_thresholds },
      { id: 'contraoferta', title: 'Factores de Contraoferta', data: config.contraoferta_factors },
      { id: 'anger', title: 'Consecuencias del Enfado', data: config.anger_consequences },
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
                <pre className="text-xs bg-black/30 rounded p-3 overflow-auto max-h-96 text-muted-foreground">
                  {JSON.stringify(section.data, null, 2)}
                </pre>
                {isAdmin && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Para editar, modifica el JSON y guarda. Los cambios se aplicarán a todas las transacciones futuras.
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {npcs.map(npc => (
              <div 
                key={npc._id} 
                className="bg-black/20 rounded-lg p-4 border border-border/30 hover:border-[hsl(var(--gold))]/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-[hsl(var(--gold))]">{npc.nombre}</h4>
                    <p className="text-sm text-muted-foreground">{npc.profesion_comerciante || npc.ocupacion}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => { setEditingNpc(npc); setShowNpcEditor(true); }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      onClick={() => deleteNpc(npc._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1 text-xs">
                  {npc.ubicacion && (
                    <p><span className="text-muted-foreground">Ubicación:</span> {npc.ubicacion}</p>
                  )}
                  <p><span className="text-muted-foreground">Perfil:</span> 
                    <span className="ml-1 px-2 py-0.5 rounded bg-black/30">
                      {config?.merchant_profiles?.[npc.perfil_comerciante]?.nombre || npc.perfil_comerciante}
                    </span>
                  </p>
                  {npc.apariencia && (
                    <p className="text-muted-foreground line-clamp-2">{npc.apariencia}</p>
                  )}
                </div>
              </div>
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

const NpcEditorModal = ({ npc, config, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    apodo: '',
    ocupacion: '',
    profesion_comerciante: '',
    apariencia: '',
    rasgo_positivo: '',
    rasgo_negativo: '',
    habilidad_especial: '',
    modo_hablar: '',
    personalidad: '',
    conocimiento_util: '',
    vinculo: '',
    defecto_secreto: '',
    alineamiento_moral: 'Neutral',
    alineamiento_etico: 'Neutral',
    perfil_comerciante: 'normal',
    ubicacion: '',
    region: '',
    inventario: '',
    notas: '',
    ...npc,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border/30 flex justify-between items-center sticky top-0 bg-[hsl(var(--background))]">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            {npc?._id ? 'Editar PNJ' : 'Nuevo PNJ'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Nombre*</label>
              <Input
                value={formData.nombre}
                onChange={(e) => setFormData(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre del PNJ"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Apodo</label>
              <Input
                value={formData.apodo}
                onChange={(e) => setFormData(p => ({ ...p, apodo: e.target.value }))}
                placeholder="Apodo o sobrenombre"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Profesión Comerciante</label>
              <Input
                value={formData.profesion_comerciante}
                onChange={(e) => setFormData(p => ({ ...p, profesion_comerciante: e.target.value }))}
                placeholder="Ej: Herrero, Posadero"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Perfil</label>
              <select
                className="w-full bg-black/30 border border-border rounded px-3 py-2"
                value={formData.perfil_comerciante}
                onChange={(e) => setFormData(p => ({ ...p, perfil_comerciante: e.target.value }))}
              >
                {config?.merchant_profiles && Object.entries(config.merchant_profiles).map(([key, val]) => (
                  <option key={key} value={key}>{val.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Ubicación</label>
              <Input
                value={formData.ubicacion}
                onChange={(e) => setFormData(p => ({ ...p, ubicacion: e.target.value }))}
                placeholder="Ej: Bree, Edoras"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Región</label>
              <Input
                value={formData.region}
                onChange={(e) => setFormData(p => ({ ...p, region: e.target.value }))}
                placeholder="Ej: Eriador, Rohan"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Apariencia</label>
            <textarea
              className="w-full bg-black/30 border border-border rounded px-3 py-2 h-20"
              value={formData.apariencia}
              onChange={(e) => setFormData(p => ({ ...p, apariencia: e.target.value }))}
              placeholder="Descripción física"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Rasgo Positivo</label>
              <Input
                value={formData.rasgo_positivo}
                onChange={(e) => setFormData(p => ({ ...p, rasgo_positivo: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Rasgo Negativo</label>
              <Input
                value={formData.rasgo_negativo}
                onChange={(e) => setFormData(p => ({ ...p, rasgo_negativo: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Personalidad</label>
            <Input
              value={formData.personalidad}
              onChange={(e) => setFormData(p => ({ ...p, personalidad: e.target.value }))}
              placeholder="Rasgos de personalidad"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Modo de Hablar</label>
            <Input
              value={formData.modo_hablar}
              onChange={(e) => setFormData(p => ({ ...p, modo_hablar: e.target.value }))}
              placeholder="Cómo habla el PNJ"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground">Notas</label>
            <textarea
              className="w-full bg-black/30 border border-border rounded px-3 py-2 h-20"
              value={formData.notas}
              onChange={(e) => setFormData(p => ({ ...p, notas: e.target.value }))}
              placeholder="Notas adicionales"
            />
          </div>
        </div>

        <div className="p-4 border-t border-border/30 flex justify-end gap-2 sticky bottom-0 bg-[hsl(var(--background))]">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.nombre}
            className="bg-[hsl(var(--torch-orange))] hover:bg-[hsl(var(--torch-orange))]/90 text-black"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TradingSystemSection;
