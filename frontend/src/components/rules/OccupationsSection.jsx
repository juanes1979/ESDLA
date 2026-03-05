/**
 * Occupations Section Component
 * Displays detailed occupation/class information with expandable cards
 */
import { useState } from 'react';
import { Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Section helper component for consistent styling
const Section = ({ title, children }) => (
  <div>
    <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-2">{title}</h4>
    {children}
  </div>
);

const OccupationsSection = ({ 
  data = [], 
  isAdmin = false, 
  searchTerm = '', 
  onEdit,
  onDelete 
}) => {
  // State for expanded cards
  const [expandedOccupation, setExpandedOccupation] = useState(null);

  // Ensure occupations is always an array
  const occupations = Array.isArray(data) ? data : [];

  // Filter occupations by search term
  const filterData = (items, term) => {
    if (!term || !items) return items;
    const lower = term.toLowerCase();
    return items.filter(item => {
      const name = item.vocacion || '';
      const description = item.descripcion_corta || '';
      return name.toLowerCase().includes(lower) || description.toLowerCase().includes(lower);
    });
  };

  const filteredOccupations = filterData(occupations, searchTerm);

  // Render occupation detail
  const renderOccupationDetail = (occ) => {
    const isExpanded = expandedOccupation === occ.id;
    
    return (
      <div key={occ.id} className="card-parchment rounded-lg p-4 mb-4" data-testid={`occupation-${occ.id}`}>
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setExpandedOccupation(isExpanded ? null : occ.id)}
        >
          <div className="flex-1">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{occ.vocacion}</h3>
            <span className="text-xs bg-black/30 px-2 py-1 rounded">
              {occ.dado_golpe} • PG {occ.puntos_golpe_base}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(occ); }}
                  data-testid={`edit-occupation-${occ.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(occ.id, occ.vocacion); }}
                  data-testid={`delete-occupation-${occ.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {occ.descripcion_corta && (
              <p className="text-sm text-muted-foreground italic">{occ.descripcion_corta}</p>
            )}
            
            {occ.descripcion_ocupacion_larga && (
              <p className="text-sm text-muted-foreground">{occ.descripcion_ocupacion_larga}</p>
            )}
            
            <Section title="Características y Salvaciones">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Características Principales:</p>
                  <p className="text-[hsl(var(--gold))]">{occ.caracteristicas_principales?.join(', ') || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tiradas de Salvación:</p>
                  <p className="text-[hsl(var(--gold))]">{occ.tiradas_salvacion?.join(', ') || '-'}</p>
                </div>
              </div>
            </Section>

            <Section title="Competencias">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Armas:</p>
                  <p>{occ.competencia_armas?.join(', ') || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Armaduras:</p>
                  <p>{occ.competencia_armaduras?.join(', ') || '-'}</p>
                </div>
              </div>
            </Section>

            {/* Especiales de ocupación */}
            {(occ.especiales_ocupacion1 || occ.especiales_ocupacion2 || occ.especiales_ocupacion3) && (
              <Section title="Habilidades Especiales">
                <div className="space-y-2">
                  {occ.especiales_ocupacion1 && (
                    <div className="bg-black/10 p-2 rounded">
                      <p className="text-sm font-bold text-[hsl(var(--gold))]">{occ.especiales_ocupacion1}</p>
                      {occ.especiales_ocupacion1_descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{occ.especiales_ocupacion1_descripcion}</p>
                      )}
                    </div>
                  )}
                  {occ.especiales_ocupacion2 && (
                    <div className="bg-black/10 p-2 rounded">
                      <p className="text-sm font-bold text-[hsl(var(--gold))]">{occ.especiales_ocupacion2}</p>
                      {occ.especiales_ocupacion2_descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{occ.especiales_ocupacion2_descripcion}</p>
                      )}
                    </div>
                  )}
                  {occ.especiales_ocupacion3 && (
                    <div className="bg-black/10 p-2 rounded">
                      <p className="text-sm font-bold text-[hsl(var(--gold))]">{occ.especiales_ocupacion3}</p>
                      {occ.especiales_ocupacion3_descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{occ.especiales_ocupacion3_descripcion}</p>
                      )}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Senda de la Sombra */}
            {occ.maldicion_nombre && (
              <Section title="Senda de la Sombra">
                <div className="bg-[hsl(var(--destructive))/10] p-3 rounded">
                  <p className="text-sm font-bold text-[hsl(var(--destructive))]">{occ.maldicion_nombre}</p>
                  {occ.maldicion_descripcion && (
                    <p className="text-xs text-muted-foreground mt-1">{occ.maldicion_descripcion}</p>
                  )}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!filteredOccupations?.length) {
    return <p className="text-muted-foreground">No se encontraron ocupaciones</p>;
  }

  return (
    <div className="space-y-4" data-testid="occupations-section">
      {filteredOccupations.map(renderOccupationDetail)}
    </div>
  );
};

export default OccupationsSection;
