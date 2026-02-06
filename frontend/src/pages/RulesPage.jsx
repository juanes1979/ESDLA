/**
 * Rules Page - Game rules organized by category with complete data display
 * Includes CRUD for Races, Cultures, Backgrounds, Occupations (admin only)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Swords, Shield, BookOpen, Sparkles, Moon, Map, Loader2, Package, Search, ChevronDown, ChevronUp, Plus, Copy, Edit, User, Scroll, Trash2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { getCultures, getOccupations, getVirtues, getEquipmentCatalog, getBackgrounds } from '@/services/api';
import api from '@/services/api';
import { useUser } from '@/contexts/UserContext';
import CultureEditor from '@/components/admin/CultureEditor';
import RaceEditor from '@/components/admin/RaceEditor';
import BackgroundEditor from '@/components/admin/BackgroundEditor';
import OccupationEditor from '@/components/admin/OccupationEditor';
import EquipmentEditor from '@/components/admin/EquipmentEditor';

const RULE_CATEGORIES = [
  { id: 'cultures', name: 'Culturas', icon: Users, color: 'gold', description: 'Las razas y pueblos de la Tierra Media' },
  { id: 'backgrounds', name: 'Trasfondos', icon: Scroll, color: 'torch-orange', description: 'Los orígenes y oficios previos' },
  { id: 'occupations', name: 'Ocupaciones', icon: Swords, color: 'magic-blue', description: 'Las vocaciones heroicas' },
  { id: 'virtues', name: 'Virtudes', icon: Sparkles, color: 'torch-orange', description: 'Dones especiales por cultura' },
  { id: 'equipment', name: 'Precios de Equipo', icon: Package, color: 'gold', description: 'Lista completa con precios y pesos' },
  { id: 'shadow', name: 'Sombra', icon: Moon, color: 'destructive', description: 'La corrupción y sus efectos' },
  { id: 'artes', name: 'Artes', icon: BookOpen, color: 'magic-blue', description: 'Habilidades especiales' },
  { id: 'recompensas', name: 'Recompensas', icon: Crown, color: 'gold', description: 'Mejoras de equipo y bendiciones' },
  { id: 'combate', name: 'Combate', icon: Swords, color: 'destructive', description: 'Reglas de combate y ataque' },
  { id: 'salarios', name: 'Salarios', icon: Crown, color: 'gold', description: 'Tabla de salarios por ocupación' },
  { id: 'varios', name: 'Reglas Varias', icon: BookOpen, color: 'magic-blue', description: 'Pruebas, Cansancio, Inspiración, Ojo de Mordor' },
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
  const { isAdmin, user, toggleRole } = useUser();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [data, setData] = useState(null);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCulture, setExpandedCulture] = useState(null);
  const [expandedOccupation, setExpandedOccupation] = useState(null);
  const [expandedBackground, setExpandedBackground] = useState(null);
  const [cultureNames, setCultureNames] = useState({});
  const [cultureVirtues, setCultureVirtues] = useState({});  // Cache for culture virtues
  
  // Admin modal states
  const [showRaceEditor, setShowRaceEditor] = useState(false);
  const [showCultureEditor, setShowCultureEditor] = useState(false);
  const [showBackgroundEditor, setShowBackgroundEditor] = useState(false);
  const [showOccupationEditor, setShowOccupationEditor] = useState(false);
  const [showVirtudEditor, setShowVirtudEditor] = useState(false);
  const [showEquipmentEditor, setShowEquipmentEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Load races for culture editor
  useEffect(() => {
    const loadRaces = async () => {
      try {
        const res = await api.get('/data/races');
        setRaces(res.data.races || []);
      } catch (err) {
        console.warn('Could not load races:', err);
      }
    };
    loadRaces();
  }, []);

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
            const virtuesRes = await api.get('/data/virtudes');
            setData(virtuesRes.data?.virtudes || []);
            break;
          case 'equipment':
            const equipment = await getEquipmentCatalog();
            setData(equipment);
            break;
          case 'shadow':
            const sombraRes = await api.get('/data/sombra');
            setData(sombraRes.data);
            break;
          case 'artes':
            const artesRes = await api.get('/data/artes');
            setData(artesRes.data?.artes || []);
            break;
          case 'recompensas':
            const recompensasRes = await api.get('/data/recompensas');
            setData(recompensasRes.data);
            break;
          case 'salarios':
            const salariosRes = await api.get('/data/salarios');
            setData(salariosRes.data);
            break;
          case 'varios':
            const variosRes = await api.get('/data/varios');
            setData(variosRes.data);
            break;
          case 'combate':
            const combateRes = await api.get('/data/combate');
            setData(combateRes.data);
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

  // Load virtues for a specific culture
  const loadCultureVirtues = async (cultureId) => {
    if (cultureVirtues[cultureId]) return; // Already loaded
    
    try {
      const res = await api.get(`/data/cultures/${cultureId}/virtues`);
      setCultureVirtues(prev => ({
        ...prev,
        [cultureId]: res.data.virtues || []
      }));
    } catch (err) {
      console.warn('Could not load culture virtues:', err);
    }
  };

  // COMPLETE Culture Detail Renderer
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
                  onClick={(e) => { e.stopPropagation(); openEditor('culture', culture); }}
                  data-testid={`edit-culture-${culture.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete('cultures', culture.id, culture.nombre); }}
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); openEditor('background', bg); }}
                  data-testid={`edit-background-${bg.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete('backgrounds', bg.id, bg.nombre); }}
                  data-testid={`delete-background-${bg.id}`}
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
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); openEditor('occupation', occ); }}
                  data-testid={`edit-occupation-${occ.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); handleDelete('occupations', occ.id, occ.vocacion); }}
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
    
    // Admin button to create new equipment
    const adminButton = isAdmin && (
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setShowEquipmentEditor(true)}
          className="btn-fantasy"
        >
          <Plus className="w-4 h-4 mr-2" />
          Crear Equipo
        </Button>
      </div>
    );
    
    // Group categories by section with titles
    const sections = [
      {
        title: "⚔️ Armas",
        categories: [
          { key: 'armas_sencillas_cc', name: 'Armas Sencillas (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
          { key: 'armas_sencillas_distancia', name: 'Armas Sencillas (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
          { key: 'armas_marciales_cc', name: 'Armas Marciales (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
          { key: 'armas_marciales_distancia', name: 'Armas Marciales (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
        ]
      },
      {
        title: "🛡️ Armaduras",
        categories: [
          { key: 'armaduras_ligeras', name: 'Armaduras Ligeras', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
          { key: 'armaduras_medias', name: 'Armaduras Medias', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
          { key: 'armaduras_pesadas', name: 'Armaduras Pesadas', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
          { key: 'escudos', name: 'Escudos', fields: ['nombre', 'precio', 'ca', 'peso_kg'] },
        ]
      },
      {
        title: "🎒 Equipo y Herramientas",
        categories: [
          { key: 'equipo_general', name: 'Equipo General', fields: ['nombre', 'precio', 'peso_kg'] },
          { key: 'herramientas', name: 'Herramientas', fields: ['nombre', 'precio', 'peso_kg'] },
          { key: 'juegos', name: 'Juegos', fields: ['nombre', 'precio', 'peso_kg'] },
          { key: 'instrumentos_musicales', name: 'Instrumentos Musicales', fields: ['nombre', 'precio', 'peso_kg'] },
        ]
      },
      {
        title: "🍖 Consumibles y Alimentación",
        categories: [
          { key: 'consumibles', name: 'Consumibles y Alimentación', fields: ['nombre', 'precio', 'peso_kg'] },
          { key: 'comida_posadas', name: 'Comida en Posadas y Restaurantes', fields: ['nombre', 'precio', 'peso_kg'] },
        ]
      },
      {
        title: "🌿 Hierbas y Venenos",
        categories: [
          { key: 'hierbas', name: 'Hierbas Medicinales y Pociones', fields: ['nombre', 'precio', 'forma_preparacion', 'efecto', 'peso_kg'] },
          { key: 'venenos', name: 'Venenos', fields: ['nombre', 'precio', 'forma_preparacion', 'efecto', 'peso_kg'] },
        ]
      },
      {
        title: "🐴 Monturas y Transporte",
        categories: [
          { key: 'monturas', name: 'Monturas', fields: ['nombre', 'precio', 'capacidad_carga', 'constitucion', 'velocidad', 'capacidad_pequeno', 'capacidad_mediano'] },
          { key: 'accesorios_monturas', name: 'Accesorios de Monturas', fields: ['nombre', 'precio', 'peso_kg'] },
          { key: 'transporte_terrestre', name: 'Transporte Terrestre', fields: ['nombre', 'precio', 'capacidad_kg'] },
          { key: 'transporte_maritimo', name: 'Transporte Marítimo', fields: ['nombre', 'precio', 'capacidad_kg'] },
        ]
      },
      {
        title: "🏗️ Elementos de Construcción",
        categories: [
          { key: 'construccion', name: 'Elementos de Construcción', fields: ['nombre', 'precio', 'peso_kg', 'm2'] },
        ]
      },
    ];

    // Render a single table
    const renderTable = (cat) => {
      const items = data[cat.key];
      if (!items?.length) return null;
      
      const filtered = filterData(items, searchTerm);
      if (!filtered?.length) return null;
      
      return (
        <div key={cat.key} className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-md text-[hsl(var(--magic-blue))] mb-3">{cat.name}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2">Nombre</th>
                  <th className="text-right py-2 px-2">Precio</th>
                  {cat.fields.includes('dano') && <th className="text-center py-2 px-2">Daño</th>}
                  {cat.fields.includes('modificador') && <th className="text-center py-2 px-2">Tipo</th>}
                  {cat.fields.includes('alcance') && <th className="text-center py-2 px-2">Alcance</th>}
                  {cat.fields.includes('herida') && <th className="text-center py-2 px-2">Herida</th>}
                  {cat.fields.includes('ca') && <th className="text-center py-2 px-2">CA</th>}
                  {cat.fields.includes('comentarios') && <th className="text-left py-2 px-2">Modificadores</th>}
                  {cat.fields.includes('forma_preparacion') && <th className="text-center py-2 px-2">Preparación</th>}
                  {cat.fields.includes('efecto') && <th className="text-left py-2 px-2">Efecto</th>}
                  {cat.fields.includes('capacidad_carga') && <th className="text-center py-2 px-2">Carga</th>}
                  {cat.fields.includes('constitucion') && <th className="text-center py-2 px-2">Const.</th>}
                  {cat.fields.includes('velocidad') && <th className="text-center py-2 px-2">Vel.</th>}
                  {cat.fields.includes('capacidad_pequeno') && <th className="text-center py-2 px-2">Pequeño</th>}
                  {cat.fields.includes('capacidad_mediano') && <th className="text-center py-2 px-2">Mediano</th>}
                  {cat.fields.includes('capacidad_monta') && <th className="text-center py-2 px-2">Cap. Monta</th>}
                  {cat.fields.includes('capacidad_kg') && <th className="text-center py-2 px-2">Cap. (Kg)</th>}
                  {cat.fields.includes('m2') && <th className="text-center py-2 px-2">m²</th>}
                  {cat.fields.includes('peso_kg') && <th className="text-right py-2 px-2">Peso</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={i} className="border-b border-border/10 hover:bg-black/10">
                    <td className="py-2 px-2">{item.nombre}</td>
                    <td className="text-right py-2 px-2 text-[hsl(var(--gold))]">{formatPrice(item.precio, item.moneda)}</td>
                    {cat.fields.includes('dano') && <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">{item.dano || '-'}</td>}
                    {cat.fields.includes('modificador') && <td className="text-center py-2 px-2 text-xs">{item.modificador || '-'}</td>}
                    {cat.fields.includes('alcance') && <td className="text-center py-2 px-2">{item.alcance || '-'}</td>}
                    {cat.fields.includes('herida') && <td className="text-center py-2 px-2">{item.herida || '-'}</td>}
                    {cat.fields.includes('ca') && <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{item.ca || '-'}</td>}
                    {cat.fields.includes('comentarios') && <td className="text-left py-2 px-2 text-xs text-muted-foreground">{item.comentarios || '-'}</td>}
                    {cat.fields.includes('forma_preparacion') && <td className="text-center py-2 px-2 text-xs">{item.forma_preparacion || '-'}</td>}
                    {cat.fields.includes('efecto') && <td className="text-left py-2 px-2 text-xs text-muted-foreground max-w-[200px] truncate" title={item.efecto}>{item.efecto || '-'}</td>}
                    {cat.fields.includes('capacidad_carga') && <td className="text-center py-2 px-2">{item.capacidad_carga || '-'}</td>}
                    {cat.fields.includes('constitucion') && <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">{item.constitucion || '-'}</td>}
                    {cat.fields.includes('velocidad') && <td className="text-center py-2 px-2">{item.velocidad || '-'}</td>}
                    {cat.fields.includes('capacidad_pequeno') && <td className="text-center py-2 px-2">{item.capacidad_pequeno ? '✓' : '-'}</td>}
                    {cat.fields.includes('capacidad_mediano') && <td className="text-center py-2 px-2">{item.capacidad_mediano ? '✓' : '-'}</td>}
                    {cat.fields.includes('capacidad_monta') && <td className="text-center py-2 px-2 text-xs">{item.capacidad_monta || '-'}</td>}
                    {cat.fields.includes('capacidad_kg') && <td className="text-center py-2 px-2">{item.capacidad_kg || '-'}</td>}
                    {cat.fields.includes('m2') && <td className="text-center py-2 px-2">{item.m2 || '-'}</td>}
                    {cat.fields.includes('peso_kg') && <td className="text-right py-2 px-2 text-muted-foreground">{item.peso_kg ? `${item.peso_kg} kg` : '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-8">
        {adminButton}
        {sections.map((section, sectionIdx) => {
          // Check if any category in this section has items
          const hasItems = section.categories.some(cat => data[cat.key]?.length > 0);
          if (!hasItems) return null;
          
          return (
            <div key={sectionIdx}>
              <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
                {section.title}
              </h3>
              <div className="space-y-4">
                {section.categories.map(cat => renderTable(cat))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render virtues - Complete data with all fields
  const renderVirtues = () => {
    if (!data?.length) return <p className="text-muted-foreground">No hay virtudes cargadas</p>;
    
    const filtered = filterData(data, searchTerm);
    
    // Group by culture
    const grouped = {};
    filtered.forEach(v => {
      const cult = v.cultura || 'Comunes';
      if (!grouped[cult]) grouped[cult] = [];
      grouped[cult].push(v);
    });

    return (
      <div className="space-y-6">
        {/* Admin button to create new virtue */}
        {isAdmin && (
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                setEditingItem(null);
                setShowVirtudEditor(true);
              }}
              className="btn-fantasy"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Virtud
            </Button>
          </div>
        )}
        
        {Object.entries(grouped).map(([cultura, virtudes]) => (
          <div key={cultura} className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              {cultura}
            </h3>
            <div className="space-y-4">
              {virtudes.map((v, i) => (
                <div key={i} className="bg-black/10 p-4 rounded border border-border/20">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-[hsl(var(--torch-orange))] text-lg">{v.nombre}</p>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingItem(v);
                            setShowVirtudEditor(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => handleDeleteVirtud(v._id, v.nombre)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Description */}
                  {v.descripcion && (
                    <p className="text-sm text-muted-foreground mt-2 italic">{v.descripcion}</p>
                  )}
                  
                  {/* Rasgos (traits to note on sheet) */}
                  {v.rasgos && (
                    <div className="mt-3 p-2 bg-[hsl(var(--magic-blue))/10] rounded">
                      <p className="text-xs font-bold text-[hsl(var(--magic-blue))] mb-1">Rasgos a indicar en la ficha:</p>
                      <p className="text-sm">{v.rasgos}</p>
                    </div>
                  )}
                  
                  {/* Stat increases */}
                  {(v.aumenta_fuerza || v.aumenta_destreza || v.aumenta_constitucion || 
                    v.aumenta_inteligencia || v.aumenta_sabiduria || v.aumenta_carisma) && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-[hsl(var(--gold))]">Aumenta en 1:</span>
                      {v.aumenta_fuerza && <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">FUE</span>}
                      {v.aumenta_destreza && <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">DES</span>}
                      {v.aumenta_constitucion && <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded">CON</span>}
                      {v.aumenta_inteligencia && <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">INT</span>}
                      {v.aumenta_sabiduria && <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">SAB</span>}
                      {v.aumenta_carisma && <span className="px-2 py-1 bg-pink-500/20 text-pink-400 text-xs rounded">CAR</span>}
                    </div>
                  )}
                  
                  {/* Choose stat to increase */}
                  {v.elegir_caracteristica?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-[hsl(var(--torch-orange))]">Elegir +1 en:</span>
                      {v.elegir_caracteristica.map((stat, idx) => (
                        <span key={idx} className="px-2 py-1 bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] text-xs rounded border border-[hsl(var(--torch-orange))/30]">
                          {stat.substring(0, 3)}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Choose saving throw proficiency */}
                  {v.elegir_salvacion?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-[hsl(var(--magic-blue))]">Elegir competencia en salvación:</span>
                      {v.elegir_salvacion.map((save, idx) => (
                        <span key={idx} className="px-2 py-1 bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-xs rounded border border-[hsl(var(--magic-blue))/30]">
                          {save.substring(0, 3)}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Bonuses */}
                  {(v.bonus_puntos_golpe || v.bonus_comunidad || v.bonus_ca) && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {v.bonus_puntos_golpe && (
                        <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded flex items-center gap-1">
                          <span className="font-bold">+{v.bonus_puntos_golpe}</span> PG
                        </span>
                      )}
                      {v.bonus_comunidad && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                          <span className="font-bold">+{v.bonus_comunidad}</span> Comunidad
                        </span>
                      )}
                      {v.bonus_ca && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
                          <span className="font-bold">+{v.bonus_ca}</span> CA
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Choose skill proficiency */}
                  {v.elegir_habilidad?.length > 0 && (
                    <div className="mt-3 p-2 bg-[hsl(var(--gold))/10] rounded">
                      <p className="text-xs font-bold text-[hsl(var(--gold))] mb-1">Elegir competencia en habilidad:</p>
                      <div className="flex flex-wrap gap-1">
                        {v.elegir_habilidad.map((skill, idx) => (
                          <span key={idx} className="px-2 py-1 bg-black/20 text-xs rounded">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Choose tool proficiency */}
                  {v.elegir_herramienta?.length > 0 && (
                    <div className="mt-3 p-2 bg-[hsl(var(--torch-orange))/10] rounded">
                      <p className="text-xs font-bold text-[hsl(var(--torch-orange))] mb-1">Elegir competencia en herramienta:</p>
                      <div className="flex flex-wrap gap-1">
                        {v.elegir_herramienta.map((tool, idx) => (
                          <span key={idx} className="px-2 py-1 bg-black/20 text-xs rounded">{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // === CRUD FUNCTIONS ===
  
  const reloadData = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      switch (selectedCategory) {
        case 'cultures':
          const cultures = await getCultures();
          setData(cultures);
          // Reload races too
          const racesRes = await api.get('/data/races');
          setRaces(racesRes.data.races || []);
          break;
        case 'backgrounds':
          const backgrounds = await getBackgrounds();
          setData(backgrounds);
          break;
        case 'occupations':
          const occupations = await getOccupations();
          setData(occupations);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('Error reloading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    
    try {
      await api.delete(`/data/${type}/${id}`);
      toast.success(`${name} eliminado correctamente`);
      reloadData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleCopy = async (type, id, originalName) => {
    const newName = window.prompt(`Nombre para la copia de "${originalName}":`);
    if (!newName?.trim()) return;
    
    try {
      await api.post(`/data/${type}/${id}/copy`, { new_name: newName.trim() });
      toast.success(`Copia creada: ${newName}`);
      reloadData();
      setEditingItem(null);
      setShowCultureEditor(false);
      setShowBackgroundEditor(false);
      setShowOccupationEditor(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al copiar');
    }
  };

  const handleEditorSave = () => {
    toast.success('Guardado correctamente');
    setShowRaceEditor(false);
    setShowCultureEditor(false);
    setShowBackgroundEditor(false);
    setShowOccupationEditor(false);
    setEditingItem(null);
    reloadData();
  };

  const openEditor = (type, item = null) => {
    setEditingItem(item);
    switch (type) {
      case 'race':
        setShowRaceEditor(true);
        break;
      case 'culture':
        setShowCultureEditor(true);
        break;
      case 'background':
        setShowBackgroundEditor(true);
        break;
      case 'occupation':
        setShowOccupationEditor(true);
        break;
      default:
        break;
    }
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
        return renderSombra();
      
      case 'artes':
        return renderArtes();
      
      case 'recompensas':
        return renderRecompensas();
      
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

  // === RENDER SOMBRA ===
  const renderSombra = () => {
    if (!data) return <p className="text-muted-foreground">No hay datos de Sombra cargados</p>;
    
    return (
      <div className="space-y-6">
        {/* PAVOR */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            🌑 PAVOR
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Se puede obtener puntos de sombra al ser testigo de acontecimientos terribles.
            <br /><span className="text-[hsl(var(--magic-blue))]">Tirada de salvación de CARISMA. Si tiene éxito se retira 1 punto.</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2">Fuente</th>
                  <th className="text-left py-2 px-2">Ejemplo</th>
                  <th className="text-center py-2 px-2">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {data.pavor?.map((p, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2 px-2">{p.fuente}</td>
                    <td className="py-2 px-2 text-muted-foreground text-xs">{p.ejemplo}</td>
                    <td className="text-center py-2 px-2 text-[hsl(var(--destructive))] font-bold">{p.puntos_sombra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AVARICIA */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            💰 AVARICIA
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Propio deseo de riquezas. Tesoros mágicos o artefactos encontrados.
            <br /><span className="text-[hsl(var(--magic-blue))]">Tirada de salvación de SABIDURÍA. Si tiene éxito se retira 1 punto.</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2">Tesoro Mágico</th>
                  <th className="text-left py-2 px-2">Descripción</th>
                  <th className="text-center py-2 px-2">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {data.avaricia?.map((a, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2 px-2 font-medium">{a.tesoro_magico}</td>
                    <td className="py-2 px-2 text-muted-foreground text-xs">{a.descripcion}</td>
                    <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{a.puntos_sombra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FECHORÍAS */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
            ⚠️ FECHORÍAS
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            La intención es lo que cuenta. Si la fechoría es sin querer, se puede reducir a la mitad.
            <br /><span className="text-[hsl(var(--destructive))]">NO se puede realizar tirada de salvación.</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2">Acción</th>
                  <th className="text-center py-2 px-2">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {data.fechorias?.map((f, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2 px-2">{f.accion}</td>
                    <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))] font-bold">{f.puntos_sombra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* HECHICERÍA */}
        {data.hechiceria && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2">
              🔮 HECHICERÍA
            </h3>
            <p className="text-sm text-muted-foreground">
              {data.hechiceria.descripcion}
            </p>
          </div>
        )}

        {/* FORTALECER LA VOLUNTAD */}
        {data.fortalecer_voluntad && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              💪 FORTALECER LA VOLUNTAD
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {data.fortalecer_voluntad.descripcion}
            </p>
            {data.fortalecer_voluntad.nota && (
              <p className="text-xs text-[hsl(var(--gold))] italic bg-[hsl(var(--gold))/10] p-2 rounded">
                {data.fortalecer_voluntad.nota}
              </p>
            )}
          </div>
        )}

        {/* ESTADOS */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            😰 ESTADOS PROVOCADOS POR LA SOMBRA
          </h3>
          <div className="space-y-4">
            {data.estados?.map((e, i) => (
              <div key={i} className="bg-black/20 p-4 rounded border-l-4 border-[hsl(var(--destructive))]">
                <p className="font-bold text-[hsl(var(--torch-orange))] text-lg">{e.nombre}</p>
                <p className="text-sm text-muted-foreground mt-1"><strong>Condición:</strong> {e.condicion}</p>
                <div className="mt-2">
                  <p className="text-xs font-bold text-[hsl(var(--destructive))]">Efectos:</p>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {e.efectos?.map((ef, j) => (
                      <li key={j}>{ef}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CÓMO SUCUMBIR ANTE LA SOMBRA */}
        {data.como_sucumbir && (
          <div className="card-parchment rounded-lg p-4 border-2 border-[hsl(var(--destructive))]">
            <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
              ☠️ CÓMO SUCUMBIR ANTE LA SOMBRA
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {data.como_sucumbir.descripcion}
            </p>
            <div className="bg-[hsl(var(--destructive))/20] p-3 rounded border border-[hsl(var(--destructive))/50]">
              <p className="text-sm font-bold text-[hsl(var(--destructive))]">
                ⚠️ {data.como_sucumbir.consecuencia}
              </p>
            </div>
          </div>
        )}

        {/* SENDAS DE LA SOMBRA */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            💀 SENDAS DE LA SOMBRA - DEFECTOS
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tras el brote de locura se adquieren los siguientes defectos según el origen de la Sombra.
            Los héroes que desarrollan los cuatro defectos de una senda sucumben ante la Sombra.
          </p>
          
          {/* Group by senda */}
          {(() => {
            const grouped = {};
            data.sendas_sombra?.forEach(s => {
              if (!grouped[s.senda]) grouped[s.senda] = [];
              grouped[s.senda].push(s);
            });
            
            return Object.entries(grouped).map(([senda, defectos]) => (
              <div key={senda} className="mb-6 last:mb-0">
                <h4 className="font-heading text-md text-[hsl(var(--torch-orange))] mb-3 bg-black/30 p-2 rounded">
                  {senda}
                </h4>
                <div className="space-y-2">
                  {defectos.map((d, i) => (
                    <div key={i} className="bg-black/10 p-3 rounded border-l-2 border-[hsl(var(--destructive))/50]">
                      <p className="font-bold text-sm">{d.defecto}</p>
                      <p className="text-xs text-muted-foreground mt-1">{d.descripcion}</p>
                      {d.efecto_juego && (
                        <p className="text-xs text-[hsl(var(--magic-blue))] mt-1 italic">{d.efecto_juego}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    );
  };

  // === RENDER ARTES ===
  const renderArtes = () => {
    if (!data?.length) return <p className="text-muted-foreground">No hay artes cargadas</p>;
    
    return (
      <div className="space-y-4">
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            📜 Artes ({data.length})
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Las Artes son habilidades especiales que los personajes pueden utilizar en situaciones de juego. 
            Cada uso de un Arte consume un espacio de arte.
          </p>
          <div className="space-y-6">
            {data.map((arte, i) => (
              <div key={i} className="bg-black/10 p-4 rounded border border-border/20" data-testid={`arte-${i}`}>
                <p className="font-bold text-[hsl(var(--torch-orange))] text-lg mb-2">{arte.nombre}</p>
                {arte.descripcion_corta && (
                  <p className="text-sm text-muted-foreground italic border-l-2 border-[hsl(var(--gold))/50] pl-3 mb-3">{arte.descripcion_corta}</p>
                )}
                {arte.descripcion && (
                  <div className="mt-3 p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/20]">
                    {arte.descripcion.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx} className="text-sm mb-2 last:mb-0 whitespace-pre-wrap">
                        {paragraph.startsWith('•') ? (
                          <span className="text-[hsl(var(--gold))]">{paragraph}</span>
                        ) : paragraph}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // === RENDER RECOMPENSAS ===
  const renderRecompensas = () => {
    if (!data) return <p className="text-muted-foreground">No hay recompensas cargadas</p>;
    
    return (
      <div className="space-y-6">
        {/* Mejoras de Equipo */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            ⚔️ Mejoras de Equipo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="text-left py-2 px-2">Tipo</th>
                  <th className="text-left py-2 px-2">Recompensa</th>
                  <th className="text-left py-2 px-2">Efecto Mecánico</th>
                  <th className="text-left py-2 px-2">Restricciones</th>
                </tr>
              </thead>
              <tbody>
                {data.mejoras?.map((m, i) => (
                  <tr key={i} className="border-b border-border/10">
                    <td className="py-2 px-2 text-[hsl(var(--magic-blue))]">{m.tipo}</td>
                    <td className="py-2 px-2 font-medium text-[hsl(var(--torch-orange))]">{m.nombre}</td>
                    <td className="py-2 px-2">{m.efecto}</td>
                    <td className="py-2 px-2 text-muted-foreground text-xs">{m.restriccion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Niveles de Recompensa */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
            📈 Niveles de Recompensa
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.niveles_recompensa?.map((n, i) => (
              <div key={i} className="bg-black/10 p-3 rounded text-center">
                <p className="text-2xl font-bold text-[hsl(var(--gold))]">Nivel {n.nivel}</p>
                <p className="text-sm text-muted-foreground">{n.recompensas} recompensa{n.recompensas > 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bendiciones */}
        {data.bendiciones && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              ✨ Bendiciones
            </h3>
            <p className="text-sm mb-4">{data.bendiciones.descripcion}</p>
            
            {/* Bonificador por Competencia */}
            {data.bendiciones.bonificador_competencia && (
              <div className="mt-4 p-3 bg-[hsl(var(--magic-blue))/10] rounded">
                <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">
                  🎯 Dado de Bendición por Nivel
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {data.bendiciones.bonificador_competencia.descripcion}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {data.bendiciones.bonificador_competencia.tabla?.map((b, i) => (
                    <div key={i} className="bg-black/20 p-2 rounded text-center">
                      <p className="text-xs text-muted-foreground">Nivel {b.nivel}</p>
                      <p className="text-lg font-bold text-[hsl(var(--torch-orange))]">{b.dado}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Handle virtue delete
  const handleDeleteVirtud = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar la virtud "${nombre}"?`)) return;
    try {
      await api.delete(`/data/virtudes/${id}`);
      toast.success('Virtud eliminada');
      // Reload virtues
      const res = await api.get('/data/virtudes');
      setData(res.data?.virtudes || []);
    } catch (err) {
      toast.error('Error al eliminar la virtud');
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
          
          <div className="flex items-center gap-3">
            {/* Admin indicator */}
            {isAdmin && (
              <div className="flex items-center gap-2 bg-[hsl(var(--gold))/20] px-3 py-1 rounded-full">
                <Crown className="w-4 h-4 text-[hsl(var(--gold))]" />
                <span className="text-sm text-[hsl(var(--gold))]">{user?.username}</span>
              </div>
            )}
            
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
            
            {/* Admin create buttons */}
            {isAdmin && selectedCategory === 'cultures' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditor('race')}
                  className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]"
                  data-testid="create-race-btn"
                >
                  <Plus className="w-4 h-4 mr-1" /> Raza
                </Button>
                <Button
                  size="sm"
                  onClick={() => openEditor('culture')}
                  className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))/80]"
                  data-testid="create-culture-btn"
                >
                  <Plus className="w-4 h-4 mr-1" /> Cultura
                </Button>
              </div>
            )}
            
            {isAdmin && selectedCategory === 'backgrounds' && (
              <Button
                size="sm"
                onClick={() => openEditor('background')}
                className="bg-[hsl(var(--torch-orange))] text-black hover:bg-[hsl(var(--torch-orange))/80]"
                data-testid="create-background-btn"
              >
                <Plus className="w-4 h-4 mr-1" /> Trasfondo
              </Button>
            )}
            
            {isAdmin && selectedCategory === 'occupations' && (
              <Button
                size="sm"
                onClick={() => openEditor('occupation')}
                className="bg-[hsl(var(--magic-blue))] text-black hover:bg-[hsl(var(--magic-blue))/80]"
                data-testid="create-occupation-btn"
              >
                <Plus className="w-4 h-4 mr-1" /> Ocupación
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Show races section when in cultures category */}
        {selectedCategory === 'cultures' && isAdmin && races.length > 0 && (
          <div className="mb-6 card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">Razas Base</h3>
            <div className="flex flex-wrap gap-2">
              {races.map(race => (
                <div key={race.id} className="flex items-center gap-2 bg-black/20 px-3 py-2 rounded">
                  <span className="text-sm">{race.nombre}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => openEditor('race', race)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete('races', race.id, race.nombre)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
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
      
      {/* Admin Modals */}
      {showRaceEditor && (
        <RaceEditor
          race={editingItem}
          onSave={handleEditorSave}
          onClose={() => { setShowRaceEditor(false); setEditingItem(null); }}
        />
      )}
      
      {showCultureEditor && (
        <CultureEditor
          culture={editingItem}
          races={races}
          onSave={handleEditorSave}
          onClose={() => { setShowCultureEditor(false); setEditingItem(null); }}
          onCopy={editingItem ? (item) => handleCopy('cultures', item.id, item.nombre) : null}
        />
      )}
      
      {showBackgroundEditor && (
        <BackgroundEditor
          background={editingItem}
          onSave={handleEditorSave}
          onClose={() => { setShowBackgroundEditor(false); setEditingItem(null); }}
          onCopy={editingItem ? (item) => handleCopy('backgrounds', item.id, item.nombre) : null}
        />
      )}
      
      {showOccupationEditor && (
        <OccupationEditor
          occupation={editingItem}
          onSave={handleEditorSave}
          onClose={() => { setShowOccupationEditor(false); setEditingItem(null); }}
          onCopy={editingItem ? (item) => handleCopy('occupations', item.id, item.vocacion) : null}
        />
      )}
      
      {showEquipmentEditor && (
        <EquipmentEditor
          onSave={async () => {
            // Reload equipment data
            const equipment = await getEquipmentCatalog();
            setData(equipment);
          }}
          onClose={() => setShowEquipmentEditor(false)}
        />
      )}
    </div>
  );
};

export default RulesPage;
