/**
 * Background Card - Background info with personal history
 */
import { Scroll, Crown } from 'lucide-react';

const BackgroundCard = ({ character, background }) => {
  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
        <Scroll className="w-5 h-5" />
        Trasfondo
      </h3>
      <div className="space-y-2">
        <div className="bg-secondary rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Trasfondo</p>
          <p className="text-foreground font-medium">{character.trasfondo_nombre}</p>
        </div>
        
        {/* Historia generada por IA o descripción del trasfondo */}
        {(character.historia || character.descripcion_trasfondo || background?.descripcion) && (
          <div className="bg-secondary/50 rounded-lg p-3 border-l-2 border-[hsl(var(--gold))/50]">
            <p className="text-xs text-[hsl(var(--gold))] mb-1">Historia Personal</p>
            <p className="text-muted-foreground text-sm italic leading-relaxed">
              {character.historia || character.descripcion_trasfondo || background?.descripcion}
            </p>
          </div>
        )}
        
        {character.virtud_nombre && (
          <div className="bg-secondary rounded-lg p-3" data-testid="summary-virtud-block">
            <p className="text-xs text-muted-foreground">Virtud</p>
            <p className="text-foreground font-medium">{character.virtud_nombre}</p>
            {character.virtud_descripcion && (
              <p className="text-muted-foreground text-xs mt-1 italic">
                {character.virtud_descripcion}
              </p>
            )}
            {character.virtud_rasgos && character.virtud_rasgos !== character.virtud_descripcion && (
              <p className="text-muted-foreground text-xs mt-1">
                {character.virtud_rasgos}
              </p>
            )}
            {(() => {
              // Reúne TODO lo que la virtud aporta al personaje para mostrarlo en chips.
              const chips = [];
              const STAT_ABBR = {
                fuerza: 'FUE', destreza: 'DES', constitucion: 'CON',
                inteligencia: 'INT', sabiduria: 'SAB', carisma: 'CAR',
              };
              // Aumentos fijos de característica.
              const fijas = character.virtud_caracteristicas_fijas || {};
              Object.entries(fijas).forEach(([attr, val]) => {
                if (val) chips.push(`+${val} ${STAT_ABBR[attr] || attr.toUpperCase()}`);
              });
              // Característica elegida (+1).
              const elegida = character.virtud_caracteristica_elegida ||
                (Array.isArray(character.virtud_caracteristicas_elegir) ? character.virtud_caracteristicas_elegir[0] : null);
              if (elegida) chips.push(`+1 ${elegida}`);
              // Bonos numéricos.
              if (character.virtud_pg_extra) chips.push(`+${character.virtud_pg_extra} PG`);
              if (character.virtud_ca_extra) chips.push(`+${character.virtud_ca_extra} CA`);
              if (character.virtud_comunidad_extra) chips.push(`+${character.virtud_comunidad_extra} Comunidad`);
              return chips.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-2" data-testid="summary-virtud-bonos">
                  {chips.map((c, i) => (
                    <span key={i} className="text-[10px] bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] px-2 py-0.5 rounded border border-[hsl(var(--gold))/30]">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
            {/* Competencias otorgadas por la virtud */}
            {Array.isArray(character.virtud_habilidades_elegir) && character.virtud_habilidades_elegir.filter(Boolean).length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="text-[hsl(var(--magic-blue))]">Habilidad:</span> {character.virtud_habilidades_elegir.filter(Boolean).join(', ')}
              </p>
            )}
            {Array.isArray(character.virtud_salvaciones_elegir) && character.virtud_salvaciones_elegir.filter(Boolean).length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-[hsl(var(--magic-blue))]">Salvación:</span> {character.virtud_salvaciones_elegir.filter(Boolean).join(', ')}
              </p>
            )}
            {Array.isArray(character.virtud_herramientas_elegir) && character.virtud_herramientas_elegir.filter(Boolean).length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-[hsl(var(--magic-blue))]">Herramienta:</span> {character.virtud_herramientas_elegir.filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        )}
        {character.patron_nombre && (
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Crown className="w-3 h-3" /> Mecenas
            </p>
            <p className="text-foreground">{character.patron_nombre}</p>
            <p className="text-xs text-[hsl(var(--magic-blue))]">
              Puntos de Comunidad: {character.puntos_comunidad || 0}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BackgroundCard;
