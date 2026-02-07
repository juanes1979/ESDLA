/**
 * BackgroundsSection - Displays backgrounds organized by Race (tabs) and Culture (collapsible)
 */
import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Edit, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';
import { useUser } from '@/contexts/UserContext';

// Section helper
const Section = ({ title, children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    <h4 className="text-sm font-heading text-[hsl(var(--gold))] mb-2 border-b border-[hsl(var(--gold))/30] pb-1">{title}</h4>
    {children}
  </div>
);

// Race icon map
const RACE_ICONS = {
  'Elfos': '🧝',
  'Enanos': '⛏️',
  'Hobbits': '🍃',
  'Hombres': '⚔️',
  'Otros': '❓'
};

const BackgroundsSection = ({ onEdit, onDelete, onRefresh }) => {
  const { isAdmin } = useUser();
  const [groupedData, setGroupedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRace, setSelectedRace] = useState(null);
  const [expandedCultures, setExpandedCultures] = useState({});
  const [expandedBackground, setExpandedBackground] = useState(null);

  useEffect(() => {
    loadGroupedBackgrounds();
  }, []);

  const loadGroupedBackgrounds = async () => {
    try {
      setLoading(true);
      const res = await api.get('/data/backgrounds/grouped/by-race');
      setGroupedData(res.data.grouped || {});
      // Set default selected race
      const races = Object.keys(res.data.grouped || {});
      if (races.length > 0 && !selectedRace) {
        setSelectedRace(races[0]);
      }
    } catch (err) {
      console.error('Error loading backgrounds:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleCulture = (culture) => {
    setExpandedCultures(prev => ({
      ...prev,
      [culture]: !prev[culture]
    }));
  };

  const toggleBackground = (bgId) => {
    setExpandedBackground(expandedBackground === bgId ? null : bgId);
  };

  // Render a single background detail
  const renderBackgroundDetail = (bg) => {
    const isExpanded = expandedBackground === bg.id;
    
    return (
      <div key={bg.id} className="bg-black/10 rounded-lg p-3 mb-2" data-testid={`background-${bg.id}`}>
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => toggleBackground(bg.id)}
        >
          <div className="flex-1">
            <h4 className="font-heading text-md text-[hsl(var(--torch-orange))]">{bg.nombre}</h4>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); onEdit && onEdit(bg); }}
                  data-testid={`edit-background-${bg.id}`}
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete && onDelete(bg.id, bg.nombre); }}
                  data-testid={`delete-background-${bg.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-3 space-y-3 pt-3 border-t border-border/20">
            {bg.descripcion && (
              <p className="text-sm text-muted-foreground italic">{bg.descripcion}</p>
            )}
            
            {/* Competencias Habilidades */}
            <Section title="Competencias en Habilidades">
              {bg.competencias_habilidades_auto?.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground">Automáticas: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bg.competencias_habilidades_auto.map((h, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-xs rounded">{h}</span>
                    ))}
                  </div>
                </div>
              )}
              {bg.competencias_habilidades_elegir?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">A elegir (1): </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bg.competencias_habilidades_elegir.map((h, i) => (
                      <span key={i} className="px-2 py-0.5 bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] text-xs rounded">{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Competencias Herramientas */}
            {(bg.competencias_herramientas_1?.length > 0 || bg.competencias_herramientas_2?.length > 0) && (
              <Section title="Competencias en Herramientas">
                <div className="space-y-1">
                  {bg.competencias_herramientas_1?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {bg.competencias_herramientas_1.map((h, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-xs rounded">{h}</span>
                      ))}
                    </div>
                  )}
                  {bg.competencias_herramientas_2?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {bg.competencias_herramientas_2.map((h, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-xs rounded">{h}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Rasgos */}
            {bg.rasgos_descripciones?.length > 0 && (
              <Section title="Rasgos del Trasfondo">
                <ul className="space-y-1">
                  {bg.rasgos_descripciones.map((rasgo, i) => (
                    <li key={i} className="text-xs bg-black/10 p-2 rounded text-foreground">{rasgo}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render cultures for a race
  const renderCulturesForRace = (race) => {
    const cultures = groupedData[race] || {};
    
    return (
      <div className="space-y-3">
        {Object.entries(cultures).map(([cultureName, backgrounds]) => (
          <div key={cultureName} className="card-parchment rounded-lg overflow-hidden">
            {/* Culture Header (Collapsible) */}
            <div 
              className="flex justify-between items-center p-3 cursor-pointer hover:bg-black/5"
              onClick={() => toggleCulture(cultureName)}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{cultureName}</h3>
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{backgrounds.length} trasfondos</span>
              </div>
              {expandedCultures[cultureName] ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            
            {/* Culture Backgrounds (Expanded) */}
            {expandedCultures[cultureName] && (
              <div className="px-3 pb-3">
                {backgrounds.map(bg => renderBackgroundDetail(bg))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  const races = Object.keys(groupedData);

  return (
    <div className="space-y-4" data-testid="backgrounds-section">
      {/* Admin button to create new background */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            onClick={() => onEdit && onEdit(null)}
            className="btn-fantasy"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Trasfondo
          </Button>
        </div>
      )}
      
      {/* Race Tabs */}
      <Tabs value={selectedRace || races[0]} onValueChange={setSelectedRace} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-black/20 p-1 rounded-lg">
          {races.map(race => {
            const cultureCount = Object.keys(groupedData[race] || {}).length;
            const bgCount = Object.values(groupedData[race] || {}).reduce((acc, bgs) => acc + bgs.length, 0);
            return (
              <TabsTrigger 
                key={race} 
                value={race}
                className="flex-1 min-w-[120px] data-[state=active]:bg-[hsl(var(--gold))] data-[state=active]:text-black"
              >
                <span className="mr-1">{RACE_ICONS[race] || '❓'}</span>
                {race}
                <span className="ml-1 text-xs opacity-70">({bgCount})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        {races.map(race => (
          <TabsContent key={race} value={race} className="mt-4">
            {renderCulturesForRace(race)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default BackgroundsSection;
