/**
 * Step 7: Equipment Selection
 * El equipo inicial se asigna AUTOMÁTICAMENTE según el Nivel de Vida de la cultura
 * + ropa según nivel de vida
 * + monedas según ocupación
 * + TIENDA para comprar equipo adicional con el dinero inicial (PRECIOS BASE)
 */
import { useState, useMemo, useEffect } from 'react';
import { Loader2, ChevronLeft, Package, Coins, ShoppingCart, Plus, Minus, Store, Sword, Shield, Scroll, Wrench, Apple, Search, X, Leaf, Skull, Gem, Ship, Building, CircleDot } from 'lucide-react';
import { updateDraftStep7 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import api from '@/services/api';
import { toast } from 'sonner';

// Equipo inicial según Nivel de Vida (según las reglas del juego)
const EQUIPO_POR_NIVEL_VIDA = {
  'Frugal': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
      { nombre: 'Botas de viaje', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda común', cantidad: 1 },
    ],
    dinero: { mp: 0, mo: 0, me: 0, mc: 0 },
    descripcion: 'Equipo básico para supervivencia. Tu cultura vive de forma austera, sin monedas.'
  },
  'Común': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
      { nombre: 'Antorchas (paquete de 10)', cantidad: 1 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de cáñamo (15 m)', cantidad: 1 },
      { nombre: 'Botas de buena piel', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda de viajero', cantidad: 1 },
    ],
    dinero: { mp: 15, mo: 0, me: 0, mc: 0 },
    descripcion: 'Equipo estándar para un aventurero. Tu cultura tiene recursos moderados.'
  },
  'Próspero': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Linterna sorda', cantidad: 1 },
      { nombre: 'Aceite (frasco)', cantidad: 3 },
      { nombre: 'Raciones de cram (1 día)', cantidad: 10 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de seda (15 m)', cantidad: 1 },
      { nombre: 'Tienda para 2 personas', cantidad: 1 },
      { nombre: 'Botas de cuero', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda fina', cantidad: 1 },
      { nombre: 'Muda de viajero', cantidad: 1 },
    ],
    dinero: { mp: 20, mo: 0, me: 0, mc: 0 },
    descripcion: 'Equipo de alta calidad. Tu cultura goza de riqueza y comodidades.'
  }
};

// Monedas iniciales según tipo de ocupación
const DINERO_POR_OCUPACION = {
  'Buscador de tesoros': { mp: 0, mo: 0, me: 50, mc: 70 },
  'Campeón': { mp: 0, mo: 0, me: 50, mc: 80 },
  'Capitán': { mp: 2, mo: 0, me: 50, mc: 95 },
  'Erudito': { mp: 0, mo: 0, me: 20, mc: 70 },
  'Guardian': { mp: 0, mo: 0, me: 30, mc: 70 },
  'Mensajero': { mp: 0, mo: 0, me: 45, mc: 75 },
};

// Tasa de cambio: 10 me = 1 mc, 10 mc = 1 mp, 100 mp = 1 mo
const convertirAMc = (dinero) => {
  return (dinero.mo * 100000) + (dinero.mp * 1000) + (dinero.mc * 10) + (dinero.me || 0);
};

const convertirDesdeMc = (totalMe) => {
  let restante = totalMe;
  const mo = Math.floor(restante / 100000);
  restante -= mo * 100000;
  const mp = Math.floor(restante / 1000);
  restante -= mp * 1000;
  const mc = Math.floor(restante / 10);
  restante -= mc * 10;
  const me = restante;
  return { mo, mp, mc, me };
};

// Convertir precio a me (monedas de estaño) para comparación
const precioEnMe = (precio, moneda) => {
  if (moneda === 'me') return precio;
  if (moneda === 'mc') return precio * 10;
  if (moneda === 'mp') return precio * 1000;
  if (moneda === 'mo') return precio * 100000;
  return precio;
};

const Step7Equipment = ({ draftId, draft, onComplete, onBack }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showShop, setShowShop] = useState(false);
  
  // Equipment data from backend (using equipment-catalog for base prices)
  const [catalog, setCatalog] = useState({});
  const [loadingShop, setLoadingShop] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Shopping cart
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('weapons');
  
  // Category mapping for display - ALL categories from equipment-catalog
  const SHOP_CATEGORIES = [
    { key: 'weapons', label: 'Armas', icon: Sword, catalogKeys: ['armas_sencillas_cc', 'armas_sencillas_distancia', 'armas_marciales_cc', 'armas_marciales_distancia'] },
    { key: 'armor', label: 'Armaduras', icon: Shield, catalogKeys: ['armaduras_ligeras', 'armaduras_medias', 'armaduras_pesadas', 'escudos'] },
    { key: 'tools', label: 'Herramientas', icon: Wrench, catalogKeys: ['herramientas', 'juegos', 'instrumentos_musicales'] },
    { key: 'general', label: 'General', icon: Scroll, catalogKeys: ['equipo_general'] },
    { key: 'ropa', label: 'Ropa', icon: Shield, catalogKeys: ['ropa'] },
    { key: 'consumables', label: 'Consumibles', icon: Apple, catalogKeys: ['consumibles'] },
    { key: 'mounts', label: 'Monturas', icon: CircleDot, catalogKeys: ['monturas', 'accesorios_monturas'] },
    { key: 'transport', label: 'Transporte', icon: Ship, catalogKeys: ['transporte_terrestre', 'transporte_maritimo'] },
    { key: 'herbs', label: 'Hierbas', icon: Leaf, catalogKeys: ['hierbas'] },
    { key: 'poisons', label: 'Venenos', icon: Skull, catalogKeys: ['venenos'] },
    { key: 'gems', label: 'Gemas', icon: Gem, catalogKeys: ['gemas_preciosas', 'gemas_semipreciosas'] },
    { key: 'construction', label: 'Construcción', icon: Building, catalogKeys: ['recursos_desarrollo'] },
  ];

  const nivelVida = draft?.nivel_vida || 'Común';
  const vocacion = draft?.vocacion_nombre || '';
  
  const equipoAutomatico = useMemo(() => {
    return EQUIPO_POR_NIVEL_VIDA[nivelVida] || EQUIPO_POR_NIVEL_VIDA['Común'];
  }, [nivelVida]);
  
  const dineroOcupacion = useMemo(() => {
    return DINERO_POR_OCUPACION[vocacion] || { mp: 0, mo: 0, me: 0, mc: 0 };
  }, [vocacion]);
  
  const dineroInicial = useMemo(() => {
    return {
      mp: (equipoAutomatico.dinero?.mp || 0) + dineroOcupacion.mp,
      mo: (equipoAutomatico.dinero?.mo || 0) + dineroOcupacion.mo,
      me: (equipoAutomatico.dinero?.me || 0) + dineroOcupacion.me,
      mc: (equipoAutomatico.dinero?.mc || 0) + dineroOcupacion.mc,
    };
  }, [equipoAutomatico, dineroOcupacion]);

  // Calculate total spent
  const totalGastado = useMemo(() => {
    return cart.reduce((total, item) => {
      const precioMe = precioEnMe(item.precio, item.moneda);
      return total + (precioMe * item.cantidad);
    }, 0);
  }, [cart]);

  // Calculate remaining money
  const dineroRestante = useMemo(() => {
    const totalMe = convertirAMc(dineroInicial);
    const restante = totalMe - totalGastado;
    return convertirDesdeMc(Math.max(0, restante));
  }, [dineroInicial, totalGastado]);

  // Check if can afford
  const puedeComprar = (item) => {
    const precioMe = precioEnMe(item.precio || 0, item.moneda || 'mc');
    const totalMe = convertirAMc(dineroInicial);
    return (totalGastado + precioMe) <= totalMe;
  };

  // Load shop data from equipment-catalog (precios base)
  useEffect(() => {
    const loadShopData = async () => {
      if (!showShop) return;
      setLoadingShop(true);
      try {
        const response = await api.get('/data/equipment-catalog');
        setCatalog(response.data || {});
      } catch (err) {
        console.error('Error loading shop data:', err);
        toast.error('Error al cargar la tienda');
      } finally {
        setLoadingShop(false);
      }
    };
    loadShopData();
  }, [showShop]);

  // Get items for a category with optional search filter
  const getItemsForCategory = (categoryKey) => {
    const category = SHOP_CATEGORIES.find(c => c.key === categoryKey);
    if (!category) return [];
    
    let items = [];
    category.catalogKeys.forEach(catKey => {
      const catItems = catalog[catKey] || [];
      items = [...items, ...catItems.map(item => ({
        ...item,
        categoria: catKey
      }))];
    });
    
    // Filter items:
    // 1. Must have valid price > 0
    // 2. Must be available for character creation (disponible_creacion !== false)
    items = items.filter(item => 
      item.precio != null && 
      item.precio > 0 &&
      item.disponible_creacion !== false
    );
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.nombre?.toLowerCase().includes(term) ||
        item.categoria?.toLowerCase().includes(term)
      );
    }
    
    return items;
  };

  // Add to cart
  const addToCart = (item) => {
    if (!puedeComprar(item)) {
      toast.error('No tienes suficiente dinero');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(i => i.nombre === item.nombre);
      if (existing) {
        return prev.map(i => 
          i.nombre === item.nombre 
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        );
      }
      return [...prev, { ...item, cantidad: 1 }];
    });
    toast.success(`${item.nombre} añadido`);
  };

  // Remove from cart
  const removeFromCart = (itemNombre) => {
    setCart(prev => {
      const existing = prev.find(i => i.nombre === itemNombre);
      if (existing && existing.cantidad > 1) {
        return prev.map(i => 
          i.nombre === itemNombre 
            ? { ...i, cantidad: i.cantidad - 1 }
            : i
        );
      }
      return prev.filter(i => i.nombre !== itemNombre);
    });
  };

  // Get cart item count
  const getCartCount = (itemNombre) => {
    const item = cart.find(i => i.nombre === itemNombre);
    return item?.cantidad || 0;
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Combine automatic equipment + purchased items
      const inventario = [
        ...equipoAutomatico.items.map(item => ({
          item_id: `auto-${item.nombre.toLowerCase().replace(/\s/g, '-')}`,
          nombre: item.nombre,
          cantidad: item.cantidad,
          equipado: false,
          origen: 'nivel_vida'
        })),
        ...cart.map(item => ({
          item_id: item.id || `compra-${item.nombre.toLowerCase().replace(/\s/g, '-')}`,
          nombre: item.nombre,
          cantidad: item.cantidad,
          equipado: false,
          origen: 'compra',
          precio: item.precio,
          moneda: item.moneda
        }))
      ];
      
      const updatedDraft = await updateDraftStep7(draftId, {
        inventario,
        dinero: dineroRestante,
        equipo_comprado: cart
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 7:', err);
      setError('No se pudo guardar el equipo');
    } finally {
      setSaving(false);
    }
  };

  // Render shop item
  const renderShopItem = (item) => {
    const count = getCartCount(item.nombre);
    const canAfford = puedeComprar(item);
    
    // Format category name for display
    const getCategoryLabel = (cat) => {
      const labels = {
        'armas_sencillas_cc': 'Sencilla CC',
        'armas_sencillas_distancia': 'Sencilla Dist.',
        'armas_marciales_cc': 'Marcial CC',
        'armas_marciales_distancia': 'Marcial Dist.',
        'armaduras_ligeras': 'Ligera',
        'armaduras_medias': 'Media',
        'armaduras_pesadas': 'Pesada',
        'escudos': 'Escudo',
        'herramientas': 'Herramienta',
        'juegos': 'Juego',
        'instrumentos_musicales': 'Instrumento',
        'equipo_general': 'General',
        'consumibles': 'Consumible',
        'comida_posadas': 'Posada',
        'monturas': 'Montura',
        'accesorios_monturas': 'Accesorio',
        'transporte_terrestre': 'Terrestre',
        'transporte_maritimo': 'Marítimo',
        'hierbas': 'Hierba',
        'venenos': 'Veneno',
        'gemas_preciosas': 'Preciosa',
        'gemas_semipreciosas': 'Semipreciosa',
        'recursos_desarrollo': 'Construcción'
      };
      return labels[cat] || cat;
    };
    
    // Get additional item details based on category
    const getItemDetails = () => {
      const details = [];
      if (item.dano) details.push(item.dano);
      if (item.ca) details.push(`CA ${item.ca}`);
      if (item.velocidad) details.push(`Vel. ${item.velocidad}m`);
      if (item.capacidad_carga) details.push(`Carga ${item.capacidad_carga}kg`);
      if (item.efecto) details.push(item.efecto.substring(0, 30) + (item.efecto.length > 30 ? '...' : ''));
      if (item.peso_kg) details.push(`${item.peso_kg}kg`);
      return details.join(' · ');
    };
    
    return (
      <div 
        key={`${item.nombre}-${item.categoria}`}
        data-testid={`shop-item-${item.nombre?.replace(/\s/g, '-').toLowerCase()}`}
        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
          count > 0 
            ? 'bg-green-500/20 border-green-500/50' 
            : canAfford 
              ? 'bg-secondary/50 border-border hover:border-[hsl(var(--gold))/50] cursor-pointer' 
              : 'bg-secondary/20 border-border/50 opacity-50'
        }`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <p className="font-medium text-sm truncate">{item.nombre}</p>
          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            <span className="text-[hsl(var(--gold))] font-medium">{item.precio} {item.moneda || 'mc'}</span>
            {item.categoria && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                {getCategoryLabel(item.categoria)}
              </Badge>
            )}
            {getItemDetails() && <span className="truncate max-w-[150px]">· {getItemDetails()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => removeFromCart(item.nombre)}
                data-testid={`remove-${item.nombre?.replace(/\s/g, '-').toLowerCase()}`}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Badge className="bg-green-600 min-w-[24px] justify-center">{count}</Badge>
            </>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => addToCart(item)}
            disabled={!canAfford}
            data-testid={`add-${item.nombre?.replace(/\s/g, '-').toLowerCase()}`}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="step-7-equipment">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Equipo Inicial
        </h2>
        <p className="text-muted-foreground">
          Tu equipo base depende del Nivel de Vida de tu cultura
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
              <p className="text-sm text-muted-foreground">
                {draft?.cultura_nombre} · {draft?.vocacion_nombre}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Nivel de Vida</p>
            <p className="font-heading text-xl text-[hsl(var(--gold))]">
              {nivelVida}
            </p>
          </div>
        </div>
      </div>

      {/* Automatic Equipment */}
      <div className="card-parchment rounded-lg p-6 border-magic">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Equipo Automático ({nivelVida})
          </h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 italic">
          {equipoAutomatico.descripcion}
        </p>

        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {equipoAutomatico.items.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--gold))/10] border border-[hsl(var(--gold))/30]"
            >
              <span className="text-foreground">{item.nombre}</span>
              <span className="text-[hsl(var(--gold))] font-medium">x{item.cantidad}</span>
            </div>
          ))}
        </div>

        {/* Money Display */}
        <div className="p-4 rounded-lg bg-secondary">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-[hsl(var(--gold))]" />
              <p className="text-sm text-muted-foreground">
                Dinero {cart.length > 0 ? 'Restante' : 'Inicial'} ({vocacion})
              </p>
            </div>
            {cart.length > 0 && (
              <Badge variant="outline" className="text-green-400 border-green-400">
                {cart.reduce((t, i) => t + i.cantidad, 0)} items comprados
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className={`p-2 rounded ${cart.length > 0 && dineroRestante.mp !== dineroInicial.mp ? 'bg-green-500/20' : 'bg-[hsl(var(--gold))/20]'}`}>
              <p className="font-heading text-lg text-[hsl(var(--gold))]">{dineroRestante.mp}</p>
              <p className="text-xs text-muted-foreground">mp</p>
            </div>
            <div className="p-2 rounded bg-[hsl(var(--gold))/10]">
              <p className="font-heading text-lg text-foreground">{dineroRestante.mo}</p>
              <p className="text-xs text-muted-foreground">mo</p>
            </div>
            <div className={`p-2 rounded ${cart.length > 0 && dineroRestante.mc !== dineroInicial.mc ? 'bg-green-500/20' : 'bg-[hsl(var(--gold))/10]'}`}>
              <p className="font-heading text-lg text-foreground">{dineroRestante.mc}</p>
              <p className="text-xs text-muted-foreground">mc</p>
            </div>
            <div className={`p-2 rounded ${cart.length > 0 && dineroRestante.me !== dineroInicial.me ? 'bg-green-500/20' : 'bg-[hsl(var(--gold))/5]'}`}>
              <p className="font-heading text-lg text-muted-foreground">{dineroRestante.me}</p>
              <p className="text-xs text-muted-foreground">me</p>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment from Occupation */}
      {draft?.equipo_ocupacion?.length > 0 && (
        <div className="card-parchment rounded-lg p-6">
          <h3 className="font-heading text-xl text-[hsl(var(--magic-blue))] mb-4">
            Equipo de Ocupación
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este equipo viene incluido por tu ocupación de {draft?.vocacion_nombre}
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {draft.equipo_ocupacion.map((item, index) => (
              <div 
                key={index}
                className="flex items-center p-3 rounded-lg bg-[hsl(var(--magic-blue))/10] border border-[hsl(var(--magic-blue))/30]"
              >
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop Section */}
      <div className="card-parchment rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-[hsl(var(--torch-orange))]" />
            <h3 className="font-heading text-xl text-[hsl(var(--torch-orange))]">
              Tienda de Equipo
            </h3>
          </div>
          <Button
            variant={showShop ? "default" : "outline"}
            onClick={() => setShowShop(!showShop)}
            data-testid="toggle-shop-btn"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {showShop ? 'Ocultar Tienda' : 'Comprar Equipo'}
            {cart.length > 0 && (
              <Badge className="ml-2 bg-green-600">{cart.reduce((t, i) => t + i.cantidad, 0)}</Badge>
            )}
          </Button>
        </div>

        {showShop && (
          <div className="mt-4">
            {/* Search Bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar equipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
                data-testid="shop-search-input"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            
            {loadingShop ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--gold))]" />
                <span className="ml-2 text-muted-foreground">Cargando tienda...</span>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                {/* Two rows of category tabs for better organization */}
                <div className="space-y-2 mb-4">
                  {/* Row 1: Combat & Equipment */}
                  <TabsList className="grid w-full grid-cols-6 h-auto">
                    {SHOP_CATEGORIES.slice(0, 6).map(cat => {
                      const Icon = cat.icon;
                      const itemCount = getItemsForCategory(cat.key).length;
                      return (
                        <TabsTrigger 
                          key={cat.key} 
                          value={cat.key} 
                          className="flex flex-col gap-0.5 py-1.5 px-1 text-xs"
                          data-testid={`shop-tab-${cat.key}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="hidden sm:inline text-[10px]">{cat.label}</span>
                          {itemCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                              {itemCount}
                            </Badge>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  
                  {/* Row 2: Special & Resources */}
                  <TabsList className="grid w-full grid-cols-5 h-auto">
                    {SHOP_CATEGORIES.slice(6).map(cat => {
                      const Icon = cat.icon;
                      const itemCount = getItemsForCategory(cat.key).length;
                      return (
                        <TabsTrigger 
                          key={cat.key} 
                          value={cat.key} 
                          className="flex flex-col gap-0.5 py-1.5 px-1 text-xs"
                          data-testid={`shop-tab-${cat.key}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="hidden sm:inline text-[10px]">{cat.label}</span>
                          {itemCount > 0 && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                              {itemCount}
                            </Badge>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>

                {SHOP_CATEGORIES.map(cat => {
                  const items = getItemsForCategory(cat.key);
                  return (
                    <TabsContent key={cat.key} value={cat.key}>
                      <ScrollArea className="h-72">
                        <div className="space-y-2 pr-4">
                          {items.map(item => renderShopItem(item))}
                          {items.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                              {searchTerm 
                                ? `No se encontró "${searchTerm}" en ${cat.label.toLowerCase()}`
                                : `No hay ${cat.label.toLowerCase()} disponibles`
                              }
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}

            {/* Cart Summary */}
            {cart.length > 0 && (
              <div className="mt-4 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <h4 className="font-heading text-sm text-green-400 mb-2">Carrito de compra</h4>
                <div className="space-y-1">
                  {cart.map(item => (
                    <div key={item.nombre} className="flex justify-between text-sm">
                      <span>{item.nombre} x{item.cantidad}</span>
                      <span className="text-muted-foreground">{item.precio * item.cantidad} {item.moneda}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 pb-16">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-7-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-7-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step7Equipment;
