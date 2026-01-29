/**
 * Step 9: Final Details (Personality, Motivation, etc.)
 */
import { useState } from 'react';
import { Loader2, ChevronLeft, Feather } from 'lucide-react';
import { updateDraftStep9 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const Step9Details = ({ draftId, draft, onComplete, onBack }) => {
  const [rasgoDistintivo, setRasgoDistintivo] = useState('');
  const [defecto, setDefecto] = useState('');
  const [motivacion, setMotivacion] = useState('');
  const [historia, setHistoria] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep9(draftId, {
        rasgo_distintivo: rasgoDistintivo.trim() || null,
        defecto: defecto.trim() || null,
        motivacion: motivacion.trim() || null,
        historia: historia.trim() || null,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 9:', err);
      setError('No se pudieron guardar los detalles');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="step-9-details">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Detalles Finales
        </h2>
        <p className="text-muted-foreground">
          Define la personalidad y motivaciones de tu personaje
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
              {draft?.trasfondo_nombre} · {draft?.virtud_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Personality Form */}
      <div className="card-parchment rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Feather className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Personalidad
          </h3>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rasgo" className="text-[hsl(var(--parchment))]">
            Rasgo Distintivo
          </Label>
          <Input
            id="rasgo"
            value={rasgoDistintivo}
            onChange={(e) => setRasgoDistintivo(e.target.value)}
            placeholder="Ej: Siempre sonríe ante el peligro..."
            className="bg-input border-border"
            data-testid="rasgo-input"
          />
          <p className="text-xs text-muted-foreground">
            Una característica notable de tu personalidad
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defecto" className="text-[hsl(var(--parchment))]">
            Defecto
          </Label>
          <Input
            id="defecto"
            value={defecto}
            onChange={(e) => setDefecto(e.target.value)}
            placeholder="Ej: Confío demasiado en los extraños..."
            className="bg-input border-border"
            data-testid="defecto-input"
          />
          <p className="text-xs text-muted-foreground">
            Una debilidad o tendencia problemática
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motivacion" className="text-[hsl(var(--parchment))]">
            Motivación
          </Label>
          <Input
            id="motivacion"
            value={motivacion}
            onChange={(e) => setMotivacion(e.target.value)}
            placeholder="Ej: Proteger a los inocentes de la Sombra..."
            className="bg-input border-border"
            data-testid="motivacion-input"
          />
          <p className="text-xs text-muted-foreground">
            Lo que impulsa a tu personaje a aventurarse
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="historia" className="text-[hsl(var(--parchment))]">
            Historia Personal (opcional)
          </Label>
          <Textarea
            id="historia"
            value={historia}
            onChange={(e) => setHistoria(e.target.value)}
            placeholder="Cuenta la historia de tu personaje... ¿De dónde viene? ¿Qué eventos han marcado su vida? ¿Por qué se ha convertido en aventurero?"
            className="bg-input border-border min-h-[150px]"
            data-testid="historia-input"
          />
        </div>
      </div>

      {/* Quick Ideas */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-sm text-[hsl(var(--magic-blue))] mb-3">
          Ideas de Rasgos Distintivos
        </h4>
        <div className="flex flex-wrap gap-2">
          {[
            'Siempre optimista',
            'Cauteloso en extremo',
            'Curioso insaciable',
            'Honor inquebrantable',
            'Protector de los débiles',
            'Amante de las historias',
          ].map((idea) => (
            <button
              key={idea}
              onClick={() => setRasgoDistintivo(idea)}
              className="text-xs px-3 py-1 rounded-full bg-secondary hover:bg-[hsl(var(--gold))/20] text-muted-foreground hover:text-foreground transition-colors"
            >
              {idea}
            </button>
          ))}
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
          data-testid="step-9-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-9-next-btn"
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

export default Step9Details;
