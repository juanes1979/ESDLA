/**
 * Step 5: Virtue Selection
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Star, Sparkles } from 'lucide-react';
import { getVirtues, updateDraftStep5 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const Step5Virtue = ({ draftId, draft, onComplete, onBack }) => {
  const [virtues, setVirtues] = useState([]);
  const [selectedVirtue, setSelectedVirtue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('cultural');

  // Load virtues for culture
  useEffect(() => {
    const loadVirtues = async () => {
      if (!draft?.cultura_nombre) return;
      try {
        setLoading(true);
        const data = await getVirtues(null, draft.cultura_nombre, true);
        setVirtues(data);
      } catch (err) {
        console.error('Error loading virtues:', err);
        setError('No se pudieron cargar las virtudes');
      } finally {
        setLoading(false);
      }
    };
    loadVirtues();
  }, [draft?.cultura_nombre]);

  // Separate cultural and common virtues
  const culturalVirtues = virtues.filter(v => !v.es_comun && v.cultura);
  const commonVirtues = virtues.filter(v => v.es_comun || !v.cultura);

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedVirtue) return;

    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep5(draftId, {
        virtud_id: selectedVirtue.id,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 5:', err);
      setError('No se pudo guardar la virtud');
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

  const renderVirtueCard = (virtue) => {
    const isSelected = selectedVirtue?.id === virtue.id;
    const hasBonus = Object.keys(virtue.aumentos_caracteristica || {}).length > 0;

    return (
      <button
        key={virtue.id}
        onClick={() => setSelectedVirtue(virtue)}
        className={cn(
          'selection-card rounded-lg p-4 text-left h-full',
          isSelected && 'selected'
        )}
        data-testid={`virtue-${virtue.id}`}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-heading text-lg text-foreground flex items-center gap-2">
            {virtue.es_comun ? (
              <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
            )}
            {virtue.nombre}
          </h4>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {virtue.descripcion?.substring(0, 120)}...
        </p>

        {hasBonus && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(virtue.aumentos_caracteristica).map(([attr, val]) => (
              <span
                key={attr}
                className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded"
              >
                {attr.substring(0, 3).toUpperCase()} +{val}
              </span>
            ))}
          </div>
        )}
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
          Tu virtud representa un don especial o una habilidad única
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
              {draft?.cultura_nombre} · {draft?.vocacion_nombre} · {draft?.trasfondo_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Virtue Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary">
          <TabsTrigger 
            value="cultural" 
            className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20] data-[state=active]:text-[hsl(var(--gold))]"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Culturales ({culturalVirtues.length})
          </TabsTrigger>
          <TabsTrigger 
            value="common"
            className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20] data-[state=active]:text-[hsl(var(--gold))]"
          >
            <Star className="w-4 h-4 mr-2" />
            Comunes ({commonVirtues.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cultural" className="mt-4">
          <div className="card-parchment rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Virtudes exclusivas de los {draft?.cultura_nombre}
            </p>
            <ScrollArea className="h-[350px] pr-4">
              <div className="grid md:grid-cols-2 gap-4">
                {culturalVirtues.map(renderVirtueCard)}
              </div>
              {culturalVirtues.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No hay virtudes culturales específicas disponibles
                </p>
              )}
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="common" className="mt-4">
          <div className="card-parchment rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              Virtudes disponibles para todas las culturas
            </p>
            <ScrollArea className="h-[350px] pr-4">
              <div className="grid md:grid-cols-2 gap-4">
                {commonVirtues.map(renderVirtueCard)}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Virtue Detail */}
      {selectedVirtue && (
        <div className="card-parchment rounded-lg p-6 border-magic animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            {selectedVirtue.es_comun ? (
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

          {selectedVirtue.rasgos_hoja_pj && (
            <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-4">
              <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                Efectos en la Hoja de Personaje
              </h4>
              <p className="text-sm text-muted-foreground">
                {selectedVirtue.rasgos_hoja_pj}
              </p>
            </div>
          )}

          {Object.keys(selectedVirtue.aumentos_caracteristica || {}).length > 0 && (
            <div>
              <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">
                Bonificadores de Característica
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedVirtue.aumentos_caracteristica).map(([attr, val]) => (
                  <span
                    key={attr}
                    className="text-sm bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-3 py-1 rounded"
                  >
                    {attr.charAt(0).toUpperCase() + attr.slice(1)}: +{val}
                  </span>
                ))}
              </div>
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
      <div className="flex justify-between pt-4">
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
