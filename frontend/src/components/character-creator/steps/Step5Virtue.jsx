/**
 * Step 5: Virtue Selection
 * Disponible para culturas con tiene_virtud_inicial=true
 * Usa el endpoint /api/data/cultures/{id}/virtues para obtener virtudes disponibles
 * según la configuración de la cultura (propias, copiadas, comunes)
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Star, Sparkles, AlertCircle, Shield, Heart, Swords, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import api from '@/services/api';

const Step5Virtue = ({ draftId, draft, onComplete, onBack }) => {
  const [virtues, setVirtues] = useState([]);
  const [selectedVirtue, setSelectedVirtue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [cultureVirtueConfig, setCultureVirtueConfig] = useState(null);

  // Verificar si la cultura tiene derecho a virtud usando el campo de la BD
  const cultureHasVirtue = draft?.tiene_virtud_inicial === true;

  // Load virtues for culture using the new endpoint
  useEffect(() => {
    const loadVirtues = async () => {
      if (!draft?.cultura_id || !cultureHasVirtue) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Use the new endpoint that returns virtues based on culture configuration
        const response = await api.get(`/data/cultures/${draft.cultura_id}/virtues`);
        setVirtues(response.data.virtues || []);
        setCultureVirtueConfig({
          permite_comunes: response.data.permite_virtudes_comunes,
          culture_name: response.data.culture_name
        });
      } catch (err) {
        console.error('Error loading virtues:', err);
        setError('No se pudieron cargar las virtudes');
      } finally {
        setLoading(false);
      }
    };
    loadVirtues();
  }, [draft?.cultura_id, cultureHasVirtue]);

  // Handle submit - save all virtue data
  const handleSubmit = async () => {
    if (!selectedVirtue) return;

    try {
      setSaving(true);
      
      // Save all virtue data to draft
      const virtueData = {
        virtud_id: selectedVirtue.id,
        virtud_nombre: selectedVirtue.nombre,
        virtud_descripcion: selectedVirtue.descripcion,
        virtud_rasgos: selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto,
        // Characteristic bonuses
        virtud_caracteristicas_fijas: selectedVirtue.caracteristicas_fijas || {},
        virtud_caracteristicas_elegir: selectedVirtue.caracteristicas_elegir || [],
        // Saving throw proficiencies
        virtud_salvaciones_elegir: selectedVirtue.salvaciones_elegir || [],
        // Extra stats
        virtud_pg_extra: selectedVirtue.puntos_golpe_extra || 0,
        virtud_comunidad_extra: selectedVirtue.puntos_comunidad_extra || 0,
        virtud_ca_extra: selectedVirtue.clase_armadura_extra || 0,
        // Skill/tool proficiencies to choose
        virtud_habilidades_elegir: selectedVirtue.competencias_habilidades_elegir || [],
        virtud_herramientas_elegir: selectedVirtue.competencias_herramientas_elegir || [],
      };

      const response = await api.patch(`/draft/${draftId}/step5`, virtueData);
      onComplete(response.data);
    } catch (err) {
      console.error('Error saving step 5:', err);
      setError('No se pudo guardar la virtud');
    } finally {
      setSaving(false);
    }
  };

  // Si la cultura no tiene virtud, mostrar mensaje y permitir continuar
  if (!cultureHasVirtue) {
    return (
      <div className="space-y-8" data-testid="step-5-virtue-skip">
        <div className="text-center">
          <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
            Virtudes
          </h2>
        </div>

        <div className="card-parchment rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[hsl(var(--gold))] mx-auto mb-4" />
          <h3 className="font-heading text-xl text-foreground mb-2">
            Tu cultura no obtiene virtud inicial
          </h3>
          <p className="text-muted-foreground mb-4">
            La cultura <span className="text-[hsl(var(--gold))]">{draft?.cultura_nombre}</span> no 
            tiene acceso a virtudes al nivel 1 según su configuración.
          </p>
          <p className="text-sm text-muted-foreground">
            Podrás obtener virtudes más adelante al subir de nivel.
          </p>
        </div>

        <div className="flex justify-between pt-4 pb-16">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={() => onComplete({ ...draft, paso_actual: 6 })}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          >
            Continuar sin Virtud
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-parchment rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  // Render a virtue card with all its bonuses
  const renderVirtueCard = (virtue) => {
    const isSelected = selectedVirtue?.id === virtue.id;
    
    // Check for various bonuses
    const hasCharBonus = virtue.caracteristicas_fijas && 
      Object.values(virtue.caracteristicas_fijas).some(v => v !== 0);
    const hasCharChoice = virtue.caracteristicas_elegir?.length > 0;
    const hasPgBonus = virtue.puntos_golpe_extra > 0;
    const hasCaBonus = virtue.clase_armadura_extra > 0;
    const hasCommunityBonus = virtue.puntos_comunidad_extra > 0;
    const hasSkillChoice = virtue.competencias_habilidades_elegir?.length > 0;
    const hasSaveChoice = virtue.salvaciones_elegir?.length > 0;

    return (
      <button
        key={virtue.id}
        onClick={() => setSelectedVirtue(virtue)}
        className={cn(
          'selection-card rounded-lg p-4 text-left h-full transition-all',
          isSelected && 'selected ring-2 ring-[hsl(var(--gold))]'
        )}
        data-testid={`virtue-${virtue.id}`}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-heading text-lg text-foreground flex items-center gap-2">
            {virtue.es_comun || virtue.tipo === 'COMUNES' ? (
              <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
            )}
            {virtue.nombre}
          </h4>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {virtue.descripcion?.substring(0, 100)}...
        </p>

        {/* Bonus indicators */}
        <div className="flex flex-wrap gap-1">
          {hasCharBonus && (
            <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded flex items-center gap-1">
              <Brain className="w-3 h-3" /> Características
            </span>
          )}
          {hasPgBonus && (
            <span className="text-xs bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] px-2 py-0.5 rounded flex items-center gap-1">
              <Heart className="w-3 h-3" /> +{virtue.puntos_golpe_extra} PG
            </span>
          )}
          {hasCaBonus && (
            <span className="text-xs bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] px-2 py-0.5 rounded flex items-center gap-1">
              <Shield className="w-3 h-3" /> +{virtue.clase_armadura_extra} CA
            </span>
          )}
          {hasSkillChoice && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
              <Swords className="w-3 h-3" /> Competencias
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-8" data-testid="step-5-virtue">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Virtud
        </h2>
        <p className="text-muted-foreground">
          Como <span className="text-[hsl(var(--gold))]">{draft?.cultura_nombre}</span>, obtienes una virtud al nivel 1
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
            <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              {draft?.cultura_nombre} · {draft?.vocacion_nombre || draft?.ocupacion_nombre} · {draft?.trasfondo_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[hsl(var(--magic-blue))/10] border border-[hsl(var(--magic-blue))/30] rounded-lg p-4">
        <p className="text-sm text-[hsl(var(--magic-blue))]">
          <Sparkles className="w-4 h-4 inline mr-2" />
          Tienes <span className="font-bold">{virtues.length}</span> virtudes disponibles según la configuración de tu cultura.
          {cultureVirtueConfig?.permite_comunes && (
            <span className="ml-1">(incluye virtudes comunes)</span>
          )}
        </p>
      </div>

      {/* Virtues Grid */}
      <div className="card-parchment rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Selecciona una virtud para tu personaje:
        </p>
        <ScrollArea className="h-[350px] pr-4">
          <div className="grid md:grid-cols-2 gap-4">
            {virtues.map(renderVirtueCard)}
          </div>
          {virtues.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay virtudes disponibles para esta cultura.
              Contacta al administrador para configurar las virtudes.
            </p>
          )}
        </ScrollArea>
      </div>

      {/* Selected Virtue Detail */}
      {selectedVirtue && (
        <div className="card-parchment rounded-lg p-6 border-2 border-[hsl(var(--gold))/50] animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            {selectedVirtue.es_comun || selectedVirtue.tipo === 'COMUNES' ? (
              <Star className="w-6 h-6 text-[hsl(var(--gold))]" />
            ) : (
              <Sparkles className="w-6 h-6 text-[hsl(var(--magic-blue))]" />
            )}
            <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
              {selectedVirtue.nombre}
            </h3>
          </div>
          
          <p className="text-muted-foreground mb-4">
            {selectedVirtue.descripcion}
          </p>

          {/* Rasgos de la virtud */}
          {(selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto) && (
            <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-4">
              <h4 className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
                Efectos y Rasgos
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto}
              </p>
            </div>
          )}

          {/* Bonuses Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Fixed Characteristics */}
            {selectedVirtue.caracteristicas_fijas && 
             Object.values(selectedVirtue.caracteristicas_fijas).some(v => v !== 0) && (
              <div className="bg-[hsl(var(--magic-blue))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Bonificadores Fijos
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedVirtue.caracteristicas_fijas)
                    .filter(([, val]) => val !== 0)
                    .map(([attr, val]) => (
                      <span
                        key={attr}
                        className="text-sm bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-1 rounded"
                      >
                        {attr.charAt(0).toUpperCase() + attr.slice(1)}: +{val}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Characteristics to Choose */}
            {selectedVirtue.caracteristicas_elegir?.length > 0 && (
              <div className="bg-[hsl(var(--torch-orange))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--torch-orange))] mb-2">
                  Características a Elegir
                </h4>
                <p className="text-sm text-muted-foreground">
                  +1 en: {selectedVirtue.caracteristicas_elegir.join(', ')}
                </p>
              </div>
            )}

            {/* Extra HP */}
            {selectedVirtue.puntos_golpe_extra > 0 && (
              <div className="bg-red-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-red-400 mb-2">
                  Puntos de Golpe Extra
                </h4>
                <p className="text-lg font-bold text-red-400">
                  +{selectedVirtue.puntos_golpe_extra} PG
                </p>
              </div>
            )}

            {/* Extra AC */}
            {selectedVirtue.clase_armadura_extra > 0 && (
              <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--gold))] mb-2">
                  Clase de Armadura Extra
                </h4>
                <p className="text-lg font-bold text-[hsl(var(--gold))]">
                  +{selectedVirtue.clase_armadura_extra} CA
                </p>
              </div>
            )}

            {/* Community Points */}
            {selectedVirtue.puntos_comunidad_extra > 0 && (
              <div className="bg-green-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-green-400 mb-2">
                  Puntos de Comunidad Extra
                </h4>
                <p className="text-lg font-bold text-green-400">
                  +{selectedVirtue.puntos_comunidad_extra}
                </p>
              </div>
            )}

            {/* Saving Throws to Choose */}
            {selectedVirtue.salvaciones_elegir?.length > 0 && (
              <div className="bg-purple-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-purple-400 mb-2">
                  Salvaciones Adicionales
                </h4>
                <p className="text-sm text-muted-foreground">
                  Elegir de: {selectedVirtue.salvaciones_elegir.join(', ')}
                </p>
              </div>
            )}

            {/* Skills to Choose */}
            {selectedVirtue.competencias_habilidades_elegir?.length > 0 && (
              <div className="bg-cyan-500/10 rounded-lg p-3 md:col-span-2">
                <h4 className="text-xs font-heading text-cyan-400 mb-2">
                  Competencias en Habilidades a Elegir
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedVirtue.competencias_habilidades_elegir.join(', ')}
                </p>
              </div>
            )}

            {/* Tools to Choose */}
            {selectedVirtue.competencias_herramientas_elegir?.length > 0 && (
              <div className="bg-amber-500/10 rounded-lg p-3 md:col-span-2">
                <h4 className="text-xs font-heading text-amber-400 mb-2">
                  Competencias en Herramientas a Elegir
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedVirtue.competencias_herramientas_elegir.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
          data-testid="step-5-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedVirtue || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-5-next-btn"
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

export default Step5Virtue;
