/**
 * Step 2: Background Selection
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft } from 'lucide-react';
import { getBackgrounds, updateDraftStep2 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const Step2Background = ({ draftId, draft, onComplete, onBack }) => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load backgrounds for selected culture
  useEffect(() => {
    const loadBackgrounds = async () => {
      if (!draft?.cultura_nombre) return;
      try {
        setLoading(true);
        const data = await getBackgrounds(null, draft.cultura_nombre);
        setBackgrounds(data);
      } catch (err) {
        console.error('Error loading backgrounds:', err);
        setError('No se pudieron cargar los trasfondos');
      } finally {
        setLoading(false);
      }
    };
    loadBackgrounds();
  }, [draft?.cultura_nombre]);

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedBackground) return;

    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep2(draftId, {
        trasfondo_id: selectedBackground.id,
      });
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
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="step-2-background">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Trasfondo
        </h2>
        <p className="text-muted-foreground">
          Tu trasfondo define tu pasado y las habilidades que has desarrollado
        </p>
        <p className="text-sm text-[hsl(var(--magic-blue))] mt-2">
          Trasfondos disponibles para: <span className="font-heading">{draft?.cultura_nombre}</span>
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
              {draft?.cultura_nombre} · {draft?.edad} años · {draft?.altura_cm}cm
            </p>
          </div>
        </div>
      </div>

      {/* Background List */}
      <div className="card-parchment rounded-lg p-4">
        <ScrollArea className="h-[450px] pr-4">
          <div className="grid md:grid-cols-2 gap-4">
            {backgrounds.map((background) => (
              <button
                key={background.id}
                onClick={() => setSelectedBackground(background)}
                className={cn(
                  'selection-card rounded-lg p-4 text-left h-full',
                  selectedBackground?.id === background.id && 'selected'
                )}
                data-testid={`background-${background.id}`}
              >
                <h4 className="font-heading text-lg text-foreground mb-2">
                  {background.nombre}
                </h4>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {background.descripcion?.substring(0, 120)}...
                </p>
                
                {/* Skills */}
                {background.competencias_habilidades?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-[hsl(var(--gold))]">Habilidades: </span>
                    <span className="text-xs text-muted-foreground">
                      {background.competencias_habilidades.slice(0, 3).join(', ')}
                    </span>
                  </div>
                )}
                
                {/* Equipment */}
                {background.equipo_inicial?.length > 0 && (
                  <div className="mt-1">
                    <span className="text-xs text-[hsl(var(--gold))]">Equipo: </span>
                    <span className="text-xs text-muted-foreground">
                      {background.equipo_inicial.slice(0, 2).join(', ')}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Selected Background Detail */}
      {selectedBackground && (
        <div className="card-parchment rounded-lg p-6 border-magic animate-slide-up">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-3">
            {selectedBackground.nombre}
          </h3>
          <p className="text-muted-foreground mb-4">
            {selectedBackground.descripcion}
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            {selectedBackground.competencias_habilidades?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Competencias en Habilidades
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedBackground.competencias_habilidades.map((skill, i) => (
                    <li key={i}>• {skill}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedBackground.competencias_herramientas?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Competencias en Herramientas
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedBackground.competencias_herramientas.map((tool, i) => (
                    <li key={i}>• {tool}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedBackground.idiomas?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Idiomas
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedBackground.idiomas.map((lang, i) => (
                    <li key={i}>• {lang}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedBackground.equipo_inicial?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Equipo Inicial
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {selectedBackground.equipo_inicial.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
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
      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-2-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedBackground || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-2-next-btn"
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

export default Step2Background;
