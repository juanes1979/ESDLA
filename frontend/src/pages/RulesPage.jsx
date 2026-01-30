/**
 * Rules Page - Game rules organized by category
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Swords, Shield, BookOpen, Sparkles, Moon, Map, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCultures, getOccupations, getVirtues } from '@/services/api';

const RULE_CATEGORIES = [
  { id: 'cultures', name: 'Culturas', icon: Users, color: 'gold', description: 'Las razas y pueblos de la Tierra Media' },
  { id: 'occupations', name: 'Ocupaciones', icon: Swords, color: 'magic-blue', description: 'Las vocaciones heroicas' },
  { id: 'virtues', name: 'Virtudes', icon: Sparkles, color: 'torch-orange', description: 'Dones especiales por cultura' },
  { id: 'shadow', name: 'Sombra', icon: Moon, color: 'destructive', description: 'La corrupción y sus efectos' },
  { id: 'travel', name: 'Viajes', icon: Map, color: 'gold', description: 'Reglas de exploración' },
  { id: 'community', name: 'Comunidad', icon: Shield, color: 'magic-blue', description: 'Puntos de comunidad y mecenas' },
];

const RulesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load data when category changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedCategory) return;
      
      setLoading(true);
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

  const renderCultureDetail = (culture) => (
    <div key={culture.id} className="card-parchment rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{culture.nombre}</h3>
        <span className="text-xs bg-black/30 px-2 py-1 rounded">
          {culture.raza} • {culture.nivel_vida || 'Común'}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{culture.descripcion}</p>
      
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div><span className="text-[hsl(var(--gold))]">Edad:</span> {culture.edad_min}-{culture.edad_max}</div>
        <div><span className="text-[hsl(var(--gold))]">Altura:</span> {culture.altura_min}-{culture.altura_max}cm</div>
        <div><span className="text-[hsl(var(--gold))]">Velocidad:</span> {culture.velocidad}m</div>
      </div>

      {culture.bonificadores_caracteristicas && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(culture.bonificadores_caracteristicas).map(([attr, val]) => 
            val > 0 && (
              <span key={attr} className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                {attr.substring(0,3).toUpperCase()} +{val}
              </span>
            )
          )}
        </div>
      )}

      {culture.tiene_virtud_inicial && (
        <div className="mt-2 text-xs text-[hsl(var(--torch-orange))]">
          ★ Obtiene virtud al nivel 1
        </div>
      )}
    </div>
  );

  const renderOccupationDetail = (occ) => (
    <div key={occ.id} className="card-parchment rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{occ.vocacion}</h3>
        <span className="text-xs bg-black/30 px-2 py-1 rounded">
          {occ.dado_golpe} • PG {occ.puntos_golpe_base}
        </span>
      </div>
      
      <div className="text-sm text-muted-foreground mb-3">
        <p><span className="text-[hsl(var(--gold))]">Características:</span> {occ.caracteristicas_principales?.join(', ')}</p>
        <p><span className="text-[hsl(var(--gold))]">Salvaciones:</span> {occ.tiradas_salvacion?.join(', ')}</p>
      </div>

      {occ.habilidades?.opciones && (
        <div className="mb-2">
          <p className="text-xs text-[hsl(var(--gold))]">
            Habilidades a elegir ({occ.habilidades.cantidad}):
          </p>
          <p className="text-xs text-muted-foreground">
            {occ.habilidades.opciones?.slice(0, 6).join(', ')}...
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {occ.armas?.length} bloques de armas • Armadura A/B
      </div>
    </div>
  );

  const renderVirtueDetail = (virtue) => (
    <div key={virtue.id} className="card-parchment rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{virtue.nombre}</h3>
        <span className={`text-xs px-2 py-1 rounded ${virtue.es_comun ? 'bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]' : 'bg-black/30'}`}>
          {virtue.tipo || 'Cultural'}
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
        return data?.map(renderCultureDetail);
      case 'occupations':
        return data?.map(renderOccupationDetail);
      case 'virtues':
        return data?.map(renderVirtueDetail);
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
              <ScrollArea className="h-[calc(100vh-250px)]">
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
