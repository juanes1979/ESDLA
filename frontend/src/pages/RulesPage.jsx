/**
 * Rules Page - Game rules organized by category with equipment pricing
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Swords, Shield, BookOpen, Sparkles, Moon, Map, Loader2, Package, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCultures, getOccupations, getVirtues, getEquipmentCatalog } from '@/services/api';

const RULE_CATEGORIES = [
  { id: 'cultures', name: 'Culturas', icon: Users, color: 'gold', description: 'Las razas y pueblos de la Tierra Media' },
  { id: 'occupations', name: 'Ocupaciones', icon: Swords, color: 'magic-blue', description: 'Las vocaciones heroicas' },
  { id: 'virtues', name: 'Virtudes', icon: Sparkles, color: 'torch-orange', description: 'Dones especiales por cultura' },
  { id: 'equipment', name: 'Precios de Equipo', icon: Package, color: 'gold', description: 'Lista completa con precios y pesos' },
  { id: 'shadow', name: 'Sombra', icon: Moon, color: 'destructive', description: 'La corrupción y sus efectos' },
  { id: 'travel', name: 'Viajes', icon: Map, color: 'gold', description: 'Reglas de exploración' },
  { id: 'community', name: 'Comunidad', icon: Shield, color: 'magic-blue', description: 'Puntos de comunidad y mecenas' },
];

// Currency display helper
const formatPrice = (precio, moneda) => {
  if (!precio) return '-';
  return `${precio} ${moneda || 'mp'}`;
};

const RulesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCulture, setExpandedCulture] = useState(null);
  const [expandedOccupation, setExpandedOccupation] = useState(null);

  // Load data when category changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedCategory) return;
      
      setLoading(true);
      setSearchTerm('');
      try {
        switch (selectedCategory) {
          case 'cultures':
            const cultures = await getCultures();
            setData(cultures);
            break;
          case 'occupations':
            const occupations = await getOccupations();
            setData(occupations);
            break;
          case 'virtues':
            const virtues = await getVirtues();
            setData(virtues);
            break;
          case 'equipment':
            const equipment = await getEquipmentCatalog();
            setData(equipment);
            break;
          default:
            setData(null);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCategory]);

  // Filter data by search term
  const filterData = (items, term) => {
    if (!term || !items) return items;
    const lower = term.toLowerCase();
    return items.filter(item => {
      const name = item.nombre || item.vocacion || '';
      return name.toLowerCase().includes(lower);
    });
  };

  const renderCultureDetail = (culture) => {
    const isExpanded = expandedCulture === culture.id;
    
    return (
      <div key={culture.id} className="card-parchment rounded-lg p-4 mb-4">
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setExpandedCulture(isExpanded ? null : culture.id)}
        >
          <div className="flex-1">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{culture.nombre}</h3>
            <span className="text-xs bg-black/30 px-2 py-1 rounded">
              {culture.raza} • {culture.nivel_vida || 'Común'}
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{culture.descripcion}</p>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-[hsl(var(--gold))]">Edad:</span> {culture.edad_min}-{culture.edad_max}</div>
              <div><span className="text-[hsl(var(--gold))]">Altura:</span> {culture.altura_min}-{culture.altura_max}cm</div>
              <div><span className="text-[hsl(var(--gold))]">Velocidad:</span> {culture.velocidad}m</div>
              <div><span className="text-[hsl(var(--gold))]">Descanso:</span> {culture.descanso}h</div>
              <div><span className="text-[hsl(var(--gold))]">Tamaño:</span> {culture.tamanio}</div>
              <div><span className="text-[hsl(var(--gold))]">N. Vida:</span> {culture.nivel_vida}</div>
            </div>

            {culture.bonificadores_caracteristicas && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Bonificadores de Características:</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(culture.bonificadores_caracteristicas).map(([attr, val]) => (
                    <span key={attr} className={`text-xs px-2 py-0.5 rounded ${val > 0 ? 'bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]' : 'bg-black/20 text-muted-foreground'}`}>
                      {attr.substring(0,3).toUpperCase()}: {val >= 0 ? '+' : ''}{val}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {culture.idiomas?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Idiomas: <span className="text-foreground">{culture.idiomas.join(', ')}</span></p>
              </div>
            )}

            {culture.competencias_habilidades?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Competencias en Habilidades:</p>
                <p className="text-xs text-[hsl(var(--gold))]">{culture.competencias_habilidades.join(', ')}</p>
              </div>
            )}

            {culture.rasgos_culturales?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Rasgos Culturales:</p>
                <ul className="text-xs space-y-1">
                  {culture.rasgos_culturales.map((rasgo, i) => (
                    <li key={i} className="text-foreground">• {rasgo}</li>
                  ))}
                </ul>
              </div>
            )}

            {culture.tiene_virtud_inicial && (
              <div className="text-xs text-[hsl(var(--torch-orange))] bg-[hsl(var(--torch-orange))/10] p-2 rounded">
                ★ Esta cultura obtiene una Virtud al nivel 1
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOccupationDetail = (occ) => {
    const isExpanded = expandedOccupation === occ.id;
    
    return (
      <div key={occ.id} className="card-parchment rounded-lg p-4 mb-4">
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setExpandedOccupation(isExpanded ? null : occ.id)}
        >
          <div className="flex-1">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{occ.vocacion}</h3>
            <span className="text-xs bg-black/30 px-2 py-1 rounded">
              {occ.dado_golpe} • PG {occ.puntos_golpe_base}
            </span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {occ.descripcion_corta && (
              <p className="text-sm text-muted-foreground">{occ.descripcion_corta}</p>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Características Principales:</p>
                <p className="text-[hsl(var(--gold))]">{occ.caracteristicas_principales?.join(', ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tiradas de Salvación:</p>
                <p className="text-[hsl(var(--gold))]">{occ.tiradas_salvacion?.join(', ')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Competencia en Armas:</p>
                <p className="text-foreground">{occ.competencia_armas?.join(', ') || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Competencia en Armaduras:</p>
                <p className="text-foreground">{occ.competencia_armaduras?.join(', ') || '-'}</p>
              </div>
            </div>

            {occ.habilidades?.opciones && (
              <div>
                <p className="text-xs text-muted-foreground">
                  Habilidades a elegir ({occ.habilidades.cantidad}):
                </p>
                <p className="text-xs text-foreground">
                  {occ.habilidades.opciones?.join(', ')}
                </p>
              </div>
            )}

            {occ.maldicion_nombre && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                <p className="text-xs text-purple-400 font-heading">{occ.maldicion_nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">{occ.maldicion_descripcion}</p>
              </div>
            )}

            {occ.rasgos_ocupacion?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Rasgos de la Ocupación:</p>
                <div className="space-y-2">
                  {occ.rasgos_ocupacion.map((rasgo, i) => (
                    <div key={i} className="bg-black/20 rounded p-2">
                      <p className="text-xs text-[hsl(var(--gold))] font-heading">{rasgo.nombre}</p>
                      {rasgo.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{rasgo.descripcion}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderVirtueDetail = (virtue) => (
    <div key={virtue.id} className="card-parchment rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{virtue.nombre}</h3>
        <span className={`text-xs px-2 py-1 rounded ${virtue.es_comun ? 'bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]' : 'bg-black/30'}`}>
          {virtue.es_comun ? 'Común' : virtue.tipo || 'Cultural'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{virtue.descripcion}</p>
      
      {virtue.competencias_texto && (
        <p className="text-xs text-[hsl(var(--torch-orange))] mb-2">{virtue.competencias_texto}</p>
      )}

      <div className="flex flex-wrap gap-1">
        {virtue.puntos_golpe_extra > 0 && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">PG +{virtue.puntos_golpe_extra}</span>
        )}
        {virtue.clase_armadura_extra > 0 && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">CA +{virtue.clase_armadura_extra}</span>
        )}
        {virtue.caracteristicas_fijas && Object.entries(virtue.caracteristicas_fijas).map(([attr, val]) => 
          val > 0 && (
            <span key={attr} className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
              {attr.substring(0,3).toUpperCase()} +{val}
            </span>
          )
        )}
      </div>
    </div>
  );

  const renderEquipmentSection = () => {
    if (!data) return null;

    // Combine all equipment for search
    const allItems = [
      ...(data.herramientas || []).map(i => ({ ...i, tipo: 'Herramienta' })),
      ...(data.equipo_general || []).map(i => ({ ...i, tipo: 'Equipo' })),
      ...(data.armas || []).map(i => ({ ...i, tipo: 'Arma' })),
      ...(data.armaduras || []).map(i => ({ ...i, tipo: 'Armadura' })),
      ...(data.monturas || []).map(i => ({ ...i, tipo: 'Montura' })),
    ];

    const filteredItems = searchTerm
      ? allItems.filter(item => item.nombre?.toLowerCase().includes(searchTerm.toLowerCase()))
      : null;

    const renderTable = (items, title, showDamage = false, showAC = false) => {
      if (!items || items.length === 0) return null;
      
      return (
        <div className="mb-6">
          <h4 className="font-heading text-md text-[hsl(var(--gold))] mb-3">{title}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-muted-foreground">Nombre</th>
                  <th className="pb-2 text-muted-foreground text-right">Precio</th>
                  <th className="pb-2 text-muted-foreground text-right">Peso (kg)</th>
                  {showDamage && <th className="pb-2 text-muted-foreground text-right">Daño</th>}
                  {showAC && <th className="pb-2 text-muted-foreground text-right">CA</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-black/10">
                    <td className="py-2 text-foreground">{item.nombre}</td>
                    <td className="py-2 text-right text-[hsl(var(--gold))]">{formatPrice(item.precio, item.moneda)}</td>
                    <td className="py-2 text-right text-muted-foreground">{item.peso_kg?.toFixed(2) || '-'}</td>
                    {showDamage && <td className="py-2 text-right text-red-400">{item.dano || '-'}</td>}
                    {showAC && <td className="py-2 text-right text-blue-400">{item.clase_armadura || '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    const renderMountsTable = (items) => {
      if (!items || items.length === 0) return null;
      
      return (
        <div className="mb-6">
          <h4 className="font-heading text-md text-[hsl(var(--gold))] mb-3">🐴 Monturas</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-muted-foreground">Montura</th>
                  <th className="pb-2 text-muted-foreground text-right">Precio</th>
                  <th className="pb-2 text-muted-foreground text-right">Carga (kg)</th>
                  <th className="pb-2 text-muted-foreground text-right">Constitución</th>
                  <th className="pb-2 text-muted-foreground text-right">Velocidad</th>
                  <th className="pb-2 text-muted-foreground text-center">Capacidad de monta</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-black/10">
                    <td className="py-2 text-foreground">{item.nombre}</td>
                    <td className="py-2 text-right text-[hsl(var(--gold))]">{formatPrice(item.precio, item.moneda)}</td>
                    <td className="py-2 text-right text-muted-foreground">{item.carga || '-'}</td>
                    <td className="py-2 text-right text-green-400">{item.constitucion || '-'}</td>
                    <td className="py-2 text-right text-blue-400">{item.velocidad || '-'}</td>
                    <td className="py-2 text-center text-muted-foreground">
                      {item.capacidad_pequeno && <span className="text-xs bg-amber-500/20 text-amber-400 px-1 rounded mr-1">Pequeño</span>}
                      {item.capacidad_mediano && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1 rounded">Mediano</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Search results */}
        {filteredItems ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {filteredItems.length} resultados para "{searchTerm}"
            </p>
            {renderTable(filteredItems, 'Resultados de Búsqueda', true, true)}
          </div>
        ) : (
          <>
            {/* Currency info */}
            <div className="bg-[hsl(var(--gold))/10] rounded-lg p-4 mb-6 border border-[hsl(var(--gold))/30]">
              <p className="text-sm text-[hsl(var(--gold))] font-heading mb-2">💰 Sistema Monetario</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-muted-foreground">
                <div><span className="text-foreground">me</span> = Moneda de Estaño</div>
                <div><span className="text-foreground">mc</span> = Moneda de Cobre</div>
                <div><span className="text-foreground">mp</span> = Moneda de Plata</div>
                <div><span className="text-foreground">mo</span> = Moneda de Oro</div>
                <div><span className="text-foreground">mm</span> = Moneda de Mithril</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Tasa: 10 me = 1 mc | 10 mc = 1 mp | 100 mp = 1 mo | 100 mo = 1 mm
              </p>
            </div>

            {renderTable(data.armas, '⚔️ Armas', true, false)}
            {renderTable(data.armaduras, '🛡️ Armaduras', false, true)}
            {renderMountsTable(data.monturas)}
            {renderTable(data.herramientas, '🔧 Herramientas', false, false)}
            {renderTable(data.equipo_general, '📦 Equipo General', false, false)}
          </>
        )}
      </div>
    );
  };

  const renderPlaceholder = (category) => (
    <div className="text-center py-12">
      <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="font-heading text-xl text-muted-foreground mb-2">
        {category.name}
      </h3>
      <p className="text-muted-foreground text-sm">
        {category.description}
      </p>
      <p className="text-muted-foreground/50 text-xs mt-4">
        Contenido detallado próximamente
      </p>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
        </div>
      );
    }

    if (!selectedCategory) {
      return (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Selecciona una categoría para ver las reglas
          </p>
        </div>
      );
    }

    const category = RULE_CATEGORIES.find(c => c.id === selectedCategory);

    switch (selectedCategory) {
      case 'cultures':
        return filterData(data, searchTerm)?.map(renderCultureDetail);
      case 'occupations':
        return filterData(data, searchTerm)?.map(renderOccupationDetail);
      case 'virtues':
        return filterData(data, searchTerm)?.map(renderVirtueDetail);
      case 'equipment':
        return renderEquipmentSection();
      default:
        return renderPlaceholder(category);
    }
  };

  return (
    <div className="min-h-screen tavern-bg" data-testid="rules-page">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="hover:bg-[hsl(var(--gold))/10]"
            data-testid="back-home-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-heading text-2xl text-[hsl(var(--gold))] text-glow-gold">
            Reglas del Juego
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Category Sidebar */}
          <div className="lg:col-span-1">
            <h2 className="font-heading text-lg text-muted-foreground mb-4">Categorías</h2>
            <div className="space-y-2">
              {RULE_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full selection-card rounded-lg p-3 text-left flex items-center gap-3 ${isSelected ? 'selected' : ''}`}
                    data-testid={`category-${category.id}`}
                  >
                    <Icon className={`w-5 h-5 text-[hsl(var(--${category.color}))]`} />
                    <div>
                      <p className="font-heading text-sm">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <div className="card-parchment rounded-lg p-6">
              {/* Search bar for applicable categories */}
              {selectedCategory && ['cultures', 'occupations', 'virtues', 'equipment'].includes(selectedCategory) && (
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-black/20 border-border"
                      data-testid="search-input"
                    />
                  </div>
                </div>
              )}
              
              <ScrollArea className="h-[calc(100vh-320px)]">
                {renderContent()}
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RulesPage;
