/**
 * Cultures Section Component
 * Displays detailed culture information with expandable cards
 */
import { useState, useEffect, useCallback } from 'react';
import { Edit, Trash2, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/services/api';

// Section helper component for consistent styling
const Section = ({ title, children }) => (
  <div>
    <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-2">{title}</h4>
    {children}
  </div>
);

const CulturesSection = ({ 
  data = [], 
  isAdmin = false, 
  searchTerm = '', 
  onEdit,
  onDelete,
  onRefresh 
}) => {
  // State for expanded cards
  const [expandedCulture, setExpandedCulture] = useState(null);
  const [cultureVirtues, setCultureVirtues] = useState({});
  const [cultureNames, setCultureNames] = useState({});

  // Ensure cultures is always an array
  const cultures = Array.isArray(data) ? data : [];

  // Load culture names when component mounts
  useEffect(() => {
    const loadNames = async () => {
      try {
        const uniqueCultures = [...new Set(cultures.map(c => c.nombre))];
        const namesData = {};
        
        for (const nombre of uniqueCultures) {
          try {
            const res = await api.get(`/data/nombres/${encodeURIComponent(nombre)}`);
            namesData[nombre] = res.data;
          } catch {
            // Culture might not have names
          }
        }
        setCultureNames(namesData);
      } catch (err) {
        console.error('Error loading culture names:', err);
      }
    };
    
    if (cultures.length > 0) {
      loadNames();
    }
  }, [cultures]);

  // Load virtues for a specific culture
  const loadCultureVirtues = useCallback(async (cultureId) => {
    try {
      const res = await api.get(`/data/cultures/${cultureId}/virtues`);
      setCultureVirtues(prev => ({
        ...prev,
        [cultureId]: res.data
      }));
    } catch (err) {
      console.error('Error loading culture virtues:', err);
    }
  }, []);

  // Filter cultures by search term
  const filterData = (items, term) => {
    if (!term || !items) return items;
    const lower = term.toLowerCase();
    return items.filter(item => {
      const name = item.nombre || '';
      const race = item.raza || '';
      return name.toLowerCase().includes(lower) || race.toLowerCase().includes(lower);
    });
  };

  const filteredCultures = filterData(cultures, searchTerm);

  // Render culture detail
  const renderCultureDetail = (culture) => {
    const isExpanded = expandedCulture === culture.id;
    const names = cultureNames[culture.nombre] || {};
    const virtues = cultureVirtues[culture.id] || [];

    // Load virtues when expanded and has initial virtue
    if (isExpanded && culture.tiene_virtud_inicial && !cultureVirtues[culture.id]) {
      loadCultureVirtues(culture.id);
    }
    
    return (
      <div key={culture.id} className="card-parchment rounded-lg p-4 mb-4" data-testid={`culture-${culture.id}`}>
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setExpandedCulture(isExpanded ? null : culture.id)}
        >
          <div className="flex-1">
            <h3 className="font-heading text-xl text-[hsl(var(--gold))]">{culture.nombre}</h3>
            <span className="text-xs bg-black/30 px-2 py-1 rounded">{culture.raza}</span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); onEdit?.(culture); }}
                  data-testid={`edit-culture-${culture.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete?.(culture.id, culture.nombre); }}
                  data-testid={`delete-culture-${culture.id}`}
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
            {/* Descripción */}
            <p className="text-sm text-muted-foreground italic">{culture.descripcion || culture.descripcion_cultura}</p>
            
            {/* NIVEL DE VIDA / RIQUEZA */}
            <Section title="Nivel de Vida">
              <p className="text-sm"><span className="text-[hsl(var(--torch-orange))] font-bold">{culture.nivel_vida || culture.riqueza || 'Común'}</span></p>
              {culture.descripcion_riqueza && (
                <p className="text-xs text-muted-foreground mt-1">{culture.descripcion_riqueza}</p>
              )}
            </Section>

            {/* CARACTERÍSTICAS FÍSICAS BÁSICAS */}
            <Section title="Características Físicas">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Edad</span>
                  <p className="font-bold">{culture.edad_min} - {culture.edad_max} años</p>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Altura</span>
                  <p className="font-bold">{culture.altura_min} - {culture.altura_max} cm</p>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Velocidad</span>
                  <p className="font-bold">{culture.velocidad} m</p>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Descanso</span>
                  <p className="font-bold">{culture.descanso} horas</p>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Tamaño</span>
                  <p className="font-bold">{culture.tamanio}</p>
                </div>
                <div className="bg-black/20 p-2 rounded">
                  <span className="text-[hsl(var(--gold))] text-xs">Mod. Peso</span>
                  <p className="font-bold">{culture.mod_peso || 0}%</p>
                </div>
                {culture.imc && (
                  <div className="bg-black/20 p-2 rounded">
                    <span className="text-[hsl(var(--gold))] text-xs">IMC Base</span>
                    <p className="font-bold">{culture.imc.min} - {culture.imc.max}</p>
                  </div>
                )}
              </div>
            </Section>

            {/* RASGOS FÍSICOS (Ojos, Piel, Pelo) */}
            {culture.rasgos_fisicos && (
              <Section title="Rasgos Físicos">
                <div className="grid md:grid-cols-3 gap-3 text-xs">
                  {culture.rasgos_fisicos.ojos?.length > 0 && (
                    <div className="bg-black/20 p-2 rounded">
                      <span className="text-[hsl(var(--gold))]">Ojos:</span>
                      <p className="text-muted-foreground mt-1">{[...new Set(culture.rasgos_fisicos.ojos)].join(', ')}</p>
                    </div>
                  )}
                  {culture.rasgos_fisicos.piel?.length > 0 && (
                    <div className="bg-black/20 p-2 rounded">
                      <span className="text-[hsl(var(--gold))]">Piel:</span>
                      <p className="text-muted-foreground mt-1">{[...new Set(culture.rasgos_fisicos.piel)].join(', ')}</p>
                    </div>
                  )}
                  {culture.rasgos_fisicos.pelo?.length > 0 && (
                    <div className="bg-black/20 p-2 rounded">
                      <span className="text-[hsl(var(--gold))]">Pelo:</span>
                      <p className="text-muted-foreground mt-1">{[...new Set(culture.rasgos_fisicos.pelo)].join(', ')}</p>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* BONIFICADORES DE CARACTERÍSTICAS */}
            <Section title="Bonificadores de Características">
              <div className="flex flex-wrap gap-2">
                {culture.bonificadores_caracteristicas && Object.entries(culture.bonificadores_caracteristicas).map(([attr, val]) => (
                  <span key={attr} className={`text-sm px-3 py-1 rounded ${val > 0 ? 'bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] font-bold' : 'bg-black/20 text-muted-foreground'}`}>
                    {attr.charAt(0).toUpperCase() + attr.slice(1)}: {val >= 0 ? '+' : ''}{val}
                  </span>
                ))}
              </div>
              {culture.bonificador_a_eleccion && (
                <p className="text-xs text-[hsl(var(--torch-orange))] mt-2">★ Puede elegir +1 en una característica adicional</p>
              )}
            </Section>

            {/* HABILIDADES SEGÚN CULTURA */}
            {culture.habilidades_puntuaciones && (
              <Section title="Puntuaciones de Habilidades por Cultura">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                  {Object.entries(culture.habilidades_puntuaciones).sort((a, b) => b[1] - a[1]).map(([hab, val]) => (
                    <div key={hab} className={`px-2 py-1 rounded ${val > 0 ? 'bg-[hsl(var(--gold))/10]' : 'bg-black/10'}`}>
                      <span className={val > 0 ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'}>{hab}: {val}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* IDIOMAS */}
            <Section title="Idiomas">
              {culture.idiomas?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {culture.idiomas.map((idioma, i) => (
                    <span key={i} className="text-sm bg-black/20 px-3 py-1 rounded">{idioma}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin idiomas especiales</p>
              )}
            </Section>

            {/* COMPETENCIAS EN HABILIDADES */}
            <Section title="Competencias en Habilidades">
              {culture.competencias_habilidades?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {culture.competencias_habilidades.map((comp, i) => (
                    <span key={i} className="text-sm bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-3 py-1 rounded">{comp}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin competencias automáticas</p>
              )}
            </Section>

            {/* COMPETENCIAS A ELEGIR */}
            <Section title="Competencias a Elegir">
              <div className="space-y-3">
                {/* Herramientas 1 */}
                <div className="bg-black/10 p-2 rounded">
                  <span className="text-xs text-[hsl(var(--gold))]">Herramienta (Opción 1):</span>
                  {culture.competencia_herramienta_elegir_1?.length > 0 ? (
                    <p className="text-sm mt-1">{culture.competencia_herramienta_elegir_1.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">La cultura seleccionada no tiene competencia adicional en este nivel</p>
                  )}
                </div>
                {/* Herramientas 2 */}
                <div className="bg-black/10 p-2 rounded">
                  <span className="text-xs text-[hsl(var(--gold))]">Herramienta (Opción 2):</span>
                  {culture.competencia_herramienta_elegir_2?.length > 0 ? (
                    <p className="text-sm mt-1">{culture.competencia_herramienta_elegir_2.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">La cultura seleccionada no tiene competencia adicional en este nivel</p>
                  )}
                </div>
                {/* Habilidades a elegir */}
                <div className="bg-black/10 p-2 rounded">
                  <span className="text-xs text-[hsl(var(--gold))]">Habilidad a Elegir:</span>
                  {culture.competencia_habilidad_elegir?.length > 0 ? (
                    <p className="text-sm mt-1">{culture.competencia_habilidad_elegir.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">La cultura seleccionada no tiene competencia adicional en este nivel</p>
                  )}
                </div>
              </div>
            </Section>

            {/* COMPETENCIA ADICIONAL */}
            <Section title="Competencia Adicional">
              {culture.competencia_adicional ? (
                <p className="text-sm bg-[hsl(var(--torch-orange))/10] text-[hsl(var(--torch-orange))] px-3 py-2 rounded">{culture.competencia_adicional}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Sin competencia adicional</p>
              )}
            </Section>

            {/* RASGOS CULTURALES */}
            <Section title="Rasgos Culturales">
              {culture.rasgos_culturales?.length > 0 ? (
                <ul className="space-y-2">
                  {culture.rasgos_culturales.map((rasgo, i) => (
                    <li key={i} className="text-sm bg-black/10 p-2 rounded">
                      <span className="text-foreground">{rasgo}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Sin rasgos culturales especiales</p>
              )}
            </Section>

            {/* ESPECIALES DE CULTURA */}
            <Section title="Especiales de Cultura">
              <div className="space-y-2">
                {/* Puntos de golpe por nivel */}
                <div className="bg-black/10 p-2 rounded flex justify-between items-center">
                  <span className="text-sm">Puntos de Golpe extra por nivel:</span>
                  {culture.pg_extra_nivel ? (
                    <span className="text-[hsl(var(--gold))] font-bold">+{culture.pg_extra_nivel} PG</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">0</span>
                  )}
                </div>
                
                {/* Capacidad de carga */}
                <div className="bg-black/10 p-2 rounded flex justify-between items-center">
                  <span className="text-sm">Capacidad de carga x2:</span>
                  {culture.capacidad_carga_x2 ? (
                    <span className="text-[hsl(var(--gold))] font-bold">Sí</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">No</span>
                  )}
                </div>
                
                {/* Virtud inicial */}
                <div className="bg-black/10 p-2 rounded flex justify-between items-center">
                  <span className="text-sm">Virtud al nivel 1:</span>
                  {culture.tiene_virtud_inicial ? (
                    <span className="text-[hsl(var(--torch-orange))] font-bold">Sí</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">No</span>
                  )}
                </div>
                
                {/* Mejora Noldor (específico) */}
                {culture.mejora_noldor && (
                  <div className="bg-[hsl(var(--magic-blue))/20] p-2 rounded">
                    <span className="text-sm text-[hsl(var(--magic-blue))]">★ Mejora Noldor disponible</span>
                  </div>
                )}
              </div>
            </Section>

            {/* VIRTUDES DISPONIBLES (si tiene virtud inicial) */}
            {culture.tiene_virtud_inicial && (
              <Section title="Virtudes Disponibles (Nivel 1)">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Los personajes de esta cultura pueden elegir una de las siguientes virtudes al nivel 1:
                    {culture.permite_virtudes_comunes && (
                      <span className="text-[hsl(var(--gold))] ml-1">(+ virtudes comunes)</span>
                    )}
                  </p>
                  {virtues.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-2">
                      {virtues.map(v => (
                        <div key={v.id} className="bg-[hsl(var(--torch-orange))/10] p-2 rounded border border-[hsl(var(--torch-orange))/30]">
                          <p className="text-sm font-bold text-[hsl(var(--torch-orange))]">{v.nombre}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{v.descripcion}</p>
                          {v.rasgos_virtud && (
                            <p className="text-xs text-[hsl(var(--gold))] mt-1 line-clamp-1">
                              {v.rasgos_virtud}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cargando virtudes...
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* NOMBRES (Prefijos, Sufijos, Apellidos) */}
            {names && (names.hombre || names.mujer || names.apellidos) && (
              <Section title="Nombres de la Cultura">
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  {names.hombre && (
                    <div className="bg-black/10 p-3 rounded">
                      <p className="text-[hsl(var(--gold))] font-bold mb-2">♂ Nombres Masculinos</p>
                      <p><span className="text-muted-foreground">Prefijos:</span> {[...new Set(names.hombre.prefijos || [])].join(', ')}</p>
                      <p className="mt-1"><span className="text-muted-foreground">Sufijos:</span> {[...new Set(names.hombre.sufijos || [])].join(', ')}</p>
                    </div>
                  )}
                  {names.mujer && (
                    <div className="bg-black/10 p-3 rounded">
                      <p className="text-[hsl(var(--gold))] font-bold mb-2">♀ Nombres Femeninos</p>
                      <p><span className="text-muted-foreground">Prefijos:</span> {[...new Set(names.mujer.prefijos || [])].join(', ')}</p>
                      <p className="mt-1"><span className="text-muted-foreground">Sufijos:</span> {[...new Set(names.mujer.sufijos || [])].join(', ')}</p>
                    </div>
                  )}
                </div>
                {names.apellidos?.length > 0 && (
                  <div className="bg-black/10 p-3 rounded mt-2">
                    <p className="text-[hsl(var(--gold))] font-bold mb-2">Apellidos</p>
                    <p className="text-muted-foreground">{[...new Set(names.apellidos)].join(', ')}</p>
                  </div>
                )}
              </Section>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!filteredCultures?.length) {
    return <p className="text-muted-foreground">No se encontraron culturas</p>;
  }

  return (
    <div className="space-y-4" data-testid="cultures-section">
      {filteredCultures.map(renderCultureDetail)}
    </div>
  );
};

export default CulturesSection;
