/**
 * Step 8: Final Details (Personality derived from Background + Custom history)
 * Los rasgos de personalidad se derivan automáticamente del trasfondo elegido
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Feather, Scroll, User } from 'lucide-react';
import { updateDraftStep9, getBackground } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const Step8Details = ({ draftId, draft, onComplete, onBack }) => {
  const [backgroundData, setBackgroundData] = useState(null);
  const [historia, setHistoria] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      } catch (err) {
        console.error('Error loading background:', err);
        setError('No se pudieron cargar los datos del trasfondo');
      } finally {
        setLoading(false);
      }
    };
    loadBackground();
  }, [draft?.trasfondo_id]);

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Los rasgos vienen del trasfondo, la historia es personalizable
      const rasgoDistintivo = backgroundData?.rasgo_distintivo || draft?.rasgo_trasfondo || null;
      
      const updatedDraft = await updateDraftStep9(draftId, {
        rasgo_distintivo: rasgoDistintivo,
        defecto: null, // Se podría agregar si el trasfondo lo tiene
        motivacion: null,
        historia: historia.trim() || null,
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
          Detalles Finales
        </h2>
        <p className="text-muted-foreground">
          Tu personalidad y rasgos derivados de tu trasfondo
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

      {/* Background-derived Traits */}
      <div className="card-parchment rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Scroll className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Rasgos del Trasfondo: {draft?.trasfondo_nombre}
          </h3>
        </div>

        {backgroundData?.descripcion && (
          <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-4">
            <p className="text-sm text-muted-foreground italic">
              {backgroundData.descripcion}
            </p>
          </div>
        )}

        {/* Rasgos automáticos del trasfondo */}
        <div className="grid md:grid-cols-2 gap-4">
          {backgroundData?.rasgo_distintivo && (
            <div className="p-4 rounded-lg border border-[hsl(var(--gold))/30] bg-[hsl(var(--gold))/5]">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-[hsl(var(--gold))]" />
                <span className="font-heading text-sm text-[hsl(var(--gold))]">
                  Rasgo Distintivo
                </span>
              </div>
              <p className="text-foreground">{backgroundData.rasgo_distintivo}</p>
            </div>
          )}

          {backgroundData?.competencias_habilidades?.length > 0 && (
            <div className="p-4 rounded-lg border border-[hsl(var(--magic-blue))/30] bg-[hsl(var(--magic-blue))/5]">
              <div className="flex items-center gap-2 mb-2">
                <Feather className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
                <span className="font-heading text-sm text-[hsl(var(--magic-blue))]">
                  Competencias del Trasfondo
                </span>
              </div>
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

          {backgroundData?.idiomas?.length > 0 && (
            <div className="p-4 rounded-lg border border-border bg-secondary/50">
              <span className="font-heading text-sm text-muted-foreground block mb-2">
                Idiomas
              </span>
              <div className="flex flex-wrap gap-1">
                {backgroundData.idiomas.map((h, i) => (
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

      {/* Custom History */}
      <div className="card-parchment rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Feather className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Historia Personal
          </h3>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="historia" className="text-[hsl(var(--parchment))]">
            Escribe la historia de tu personaje (opcional)
          </Label>
          <Textarea
            id="historia"
            value={historia}
            onChange={(e) => setHistoria(e.target.value)}
            placeholder="Cuenta la historia de tu personaje... ¿De dónde viene? ¿Qué eventos han marcado su vida? ¿Por qué se ha convertido en aventurero?"
            className="bg-input border-border min-h-[150px]"
            data-testid="historia-input"
          />
          <p className="text-xs text-muted-foreground">
            Esta historia aparecerá en la hoja de personaje para impresión
          </p>
        </div>
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
