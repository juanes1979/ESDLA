/**
 * JourneyHeader — Cabecera de la pantalla /travel.
 *
 * Extraída de `EnhancedTravelSystem.jsx` durante el refactor P1 (Mayo 2026).
 * Render puro sin estado. Muestra el botón "Inicio", el título y un
 * `Badge` con el modo actual del viaje.
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Compass } from 'lucide-react';

const MODE_LABELS = {
  global: 'Jornada a Jornada',
  dayByDay: 'Jornada a Jornada',
  results: 'Resultados',
};

export const JourneyHeader = ({ mode }) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-4">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="text-muted-foreground hover:text-white"
      >
        <a href="/">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Inicio
        </a>
      </Button>
      <h1 className="text-3xl font-heading text-[hsl(var(--gold))]">
        <Compass className="w-8 h-8 inline mr-3" />
        Generador de Viajes
      </h1>
    </div>
    {mode !== 'config' && (
      <Badge variant="outline" className="text-lg" data-testid="journey-mode-badge">
        {MODE_LABELS[mode] || mode}
      </Badge>
    )}
  </div>
);

export default JourneyHeader;
