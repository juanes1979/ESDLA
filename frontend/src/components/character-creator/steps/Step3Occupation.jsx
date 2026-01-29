/**
 * Step 3: Occupation/Class Selection
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Sword, Shield, BookOpen, Compass, Crown, Wind } from 'lucide-react';
import { getOccupations, updateDraftStep3 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const OCCUPATION_ICONS = {
  'Explorador': Compass,
  'Guerrero': Sword,
  'Lider': Crown,
  'Maestro': BookOpen,
  'Protector': Shield,
  'Trotamundos': Wind,
};

const Step3Occupation = ({ draftId, draft, onComplete, onBack }) => {
  const [occupations, setOccupations] = useState([]);
  const [selectedOccupation, setSelectedOccupation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load occupations
  useEffect(() => {
    const loadOccupations = async () => {
      try {
        setLoading(true);
        const data = await getOccupations();
        setOccupations(data);
      } catch (err) {
        console.error('Error loading occupations:', err);
        setError('No se pudieron cargar las ocupaciones');
      } finally {
        setLoading(false);
      }
    };
    loadOccupations();
  }, []);

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedOccupation) return;

    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep3(draftId, {
        ocupacion_id: selectedOccupation.id,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 3:', err);
      setError('No se pudo guardar la ocupación');
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
    <div className="space-y-8" data-testid="step-3-occupation">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Ocupación
        </h2>
        <p className="text-muted-foreground">
          Tu ocupación define tu rol en la Comunidad y tus habilidades de combate
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
              {draft?.cultura_nombre} · {draft?.trasfondo_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Occupation Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {occupations.map((occupation) => {
          const IconComponent = OCCUPATION_ICONS[occupation.tipo] || Sword;
          const isSelected = selectedOccupation?.id === occupation.id;

          return (
            <button
              key={occupation.id}
              onClick={() => setSelectedOccupation(occupation)}
              className={cn(
                'selection-card rounded-lg p-6 text-left h-full',
                isSelected && 'selected'
              )}
              data-testid={`occupation-${occupation.id}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
                  isSelected ? 'bg-[hsl(var(--gold))/30]' : 'bg-[hsl(var(--secondary))]'
                )}>
                  <IconComponent className={cn(
                    'w-6 h-6',
                    isSelected ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
                  )} />
                </div>
                <div>
                  <h4 className="font-heading text-lg text-foreground">
                    {occupation.vocacion}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {occupation.tipo}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dado de Golpe</span>
                  <span className="text-[hsl(var(--gold))] font-heading">{occupation.dado_golpe}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PG Nivel 1</span>
                  <span className="text-[hsl(var(--magic-blue))]">{occupation.puntos_golpe_nivel1}</span>
                </div>
              </div>

              {/* Main characteristics */}
              {occupation.caracteristicas_principales?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">Características principales:</p>
                  <div className="flex flex-wrap gap-1">
                    {occupation.caracteristicas_principales.map((char, i) => (
                      <span
                        key={i}
                        className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Saving throws */}
              {occupation.competencia_tiradas_salvacion?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Tiradas de salvación:</p>
                  <p className="text-xs text-[hsl(var(--gold))]">
                    {occupation.competencia_tiradas_salvacion.join(', ')}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Occupation Detail */}
      {selectedOccupation && (
        <div className="card-parchment rounded-lg p-6 border-magic animate-slide-up">
          <div className="flex items-center gap-4 mb-4">
            {(() => {
              const IconComponent = OCCUPATION_ICONS[selectedOccupation.tipo] || Sword;
              return <IconComponent className="w-8 h-8 text-[hsl(var(--gold))]" />;
            })()}
            <div>
              <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
                {selectedOccupation.vocacion}
              </h3>
              <p className="text-sm text-muted-foreground">
                Tipo: {selectedOccupation.tipo}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="stat-box p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Dado de Golpe</p>
              <p className="stat-value">{selectedOccupation.dado_golpe}</p>
            </div>
            <div className="stat-box p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">PG Inicial</p>
              <p className="stat-value">{selectedOccupation.puntos_golpe_nivel1}</p>
            </div>
            <div className="stat-box p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Habilidades a elegir</p>
              <p className="stat-value">{selectedOccupation.num_habilidades_elegir || 2}</p>
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {selectedOccupation.competencia_armaduras?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Competencia en Armaduras
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedOccupation.competencia_armaduras.join(', ') || 'Ninguna'}
                </p>
              </div>
            )}
            {selectedOccupation.competencia_armas?.length > 0 && (
              <div>
                <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Competencia en Armas
                </h4>
                <p className="text-sm text-muted-foreground">
                  {selectedOccupation.competencia_armas.join(', ') || 'Ninguna'}
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
          data-testid="step-3-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedOccupation || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-3-next-btn"
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

export default Step3Occupation;
