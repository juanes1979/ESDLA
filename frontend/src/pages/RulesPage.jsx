/**
 * Rules Page - Game rules organized by category with complete data display
 * Includes CRUD for Races, Cultures, Backgrounds, Occupations (admin only)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Swords, Shield, BookOpen, Sparkles, Moon, Map, Loader2, Package, Search, ChevronDown, ChevronUp, Plus, Copy, Edit, User, Scroll } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getCultures, getOccupations, getVirtues, getEquipmentCatalog, getBackgrounds } from '@/services/api';
import api from '@/services/api';

const RULE_CATEGORIES = [
  { id: 'cultures', name: 'Culturas', icon: Users, color: 'gold', description: 'Las razas y pueblos de la Tierra Media' },
  { id: 'backgrounds', name: 'Trasfondos', icon: Scroll, color: 'torch-orange', description: 'Los orígenes y oficios previos' },
  { id: 'occupations', name: 'Ocupaciones', icon: Swords, color: 'magic-blue', description: 'Las vocaciones heroicas' },
  { id: 'virtues', name: 'Virtudes', icon: Sparkles, color: 'torch-orange', description: 'Dones especiales por cultura' },
  { id: 'equipment', name: 'Precios de Equipo', icon: Package, color: 'gold', description: 'Lista completa con precios y pesos' },
  { id: 'shadow', name: 'Sombra', icon: Moon, color: 'destructive', description: 'La corrupción y sus efectos' },
  { id: 'travel', name: 'Viajes', icon: Map, color: 'gold', description: 'Reglas de exploración' },
  { id: 'community', name: 'Comunidad', icon: Shield, color: 'magic-blue', description: 'Puntos de comunidad y mecenas' },
];

// Currency display helper
const formatPrice = (precio, moneda) => {
  if (!precio) return '-';
  return `${precio} ${moneda || 'mp'}`;
};

// Section component for culture details
const Section = ({ title, children, className = '' }) => (
  <div className={`mb-4 ${className}`}>
    <h4 className="text-sm font-heading text-[hsl(var(--gold))] mb-2 border-b border-[hsl(var(--gold))/30] pb-1">{title}</h4>
    {children}
  </div>
);

const RulesPage = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCulture, setExpandedCulture] = useState(null);
  const [expandedOccupation, setExpandedOccupation] = useState(null);
  const [expandedBackground, setExpandedBackground] = useState(null);
  const [cultureNames, setCultureNames] = useState({});

  // Load data when category changes
  useEffect(() => {
    const loadData = async () => {
      if (!selectedCategory) return;
      
      setLoading(true);
      setSearchTerm('');
      try {
        switch (selectedCategory) {
          case 'cultures':
            const cultures = await getCultures();
            setData(cultures);
            // Also load all culture names
            try {
              const namesRes = await api.get('/data/names');
              const namesMap = {};
              (namesRes.data?.names || []).forEach(n => {
                namesMap[n.cultura] = n;
              });
              setCultureNames(namesMap);
            } catch (err) {
              console.warn('Could not load culture names:', err);
            }
            break;
          case 'backgrounds':
            const backgrounds = await getBackgrounds();
            setData(backgrounds);
            break;
          case 'occupations':
            const occupations = await getOccupations();
            setData(occupations);
            break;
          case 'virtues':
            const virtues = await getVirtues();
            setData(virtues);
            break;
          case 'equipment':
            const equipment = await getEquipmentCatalog();
            setData(equipment);
            break;
          default:
            setData(null);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedCategory]);

  // Filter data by search term
  const filterData = (items, term) => {
    if (!term || !items) return items;
    const lower = term.toLowerCase();
    return items.filter(item => {
      const name = item.nombre || item.vocacion || '';
      return name.toLowerCase().includes(lower);
    });
  };

  // COMPLETE Culture Detail Renderer
  const renderCultureDetail = (culture) => {
    const isExpanded = expandedCulture === culture.id;
    const names = cultureNames[culture.nombre] || {};
    
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
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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

  // Background Detail Renderer
  const renderBackgroundDetail = (bg) => {
    const isExpanded = expandedBackground === bg.id;
    
    return (
      <div key={bg.id} className="card-parchment rounded-lg p-4 mb-4" data-testid={`background-${bg.id}`}>
        <div 
          className="flex justify-between items-start cursor-pointer"
          onClick={() => setExpandedBackground(isExpanded ? null : bg.id)}
        >
          <div className="flex-1">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{bg.nombre}</h3>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        
        {isExpanded && (
          <div className="mt-4 space-y-4">
            {bg.descripcion && (
              <p className="text-sm text-muted-foreground italic">{bg.descripcion}</p>
            )}
            
            {/* Competencias Habilidades */}
            <Section title="Competencias en Habilidades">
              {bg.competencias_habilidades_auto?.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground">Automáticas: </span>
                  <span className="text-sm">{bg.competencias_habilidades_auto.join(', ')}</span>
                </div>
              )}
              {bg.competencias_habilidades_elegir?.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground">A elegir (1): </span>
                  <span className="text-sm">{bg.competencias_habilidades_elegir.join(', ')}</span>
                </div>
              )}
            </Section>

            {/* Competencias Herramientas */}
            <Section title="Competencias en Herramientas">
              {(bg.competencias_herramientas_1?.length > 0 || bg.competencias_herramientas_2?.length > 0) ? (
                <div className="space-y-2">
                  {bg.competencias_herramientas_1?.length > 0 && (
                    <p className="text-sm">{bg.competencias_herramientas_1.join(', ')}</p>
                  )}
                  {bg.competencias_herramientas_2?.length > 0 && (
                    <p className="text-sm">{bg.competencias_herramientas_2.join(', ')}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin competencias en herramientas</p>
              )}
            </Section>

            {/* Rasgos */}
            {bg.rasgos_descripciones?.length > 0 && (
              <Section title="Rasgos del Trasfondo">
                <ul className="space-y-2">
                  {bg.rasgos_descripciones.map((rasgo, i) => (
                    <li key={i} className="text-sm bg-black/10 p-2 rounded">{rasgo}</li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    );
  };

  // Occupation Detail Renderer
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
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
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
            {(occ.especiales_ocupacion1 || occ.especiales_ocupacion2) && (
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

  // Render equipment tables
  const renderEquipmentTables = () => {
    if (!data) return null;
    
    const categories = [
      { key: 'armas', name: 'Armas', fields: ['nombre', 'precio', 'dano', 'herida', 'peso_kg'] },
      { key: 'armaduras', name: 'Armaduras', fields: ['nombre', 'precio', 'armadura', 'peso_kg'] },
      { key: 'escudos', name: 'Escudos', fields: ['nombre', 'precio', 'armadura', 'peso_kg'] },
      { key: 'equipo_general', name: 'Equipo General', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'herramientas', name: 'Herramientas', fields: ['nombre', 'precio', 'peso_kg'] },
      { key: 'monturas', name: 'Monturas', fields: ['nombre', 'precio', 'velocidad', 'capacidad_carga'] },
    ];

    return (
      <div className="space-y-6">
        {categories.map(cat => {
          const items = data[cat.key];
          if (!items?.length) return null;
          
          const filtered = filterData(items, searchTerm);
          
          return (
            <div key={cat.key} className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">{cat.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2 px-2">Nombre</th>
                      <th className="text-right py-2 px-2">Precio</th>
                      {cat.fields.includes('dano') && <th className="text-center py-2 px-2">Daño</th>}
                      {cat.fields.includes('herida') && <th className="text-center py-2 px-2">Herida</th>}
                      {cat.fields.includes('armadura') && <th className="text-center py-2 px-2">CA</th>}
                      {cat.fields.includes('velocidad') && <th className="text-center py-2 px-2">Vel.</th>}
                      {cat.fields.includes('capacidad_carga') && <th className="text-center py-2 px-2">Carga</th>}
                      <th className="text-right py-2 px-2">Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => (
                      <tr key={i} className="border-b border-border/10 hover:bg-black/10">
                        <td className="py-2 px-2">{item.nombre}</td>
                        <td className="text-right py-2 px-2 text-[hsl(var(--gold))]">{formatPrice(item.precio, item.moneda)}</td>
                        {cat.fields.includes('dano') && <td className="text-center py-2 px-2">{item.dano || '-'}</td>}
                        {cat.fields.includes('herida') && <td className="text-center py-2 px-2">{item.herida || '-'}</td>}
                        {cat.fields.includes('armadura') && <td className="text-center py-2 px-2">{item.armadura || item.ca || '-'}</td>}
                        {cat.fields.includes('velocidad') && <td className="text-center py-2 px-2">{item.velocidad || '-'}</td>}
                        {cat.fields.includes('capacidad_carga') && <td className="text-center py-2 px-2">{item.capacidad_carga || '-'}</td>}
                        <td className="text-right py-2 px-2 text-muted-foreground">{item.peso_kg ? `${item.peso_kg} kg` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render virtues
  const renderVirtues = () => {
    if (!data?.length) return <p className="text-muted-foreground">No hay virtudes cargadas</p>;
    
    const filtered = filterData(data, searchTerm);
    
    // Group by culture
    const grouped = {};
    filtered.forEach(v => {
      const cult = v.cultura || 'General';
      if (!grouped[cult]) grouped[cult] = [];
      grouped[cult].push(v);
    });

    return (
      <div className="space-y-6">
        {Object.entries(grouped).map(([cultura, virtudes]) => (
          <div key={cultura} className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">{cultura}</h3>
            <div className="space-y-3">
              {virtudes.map((v, i) => (
                <div key={i} className="bg-black/10 p-3 rounded">
                  <p className="font-bold text-[hsl(var(--torch-orange))]">{v.nombre}</p>
                  {v.descripcion && <p className="text-sm text-muted-foreground mt-1">{v.descripcion}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render content based on category
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
        </div>
      );
    }

    switch (selectedCategory) {
      case 'cultures':
        const filteredCultures = filterData(data, searchTerm);
        return filteredCultures?.length > 0 
          ? filteredCultures.map(renderCultureDetail)
          : <p className="text-muted-foreground">No se encontraron culturas</p>;
      
      case 'backgrounds':
        const filteredBackgrounds = filterData(data, searchTerm);
        return filteredBackgrounds?.length > 0 
          ? filteredBackgrounds.map(renderBackgroundDetail)
          : <p className="text-muted-foreground">No se encontraron trasfondos</p>;
      
      case 'occupations':
        const filteredOccs = filterData(data, searchTerm);
        return filteredOccs?.length > 0 
          ? filteredOccs.map(renderOccupationDetail)
          : <p className="text-muted-foreground">No se encontraron ocupaciones</p>;
      
      case 'virtues':
        return renderVirtues();
      
      case 'equipment':
        return renderEquipmentTables();
      
      case 'shadow':
        return (
          <div className="card-parchment rounded-lg p-6">
            <h3 className="font-heading text-xl text-[hsl(var(--destructive))] mb-4">La Sombra</h3>
            <p className="text-muted-foreground mb-4">
              La Sombra representa la corrupción que acecha a todos los habitantes de la Tierra Media. 
              A medida que un personaje acumula puntos de Sombra, se acerca más a la oscuridad.
            </p>
            <div className="space-y-3">
              <div className="bg-black/20 p-3 rounded">
                <p className="font-bold">Desanimado</p>
                <p className="text-sm text-muted-foreground">Cuando los puntos de Sombra igualan o superan tu puntuación de Esperanza</p>
              </div>
              <div className="bg-black/20 p-3 rounded">
                <p className="font-bold">Angustiado</p>
                <p className="text-sm text-muted-foreground">Cuando acumulas cicatrices de Sombra permanentes</p>
              </div>
            </div>
          </div>
        );
      
      case 'travel':
        return (
          <div className="card-parchment rounded-lg p-6">
            <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-4">Viajes</h3>
            <p className="text-muted-foreground">
              Las reglas de viaje permiten a la compañía explorar la Tierra Media, 
              enfrentándose a los peligros del camino y descubriendo nuevas tierras.
            </p>
          </div>
        );
      
      case 'community':
        return (
          <div className="card-parchment rounded-lg p-6">
            <h3 className="font-heading text-xl text-[hsl(var(--magic-blue))] mb-4">Puntos de Comunidad</h3>
            <p className="text-muted-foreground mb-4">
              Los puntos de Comunidad representan los recursos y conexiones que la compañía 
              tiene en la Tierra Media a través de sus mecenas.
            </p>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen tavern-bg" data-testid="rules-page">
      <header className="border-b border-border/50 bg-black/70 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectedCategory ? setSelectedCategory(null) : navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {selectedCategory ? 'Categorías' : 'Inicio'}
            </Button>
            <div>
              <h1 className="font-heading text-2xl text-[hsl(var(--gold))]">
                {selectedCategory ? RULE_CATEGORIES.find(c => c.id === selectedCategory)?.name : 'Reglas del Juego'}
              </h1>
              {!selectedCategory && (
                <p className="text-sm text-muted-foreground">Consulta las reglas y datos del juego</p>
              )}
            </div>
          </div>
          
          {selectedCategory && (
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 bg-black/30 border-border/50"
              />
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!selectedCategory ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {RULE_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="card-parchment p-6 rounded-lg text-left hover:ring-2 hover:ring-[hsl(var(--gold))/50] transition-all"
                data-testid={`category-${cat.id}`}
              >
                <cat.icon className={`w-8 h-8 mb-3 text-[hsl(var(--${cat.color}))]`} />
                <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
              </button>
            ))}
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            {renderContent()}
          </ScrollArea>
        )}
      </main>
    </div>
  );
};

export default RulesPage;
