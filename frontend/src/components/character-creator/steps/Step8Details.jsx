/**
 * Step 8: Final Details (Personality derived from Background)
 * Los rasgos de personalidad se derivan automáticamente del trasfondo elegido
 * La historia viene de la descripción del trasfondo
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Scroll, User, BookOpen, Star, Sparkles } from 'lucide-react';
import { updateDraftStep9, getBackground } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import api from '@/services/api';
import { toast } from 'sonner';

const Step8Details = ({ draftId, draft, onComplete, onBack }) => {
  const [backgroundData, setBackgroundData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Custom history state
  const [customHistoria, setCustomHistoria] = useState('');
  const [generatingStory, setGeneratingStory] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Cargar datos completos del trasfondo para obtener los rasgos
  useEffect(() => {
    const loadBackground = async () => {
      if (!draft?.trasfondo_id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const bg = await getBackground(draft.trasfondo_id);
        setBackgroundData(bg);
        // Initialize custom historia with the background description
        setCustomHistoria(bg?.descripcion || '');
      } catch (err) {
        console.error('Error loading background:', err);
        setError('No se pudieron cargar los datos del trasfondo');
      } finally {
        setLoading(false);
      }
    };
    loadBackground();
  }, [draft?.trasfondo_id]);

  // Generate personal history with AI
  const generatePersonalHistory = async () => {
    setGeneratingStory(true);
    try {
      const response = await api.post('/data/generate-personal-history', {
        nombre_personaje: draft?.nombre,
        cultura: draft?.cultura_nombre,
        vocacion: draft?.vocacion_nombre,
        trasfondo: draft?.trasfondo_nombre,
        descripcion_trasfondo: backgroundData?.descripcion || '',
        rasgos: backgroundData?.rasgos_descripciones || backgroundData?.rasgos || []
      });
      
      if (response.data?.success && response.data?.historia) {
        setCustomHistoria(response.data.historia);
        setIsEditing(true);
        toast.success('Historia personal generada');
      } else {
        toast.error('Error al generar la historia');
      }
    } catch (err) {
      console.error('Error generating history:', err);
      toast.error('Error al generar la historia');
    } finally {
      setGeneratingStory(false);
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Los rasgos vienen del trasfondo (ambos son rasgos distintivos) con sus descripciones
      const rasgosConDescripcion = backgroundData?.rasgos_descripciones || [];
      const rasgosSimples = backgroundData?.rasgos || [];
      
      // Get trait with description if available
      const getRasgoCompleto = (index) => {
        if (rasgosConDescripcion[index]) {
          return rasgosConDescripcion[index];
        }
        if (rasgosSimples[index]) {
          return { nombre: rasgosSimples[index], descripcion: '' };
        }
        return null;
      };
      
      const updatedDraft = await updateDraftStep9(draftId, {
        rasgo_distintivo: getRasgoCompleto(0),
        rasgo_distintivo_2: getRasgoCompleto(1),
        motivacion: null,
        historia: customHistoria || backgroundData?.descripcion || null,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 8:', err);
      setError('No se pudieron guardar los detalles');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-parchment rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="step-8-details">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Resumen del Personaje
        </h2>
        <p className="text-muted-foreground">
          Rasgos de personalidad y trasfondo de tu aventurero
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
            <span className="font-heading text-2xl text-[hsl(var(--gold))]">
              {draft?.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-heading text-xl text-foreground">{draft?.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              {draft?.cultura_nombre} · {draft?.vocacion_nombre}
            </p>
            <p className="text-xs text-muted-foreground">
              {draft?.trasfondo_nombre} · {draft?.virtud_nombre || 'Sin virtud inicial'}
            </p>
          </div>
        </div>
      </div>

      {/* Background-derived Traits - BOTH TRAITS */}
      <div className="card-parchment rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Rasgos de Personalidad
          </h3>
        </div>

        {/* Show BOTH personality traits as "Rasgos Distintivos" with descriptions */}
        <div className="space-y-4">
          {backgroundData?.rasgos_descripciones?.map((rasgo, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border border-[hsl(var(--gold))/30] bg-[hsl(var(--gold))/5]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
                <span className="font-heading text-sm text-[hsl(var(--gold))]">
                  Rasgo Distintivo {index + 1}
                </span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {typeof rasgo === 'object' ? rasgo.nombre : rasgo}
              </p>
              {typeof rasgo === 'object' && rasgo.descripcion && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  {rasgo.descripcion}
                </p>
              )}
            </div>
          ))}
          
          {/* Fallback to simple rasgos if rasgos_descripciones not available */}
          {(!backgroundData?.rasgos_descripciones || backgroundData.rasgos_descripciones.length === 0) && 
           backgroundData?.rasgos?.map((rasgo, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border border-[hsl(var(--gold))/30] bg-[hsl(var(--gold))/5]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
                <span className="font-heading text-sm text-[hsl(var(--gold))]">
                  Rasgo Distintivo {index + 1}
                </span>
              </div>
              <p className="text-lg font-medium text-foreground">
                {typeof rasgo === 'object' ? rasgo.nombre : rasgo}
              </p>
            </div>
          ))}
          
          {(!backgroundData?.rasgos_descripciones || backgroundData.rasgos_descripciones.length === 0) &&
           (!backgroundData?.rasgos || backgroundData.rasgos.length === 0) && (
            <p className="text-muted-foreground text-center py-4">
              No hay rasgos de personalidad definidos para este trasfondo
            </p>
          )}
        </div>
      </div>

      {/* Background Story - FROM TRASFONDO */}
      <div className="card-parchment rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-[hsl(var(--magic-blue))]" />
            <h3 className="font-heading text-xl text-[hsl(var(--magic-blue))]">
              Historia Personal
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generatePersonalHistory}
            disabled={generatingStory}
            data-testid="generate-history-btn"
          >
            {generatingStory ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generar con IA
              </>
            )}
          </Button>
        </div>
        
        <div className="bg-[hsl(var(--secondary))] rounded-lg p-4">
          <p className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
            Trasfondo: {draft?.trasfondo_nombre}
          </p>
          {isEditing ? (
            <Textarea
              value={customHistoria}
              onChange={(e) => setCustomHistoria(e.target.value)}
              className="min-h-[120px] bg-background/50"
              placeholder="Escribe la historia personal de tu personaje..."
            />
          ) : (
            <div 
              className="cursor-pointer hover:bg-background/20 rounded p-2 -m-2 transition-colors"
              onClick={() => setIsEditing(true)}
            >
              <p className="text-foreground leading-relaxed">
                {customHistoria || backgroundData?.descripcion || 'Sin descripción disponible'}
              </p>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Haz clic para editar o usa el botón de IA
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Competencies from Background */}
      {(backgroundData?.competencias_habilidades?.length > 0 || 
        backgroundData?.competencias_herramientas?.length > 0) && (
        <div className="card-parchment rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Scroll className="w-6 h-6 text-[hsl(var(--magic-blue))]" />
            <h3 className="font-heading text-xl text-[hsl(var(--magic-blue))]">
              Competencias del Trasfondo
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {backgroundData?.competencias_habilidades?.length > 0 && (
              <div className="p-4 rounded-lg border border-[hsl(var(--magic-blue))/30] bg-[hsl(var(--magic-blue))/5]">
                <span className="font-heading text-sm text-[hsl(var(--magic-blue))] block mb-2">
                  Habilidades
                </span>
                <div className="flex flex-wrap gap-1">
                  {backgroundData.competencias_habilidades.map((h, i) => (
                    <span 
                      key={i} 
                      className="text-xs px-2 py-1 rounded bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {backgroundData?.competencias_herramientas?.length > 0 && (
              <div className="p-4 rounded-lg border border-border bg-secondary/50">
                <span className="font-heading text-sm text-muted-foreground block mb-2">
                  Herramientas
                </span>
                <div className="flex flex-wrap gap-1">
                  {backgroundData.competencias_herramientas.map((h, i) => (
                    <span 
                      key={i} 
                      className="text-xs px-2 py-1 rounded bg-secondary text-muted-foreground"
                    >
                      {h}
                    </span>
                  ))}
                </div>
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
          data-testid="step-8-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-8-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Finalizar Personaje
        </Button>
      </div>
    </div>
  );
};

export default Step8Details;
