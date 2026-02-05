/**
 * Step 2: FASE 2 - TRASFONDO (10 pasos del plan)
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { getBackgrounds, updateDraftStep2, getEquipmentLists } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const Step2Background = ({ draftId, draft, onComplete, onBack }) => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [expandedBackground, setExpandedBackground] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Selections for background
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [selectedTool1, setSelectedTool1] = useState(null);
  const [selectedTool2, setSelectedTool2] = useState(null);
  
  // Equipment lists for special selections
  const [equipmentLists, setEquipmentLists] = useState({ juegos: [], instrumentos_musicales: [] });

  // Load backgrounds for selected culture
  useEffect(() => {
    const loadData = async () => {
      const cultureName = draft?.cultura_nombre;
      if (!cultureName) {
        setError('No se encontró la cultura del personaje');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const [bgData, equipData] = await Promise.all([
          getBackgrounds(null, cultureName),
          getEquipmentLists().catch(() => ({ juegos: [], instrumentos_musicales: [] }))
        ]);
        setBackgrounds(bgData || []);
        setEquipmentLists(equipData);
      } catch (err) {
        console.error('Error loading backgrounds:', err);
        setError(`No se pudieron cargar los trasfondos para ${cultureName}`);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [draft?.cultura_nombre]);

  // Check if tool needs sub-selection
  const needsSubSelection = (toolText) => {
    if (!toolText) return null;
    const text = toolText.toLowerCase();
    if (text.includes('instrumento musical')) return 'instrumentos';
    if (text.includes('juegos') || text.includes('juego')) return 'juegos';
    return null;
  };

  // Handle background selection
  const handleBackgroundSelect = (bg) => {
    setSelectedBackground(bg);
    setExpandedBackground(bg.id);
    // Reset selections when changing background
    setSelectedSkill(null);
    setSelectedTool1(null);
    setSelectedTool2(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedBackground) return;

    // Validate required selections
    const skillOptions = selectedBackground.competencias_habilidades_elegir || [];
    if (skillOptions.length > 0 && !selectedSkill) {
      setError('Debes elegir una competencia de habilidad');
      return;
    }

    // Validate game/instrument selections if required
    const tools1 = selectedBackground.competencias_herramientas_1 || [];
    const tools2 = selectedBackground.competencias_herramientas_2 || [];
    
    // Check if tool1 needs a sub-selection (juegos or instrumentos)
    const tool1NeedsSelection = tools1.some(t => needsSubSelection(t));
    if (tool1NeedsSelection && !selectedTool1) {
      setError('Debes elegir un juego o instrumento musical');
      return;
    }
    
    // Check if tool2 needs a sub-selection
    const tool2NeedsSelection = tools2.some(t => needsSubSelection(t));
    if (tool2NeedsSelection && !selectedTool2) {
      setError('Debes elegir un juego o instrumento musical');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      // Build equipment list from background
      const equipoTrasfondo = [];
      
      // Add any selected tools as equipment (juegos, instrumentos musicales)
      if (selectedTool1) {
        equipoTrasfondo.push(selectedTool1);
      }
      if (selectedTool2) {
        equipoTrasfondo.push(selectedTool2);
      }
      
      // Add any automatic equipment from background if exists
      if (selectedBackground.equipo) {
        equipoTrasfondo.push(...(Array.isArray(selectedBackground.equipo) ? selectedBackground.equipo : [selectedBackground.equipo]));
      }
      
      const updateData = {
        trasfondo_id: selectedBackground.id,
        trasfondo_nombre: selectedBackground.nombre,
        competencias_habilidades_trasfondo: [
          ...(selectedBackground.competencias_habilidades_auto || []),
          ...(selectedSkill ? [selectedSkill] : []),
        ],
        competencias_herramientas_trasfondo: [
          ...(selectedBackground.competencias_herramientas_1 || []).filter(t => !needsSubSelection(t)),
          ...(selectedBackground.competencias_herramientas_2 || []).filter(t => !needsSubSelection(t)),
          ...(selectedTool1 ? [selectedTool1] : []),
          ...(selectedTool2 ? [selectedTool2] : []),
        ],
        rasgos_trasfondo: selectedBackground.rasgos_descripciones || [],
        equipo_trasfondo: equipoTrasfondo, // Add selected items as equipment
      };
      
      const updatedDraft = await updateDraftStep2(draftId, updateData);
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 2:', err);
      setError('No se pudo guardar el trasfondo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-parchment rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))] mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando trasfondos para {draft?.cultura_nombre}...</p>
        </div>
      </div>
    );
  }

  if (backgrounds.length === 0) {
    return (
      <div className="card-parchment rounded-lg p-8 text-center">
        <p className="text-muted-foreground mb-4">No se encontraron trasfondos para {draft?.cultura_nombre}</p>
        <Button variant="outline" onClick={onBack}>Volver</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="step-2-background">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
          Elige tu Trasfondo
        </h2>
        <p className="text-muted-foreground text-sm">
          Trasfondos para: <span className="text-[hsl(var(--magic-blue))]">{draft?.cultura_nombre}</span>
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
            <span className="font-heading text-xl text-[hsl(var(--gold))]">
              {draft?.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-heading text-lg">{draft?.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              {draft?.cultura_nombre} · {draft?.edad} años · {draft?.altura_cm}cm · {draft?.peso_kg}kg
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Background List */}
      <div className="card-parchment rounded-lg p-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {backgrounds.map((bg) => {
              const isExpanded = expandedBackground === bg.id;
              const isSelected = selectedBackground?.id === bg.id;
              
              return (
                <div key={bg.id} className="rounded-lg overflow-hidden">
                  {/* Background Header */}
                  <button
                    onClick={() => handleBackgroundSelect(bg)}
                    className={cn(
                      "w-full selection-card p-4 text-left flex items-center justify-between",
                      isSelected && "selected"
                    )}
                    data-testid={`background-${bg.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading text-lg">{bg.nombre}</h4>
                        {isSelected && <Check className="w-4 h-4 text-[hsl(var(--gold))]" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {bg.descripcion?.substring(0, 100)}...
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  
                  {/* Expanded Background Details */}
                  {isExpanded && (
                    <div className="bg-black/20 p-4 border-t border-border/30 space-y-4">
                      {/* Description */}
                      <p className="text-sm text-muted-foreground">
                        {bg.descripcion}
                      </p>
                      
                      {/* Auto Competencies */}
                      {bg.competencias_habilidades_auto?.length > 0 && (
                        <div>
                          <span className="text-[hsl(var(--gold))] text-sm">Competencias automáticas:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {bg.competencias_habilidades_auto.map((skill, i) => (
                              <span key={i} className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-1 rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Skill Selection */}
                      {bg.competencias_habilidades_elegir?.length > 0 && (
                        <div>
                          <span className="text-[hsl(var(--gold))] text-sm">Elige 1 competencia de habilidad:</span>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {bg.competencias_habilidades_elegir.map((skill) => (
                              <button
                                key={skill}
                                onClick={() => setSelectedSkill(skill)}
                                className={cn(
                                  "selection-card p-2 rounded text-sm text-left",
                                  selectedSkill === skill && "selected"
                                )}
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Tool Competencies */}
                      {(bg.competencias_herramientas_1?.length > 0 || bg.competencias_herramientas_2?.length > 0) && (
                        <div>
                          <span className="text-[hsl(var(--gold))] text-sm">Herramientas:</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {bg.competencias_herramientas_1?.map((tool, i) => {
                              const subType = needsSubSelection(tool);
                              if (subType) {
                                return (
                                  <div key={i} className="w-full">
                                    <span className="text-xs text-muted-foreground">{tool} - Elige:</span>
                                    <div className="grid grid-cols-3 gap-1 mt-1">
                                      {(subType === 'instrumentos' ? equipmentLists.instrumentos_musicales : equipmentLists.juegos).map((item) => (
                                        <button
                                          key={item}
                                          onClick={() => setSelectedTool1(item)}
                                          className={cn(
                                            "selection-card p-1 rounded text-xs",
                                            selectedTool1 === item && "selected"
                                          )}
                                        >
                                          {item}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <span key={i} className="text-xs bg-black/30 px-2 py-1 rounded">
                                  {tool}
                                </span>
                              );
                            })}
                            {bg.competencias_herramientas_2?.map((tool, i) => (
                              <span key={`t2-${i}`} className="text-xs bg-black/30 px-2 py-1 rounded">
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Traits */}
                      {bg.rasgos_descripciones?.length > 0 && (
                        <div>
                          <span className="text-[hsl(var(--gold))] text-sm">Rasgos de personalidad:</span>
                          <div className="space-y-2 mt-2">
                            {bg.rasgos_descripciones.map((rasgo, i) => (
                              <div key={i} className="bg-black/20 p-2 rounded">
                                <span className="text-sm font-heading text-[hsl(var(--torch-orange))]">
                                  {rasgo.nombre}:
                                </span>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {rasgo.descripcion}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-border/30">
        <Button
          variant="outline"
          onClick={onBack}
          data-testid="step-2-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedBackground || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
          data-testid="step-2-next-btn"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step2Background;
