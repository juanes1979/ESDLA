/**
 * Equipment Manager Modal
 * Allows adding, modifying, and removing equipment from characters
 * Handles purchases (deducting money) and gifts/treasures
 * Manages mount carrying capacity
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  X, Package, Plus, Trash2, Search, ShoppingCart, Gift, 
  Loader2, AlertTriangle, Landmark, User, Scale, Coins,
  Sword, Shield, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// Category display names
const CATEGORY_NAMES = {
  equipo_general: 'Equipo General',
  herramientas: 'Herramientas',
  juegos: 'Juegos',
  instrumentos_musicales: 'Instrumentos Musicales',
  consumibles: 'Consumibles',
  comida_posadas: 'Comida en Posadas',
  hierbas: 'Hierbas y Pociones',
  venenos: 'Venenos',
  armas_sencillas_cc: 'Armas Sencillas (C/C)',
  armas_sencillas_distancia: 'Armas Sencillas (Distancia)',
  armas_marciales_cc: 'Armas Marciales (C/C)',
  armas_marciales_distancia: 'Armas Marciales (Distancia)',
  armaduras_ligeras: 'Armaduras Ligeras',
  armaduras_medias: 'Armaduras Medias',
  armaduras_pesadas: 'Armaduras Pesadas',
  escudos: 'Escudos',
  monturas: 'Monturas',
  accesorios_monturas: 'Accesorios de Montura',
  transporte_terrestre: 'Transporte Terrestre',
  transporte_maritimo: 'Transporte Marítimo',
};

// Category groups for organization
const CATEGORY_GROUPS = {
  'Armas': ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia'],
  'Armaduras': ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos'],
  'Equipo': ['equipo_general', 'herramientas', 'juegos', 'instrumentos_musicales'],
  'Consumibles': ['consumibles', 'comida_posadas', 'hierbas', 'venenos'],
  'Monturas y Transporte': ['monturas', 'accesorios_monturas', 'transporte_terrestre', 'transporte_maritimo'],
};

const COIN_LABELS = { mo: 'Oro', mp: 'Plata', me: 'Estaño', mc: 'Cobre' };

const EquipmentManagerModal = ({
  isOpen,
  onClose,
  character,
  onCharacterUpdate,
}) => {
  const [activeTab, setActiveTab] = useState('add'); // 'add' | 'manage'
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('equipo_general');
  const [expandedGroups, setExpandedGroups] = useState({ 'Equipo': true });
  const [weightSummary, setWeightSummary] = useState(null);
  
  // Add item form state
  const [selectedItem, setSelectedItem] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [isPurchase, setIsPurchase] = useState(true);
  
  // Price modifiers state
  const [priceModifiers, setPriceModifiers] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState({
    region: null,
    asentamiento: null,
    relacion: null,
    contexto: null,
  });
  const [showModifiers, setShowModifiers] = useState(false);

  // Load catalog, weight summary and price modifiers
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen) return;
      try {
        setLoading(true);
        const [catalogRes, weightRes, modifiersRes] = await Promise.all([
          api.get('/data/equipment-catalog'),
          api.get(`/characters/${character.id}/weight-summary`),
          api.get('/data/modificadores-precio'),
        ]);
        setCatalog(catalogRes.data || {});
        setWeightSummary(weightRes.data);
        setPriceModifiers(modifiersRes.data);
      } catch (err) {
        console.error('Error loading data:', err);
        toast.error('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, character?.id]);

  // Refresh weight after changes
  const refreshWeight = async () => {
    try {
      const res = await api.get(`/characters/${character.id}/weight-summary`);
      setWeightSummary(res.data);
    } catch (err) {
      console.error('Error refreshing weight:', err);
    }
  };

  // Calculate total modifier from selected options
  const calculateTotalModifier = () => {
    let total = 1.0;
    if (selectedModifiers.region) total *= selectedModifiers.region.modificador;
    if (selectedModifiers.asentamiento) total *= selectedModifiers.asentamiento.modificador;
    if (selectedModifiers.relacion) total *= selectedModifiers.relacion.modificador;
    if (selectedModifiers.contexto) total *= selectedModifiers.contexto.modificador;
    return total;
  };

  // Filter items based on search
  const filteredItems = useMemo(() => {
    const items = catalog[selectedCategory] || [];
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.nombre?.toLowerCase().includes(term)
    );
  }, [catalog, selectedCategory, searchTerm]);

  // Get current character money in display format
  const getMoneyDisplay = () => {
    const dinero = character?.dinero || { mo: 0, mp: 0, me: 0, mc: 0 };
    const parts = [];
    if (dinero.mo > 0) parts.push(`${dinero.mo} mo`);
    if (dinero.mp > 0) parts.push(`${dinero.mp} mp`);
    if (dinero.me > 0) parts.push(`${dinero.me} me`);
    if (dinero.mc > 0) parts.push(`${dinero.mc} mc`);
    return parts.length > 0 ? parts.join(', ') : '0';
  };

  // Calculate total price with modifiers
  const getTotalPrice = () => {
    if (!selectedItem) return null;
    const precioBase = selectedItem.precio || 0;
    const moneda = selectedItem.moneda || 'mp';
    const modifier = calculateTotalModifier();
    const precioFinal = Math.round(precioBase * cantidad * modifier * 100) / 100;
    return { 
      precioBase: precioBase * cantidad,
      precioFinal,
      moneda,
      modifier,
    };
  };

  // Check if can afford
  const canAfford = () => {
    if (!isPurchase || !selectedItem) return true;
    const priceData = getTotalPrice();
    if (!priceData || priceData.precioFinal === 0) return true;
    
    // Convert everything to copper for comparison
    const rates = { mo: 1000, mp: 100, me: 10, mc: 1 };
    const dinero = character?.dinero || { mo: 0, mp: 0, me: 0, mc: 0 };
    const totalCopper = (dinero.mo || 0) * rates.mo + (dinero.mp || 0) * rates.mp + 
                        (dinero.me || 0) * rates.me + (dinero.mc || 0) * rates.mc;
    const costCopper = priceData.precioFinal * rates[priceData.moneda];
    return totalCopper >= costCopper;
  };

  // Add equipment
  const handleAddEquipment = async () => {
    if (!selectedItem) return;
    
    setProcessing(true);
    try {
      // Get price with modifiers applied
      const priceData = getTotalPrice();
      const finalPrice = isPurchase && priceData ? priceData.precioFinal / cantidad : 0;
      
      const res = await api.post(`/characters/${character.id}/equipment/add`, {
        item_name: selectedItem.nombre,
        item_category: selectedCategory,
        cantidad: cantidad,
        is_purchase: isPurchase,
        precio: finalPrice, // Use modified price
        moneda: selectedItem.moneda || 'mp',
        peso_kg: selectedItem.peso_kg,
        dano: selectedItem.dano,
        ca: selectedItem.ca,
        herida: selectedItem.herida,
        alcance: selectedItem.alcance,
        capacidad_carga: selectedItem.capacidad_carga,
      });
      
      toast.success(res.data.message);
      onCharacterUpdate(res.data.character);
      await refreshWeight();
      
      // Reset form
      setSelectedItem(null);
      setCantidad(1);
    } catch (err) {
      console.error('Error adding equipment:', err);
      toast.error(err.response?.data?.detail || 'Error al añadir equipo');
    } finally {
      setProcessing(false);
    }
  };

  // Remove equipment
  const handleRemoveEquipment = async (itemName, itemCategory) => {
    if (!confirm(`¿Eliminar ${itemName}?`)) return;
    
    setProcessing(true);
    try {
      const res = await api.delete(`/characters/${character.id}/equipment/remove`, {
        params: { item_name: itemName, item_category: itemCategory }
      });
      
      toast.success(res.data.message);
      onCharacterUpdate(res.data.character);
      await refreshWeight();
    } catch (err) {
      console.error('Error removing equipment:', err);
      toast.error(err.response?.data?.detail || 'Error al eliminar equipo');
    } finally {
      setProcessing(false);
    }
  };

  // Update carrier (character or mount)
  const handleUpdateCarrier = async (itemIndex, carriedBy) => {
    setProcessing(true);
    try {
      const res = await api.patch(`/characters/${character.id}/equipment/carry`, {
        item_index: itemIndex,
        carried_by: carriedBy
      });
      
      onCharacterUpdate(res.data);
      await refreshWeight();
      toast.success(`Equipo ${carriedBy === 'montura' ? 'movido a la montura' : 'llevado por el personaje'}`);
    } catch (err) {
      console.error('Error updating carrier:', err);
      toast.error(err.response?.data?.detail || 'Error al actualizar');
    } finally {
      setProcessing(false);
    }
  };

  // Toggle group expansion
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  if (!isOpen) return null;

  // Get all character equipment for management tab
  const getAllEquipment = () => {
    const items = [];
    const addedWeapons = new Set();
    
    // Helper to add weapons from different sources
    const addWeapons = (armasArray, source) => {
      (armasArray || []).forEach((arma, idx) => {
        const nombre = typeof arma === 'object' ? arma.nombre : arma;
        if (!nombre || addedWeapons.has(nombre.toLowerCase())) return;
        addedWeapons.add(nombre.toLowerCase());
        
        const mejoras = typeof arma === 'object' ? (arma.mejoras || []) : [];
        items.push({
          nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
          nombreBase: nombre,
          categoria: 'armas',
          tipo: 'Arma',
          peso: arma?.peso_kg || 0,
          canMove: false, // Weapons always on character
          index: idx,
          source: source,
          mejoras,
        });
      });
    };
    
    // Weapons from armas array
    addWeapons(character.armas, 'armas');
    
    // Weapons from armas_elegidas (character creation)
    addWeapons(character.armas_elegidas, 'elegidas');
    
    // Armor
    const armadura = character.armadura;
    if (armadura && (typeof armadura === 'string' ? armadura : armadura.nombre)) {
      const nombre = typeof armadura === 'object' ? armadura.nombre : armadura;
      const mejoras = typeof armadura === 'object' ? (armadura.mejoras || []) : [];
      items.push({
        nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
        nombreBase: nombre,
        categoria: 'armaduras',
        tipo: 'Armadura',
        peso: armadura?.peso_kg || 0,
        canMove: false, // Armor always on character
        mejoras,
      });
    }
    
    // Armor from armadura_elegida (character creation)
    if (!armadura && character.armadura_elegida) {
      const armElegida = Array.isArray(character.armadura_elegida) 
        ? character.armadura_elegida[0] 
        : character.armadura_elegida;
      if (armElegida) {
        const nombre = typeof armElegida === 'object' ? armElegida.nombre : armElegida;
        items.push({
          nombre,
          nombreBase: nombre,
          categoria: 'armaduras',
          tipo: 'Armadura',
          peso: 0,
          canMove: false,
          mejoras: [],
        });
      }
    }
    
    // Shield/Equipment
    (character.equipo || []).forEach((item, idx) => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      const mejoras = typeof item === 'object' ? (item.mejoras || []) : [];
      items.push({
        nombre: mejoras.length > 0 ? `${nombre} [${mejoras.join(', ')}]` : nombre,
        nombreBase: nombre,
        categoria: nombre?.toLowerCase().includes('escudo') ? 'escudos' : 'equipo',
        tipo: nombre?.toLowerCase().includes('escudo') ? 'Escudo' : 'Equipo',
        peso: item?.peso_kg || 0,
        canMove: !nombre?.toLowerCase().includes('escudo'), // Shields can't be moved
        portadoPor: item?.portado_por || 'personaje',
        index: idx,
        mejoras,
      });
    });
    
    // Inventory
    (character.inventario || []).forEach((item, idx) => {
      const nombre = typeof item === 'object' ? item.nombre : item;
      const cantidad = typeof item === 'object' ? item.cantidad : 1;
      items.push({
        nombre: cantidad > 1 ? `${nombre} (x${cantidad})` : nombre,
        nombreBase: nombre,
        categoria: item?.categoria || 'equipo_general',
        tipo: 'Inventario',
        peso: (item?.peso_kg || 0) * cantidad,
        canMove: true,
        portadoPor: item?.portado_por || 'personaje',
        index: idx,
      });
    });
    
    // Mount
    const montura = character.montura;
    if (montura && montura.nombre) {
      items.push({
        nombre: `${montura.nombre} (Cap: ${montura.capacidad_carga || 0}kg)`,
        nombreBase: montura.nombre,
        categoria: 'monturas',
        tipo: 'Montura',
        peso: 0,
        canMove: false,
        isMontura: true,
        capacidad: montura.capacidad_carga || 0,
      });
    }
    
    return items;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-[hsl(var(--background))] border-[hsl(var(--gold))]/50">
        <CardHeader className="border-b border-border/30 pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Package className="w-6 h-6" />
              Gestión de Equipamiento
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Money and Weight Summary */}
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-2 bg-yellow-900/30 px-3 py-1 rounded">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-200">{getMoneyDisplay()}</span>
            </div>
            {weightSummary && (
              <div className={`flex items-center gap-2 px-3 py-1 rounded ${
                weightSummary.estado_carga === 'muy_cargado' ? 'bg-red-900/30' :
                weightSummary.estado_carga === 'cargado' ? 'bg-orange-900/30' : 'bg-green-900/30'
              }`}>
                <Scale className="w-4 h-4" />
                <span>{weightSummary.peso_personaje} / {weightSummary.limite_muy_cargado} kg</span>
                {weightSummary.estado_carga !== 'normal' && (
                  <Badge variant="destructive" className="text-xs">
                    {weightSummary.estado_carga === 'muy_cargado' ? 'Muy Cargado' : 'Cargado'}
                  </Badge>
                )}
              </div>
            )}
            {weightSummary?.tiene_montura && (
              <div className="flex items-center gap-2 bg-blue-900/30 px-3 py-1 rounded">
                <Landmark className="w-4 h-4 text-blue-400" />
                <span>{weightSummary.nombre_montura}: {weightSummary.peso_montura}/{weightSummary.capacidad_montura} kg</span>
              </div>
            )}
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={activeTab === 'add' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('add')}
              className={activeTab === 'add' ? 'bg-[hsl(var(--gold))] text-black' : ''}
            >
              <Plus className="w-4 h-4 mr-1" />
              Añadir Equipo
            </Button>
            <Button
              variant={activeTab === 'manage' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('manage')}
              className={activeTab === 'manage' ? 'bg-[hsl(var(--gold))] text-black' : ''}
            >
              <Package className="w-4 h-4 mr-1" />
              Gestionar ({getAllEquipment().length})
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
            </div>
          ) : activeTab === 'add' ? (
            /* ADD EQUIPMENT TAB */
            <div className="grid grid-cols-12 gap-4 h-[60vh]">
              {/* Category Selection */}
              <div className="col-span-3 border-r border-border/30 pr-4">
                <h4 className="font-medium mb-2 text-sm text-muted-foreground">Categorías</h4>
                <ScrollArea className="h-[55vh]">
                  {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
                    <div key={group} className="mb-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className="flex items-center gap-1 w-full text-left py-1 text-sm font-medium text-[hsl(var(--gold))]"
                      >
                        {expandedGroups[group] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        {group}
                      </button>
                      {expandedGroups[group] && (
                        <div className="ml-4 space-y-1">
                          {categories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => {
                                setSelectedCategory(cat);
                                setSelectedItem(null);
                              }}
                              className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                                selectedCategory === cat
                                  ? 'bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]'
                                  : 'hover:bg-secondary/50'
                              }`}
                            >
                              {CATEGORY_NAMES[cat] || cat}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({catalog[cat]?.length || 0})
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </ScrollArea>
              </div>
              
              {/* Item List */}
              <div className="col-span-5">
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {filteredItems.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        className={`w-full text-left p-2 rounded border transition-all ${
                          selectedItem?.nombre === item.nombre
                            ? 'bg-[hsl(var(--gold))]/20 border-[hsl(var(--gold))]'
                            : 'bg-black/20 border-border/30 hover:border-[hsl(var(--gold))]/50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-sm">{item.nombre}</span>
                          {item.precio > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {item.precio} {item.moneda || 'mp'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          {item.peso_kg > 0 && <span>{item.peso_kg} kg</span>}
                          {item.dano && <span>Daño: {item.dano}</span>}
                          {item.ca && <span>CA: +{item.ca}</span>}
                          {item.capacidad_carga && <span>Carga: {item.capacidad_carga} kg</span>}
                        </div>
                        {item.efecto && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{item.efecto}</p>
                        )}
                      </button>
                    ))}
                    {filteredItems.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No se encontraron items</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Add Form */}
              <div className="col-span-4 border-l border-border/30 pl-4">
                <h4 className="font-medium mb-3 text-[hsl(var(--gold))]">Añadir Item</h4>
                {selectedItem ? (
                  <ScrollArea className="h-[55vh]">
                  <div className="space-y-4 pr-2">
                    <div className="p-3 bg-secondary/30 rounded">
                      <h5 className="font-medium">{selectedItem.nombre}</h5>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        {selectedItem.precio > 0 && <p>Precio base: {selectedItem.precio} {selectedItem.moneda || 'mp'}</p>}
                        {selectedItem.peso_kg > 0 && <p>Peso: {selectedItem.peso_kg} kg</p>}
                        {selectedItem.dano && <p>Daño: {selectedItem.dano}</p>}
                        {selectedItem.ca && <p>CA: +{selectedItem.ca}</p>}
                        {selectedItem.capacidad_carga && <p>Capacidad: {selectedItem.capacidad_carga} kg</p>}
                      </div>
                    </div>
                    
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={cantidad}
                        onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                        className="mt-1"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Tipo de adquisición</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={isPurchase ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsPurchase(true)}
                          className={isPurchase ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Comprar
                        </Button>
                        <Button
                          variant={!isPurchase ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsPurchase(false)}
                          className={!isPurchase ? 'bg-green-600 hover:bg-green-700' : ''}
                        >
                          <Gift className="w-4 h-4 mr-1" />
                          Regalo/Tesoro
                        </Button>
                      </div>
                    </div>
                    
                    {/* Price Modifiers - Only show when purchasing */}
                    {isPurchase && selectedItem.precio > 0 && priceModifiers && (
                      <div className="space-y-2 border border-border/30 rounded p-3">
                        <button 
                          onClick={() => setShowModifiers(!showModifiers)}
                          className="flex items-center gap-2 w-full text-left text-sm font-medium text-[hsl(var(--gold))]"
                        >
                          {showModifiers ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Modificadores de Precio ({(calculateTotalModifier() * 100).toFixed(0)}%)
                        </button>
                        
                        {showModifiers && (
                          <div className="space-y-3 mt-2">
                            {/* Region */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Región</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.region?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.region.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, region: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.region.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Settlement */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Asentamiento</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.asentamiento?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.asentamiento.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, asentamiento: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.asentamiento.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Relationship */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Relación con el vendedor</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.relacion?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.relacion.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, relacion: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.relacion.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Context */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Contexto histórico</Label>
                              <select 
                                className="w-full mt-1 bg-secondary/50 border border-border/30 rounded p-2 text-sm"
                                value={selectedModifiers.contexto?.nombre || ''}
                                onChange={(e) => {
                                  const mod = priceModifiers.contexto.find(m => m.nombre === e.target.value);
                                  setSelectedModifiers(prev => ({ ...prev, contexto: mod || null }));
                                }}
                              >
                                <option value="">Sin modificador (100%)</option>
                                {priceModifiers.contexto.map((m, i) => (
                                  <option key={i} value={m.nombre}>{m.nombre} ({(m.modificador * 100).toFixed(0)}%)</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isPurchase && selectedItem.precio > 0 && (
                      <div className={`p-3 rounded ${canAfford() ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                        <div className="text-sm space-y-1">
                          <p><span className="text-muted-foreground">Base:</span> {getTotalPrice()?.precioBase} {getTotalPrice()?.moneda}</p>
                          {getTotalPrice()?.modifier !== 1 && (
                            <p><span className="text-muted-foreground">Modificador:</span> x{getTotalPrice()?.modifier.toFixed(2)} ({(getTotalPrice()?.modifier * 100).toFixed(0)}%)</p>
                          )}
                          <p className="font-bold text-base">
                            <strong>Total:</strong> {getTotalPrice()?.precioFinal} {getTotalPrice()?.moneda}
                          </p>
                        </div>
                        {!canAfford() && (
                          <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Dinero insuficiente
                          </p>
                        )}
                      </div>
                    )}
                    
                    <Button
                      onClick={handleAddEquipment}
                      disabled={processing || (isPurchase && !canAfford())}
                      className="w-full bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : isPurchase ? (
                        <ShoppingCart className="w-4 h-4 mr-2" />
                      ) : (
                        <Plus className="w-4 h-4 mr-2" />
                      )}
                      {isPurchase ? 'Comprar' : 'Añadir'} {selectedItem.nombre}
                    </Button>
                  </div>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Selecciona un item de la lista para añadirlo.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* MANAGE EQUIPMENT TAB */
            <div className="h-[60vh]">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {getAllEquipment().length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      El personaje no tiene equipamiento
                    </p>
                  ) : (
                    getAllEquipment().map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-black/20 rounded border border-border/30"
                      >
                        <div className="flex items-center gap-3">
                          {item.tipo === 'Arma' && <Sword className="w-4 h-4 text-red-400" />}
                          {item.tipo === 'Armadura' && <Shield className="w-4 h-4 text-blue-400" />}
                          {item.tipo === 'Escudo' && <Shield className="w-4 h-4 text-green-400" />}
                          {!['Arma', 'Armadura', 'Escudo'].includes(item.tipo) && <Package className="w-4 h-4 text-gray-400" />}
                          <div>
                            <span className="font-medium">{item.nombre}</span>
                            <div className="text-xs text-muted-foreground flex gap-2">
                              <Badge variant="outline" className="text-xs">{item.tipo}</Badge>
                              {item.peso > 0 && <span>{item.peso.toFixed(2)} kg</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Carrier toggle for moveable items */}
                          {item.canMove && weightSummary?.tiene_montura && (
                            <div className="flex items-center gap-1 bg-secondary/50 rounded p-1">
                              <button
                                onClick={() => handleUpdateCarrier(item.index, 'personaje')}
                                disabled={processing}
                                className={`p-1 rounded ${
                                  item.portadoPor !== 'montura' ? 'bg-[hsl(var(--gold))]/30' : 'hover:bg-secondary'
                                }`}
                                title="Llevado por personaje"
                              >
                                <User className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleUpdateCarrier(item.index, 'montura')}
                                disabled={processing}
                                className={`p-1 rounded ${
                                  item.portadoPor === 'montura' ? 'bg-blue-600/30' : 'hover:bg-secondary'
                                }`}
                                title="Llevado por montura"
                              >
                                <Landmark className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEquipment(item.nombreBase || item.nombre, item.categoria)}
                            disabled={processing}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EquipmentManagerModal;
