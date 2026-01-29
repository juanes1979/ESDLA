/**
 * Step 8: Patron Selection
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Users, Crown } from 'lucide-react';
import { getPatrons, updateDraftStep8 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const Step8Patron = ({ draftId, draft, onComplete, onBack }) => {
  const [patrons, setPatrons] = useState([]);
  const [selectedPatron, setSelectedPatron] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load patrons
  useEffect(() => {
    const loadPatrons = async () => {
      try {
        setLoading(true);
        const data = await getPatrons();
        setPatrons(data);
      } catch (err) {
        console.error('Error loading patrons:', err);
        setError('No se pudieron cargar los mecenas');
      } finally {
        setLoading(false);
      }
    };
    loadPatrons();
  }, []);

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep8(draftId, {
        patron_id: selectedPatron?.id || null,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 8:', err);
      setError('No se pudo guardar el mecenas');
    } finally {
      setSaving(false);
    }
  };

  // Skip patron selection
  const handleSkip = async () => {
    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep8(draftId, {
        patron_id: null,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error skipping step 8:', err);
      setError('No se pudo continuar');
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
    <div className="space-y-8" data-testid="step-8-patron">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Mecenas
        </h2>
        <p className="text-muted-foreground">
          Un mecenas es un aliado poderoso que apoya tu causa (opcional)
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
              {draft?.cultura_nombre} · {draft?.vocacion_nombre} · {draft?.virtud_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Patrons Grid */}
      <div className="card-parchment rounded-lg p-4">
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {patrons.filter(p => p.nombre !== 'Sin mecenas').map((patron) => {
              const isSelected = selectedPatron?.id === patron.id;
              
              return (
                <button
                  key={patron.id}
                  onClick={() => setSelectedPatron(isSelected ? null : patron)}
                  className={cn(
                    'selection-card w-full rounded-lg p-5 text-left',
                    isSelected && 'selected'
                  )}
                  data-testid={`patron-${patron.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        isSelected ? 'bg-[hsl(var(--gold))/30]' : 'bg-secondary'
                      )}>
                        <Crown className={cn(
                          'w-5 h-5',
                          isSelected ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
                        )} />
                      </div>
                      <h4 className="font-heading text-lg text-foreground">
                        {patron.nombre}
                      </h4>
                    </div>
                    {patron.puntos_comunidad !== null && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Puntos de Comunidad</p>
                        <p className="font-heading text-xl text-[hsl(var(--magic-blue))]">
                          {patron.puntos_comunidad}
                        </p>
                      </div>
                    )}
                  </div>

                  {patron.ocupaciones_favorecidas && (
                    <div className="mb-2">
                      <span className="text-xs text-[hsl(var(--gold))]">Ocupaciones favorecidas: </span>
                      <span className="text-xs text-muted-foreground">
                        {patron.ocupaciones_favorecidas}
                      </span>
                    </div>
                  )}

                  {patron.ventaja_adicional && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {patron.ventaja_adicional}
                    </p>
                  )}

                  {patron.planes && (
                    <div className="text-xs text-muted-foreground/70 italic">
                      <span className="text-[hsl(var(--gold))]">Planes: </span>
                      {patron.planes.substring(0, 100)}...
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Selected Patron Detail */}
      {selectedPatron && (
        <div className="card-parchment rounded-lg p-6 border-magic animate-slide-up">
          <div className="flex items-center gap-4 mb-4">
            <Crown className="w-8 h-8 text-[hsl(var(--gold))]" />
            <div>
              <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
                {selectedPatron.nombre}
              </h3>
              <p className="text-sm text-muted-foreground">
                Puntos de Comunidad: {selectedPatron.puntos_comunidad || 0}
              </p>
            </div>
          </div>

          {selectedPatron.ventaja_adicional && (
            <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-4">
              <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                Ventaja Especial
              </h4>
              <p className="text-sm text-muted-foreground">
                {selectedPatron.ventaja_adicional}
              </p>
            </div>
          )}

          {selectedPatron.planes && (
            <div>
              <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                Planes y Objetivos
              </h4>
              <p className="text-sm text-muted-foreground">
                {selectedPatron.planes}
              </p>
            </div>
          )}
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
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={saving}
            className="border-border hover:bg-secondary"
            data-testid="step-8-skip-btn"
          >
            Sin Mecenas
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPatron || saving}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
            data-testid="step-8-next-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Step8Patron;
