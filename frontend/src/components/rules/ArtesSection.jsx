/**
 * Arts Section Component
 * Displays special arts/abilities that characters can use
 */
import { useMemo } from 'react';
import { BookOpen, Sparkles, AlertTriangle } from 'lucide-react';

const ArtesSection = ({ data = [], searchTerm = '' }) => {
  // Filter arts based on search
  const filteredArts = useMemo(() => {
    if (!data?.length) return [];
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(arte =>
      arte.nombre?.toLowerCase().includes(term) ||
      arte.descripcion?.toLowerCase().includes(term) ||
      arte.descripcion_corta?.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  if (!data?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No hay artes cargadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="artes-section">
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Artes ({filteredArts.length})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Las Artes son habilidades especiales que los personajes pueden utilizar en situaciones de juego. 
          Cada uso de un Arte consume un espacio de arte.
        </p>
        
        <div className="space-y-6">
          {filteredArts.map((arte, i) => (
            <ArteCard key={arte._id || i} arte={arte} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Individual art card
const ArteCard = ({ arte, index }) => {
  return (
    <div className="bg-black/10 p-4 rounded border border-border/20" data-testid={`arte-${index}`}>
      <p className="font-bold text-[hsl(var(--torch-orange))] text-lg mb-2">{arte.nombre}</p>
      
      {/* Short description */}
      {arte.descripcion_corta && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-[hsl(var(--gold))/50] pl-3 mb-3">
          {arte.descripcion_corta}
        </p>
      )}
      
      {/* Full description */}
      {arte.descripcion && (
        <div className="mt-3 p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/20]">
          {arte.descripcion.split('\n\n').map((paragraph, pIdx) => (
            <p key={pIdx} className="text-sm mb-2 last:mb-0 whitespace-pre-wrap">
              {paragraph}
            </p>
          ))}
        </div>
      )}
      
      {/* Requirements */}
      {arte.requisitos?.length > 0 && (
        <div className="mt-3 p-3 bg-[hsl(var(--destructive))/10] rounded border border-[hsl(var(--destructive))/20]">
          <p className="text-xs font-bold text-[hsl(var(--destructive))] mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Requisitos
          </p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {arte.requisitos.map((req, rIdx) => (
              <li key={rIdx}>{req}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Options */}
      {arte.opciones?.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold text-[hsl(var(--gold))] mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Opciones de uso
          </p>
          {arte.opciones.map((opcion, oIdx) => (
            <ArteOption key={oIdx} opcion={opcion} />
          ))}
        </div>
      )}
      
      {/* Level 5 improvement (general) */}
      {arte.nivel_5 && (
        <div className="mt-3 p-3 bg-cyan-500/10 rounded border border-cyan-500/30">
          <p className="text-sm">
            <strong className="text-cyan-400">Al alcanzar nivel 5:</strong> {arte.nivel_5}
          </p>
        </div>
      )}
      
      {/* Special rules */}
      {arte.reglas_especiales?.length > 0 && (
        <div className="mt-3 p-3 bg-black/20 rounded border border-border/30">
          <p className="text-xs font-bold text-muted-foreground mb-2">Reglas Especiales</p>
          <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
            {arte.reglas_especiales.map((regla, rIdx) => (
              <li key={rIdx}>{regla}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Doom types (for Rune Art) */}
      {arte.tipos_perdicion?.length > 0 && (
        <div className="mt-3 p-2 bg-[hsl(var(--destructive))/10] rounded">
          <p className="text-xs font-bold text-[hsl(var(--destructive))]">Tipos de Perdición disponibles:</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {arte.tipos_perdicion.map((tipo, tIdx) => (
              <span key={tIdx} className="px-2 py-0.5 bg-[hsl(var(--destructive))/20] rounded text-xs">
                {tipo}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Art option subcomponent
const ArteOption = ({ opcion }) => {
  return (
    <div className="p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/20]">
      <p className="font-semibold text-[hsl(var(--gold))]">{opcion.tipo}</p>
      <p className="text-sm mt-1">{opcion.efecto}</p>
      
      {opcion.exito && (
        <p className="text-sm mt-1 text-green-400">
          <strong>Éxito:</strong> {opcion.exito}
        </p>
      )}
      
      {opcion.exito_magico && (
        <p className="text-sm mt-1 text-purple-400">
          <strong>Éxito Mágico:</strong> {opcion.exito_magico}
        </p>
      )}
      
      {opcion.ejemplos && (
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Ejemplos:</strong> {opcion.ejemplos.join(', ')}
        </p>
      )}
      
      {opcion.nota && (
        <p className="text-xs text-yellow-400/80 mt-1 italic">
          {opcion.nota}
        </p>
      )}
      
      {opcion.nivel_5 && (
        <p className="text-xs text-cyan-400 mt-2">
          <strong>Nivel 5:</strong> {opcion.nivel_5}
        </p>
      )}
      
      {opcion.alternativa && (
        <p className="text-sm mt-2 p-2 bg-black/20 rounded">
          <strong>Alternativa:</strong> {opcion.alternativa}
        </p>
      )}
    </div>
  );
};

export default ArtesSection;
