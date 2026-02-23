/**
 * Rules Page - Game rules organized by category with complete data display
 * Includes CRUD for Races, Cultures, Backgrounds, Occupations (admin only)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Swords, Shield, BookOpen, Sparkles, Moon, Map, Loader2, Package, Search, ChevronDown, ChevronUp, Plus, Copy, Edit, User, Scroll, Trash2, Crown, Skull, MapPin, FileText, Printer, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { getCultures, getOccupations, getVirtues, getEquipmentCatalog, getBackgrounds } from '@/services/api';
import api from '@/services/api';
import { useUser } from '@/contexts/UserContext';
import { jsPDF } from 'jspdf';
import CultureEditor from '@/components/admin/CultureEditor';
import RaceEditor from '@/components/admin/RaceEditor';
import BackgroundEditor from '@/components/admin/BackgroundEditor';
import OccupationEditor from '@/components/admin/OccupationEditor';
import EquipmentEditor from '@/components/admin/EquipmentEditor';
// Refactored rule section components
import { SombraSection, CombateSection, SalariosSection, VariosSection, ViajeSection, ComunidadSection, NPCsSection, CriaturasSinNombreSection, BackgroundsSection } from '@/components/rules';

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
  { id: 'community', name: 'Comunidad', icon: Users, color: 'magic-blue', description: 'Fase de comunidad, Yule y empresas' },
  { id: 'npcs', name: 'Bestiario', icon: Moon, color: 'destructive', description: 'Enemigos, PNJ, Animales y Especiales' },
  { id: 'nameless', name: 'Criaturas sin Nombre', icon: Skull, color: 'destructive', description: 'Reglas y generador de criaturas ancestrales' },
  { id: 'regions', name: 'Regiones', icon: MapPin, color: 'magic-blue', description: 'Gestión de regiones y sub-regiones del mapa' },
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
  
  // Equipment PDF export states
  const [showEquipmentPdfModal, setShowEquipmentPdfModal] = useState(false);
  const [selectedPdfCategories, setSelectedPdfCategories] = useState([]);
  const [generatingEquipmentPdf, setGeneratingEquipmentPdf] = useState(false);
  
  // Region management states
  const [editingRegion, setEditingRegion] = useState(null);
  const [newRegionName, setNewRegionName] = useState('');
  const [newSubregionName, setNewSubregionName] = useState('');
  const [selectedParentRegion, setSelectedParentRegion] = useState(null);
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [isAddingSubregion, setIsAddingSubregion] = useState(false);
  const [regionLoading, setRegionLoading] = useState(false);

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
          case 'travel':
            const viajeRes = await api.get('/data/viaje');
            setData(viajeRes.data);
            break;
          case 'community':
            const comunidadRes = await api.get('/data/comunidad');
            setData(comunidadRes.data);
            break;
          case 'npcs':
            const npcsRes = await api.get('/data/npcs');
            setData(npcsRes.data);
            break;
          case 'regions':
            const regionsRes = await api.get('/data/regions');
            setData(regionsRes.data?.regions || []);
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
    
    // Action buttons (admin + PDF export)
    const actionButtons = (
      <div className="flex justify-between items-center mb-4">
        <Button
          onClick={() => setShowEquipmentPdfModal(true)}
          variant="outline"
          className="border-[hsl(var(--gold))]/50 hover:bg-[hsl(var(--gold))]/10"
          data-testid="export-equipment-pdf-btn"
        >
          <Printer className="w-4 h-4 mr-2 text-[hsl(var(--gold))]" />
          Imprimir Listado PDF
        </Button>
        
        {isAdmin && (
          <Button
            onClick={() => setShowEquipmentEditor(true)}
            className="btn-fantasy"
          >
            <Plus className="w-4 h-4 mr-2" />
            Crear Equipo
          </Button>
        )}
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
        {actionButtons}
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

  // Equipment PDF export configuration
  const EQUIPMENT_PDF_SECTIONS = [
    {
      id: 'armas',
      title: 'Armas',
      categories: [
        { key: 'armas_sencillas_cc', name: 'Armas Sencillas (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
        { key: 'armas_sencillas_distancia', name: 'Armas Sencillas (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
        { key: 'armas_marciales_cc', name: 'Armas Marciales (Cuerpo a Cuerpo)', fields: ['nombre', 'precio', 'dano', 'modificador', 'herida', 'peso_kg'] },
        { key: 'armas_marciales_distancia', name: 'Armas Marciales (Distancia)', fields: ['nombre', 'precio', 'dano', 'alcance', 'herida', 'peso_kg'] },
      ]
    },
    {
      id: 'armaduras',
      title: 'Armaduras y Escudos',
      categories: [
        { key: 'armaduras_ligeras', name: 'Armaduras Ligeras', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
        { key: 'armaduras_medias', name: 'Armaduras Medias', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
        { key: 'armaduras_pesadas', name: 'Armaduras Pesadas', fields: ['nombre', 'precio', 'ca', 'comentarios', 'peso_kg'] },
        { key: 'escudos', name: 'Escudos', fields: ['nombre', 'precio', 'ca', 'peso_kg'] },
      ]
    },
    {
      id: 'equipo_herramientas',
      title: 'Equipo y Herramientas',
      categories: [
        { key: 'equipo_general', name: 'Equipo General', fields: ['nombre', 'precio', 'peso_kg'] },
        { key: 'herramientas', name: 'Herramientas', fields: ['nombre', 'precio', 'peso_kg'] },
        { key: 'juegos', name: 'Juegos', fields: ['nombre', 'precio', 'peso_kg'] },
        { key: 'instrumentos_musicales', name: 'Instrumentos Musicales', fields: ['nombre', 'precio', 'peso_kg'] },
      ]
    },
    {
      id: 'consumibles',
      title: 'Consumibles y Alimentación',
      categories: [
        { key: 'consumibles', name: 'Consumibles y Alimentación', fields: ['nombre', 'precio', 'peso_kg'] },
        { key: 'comida_posadas', name: 'Comida en Posadas y Restaurantes', fields: ['nombre', 'precio', 'peso_kg'] },
      ]
    },
    {
      id: 'hierbas_venenos',
      title: 'Hierbas y Venenos',
      categories: [
        { key: 'hierbas', name: 'Hierbas Medicinales y Pociones', fields: ['nombre', 'precio', 'efecto', 'peso_kg'] },
        { key: 'venenos', name: 'Venenos', fields: ['nombre', 'precio', 'efecto', 'peso_kg'] },
      ]
    },
    {
      id: 'monturas_transporte',
      title: 'Monturas y Transporte',
      categories: [
        { key: 'monturas', name: 'Monturas', fields: ['nombre', 'precio', 'velocidad', 'capacidad_carga'] },
        { key: 'accesorios_monturas', name: 'Accesorios de Monturas', fields: ['nombre', 'precio', 'peso_kg'] },
        { key: 'transporte_terrestre', name: 'Transporte Terrestre', fields: ['nombre', 'precio', 'capacidad_kg'] },
        { key: 'transporte_maritimo', name: 'Transporte Marítimo', fields: ['nombre', 'precio', 'capacidad_kg'] },
      ]
    },
    {
      id: 'construccion',
      title: 'Elementos de Construcción',
      categories: [
        { key: 'construccion', name: 'Elementos de Construcción', fields: ['nombre', 'precio', 'peso_kg', 'm2'] },
      ]
    },
  ];

  // Generate Equipment PDF
  const generateEquipmentPDF = async () => {
    if (selectedPdfCategories.length === 0) {
      toast.error('Selecciona al menos una categoría');
      return;
    }
    
    setGeneratingEquipmentPdf(true);
    toast.info('Generando PDF de equipamiento...');
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 12;
      const contentWidth = pageWidth - 2 * margin;
      let y = margin;
      
      // Set Calibri-like font (Helvetica is closest standard PDF font)
      pdf.setFont('helvetica');
      
      const checkNewPage = (height) => {
        if (y + height > pageHeight - margin) {
          pdf.addPage();
          y = margin;
          return true;
        }
        return false;
      };
      
      // Title
      pdf.setFontSize(16);
      pdf.setTextColor(139, 90, 43);
      pdf.text('LISTADO DE EQUIPAMIENTO', pageWidth / 2, y, { align: 'center' });
      y += 8;
      
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text('El Señor de los Anillos 5e - Precios y Características', pageWidth / 2, y, { align: 'center' });
      y += 10;
      
      // Process selected sections
      const selectedSections = EQUIPMENT_PDF_SECTIONS.filter(s => selectedPdfCategories.includes(s.id));
      
      for (const section of selectedSections) {
        checkNewPage(15);
        
        // Section title
        pdf.setFontSize(12);
        pdf.setTextColor(139, 90, 43);
        pdf.text(section.title.toUpperCase(), margin, y);
        y += 1;
        pdf.setDrawColor(139, 90, 43);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
        
        for (const cat of section.categories) {
          const items = data[cat.key];
          if (!items?.length) continue;
          
          checkNewPage(12);
          
          // Category title
          pdf.setFontSize(10);
          pdf.setTextColor(60, 90, 130);
          pdf.text(cat.name, margin, y);
          y += 5;
          
          // Table header
          pdf.setFontSize(8);
          pdf.setTextColor(80, 80, 80);
          pdf.setFillColor(240, 235, 220);
          pdf.rect(margin, y - 3, contentWidth, 5, 'F');
          
          let colX = margin + 2;
          const colWidths = calculateColumnWidths(cat.fields, contentWidth);
          
          // Headers
          const headerLabels = {
            nombre: 'Nombre',
            precio: 'Precio',
            dano: 'Daño',
            modificador: 'Tipo',
            alcance: 'Alcance',
            herida: 'Herida',
            ca: 'CA',
            comentarios: 'Modificadores',
            efecto: 'Efecto',
            peso_kg: 'Peso',
            velocidad: 'Velocidad',
            capacidad_carga: 'Carga',
            capacidad_kg: 'Capacidad',
            m2: 'm²',
          };
          
          cat.fields.forEach((field, idx) => {
            const align = field === 'nombre' || field === 'efecto' || field === 'comentarios' ? 'left' : 'center';
            pdf.text(headerLabels[field] || field, align === 'center' ? colX + colWidths[idx] / 2 : colX, y, { align });
            colX += colWidths[idx];
          });
          y += 5;
          
          // Table rows - Font size 10 as requested
          pdf.setFontSize(10);
          pdf.setTextColor(30, 30, 30);
          
          for (const item of items) {
            // Check if we need a new page
            if (checkNewPage(6)) {
              // Repeat header on new page
              pdf.setFontSize(8);
              pdf.setTextColor(80, 80, 80);
              pdf.setFillColor(240, 235, 220);
              pdf.rect(margin, y - 3, contentWidth, 5, 'F');
              
              colX = margin + 2;
              cat.fields.forEach((field, idx) => {
                const align = field === 'nombre' || field === 'efecto' || field === 'comentarios' ? 'left' : 'center';
                pdf.text(headerLabels[field] || field, align === 'center' ? colX + colWidths[idx] / 2 : colX, y, { align });
                colX += colWidths[idx];
              });
              y += 5;
              pdf.setFontSize(10);
              pdf.setTextColor(30, 30, 30);
            }
            
            colX = margin + 2;
            cat.fields.forEach((field, idx) => {
              let value = '';
              if (field === 'precio') {
                value = formatPrice(item.precio, item.moneda);
              } else if (field === 'peso_kg') {
                value = item.peso_kg ? `${item.peso_kg} kg` : '-';
              } else {
                value = item[field]?.toString() || '-';
              }
              
              // Truncate long text
              const maxChars = Math.floor(colWidths[idx] / 2);
              if (value.length > maxChars && field !== 'nombre') {
                value = value.substring(0, maxChars - 2) + '...';
              }
              
              const align = field === 'nombre' || field === 'efecto' || field === 'comentarios' ? 'left' : 'center';
              pdf.text(value, align === 'center' ? colX + colWidths[idx] / 2 : colX, y, { align });
              colX += colWidths[idx];
            });
            y += 5;
          }
          
          y += 3; // Space after table
        }
        
        y += 5; // Space after section
      }
      
      // Footer
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        pdf.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }
      
      // Save
      const filename = `equipamiento_lotr5e_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      
      toast.success('PDF generado correctamente');
      setShowEquipmentPdfModal(false);
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      setGeneratingEquipmentPdf(false);
    }
  };
  
  // Calculate column widths based on fields
  const calculateColumnWidths = (fields, totalWidth) => {
    const baseWidths = {
      nombre: 45,
      precio: 20,
      dano: 15,
      modificador: 20,
      alcance: 15,
      herida: 12,
      ca: 12,
      comentarios: 35,
      efecto: 50,
      peso_kg: 15,
      velocidad: 15,
      capacidad_carga: 18,
      capacidad_kg: 18,
      m2: 12,
    };
    
    let widths = fields.map(f => baseWidths[f] || 20);
    const totalBase = widths.reduce((a, b) => a + b, 0);
    const scale = (totalWidth - 4) / totalBase;
    return widths.map(w => w * scale);
  };

  // Equipment PDF Export Modal
  const renderEquipmentPdfModal = () => {
    if (!showEquipmentPdfModal) return null;
    
    const allSelected = selectedPdfCategories.length === EQUIPMENT_PDF_SECTIONS.length;
    
    const toggleAll = () => {
      if (allSelected) {
        setSelectedPdfCategories([]);
      } else {
        setSelectedPdfCategories(EQUIPMENT_PDF_SECTIONS.map(s => s.id));
      }
    };
    
    const toggleCategory = (id) => {
      setSelectedPdfCategories(prev => 
        prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
      );
    };
    
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-lg">
          <div className="p-4 border-b border-border/30 flex justify-between items-center">
            <h2 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Exportar Listado de Equipo a PDF
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setShowEquipmentPdfModal(false)}>
              ✕
            </Button>
          </div>
          
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona las categorías que deseas incluir en el PDF (A4 vertical, fuente Calibri 10pt):
            </p>
            
            {/* Select All */}
            <div className="flex items-center gap-2 pb-2 border-b border-border/30">
              <Checkbox 
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Seleccionar Todas
              </label>
            </div>
            
            {/* Category checkboxes */}
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {EQUIPMENT_PDF_SECTIONS.map(section => (
                <div key={section.id} className="flex items-center gap-2">
                  <Checkbox 
                    id={`cat-${section.id}`}
                    checked={selectedPdfCategories.includes(section.id)}
                    onCheckedChange={() => toggleCategory(section.id)}
                  />
                  <label htmlFor={`cat-${section.id}`} className="text-sm cursor-pointer flex-1">
                    {section.title}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({section.categories.length} {section.categories.length === 1 ? 'tabla' : 'tablas'})
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 border-t border-border/30 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEquipmentPdfModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={generateEquipmentPDF}
              disabled={selectedPdfCategories.length === 0 || generatingEquipmentPdf}
              className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
            >
              {generatingEquipmentPdf ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Generar PDF
            </Button>
          </div>
        </div>
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
  
  const handleDeleteSenda = async (senda) => {
    if (!window.confirm(`¿Estás seguro de eliminar la senda "${senda}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    try {
      await api.delete(`/sombra/sendas/${encodeURIComponent(senda)}`);
      toast.success(`Senda "${senda}" eliminada correctamente`);
      // Reload shadow data
      const response = await api.get('/data/sombra');
      setData(response.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al eliminar la senda');
    }
  };
  
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

  // === REGION MANAGEMENT FUNCTIONS ===
  const refreshRegions = async () => {
    const regionsRes = await api.get('/data/regions');
    setData(regionsRes.data?.regions || []);
  };

  const seedRegions = async () => {
    setRegionLoading(true);
    try {
      await api.post('/data/regions/seed');
      toast.success('Regiones iniciales creadas');
      await refreshRegions();
    } catch (err) {
      toast.error('Error al crear regiones: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRegionLoading(false);
    }
  };

  const createRegion = async (nombre, parentId = null) => {
    setRegionLoading(true);
    try {
      await api.post('/data/regions', { nombre, parent_id: parentId, orden: data?.length || 0 });
      toast.success(`Región "${nombre}" creada`);
      await refreshRegions();
      setNewRegionName('');
      setNewSubregionName('');
      setIsAddingRegion(false);
      setIsAddingSubregion(false);
      setSelectedParentRegion(null);
    } catch (err) {
      toast.error('Error al crear región: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRegionLoading(false);
    }
  };

  const updateRegion = async (regionId, newName) => {
    setRegionLoading(true);
    try {
      await api.put(`/data/regions/${regionId}`, { nombre: newName });
      toast.success('Región actualizada');
      await refreshRegions();
      setEditingRegion(null);
    } catch (err) {
      toast.error('Error al actualizar región: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRegionLoading(false);
    }
  };

  const deleteRegion = async (regionId, nombre, hasSubregions = false) => {
    const msg = hasSubregions 
      ? `¿Eliminar "${nombre}" y todas sus sub-regiones?`
      : `¿Eliminar "${nombre}"?`;
    
    if (!window.confirm(msg)) return;
    
    setRegionLoading(true);
    try {
      await api.delete(`/data/regions/${regionId}`);
      toast.success('Región eliminada');
      await refreshRegions();
    } catch (err) {
      toast.error('Error al eliminar región: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRegionLoading(false);
    }
  };

  // === RENDER REGIONS ===
  const renderRegions = () => {
    const regions = data || [];
    
    return (
      <div className="space-y-6">
        {/* Header with actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/30">
          <div>
            <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
              <MapPin className="w-5 h-5 inline mr-2" />
              Gestión de Regiones
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define las regiones principales y sus sub-regiones para organizar el mapa
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex gap-2">
              {regions.length === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={seedRegions}
                  disabled={regionLoading}
                  data-testid="seed-regions-btn"
                >
                  {regionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Cargar Regiones Iniciales
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsAddingRegion(true)}
                disabled={regionLoading}
                className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
                data-testid="add-region-btn"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva Región Principal
              </Button>
            </div>
          )}
        </div>

        {/* Add new main region form */}
        {isAddingRegion && (
          <div className="card-parchment p-4 rounded-lg border-2 border-dashed border-[hsl(var(--gold))]/50">
            <h3 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Nueva Región Principal</h3>
            <div className="flex gap-2">
              <Input
                value={newRegionName}
                onChange={(e) => setNewRegionName(e.target.value)}
                placeholder="Nombre de la región..."
                className="flex-1"
                autoFocus
                data-testid="new-region-input"
              />
              <Button
                onClick={() => createRegion(newRegionName)}
                disabled={!newRegionName.trim() || regionLoading}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {regionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
              </Button>
              <Button
                onClick={() => { setIsAddingRegion(false); setNewRegionName(''); }}
                variant="ghost"
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Regions list */}
        {regions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No hay regiones definidas.</p>
            {isAdmin && <p className="text-sm mt-2">Haz clic en "Cargar Regiones Iniciales" para empezar con las regiones de la Tierra Media.</p>}
          </div>
        ) : (
          <div className="grid gap-4">
            {regions.map((region) => (
              <div key={region.id} className="card-parchment rounded-lg overflow-hidden" data-testid={`region-${region.id}`}>
                {/* Main region header */}
                <div className="flex items-center justify-between p-4 bg-black/10">
                  {editingRegion === region.id ? (
                    <div className="flex gap-2 flex-1 mr-4">
                      <Input
                        defaultValue={region.nombre}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') updateRegion(region.id, e.target.value);
                          if (e.key === 'Escape') setEditingRegion(null);
                        }}
                        className="flex-1"
                        autoFocus
                        data-testid={`edit-region-input-${region.id}`}
                      />
                      <Button
                        onClick={(e) => updateRegion(region.id, e.target.previousSibling.value)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Guardar
                      </Button>
                      <Button
                        onClick={() => setEditingRegion(null)}
                        variant="ghost"
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[hsl(var(--gold))]" />
                        <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{region.nombre}</h3>
                        <span className="text-xs text-muted-foreground bg-black/20 px-2 py-0.5 rounded">
                          {region.subregions?.length || 0} sub-regiones
                        </span>
                      </div>
                      
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRegion(region.id)}
                            className="h-8 w-8 p-0"
                            data-testid={`edit-region-btn-${region.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedParentRegion(region);
                              setIsAddingSubregion(true);
                            }}
                            className="h-8 w-8 p-0 text-green-500"
                            data-testid={`add-subregion-btn-${region.id}`}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRegion(region.id, region.nombre, region.subregions?.length > 0)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            data-testid={`delete-region-btn-${region.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                {/* Sub-regions */}
                {(region.subregions?.length > 0 || (isAddingSubregion && selectedParentRegion?.id === region.id)) && (
                  <div className="p-4 pt-0">
                    {/* Add subregion form */}
                    {isAddingSubregion && selectedParentRegion?.id === region.id && (
                      <div className="flex gap-2 mb-3 mt-4 p-3 bg-black/10 rounded">
                        <Input
                          value={newSubregionName}
                          onChange={(e) => setNewSubregionName(e.target.value)}
                          placeholder="Nombre de la sub-región..."
                          className="flex-1"
                          autoFocus
                          data-testid="new-subregion-input"
                        />
                        <Button
                          onClick={() => createRegion(newSubregionName, region.id)}
                          disabled={!newSubregionName.trim() || regionLoading}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {regionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
                        </Button>
                        <Button
                          onClick={() => { setIsAddingSubregion(false); setNewSubregionName(''); setSelectedParentRegion(null); }}
                          variant="ghost"
                          size="sm"
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                    
                    {/* Subregions list */}
                    {region.subregions?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {region.subregions.map((sub) => (
                          <div
                            key={sub.id}
                            className="group flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded text-sm"
                            data-testid={`subregion-${sub.id}`}
                          >
                            {editingRegion === sub.id ? (
                              <div className="flex gap-2">
                                <Input
                                  defaultValue={sub.nombre}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateRegion(sub.id, e.target.value);
                                    if (e.key === 'Escape') setEditingRegion(null);
                                  }}
                                  className="h-7 text-sm w-32"
                                  autoFocus
                                />
                                <Button
                                  onClick={(e) => updateRegion(sub.id, e.target.previousSibling.value)}
                                  size="sm"
                                  className="h-7 px-2 bg-green-600"
                                >
                                  ✓
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span>{sub.nombre}</span>
                                {isAdmin && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setEditingRegion(sub.id)}
                                      className="p-0.5 hover:text-[hsl(var(--gold))]"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => deleteRegion(sub.id, sub.nombre)}
                                      className="p-0.5 hover:text-destructive"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
        return (
          <BackgroundsSection 
            onEdit={(bg) => openEditor('background', bg)}
            onDelete={(id, name) => handleDelete('backgrounds', id, name)}
            onRefresh={reloadData}
          />
        );
      
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
        return <SombraSection data={data} isAdmin={isAdmin} onDeleteSenda={handleDeleteSenda} />;
      
      case 'artes':
        return renderArtes();
      
      case 'recompensas':
        return renderRecompensas();
      
      case 'salarios':
        return <SalariosSection data={data} />;
      
      case 'varios':
        return <VariosSection data={data} />;
      
      case 'combate':
        return <CombateSection data={data} />;
      
      case 'travel':
        return <ViajeSection data={data} />;
      
      case 'community':
        return <ComunidadSection data={data} />;
      
      case 'npcs':
        return <NPCsSection data={data} onRefresh={async () => {
          const npcsRes = await api.get('/data/npcs');
          setData(npcsRes.data);
        }} />;
      
      case 'nameless':
        return <CriaturasSinNombreSection />;
      
      case 'regions':
        return renderRegions();
      
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
            
            const handleDeleteSenda = async (sendaName) => {
              if (!window.confirm(`¿Estás seguro de eliminar la senda "${sendaName}" y todos sus defectos?`)) return;
              try {
                await api.delete(`/data/sombra/sendas/${encodeURIComponent(sendaName)}`);
                toast.success(`Senda "${sendaName}" eliminada`);
                // Reload sombra data
                const sombraRes = await api.get('/data/sombra');
                setData(sombraRes.data);
              } catch (err) {
                toast.error('Error al eliminar la senda');
              }
            };
            
            return Object.entries(grouped).map(([senda, defectos]) => (
              <div key={senda} className="mb-6 last:mb-0">
                <div className="flex justify-between items-center bg-black/30 p-2 rounded mb-3">
                  <h4 className="font-heading text-md text-[hsl(var(--torch-orange))]">
                    {senda}
                  </h4>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/20"
                      onClick={() => handleDeleteSenda(senda)}
                      title="Eliminar senda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
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
                
                {/* Descripción */}
                {arte.descripcion && (
                  <div className="mt-3 p-3 bg-[hsl(var(--magic-blue))/10] rounded border border-[hsl(var(--magic-blue))/20]">
                    {arte.descripcion.split('\n\n').map((paragraph, pIdx) => (
                      <p key={pIdx} className="text-sm mb-2 last:mb-0 whitespace-pre-wrap">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                )}
                
                {/* Requisitos */}
                {arte.requisitos?.length > 0 && (
                  <div className="mt-3 p-3 bg-[hsl(var(--destructive))/10] rounded border border-[hsl(var(--destructive))/20]">
                    <p className="text-xs font-bold text-[hsl(var(--destructive))] mb-2">⚠️ Requisitos</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {arte.requisitos.map((req, rIdx) => (
                        <li key={rIdx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Opciones */}
                {arte.opciones?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-bold text-[hsl(var(--gold))] mb-2">⚡ Opciones de uso</p>
                    {arte.opciones.map((opcion, oIdx) => (
                      <div key={oIdx} className="p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/20]">
                        <p className="font-semibold text-[hsl(var(--gold))]">{opcion.tipo}</p>
                        <p className="text-sm mt-1">{opcion.efecto}</p>
                        {opcion.exito && (
                          <p className="text-sm mt-1 text-green-400"><strong>Éxito:</strong> {opcion.exito}</p>
                        )}
                        {opcion.exito_magico && (
                          <p className="text-sm mt-1 text-purple-400"><strong>Éxito Mágico:</strong> {opcion.exito_magico}</p>
                        )}
                        {opcion.ejemplos && (
                          <p className="text-xs text-muted-foreground mt-1"><strong>Ejemplos:</strong> {opcion.ejemplos.join(', ')}</p>
                        )}
                        {opcion.nota && (
                          <p className="text-xs text-yellow-400/80 mt-1 italic">📝 {opcion.nota}</p>
                        )}
                        {opcion.nivel_5 && (
                          <p className="text-xs text-cyan-400 mt-2"><strong>Nivel 5:</strong> {opcion.nivel_5}</p>
                        )}
                        {opcion.alternativa && (
                          <p className="text-sm mt-2 p-2 bg-black/20 rounded"><strong>Alternativa:</strong> {opcion.alternativa}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Mejora Nivel 5 (general) */}
                {arte.nivel_5 && (
                  <div className="mt-3 p-3 bg-cyan-500/10 rounded border border-cyan-500/30">
                    <p className="text-sm"><strong className="text-cyan-400">📈 Al alcanzar nivel 5:</strong> {arte.nivel_5}</p>
                  </div>
                )}
                
                {/* Reglas especiales */}
                {arte.reglas_especiales?.length > 0 && (
                  <div className="mt-3 p-3 bg-black/20 rounded border border-border/30">
                    <p className="text-xs font-bold text-muted-foreground mb-2">📋 Reglas Especiales</p>
                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                      {arte.reglas_especiales.map((regla, rIdx) => (
                        <li key={rIdx}>{regla}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Tipos de perdición (para Arte de las Runas) */}
                {arte.tipos_perdicion?.length > 0 && (
                  <div className="mt-3 p-2 bg-[hsl(var(--destructive))/10] rounded">
                    <p className="text-xs font-bold text-[hsl(var(--destructive))]">Tipos de Perdición disponibles:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {arte.tipos_perdicion.map((tipo, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 bg-[hsl(var(--destructive))/20] rounded text-xs">{tipo}</span>
                      ))}
                    </div>
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
        {/* Información General */}
        {data.info_general && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              📜 Reglas de Recompensas
            </h3>
            <p className="text-sm mb-4">{data.info_general.descripcion}</p>
            
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-black/10 p-3 rounded">
                <p className="text-[hsl(var(--gold))] font-bold mb-1">Cuándo elegir:</p>
                <p className="text-muted-foreground">{data.info_general.cuando_elegir}</p>
              </div>
              <div className="bg-black/10 p-3 rounded">
                <p className="text-[hsl(var(--torch-orange))] font-bold mb-1">Aplicación:</p>
                <p className="text-muted-foreground">{data.info_general.aplicacion}</p>
              </div>
              <div className="bg-black/10 p-3 rounded">
                <p className="text-[hsl(var(--magic-blue))] font-bold mb-1">Interpretación:</p>
                <p className="text-muted-foreground">{data.info_general.interpretacion}</p>
              </div>
              <div className="bg-black/10 p-3 rounded">
                <p className="text-[hsl(var(--destructive))] font-bold mb-1">Inmunidad Argumental:</p>
                <p className="text-muted-foreground">{data.info_general.inmunidad_argumental}</p>
              </div>
            </div>
            
            {data.info_general.prestamo && (
              <div className="mt-4 p-3 bg-[hsl(var(--torch-orange))/10] rounded border border-[hsl(var(--torch-orange))/30]">
                <p className="text-sm"><span className="font-bold text-[hsl(var(--torch-orange))]">Préstamo:</span> {data.info_general.prestamo}</p>
              </div>
            )}
          </div>
        )}

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
                {n.descripcion && <p className="text-xs text-[hsl(var(--torch-orange))] mt-1">{n.descripcion}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Mejoras de Equipo (Detalladas) */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            ⚔️ Mejoras de Equipo
          </h3>
          <div className="space-y-4">
            {data.mejoras?.map((m, i) => (
              <div key={i} className="bg-black/10 p-4 rounded border-l-4 border-[hsl(var(--torch-orange))]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-xs font-bold rounded">{m.tipo}</span>
                  <h4 className="font-heading text-lg text-[hsl(var(--torch-orange))]">{m.nombre}</h4>
                </div>
                {m.descripcion && (
                  <p className="text-sm text-muted-foreground italic mb-2">{m.descripcion}</p>
                )}
                <div className="bg-[hsl(var(--gold))/10] p-2 rounded mb-2">
                  <p className="text-sm"><span className="font-bold text-[hsl(var(--gold))]">Efecto:</span> {m.efecto_mecanico || m.efecto}</p>
                </div>
                {m.restricciones && (
                  <p className="text-xs text-destructive"><span className="font-bold">Restricciones:</span> {m.restricciones}</p>
                )}
                {m.efecto_adicional_anillo_unico && (
                  <div className="mt-2 p-2 bg-[hsl(var(--magic-blue))/10] rounded text-xs">
                    <span className="font-bold text-[hsl(var(--magic-blue))]">El Anillo Único:</span> {m.efecto_adicional_anillo_unico}
                  </div>
                )}
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

        {/* Armas con Nombre */}
        {data.armas_con_nombre && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
              🗡️ Armas con Nombre
            </h3>
            <p className="text-sm mb-4">{data.armas_con_nombre.descripcion}</p>
            
            <div className="space-y-3">
              {data.armas_con_nombre.tradiciones?.map((t, i) => (
                <div key={i} className="bg-black/10 p-3 rounded">
                  <p className="font-bold text-[hsl(var(--gold))] mb-1">{t.cultura}</p>
                  <p className="text-sm text-muted-foreground">{t.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // === RENDER SALARIOS ===
  const renderSalarios = () => {
    if (!data) return <p className="text-muted-foreground">No hay datos de salarios cargados</p>;
    
    const renderCategoriaTable = (titulo, trabajadores, icon) => (
      <div className="card-parchment rounded-lg p-4 mb-4">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 border-b border-[hsl(var(--gold))/30] pb-2">
          {icon} {titulo}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-xs">
                <th className="text-left py-2 px-2">Ocupación</th>
                <th className="text-center py-2 px-2">Mod.</th>
                <th className="text-center py-2 px-2">Bajo</th>
                <th className="text-center py-2 px-2">Medio</th>
                <th className="text-center py-2 px-2">Alto</th>
                <th className="text-center py-2 px-2">Diario</th>
                <th className="text-left py-2 px-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {trabajadores?.map((t, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-2 px-2 font-medium text-[hsl(var(--torch-orange))]">{t.ocupacion}</td>
                  <td className="py-2 px-2 text-center text-[hsl(var(--magic-blue))]">x{t.modificador}</td>
                  <td className="py-2 px-2 text-center">{t.salario_bajo} mc</td>
                  <td className="py-2 px-2 text-center font-semibold text-[hsl(var(--gold))]">{t.salario_medio} mc</td>
                  <td className="py-2 px-2 text-center">{t.salario_alto} mc</td>
                  <td className="py-2 px-2 text-center text-xs">{t.diario} mc</td>
                  <td className="py-2 px-2 text-xs text-muted-foreground">{t.notas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    const renderModificadores = (titulo, mods, colorClass) => (
      <div className="bg-black/10 p-3 rounded mb-3">
        <h4 className={`font-semibold ${colorClass} mb-2`}>{titulo}</h4>
        <div className="space-y-1">
          {mods?.map((m, i) => {
            const mod = m.modificador;
            const isPositive = mod && (mod.startsWith('+') || (!mod.startsWith('-') && mod !== '0'));
            const isNegative = mod && mod.startsWith('-');
            return (
              <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/10 last:border-0">
                <span className="flex-1">{m.region || m.tipo || m.relacion || m.situacion}</span>
                <span className={`font-mono w-16 text-right ${isPositive ? 'text-red-400' : isNegative ? 'text-green-400' : 'text-muted-foreground'}`}>
                  {mod}
                </span>
                <span className="text-xs text-muted-foreground ml-2 flex-1">{m.notas}</span>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="card-parchment rounded-lg p-4">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))] mb-2">💰 {data.descripcion}</h2>
          <p className="text-sm text-muted-foreground">{data.nota}</p>
        </div>

        {/* Categories Tables */}
        {renderCategoriaTable('Trabajadores No Cualificados', data.categorias?.trabajadores_no_cualificados, '👷')}
        {renderCategoriaTable('Trabajadores Cualificados', data.categorias?.trabajadores_cualificados, '🔨')}
        {renderCategoriaTable('Nobles y Guerreros', data.categorias?.nobles_y_guerreros, '⚔️')}
        {renderCategoriaTable('Razas Especiales', data.categorias?.razas_especiales, '✨')}

        {/* Modificadores */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            📊 Modificadores de Salario
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Aplica estos modificadores al salario base según las circunstancias.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {renderModificadores('Por Región', data.modificadores?.por_region, 'text-[hsl(var(--gold))]')}
            {renderModificadores('Por Tipo de Asentamiento', data.modificadores?.por_asentamiento, 'text-[hsl(var(--torch-orange))]')}
            {renderModificadores('Por Relación con el PJ', data.modificadores?.por_relacion, 'text-[hsl(var(--magic-blue))]')}
            {renderModificadores('Por Contexto Histórico', data.modificadores?.por_contexto, 'text-destructive')}
          </div>
        </div>
      </div>
    );
  };

  // === RENDER VARIOS (Multiple Rules) ===
  const renderVarios = () => {
    if (!data) return <p className="text-muted-foreground">No hay reglas varias cargadas</p>;
    
    return (
      <div className="space-y-6">
        {/* Pruebas de Habilidad */}
        {data.pruebas_habilidad && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              🎲 Pruebas de Habilidad
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{data.pruebas_habilidad.descripcion}</p>
            
            {/* Habilidades por Característica */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {Object.entries(data.pruebas_habilidad.habilidades_por_caracteristica || {}).map(([carac, habs]) => (
                <div key={carac} className="bg-black/10 p-3 rounded">
                  <h4 className="font-bold text-[hsl(var(--gold))] text-sm mb-2">{carac}</h4>
                  <ul className="text-xs space-y-1">
                    {habs.map((h, i) => <li key={i}>• {h}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            
            {/* Tabla de Dificultad */}
            <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">Tabla de Dificultad</h4>
            <p className="text-xs text-muted-foreground mb-3">{data.pruebas_habilidad.nota_elevacion}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Dificultad</th>
                    <th className="text-center py-2 px-2">CD</th>
                    <th className="text-left py-2 px-2">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pruebas_habilidad.dificultad?.map((d, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2 font-medium text-[hsl(var(--torch-orange))]">{d.nombre}</td>
                      <td className="py-2 px-2 text-center font-bold text-[hsl(var(--gold))]">{d.cd}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{d.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ventaja */}
        {data.ventaja && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              ⚖️ Ventaja y Desventaja
            </h3>
            <p className="text-sm mb-4">{data.ventaja.descripcion}</p>
            <div className="grid md:grid-cols-2 gap-4">
              {data.ventaja.reglas?.map((r, i) => (
                <div key={i} className={`p-4 rounded text-center ${r.tipo === 'Ventaja' ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                  <p className={`text-2xl font-bold ${r.tipo === 'Ventaja' ? 'text-green-400' : 'text-red-400'}`}>
                    {r.tipo === 'Ventaja' ? '+5' : '-5'}
                  </p>
                  <p className="text-sm font-medium mt-1">{r.tipo}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.efecto}</p>
                </div>
              ))}
            </div>
            {data.ventaja.nota && (
              <p className="text-sm text-muted-foreground mt-3 text-center italic">{data.ventaja.nota}</p>
            )}
          </div>
        )}

        {/* Cansancio */}
        {data.cansancio && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
              😴 Cansancio
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{data.cansancio.descripcion}</p>
            
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-center py-2 px-2 w-20">Nivel</th>
                    <th className="text-left py-2 px-2">Consecuencia</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cansancio.niveles?.map((n, i) => (
                    <tr key={i} className={`border-b border-border/10 ${n.nivel === 6 ? 'bg-red-900/20' : ''}`}>
                      <td className="py-2 px-2 text-center">
                        <span className={`inline-block w-8 h-8 rounded-full ${n.nivel === 6 ? 'bg-red-500' : 'bg-[hsl(var(--torch-orange))]'} text-black font-bold leading-8`}>
                          {n.nivel}
                        </span>
                      </td>
                      <td className={`py-2 px-2 ${n.nivel === 6 ? 'text-red-400 font-bold' : ''}`}>{n.consecuencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {data.cansancio.reglas?.map((r, i) => (
                <div key={i} className="bg-black/10 p-3 rounded">
                  <p className="font-semibold text-[hsl(var(--gold))] text-sm">{r.regla}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.efecto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inspiración */}
        {data.inspiracion && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              ✨ Inspiración
            </h3>
            <p className="text-sm mb-4">{data.inspiracion.descripcion}</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--gold))] mb-2">¿Cómo se obtiene?</h4>
                <ul className="text-sm space-y-1">
                  {data.inspiracion.como_obtener?.map((o, i) => (
                    <li key={i}>• {o}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-2 italic">{data.inspiracion.nota_acumulacion}</p>
              </div>
              
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">¿Cómo se usa?</h4>
                <ul className="text-sm space-y-1">
                  {data.inspiracion.como_usar?.map((u, i) => (
                    <li key={i}>• {u}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Ojo de Mordor */}
        {data.ojo_de_mordor && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-destructive mb-4 border-b border-destructive/30 pb-2">
              👁️ Ojo de Mordor
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{data.ojo_de_mordor.descripcion}</p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Puntuación Inicial */}
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">Puntuación Inicial</h4>
                <div className="space-y-1">
                  {data.ojo_de_mordor.puntuacion_inicial?.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{p.condicion}</span>
                      <span className="font-bold text-red-400">+{p.puntos}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Durante el Juego */}
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">Durante el Juego</h4>
                <div className="space-y-1">
                  {data.ojo_de_mordor.durante_juego?.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{d.evento}</span>
                      <span className="font-bold text-red-400">+{d.puntos}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Episodios de Revelación */}
            <div className="bg-red-900/10 p-3 rounded border border-red-500/30 mb-4">
              <h4 className="font-semibold text-red-400 mb-2">Episodios de Revelación</h4>
              <p className="text-sm">{data.ojo_de_mordor.episodios_revelacion}</p>
              <p className="text-sm mt-2 text-muted-foreground italic">{data.ojo_de_mordor.volver_nivel_inicial}</p>
            </div>

            {/* La Caza */}
            {data.ojo_de_mordor.la_caza && (
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-destructive mb-2">La Caza</h4>
                <p className="text-sm text-muted-foreground mb-2">{data.ojo_de_mordor.la_caza.descripcion}</p>
                
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[hsl(var(--gold))] mb-1">Umbrales por Región</p>
                    {data.ojo_de_mordor.la_caza.regiones?.map((r, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span>{r.region}</span>
                        <span className="font-mono text-[hsl(var(--torch-orange))]">{r.umbral}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[hsl(var(--magic-blue))] mb-1">Modificadores</p>
                    {data.ojo_de_mordor.la_caza.modificadores?.map((m, i) => (
                      <div key={i} className="text-xs py-1 border-b border-border/10 last:border-0">
                        <span className={`font-mono ${m.modificador.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{m.modificador}</span>
                        <span className="ml-2 text-muted-foreground">{m.descripcion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Más Allá del Nivel 10 */}
        {data.mas_alla_nivel_10 && (
          <div className="card-parchment rounded-lg p-4 bg-[hsl(var(--gold))/10]">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              🏔️ Más Allá del Nivel 10
            </h3>
            <p className="text-sm italic">{data.mas_alla_nivel_10.descripcion}</p>
          </div>
        )}
      </div>
    );
  };

  // === RENDER COMBATE ===
  const renderCombate = () => {
    if (!data) return <p className="text-muted-foreground">No hay reglas de combate cargadas</p>;
    
    return (
      <div className="space-y-6">
        {/* Estructura del Combate */}
        {data.estructura && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-destructive mb-4 border-b border-destructive/30 pb-2">
              ⚔️ {data.estructura.descripcion}
            </h3>
            <div className="space-y-3">
              {data.estructura.fases?.map((f, i) => (
                <div key={i} className="flex gap-4 items-start p-3 bg-black/10 rounded">
                  <span className="w-8 h-8 rounded-full bg-destructive text-white font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-[hsl(var(--gold))]">{f.fase}</p>
                    <p className="text-sm text-muted-foreground">{f.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        {data.acciones && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
              🎬 {data.acciones.descripcion}
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              {data.acciones.lista?.map((a, i) => (
                <div key={i} className="bg-black/10 p-3 rounded border-l-4 border-[hsl(var(--torch-orange))]">
                  <p className="font-semibold text-[hsl(var(--gold))]">{a.accion}</p>
                  <p className="text-sm text-muted-foreground">{a.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atacar */}
        {data.atacar && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              🎯 {data.atacar.descripcion}
            </h3>
            
            <div className="space-y-3 mb-4">
              {data.atacar.pasos?.map((p, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded bg-[hsl(var(--magic-blue))] text-black text-sm font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-[hsl(var(--gold))]">{p.paso}</p>
                    <p className="text-sm text-muted-foreground">{p.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Críticos */}
            <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">Tiradas Especiales</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {data.atacar.criticos?.map((c, i) => (
                <div key={i} className={`p-3 rounded text-center ${c.tirada === 20 ? 'bg-green-900/20 border border-green-500/30' : 'bg-red-900/20 border border-red-500/30'}`}>
                  <p className={`text-3xl font-bold ${c.tirada === 20 ? 'text-green-400' : 'text-red-400'}`}>
                    {c.tirada}
                  </p>
                  <p className="text-sm mt-1">{c.efecto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Muerte e Inconsciencia */}
        {data.muerte_e_inconsciencia && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-destructive mb-4 border-b border-destructive/30 pb-2">
              💀 Muerte e Inconsciencia
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                <h4 className="font-semibold text-red-400 mb-2">Muerte</h4>
                <p className="text-sm">{data.muerte_e_inconsciencia.muerte}</p>
              </div>
              <div className="bg-yellow-900/20 p-3 rounded border border-yellow-500/30">
                <h4 className="font-semibold text-yellow-400 mb-2">Inconsciencia</h4>
                <p className="text-sm">{data.muerte_e_inconsciencia.inconsciencia}</p>
              </div>
            </div>

            {/* Tiradas de Salvación de Muerte */}
            {data.muerte_e_inconsciencia.tiradas_salvacion_muerte && (
              <div className="bg-black/10 p-4 rounded mb-4">
                <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">
                  Tiradas de Salvación de la Muerte
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {data.muerte_e_inconsciencia.tiradas_salvacion_muerte.descripcion}
                </p>
                <div className="space-y-2">
                  {data.muerte_e_inconsciencia.tiradas_salvacion_muerte.reglas?.map((r, i) => (
                    <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-border/10 last:border-0">
                      <span className="font-mono text-[hsl(var(--magic-blue))]">{r.resultado}</span>
                      <span className="text-muted-foreground">{r.efecto}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-green-900/20 p-3 rounded border border-green-500/30">
              <h4 className="font-semibold text-green-400 mb-2">Estabilizar</h4>
              <p className="text-sm">{data.muerte_e_inconsciencia.estabilizar}</p>
            </div>
            
            <p className="text-sm text-muted-foreground mt-3 italic">
              {data.muerte_e_inconsciencia.nota_enemigos}
            </p>
          </div>
        )}
      </div>
    );
  };

  // === RENDER VIAJE ===
  const renderViaje = () => {
    if (!data) return <p className="text-muted-foreground">No hay reglas de viaje cargadas</p>;
    
    return (
      <div className="space-y-6">
        {/* Introducción */}
        {data.introduccion && (
          <div className="card-parchment rounded-lg p-4">
            <h2 className="font-heading text-xl text-[hsl(var(--gold))] mb-3 border-b border-[hsl(var(--gold))/30] pb-2">
              🗺️ {data.introduccion.titulo}
            </h2>
            <p className="text-sm">{data.introduccion.descripcion}</p>
          </div>
        )}

        {/* Papeles de Viaje */}
        {data.papeles_viaje && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
              👥 Papeles de Viaje
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{data.papeles_viaje.descripcion}</p>
            
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              {data.papeles_viaje.papeles?.map((p, i) => (
                <div key={i} className="bg-black/10 p-3 rounded border-l-4 border-[hsl(var(--gold))]">
                  <p className="font-bold text-[hsl(var(--gold))]">{p.papel}</p>
                  <p className="text-sm text-muted-foreground">{p.funcion}</p>
                </div>
              ))}
            </div>

            {/* Asignación de papeles */}
            <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
              <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">Cómo asignar los papeles</h4>
              <ul className="text-sm space-y-1">
                {data.papeles_viaje.asignacion?.reglas?.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Secuencia del Viaje */}
        {data.secuencia_viaje && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              📋 Secuencia del Viaje
            </h3>
            <p className="text-sm text-muted-foreground mb-4 italic">{data.secuencia_viaje.nota}</p>
            
            <div className="space-y-4">
              {data.secuencia_viaje.pasos?.map((paso, i) => (
                <div key={i} className="bg-black/10 p-4 rounded">
                  <div className="flex items-start gap-3 mb-2">
                    <span className="w-8 h-8 rounded-full bg-[hsl(var(--magic-blue))] text-white font-bold flex items-center justify-center flex-shrink-0">
                      {paso.numero}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-bold text-[hsl(var(--gold))]">{paso.titulo}</h4>
                      <p className="text-sm text-muted-foreground">{paso.descripcion}</p>
                    </div>
                  </div>
                  
                  {paso.consideraciones && (
                    <div className="ml-11 mt-2">
                      <p className="text-xs font-semibold text-[hsl(var(--torch-orange))] mb-1">Consideraciones:</p>
                      <ul className="text-xs space-y-1">
                        {paso.consideraciones.map((c, ci) => <li key={ci}>• {c}</li>)}
                      </ul>
                    </div>
                  )}
                  
                  {paso.maestro && (
                    <div className="ml-11 mt-2">
                      <p className="text-xs font-semibold text-[hsl(var(--magic-blue))] mb-1">El Maestro del saber:</p>
                      <ul className="text-xs space-y-1">
                        {paso.maestro.map((m, mi) => <li key={mi}>• {m}</li>)}
                      </ul>
                    </div>
                  )}
                  
                  {paso.prueba && (
                    <div className="ml-11 mt-2 bg-[hsl(var(--gold))/10] p-2 rounded">
                      <p className="text-sm font-semibold text-[hsl(var(--gold))]">{paso.prueba.tipo}</p>
                      {paso.prueba.alternativas && (
                        <p className="text-xs text-muted-foreground">
                          Alternativas: {paso.prueba.alternativas.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-red-400 mt-1">{paso.prueba.penalizacion}</p>
                    </div>
                  )}
                  
                  {paso.resultados && (
                    <div className="ml-11 mt-3">
                      <p className="text-xs font-semibold mb-2">Distancia al acontecimiento:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {paso.resultados.map((r, ri) => (
                          <div key={ri} className={`p-2 rounded text-center text-xs ${r.resultado.includes('Éxito') ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                            <p className={`font-semibold ${r.resultado.includes('Éxito') ? 'text-green-400' : 'text-red-400'}`}>{r.resultado}</p>
                            <p className="text-muted-foreground">{r.distancia}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fatiga */}
        {data.fatiga && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
              😰 Fatiga
            </h3>
            <p className="text-sm mb-4">{data.fatiga.descripcion}</p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
              {data.fatiga.resultados?.map((r, i) => (
                <div key={i} className={`p-3 rounded text-center ${r.resultado === 'Éxito' ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                  <p className={`font-semibold ${r.resultado === 'Éxito' ? 'text-green-400' : 'text-red-400'}`}>{r.resultado}</p>
                  <p className="text-xs text-muted-foreground">{r.efecto}</p>
                </div>
              ))}
            </div>
            
            <p className="text-sm text-[hsl(var(--magic-blue))] italic">🐴 {data.fatiga.montura}</p>
          </div>
        )}

        {/* Duración del Viaje */}
        {data.duracion_viaje && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              ⏱️ Duración del Viaje
            </h3>
            <p className="text-sm text-muted-foreground mb-3">{data.duracion_viaje.descripcion}</p>
            
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              {data.duracion_viaje.reglas?.map((r, i) => (
                <div key={i} className="bg-black/10 p-2 rounded flex justify-between items-center">
                  <span className="text-sm">{r.condicion}</span>
                  <span className="text-sm font-mono text-[hsl(var(--torch-orange))]">{r.duracion}</span>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-yellow-900/20 p-3 rounded border border-yellow-500/30">
                <h4 className="font-semibold text-yellow-400 mb-2">⛰️ Terreno Difícil</h4>
                <ul className="text-sm space-y-1">
                  {data.duracion_viaje.terreno_dificil?.reglas?.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-red-900/20 p-3 rounded border border-red-500/30">
                <h4 className="font-semibold text-red-400 mb-2">🏃 Marcha Forzada</h4>
                <p className="text-sm">{data.duracion_viaje.marcha_forzada?.efecto}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.duracion_viaje.marcha_forzada?.salvacion}</p>
              </div>
            </div>
          </div>
        )}

        {/* Áreas Peligrosas */}
        {data.areas_peligrosas && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-destructive mb-4 border-b border-destructive/30 pb-2">
              ⚠️ Áreas Peligrosas
            </h3>
            <p className="text-sm mb-3">{data.areas_peligrosas.descripcion}</p>
            <ul className="text-sm space-y-1">
              {data.areas_peligrosas.reglas?.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Otras Reglas */}
        {data.otras_reglas && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
              📜 Otras Reglas de Viaje
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {data.otras_reglas.advertir_amenazas && (
                <div className="bg-black/10 p-3 rounded">
                  <h4 className="font-semibold text-[hsl(var(--gold))]">👁️ Advertir Amenazas</h4>
                  <p className="text-sm">{data.otras_reglas.advertir_amenazas.descripcion}</p>
                  <p className="text-xs text-red-400 mt-1">{data.otras_reglas.advertir_amenazas.penalizacion}</p>
                </div>
              )}
              {data.otras_reglas.sigilo && (
                <div className="bg-black/10 p-3 rounded">
                  <h4 className="font-semibold text-[hsl(var(--torch-orange))]">🤫 Sigilo</h4>
                  <p className="text-sm">{data.otras_reglas.sigilo.descripcion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Experiencia por Viaje */}
        {data.experiencia_viaje && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
              ⭐ Experiencia por Viaje
            </h3>
            <p className="text-sm text-muted-foreground mb-2">Se otorgan PX solo si:</p>
            <ul className="text-sm mb-4 space-y-1">
              {data.experiencia_viaje.condiciones?.map((c, i) => (
                <li key={i}>• {c}</li>
              ))}
            </ul>
            <p className="text-sm text-[hsl(var(--magic-blue))] mb-3">{data.experiencia_viaje.calculo}</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Terreno</th>
                    <th className="text-center py-2 px-2">T. Fronterizas</th>
                    <th className="text-center py-2 px-2">T. Salvajes</th>
                    <th className="text-center py-2 px-2">T. Oscuras</th>
                  </tr>
                </thead>
                <tbody>
                  {data.experiencia_viaje.tabla?.map((t, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2 font-medium">{t.terreno}</td>
                      <td className="py-2 px-2 text-center text-green-400">{t.fronterizas}</td>
                      <td className="py-2 px-2 text-center text-yellow-400">{t.salvajes}</td>
                      <td className="py-2 px-2 text-center text-red-400">{t.oscuras}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Acontecimientos de Viaje */}
        {data.acontecimientos && (
          <div className="card-parchment rounded-lg p-4">
            <h3 className="font-heading text-lg text-destructive mb-4 border-b border-destructive/30 pb-2">
              🎲 Acontecimientos de Viaje
            </h3>
            
            {/* Secuencia */}
            <div className="mb-4">
              <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">Secuencia:</h4>
              <div className="flex flex-wrap gap-2">
                {data.acontecimientos.secuencia?.map((s, i) => (
                  <div key={i} className="bg-black/10 px-3 py-1 rounded text-sm">
                    <span className="font-semibold text-[hsl(var(--gold))]">{s.paso}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Objetivos (1d3) */}
            <div className="mb-4">
              <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">Elegir objetivos (1d3):</h4>
              <div className="grid grid-cols-3 gap-2">
                {data.acontecimientos.objetivos?.map((o, i) => (
                  <div key={i} className="bg-black/10 p-2 rounded text-center">
                    <p className="text-2xl font-bold text-[hsl(var(--gold))]">{o.d3}</p>
                    <p className="text-sm font-semibold">{o.objetivo}</p>
                    <p className="text-xs text-muted-foreground">{o.prueba}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CD por Terreno */}
            <div className="mb-4 grid md:grid-cols-2 gap-4">
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--gold))] mb-2">CD según Terreno:</h4>
                {data.acontecimientos.cd_terreno?.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span>{c.terreno}</span>
                    <span className="font-mono text-[hsl(var(--torch-orange))]">CD {c.cd}</span>
                  </div>
                ))}
              </div>
              
              <div className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">Tirada según Región:</h4>
                {data.acontecimientos.tirada_region && Object.entries(data.acontecimientos.tirada_region).map(([region, mod], i) => (
                  <div key={i} className="flex justify-between text-sm py-1">
                    <span className="capitalize">Tierra {region}</span>
                    <span className={`font-semibold ${mod === 'Ventaja' ? 'text-green-400' : mod === 'Desventaja' ? 'text-red-400' : 'text-muted-foreground'}`}>{mod}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Penalizadores */}
            <div className="mb-4 bg-red-900/10 p-3 rounded border border-red-500/30">
              <h4 className="font-semibold text-red-400 mb-2">Penalizadores:</h4>
              <ul className="text-sm space-y-1">
                {data.acontecimientos.penalizadores?.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>

            {/* Tabla de Acontecimientos */}
            <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-3">Tabla de Acontecimientos (1d20):</h4>
            <div className="space-y-2">
              {data.acontecimientos.tabla_acontecimientos?.map((a, i) => (
                <div key={i} className={`p-3 rounded border-l-4 ${
                  a.nombre === 'Terrible desgracia' ? 'bg-red-900/20 border-red-500' :
                  a.nombre === 'Desesperanza' ? 'bg-purple-900/20 border-purple-500' :
                  a.nombre === 'Decisiones erróneas' ? 'bg-orange-900/20 border-orange-500' :
                  a.nombre === 'Percance' ? 'bg-yellow-900/20 border-yellow-500' :
                  a.nombre === 'Atajo' ? 'bg-blue-900/20 border-blue-500' :
                  a.nombre === 'Encuentro casual' ? 'bg-cyan-900/20 border-cyan-500' :
                  'bg-green-900/20 border-green-500'
                }`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-[hsl(var(--gold))] mr-2">{a.d20}</span>
                      <span className="font-bold">{a.nombre}</span>
                    </div>
                  </div>
                  <p className="text-sm text-[hsl(var(--torch-orange))] mt-1">{a.consecuencias}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">{a.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Describir Acontecimientos */}
        {data.describir_acontecimientos && (
          <div className="card-parchment rounded-lg p-4 bg-[hsl(var(--gold))/10]">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              📖 Describir los Acontecimientos
            </h3>
            <p className="text-sm">{data.describir_acontecimientos.descripcion}</p>
            <p className="text-sm text-muted-foreground mt-2 italic">
              <strong>Objetivo:</strong> {data.describir_acontecimientos.objetivo}
            </p>
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
      
      {/* Equipment PDF Export Modal */}
      {renderEquipmentPdfModal()}
    </div>
  );
};

export default RulesPage;
