/**
 * Character Creation Logic Section - EXPANDED VERSION
 * Complete guide to character creation with all steps and editable rules
 */
import { useState, useEffect } from 'react';
import { 
  Loader2, Save, RefreshCw, Plus, Trash2, Edit, ChevronDown, ChevronUp, 
  Coins, Package, User, Scroll, Swords, Sparkles, Heart, BookOpen,
  Users, Shield, Dices, PenTool, Check, Settings, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

// Currency icons/colors
const CURRENCY_CONFIG = {
  oro: { label: 'Oro', color: 'text-yellow-500', symbol: 'mo' },
  plata: { label: 'Plata', color: 'text-gray-300', symbol: 'mp' },
  cobre: { label: 'Cobre', color: 'text-orange-400', symbol: 'mc' },
  estano: { label: 'Estaño', color: 'text-gray-500', symbol: 'me' }
};

// Wealth level colors
const WEALTH_COLORS = {
  'Pobre': 'bg-red-900/30 border-red-700',
  'Frugal': 'bg-orange-900/30 border-orange-700',
  'Común': 'bg-yellow-900/30 border-yellow-700',
  'Próspero': 'bg-green-900/30 border-green-700',
  'Rico': 'bg-blue-900/30 border-blue-700'
};

// Default creation steps configuration
const DEFAULT_CREATION_STEPS = [
  {
    id: 'step_1',
    numero: 1,
    titulo: 'Elegir Cultura',
    descripcion: 'Selecciona la raza y cultura de tu personaje',
    fase: 'cultura',
    icon: 'Users',
    pasos_detallados: [
      { orden: 1, accion: 'Seleccionar Raza', descripcion: 'Elige entre: Elfos, Enanos, Hombres u Hobbits', editable: false },
      { orden: 2, accion: 'Seleccionar Subcultura', descripcion: 'Cada raza tiene múltiples culturas con diferentes bonificadores', editable: false },
    ],
    datos_generados: [
      'Nivel de Vida (Frugal, Común, Próspero)',
      'Bonificadores de Características',
      'Competencias de Habilidad',
      'Competencias de Armas',
      'Idiomas conocidos',
      'Rasgos culturales especiales'
    ],
    notas: 'Algunas culturas (Hombres del Lago, Hombres de Bree, Beórnidas) obtienen una Virtud al nivel 1.'
  },
  {
    id: 'step_2',
    numero: 2,
    titulo: 'Generar Nombre',
    descripcion: 'El nombre se genera según la cultura seleccionada',
    fase: 'cultura',
    icon: 'PenTool',
    pasos_detallados: [
      { orden: 1, accion: 'Generación Automática', descripcion: 'Se genera un nombre aleatorio según las tablas de la cultura', editable: true },
      { orden: 2, accion: 'Edición Manual', descripcion: 'El jugador puede modificar o escribir su propio nombre', editable: true },
    ],
    datos_generados: [
      'Nombre del personaje'
    ],
    notas: 'Cada cultura tiene su propia tabla de nombres con opciones masculinas y femeninas.'
  },
  {
    id: 'step_3',
    numero: 3,
    titulo: 'Datos Físicos',
    descripcion: 'Generación de edad, altura, peso y apariencia',
    fase: 'cultura',
    icon: 'User',
    pasos_detallados: [
      { orden: 1, accion: 'Generar Edad', descripcion: 'Tirada aleatoria según tabla de la cultura', editable: true },
      { orden: 2, accion: 'Generar Altura', descripcion: 'Tirada aleatoria: base + modificador de cultura', editable: true },
      { orden: 3, accion: 'Generar Peso', descripcion: 'Calculado a partir de la altura', editable: true },
      { orden: 4, accion: 'Color de Ojos', descripcion: 'Tirada en tabla específica de la cultura', editable: true },
      { orden: 5, accion: 'Color de Pelo', descripcion: 'Tirada en tabla específica de la cultura', editable: true },
      { orden: 6, accion: 'Rasgos Distintivos', descripcion: 'Opcional: cicatrices, tatuajes, etc.', editable: true },
    ],
    datos_generados: [
      'Edad', 'Altura (cm)', 'Peso (kg)', 'Color de Ojos', 'Color de Pelo', 'Rasgos Distintivos'
    ],
    notas: 'Todos los datos físicos pueden editarse manualmente después de la generación.'
  },
  {
    id: 'step_4',
    numero: 4,
    titulo: 'Asignar Características',
    descripcion: 'Distribuir los valores de las 6 características principales',
    fase: 'cultura',
    icon: 'Dices',
    pasos_detallados: [
      { orden: 1, accion: 'Array Estándar', descripcion: 'Usar el array [15, 14, 13, 12, 10, 8]', editable: true },
      { orden: 2, accion: 'Asignar a Características', descripcion: 'Distribuir valores entre FUE, DES, CON, INT, SAB, CAR', editable: false },
      { orden: 3, accion: 'Aplicar Bonificadores Culturales', descripcion: 'Sumar los bonificadores de la cultura seleccionada', editable: false },
    ],
    datos_generados: [
      'Fuerza (FUE)', 'Destreza (DES)', 'Constitución (CON)',
      'Inteligencia (INT)', 'Sabiduría (SAB)', 'Carisma (CAR)',
      'Modificadores de cada característica'
    ],
    notas: 'El array estándar es editable en la configuración. Los bonificadores culturales varían según la subcultura.'
  },
  {
    id: 'step_5',
    numero: 5,
    titulo: 'Selecciones de Cultura',
    descripcion: 'Elegir opciones específicas de la cultura',
    fase: 'cultura',
    icon: 'List',
    pasos_detallados: [
      { orden: 1, accion: 'Elegir Habilidades Extra', descripcion: 'Si la cultura permite elegir habilidades adicionales', editable: false },
      { orden: 2, accion: 'Elegir Competencia de Herramienta', descripcion: 'Algunas culturas permiten elegir una herramienta', editable: false },
      { orden: 3, accion: 'Elegir Idioma Adicional', descripcion: 'Si la cultura proporciona idiomas opcionales', editable: false },
    ],
    datos_generados: [
      'Habilidades elegidas',
      'Competencia de herramienta',
      'Idiomas adicionales'
    ],
    notas: 'Las opciones disponibles varían según la cultura seleccionada.'
  },
  {
    id: 'step_6',
    numero: 6,
    titulo: 'Elegir Trasfondo',
    descripcion: 'Historia y origen del personaje antes de ser aventurero',
    fase: 'trasfondo',
    icon: 'Scroll',
    pasos_detallados: [
      { orden: 1, accion: 'Seleccionar Trasfondo', descripcion: 'Elige un trasfondo de la lista disponible', editable: false },
      { orden: 2, accion: 'Obtener Competencias', descripcion: 'El trasfondo proporciona 2 habilidades', editable: false },
      { orden: 3, accion: 'Obtener Equipo Inicial', descripcion: 'Equipo específico del trasfondo', editable: false },
      { orden: 4, accion: 'Rasgo de Personalidad', descripcion: 'Tirada o selección de rasgo', editable: true },
      { orden: 5, accion: 'Vínculo', descripcion: 'Conexión personal del personaje', editable: true },
    ],
    datos_generados: [
      'Nombre del trasfondo',
      'Competencias de habilidad',
      'Equipo del trasfondo',
      'Rasgo de personalidad',
      'Vínculo'
    ],
    notas: 'El trasfondo representa lo que el personaje hacía antes de convertirse en aventurero.'
  },
  {
    id: 'step_7',
    numero: 7,
    titulo: 'Elegir Ocupación',
    descripcion: 'Tu vocación heroica y clase de personaje',
    fase: 'ocupacion',
    icon: 'Swords',
    pasos_detallados: [
      { orden: 1, accion: 'Seleccionar Ocupación', descripcion: 'Elige: Erudito, Guardián, Campeón, Cazador de Tesoros, Mensajero, Capitán', editable: false },
      { orden: 2, accion: 'Obtener Rasgos de Ocupación', descripcion: 'Habilidades especiales del nivel 1', editable: false },
      { orden: 3, accion: 'Elegir Especialidad', descripcion: 'Si la ocupación tiene subespecialidades', editable: false },
      { orden: 4, accion: 'Competencias de Armas', descripcion: 'Armas que la ocupación permite usar', editable: false },
      { orden: 5, accion: 'Salvaciones Competentes', descripcion: '2 salvaciones en las que eres competente', editable: false },
      { orden: 6, accion: 'Dado de Golpe', descripcion: 'Determina los PG por nivel', editable: false },
    ],
    datos_generados: [
      'Nombre de la ocupación',
      'Especialidad',
      'Rasgos de nivel 1',
      'Competencias de armas',
      'Salvaciones competentes',
      'Dado de golpe',
      'Puntos de golpe iniciales'
    ],
    notas: 'La ocupación determina las habilidades de combate y progresión del personaje.'
  },
  {
    id: 'step_8',
    numero: 8,
    titulo: 'Elegir Virtud (Condicional)',
    descripcion: 'Don especial de la cultura - Solo para culturas específicas',
    fase: 'virtud',
    icon: 'Sparkles',
    pasos_detallados: [
      { orden: 1, accion: 'Verificar Elegibilidad', descripcion: 'Solo Hombres del Lago, Hombres de Bree y Beórnidas obtienen virtud al nivel 1', editable: false },
      { orden: 2, accion: 'Seleccionar Virtud', descripcion: 'Elegir de la lista de virtudes disponibles para tu cultura', editable: false },
    ],
    datos_generados: [
      'Virtud seleccionada',
      'Efectos de la virtud'
    ],
    notas: 'Las demás culturas obtienen su primera virtud al subir de nivel. Este paso se omite si la cultura no tiene virtud inicial.',
    condicional: true,
    condicion: 'Solo para: Hombres del Lago, Hombres de Bree, Beórnidas'
  },
  {
    id: 'step_9',
    numero: 9,
    titulo: 'Calcular Estadísticas Derivadas',
    descripcion: 'Cálculo automático de valores basados en características',
    fase: 'estadisticas',
    icon: 'Settings',
    pasos_detallados: [
      { orden: 1, accion: 'Puntos de Golpe', descripcion: 'Dado de Golpe máximo + Modificador de CON', editable: false },
      { orden: 2, accion: 'Clase de Armadura', descripcion: '10 + Mod DES (o según armadura)', editable: false },
      { orden: 3, accion: 'Iniciativa', descripcion: 'Modificador de Destreza', editable: false },
      { orden: 4, accion: 'Velocidad', descripcion: 'Según la raza (generalmente 9m)', editable: false },
      { orden: 5, accion: 'Bonificador de Competencia', descripcion: '+2 para nivel 1', editable: true },
      { orden: 6, accion: 'Sombra Inicial', descripcion: 'Puntos de Sombra = 0', editable: false },
      { orden: 7, accion: 'Esperanza', descripcion: '8 + Mod de CAR', editable: false },
    ],
    datos_generados: [
      'Puntos de Golpe máximos',
      'Clase de Armadura base',
      'Iniciativa',
      'Velocidad',
      'Bonificador de Competencia',
      'Sombra permanente',
      'Esperanza'
    ],
    notas: 'Estos valores se calculan automáticamente basándose en las elecciones anteriores.'
  },
  {
    id: 'step_10',
    numero: 10,
    titulo: 'Equipo Inicial',
    descripcion: 'Determinar el equipo y dinero inicial',
    fase: 'equipo',
    icon: 'Package',
    pasos_detallados: [
      { orden: 1, accion: 'Equipo por Nivel de Vida', descripcion: 'Equipo base según Frugal/Común/Próspero', editable: true },
      { orden: 2, accion: 'Equipo de Trasfondo', descripcion: 'Objetos específicos del trasfondo', editable: false },
      { orden: 3, accion: 'Equipo de Ocupación', descripcion: 'Armas y equipo de la ocupación', editable: false },
      { orden: 4, accion: 'Dinero Inicial', descripcion: 'Según nivel de vida + bonificación de ocupación', editable: true },
      { orden: 5, accion: 'Compra de Equipo Adicional', descripcion: 'Gastar dinero en equipo extra', editable: true },
    ],
    datos_generados: [
      'Lista de equipo completa',
      'Armas equipadas',
      'Armadura equipada',
      'Dinero restante'
    ],
    notas: 'El equipo por nivel de vida y el dinero inicial son editables en la configuración.'
  },
  {
    id: 'step_11',
    numero: 11,
    titulo: 'Detalles Finales',
    descripcion: 'Personalidad, motivaciones y detalles de rol',
    fase: 'detalles',
    icon: 'Heart',
    pasos_detallados: [
      { orden: 1, accion: 'Sueño del Personaje', descripcion: 'Qué anhela conseguir el personaje', editable: true },
      { orden: 2, accion: 'Defecto Secreto', descripcion: 'Debilidad o secreto del personaje', editable: true },
      { orden: 3, accion: 'Motivación', descripcion: 'Por qué se convirtió en aventurero', editable: true },
      { orden: 4, accion: 'Aspecto Distintivo', descripcion: 'Característica memorable', editable: true },
      { orden: 5, accion: 'Notas Adicionales', descripcion: 'Historia personal, contactos, etc.', editable: true },
    ],
    datos_generados: [
      'Sueño',
      'Defecto secreto',
      'Motivación',
      'Aspecto distintivo',
      'Notas del personaje'
    ],
    notas: 'Estos detalles enriquecen la interpretación del personaje en el juego.'
  },
  {
    id: 'step_12',
    numero: 12,
    titulo: 'Generar Ficha',
    descripcion: 'Finalizar y crear la ficha de personaje',
    fase: 'finalizacion',
    icon: 'Check',
    pasos_detallados: [
      { orden: 1, accion: 'Revisar Datos', descripcion: 'Verificar que todo esté correcto', editable: false },
      { orden: 2, accion: 'Finalizar Personaje', descripcion: 'Guardar el personaje en la base de datos', editable: false },
      { orden: 3, accion: 'Generar PDF', descripcion: 'Crear ficha imprimible de 3 páginas', editable: false },
    ],
    datos_generados: [
      'Personaje guardado',
      'Ficha PDF descargable'
    ],
    notas: 'Una vez finalizado, el personaje aparecerá en "Mis Personajes".'
  }
];

// Icons mapping
const ICONS = {
  Users, User, Scroll, Swords, Sparkles, Heart, BookOpen, 
  Shield, Dices, PenTool, Check, Settings, Package, List, Coins
};

// Tab options
const TABS = [
  { id: 'pasos', name: 'Pasos de Creación', icon: List },
  { id: 'riqueza', name: 'Niveles de Vida', icon: Coins },
  { id: 'ocupaciones', name: 'Bonus de Ocupación', icon: Swords },
  { id: 'config', name: 'Arrays y Fórmulas', icon: Settings },
];

const CharacterCreationSection = ({ isAdmin }) => {
  const [activeTab, setActiveTab] = useState('pasos');
  const [config, setConfig] = useState(null);
  const [creationSteps, setCreationSteps] = useState(DEFAULT_CREATION_STEPS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [expandedOccupation, setExpandedOccupation] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [editingOccupation, setEditingOccupation] = useState(null);
  const [newEquipItem, setNewEquipItem] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data/character-creation-config');
      setConfig(response.data);
      if (response.data?.creation_steps) {
        setCreationSteps(response.data.creation_steps);
      }
    } catch (err) {
      console.error('Error loading config:', err);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const dataToSave = {
        ...config,
        creation_steps: creationSteps
      };
      await api.put('/data/character-creation-config', dataToSave);
      toast.success('Configuración guardada');
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('¿Restablecer toda la configuración a los valores por defecto?')) return;
    try {
      setSaving(true);
      await api.post('/data/character-creation-config/reset');
      await loadConfig();
      setCreationSteps(DEFAULT_CREATION_STEPS);
      toast.success('Configuración restablecida');
    } catch (err) {
      toast.error('Error al restablecer');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // WEALTH LEVEL HANDLERS
  // ============================================================================

  const updateWealthLevel = (levelName, field, value) => {
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          [field]: value
        }
      }
    }));
  };

  const updateWealthMoney = (levelName, currency, value) => {
    const numValue = parseInt(value) || 0;
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          dinero: {
            ...prev.wealth_levels[levelName].dinero,
            [currency]: numValue
          }
        }
      }
    }));
  };

  const addEquipToLevel = (levelName) => {
    if (!newEquipItem.trim()) return;
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          equipo_extra: [...(prev.wealth_levels[levelName].equipo_extra || []), newEquipItem.trim()]
        }
      }
    }));
    setNewEquipItem('');
  };

  const removeEquipFromLevel = (levelName, index) => {
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          equipo_extra: prev.wealth_levels[levelName].equipo_extra.filter((_, i) => i !== index)
        }
      }
    }));
  };

  // ============================================================================
  // OCCUPATION BONUS HANDLERS
  // ============================================================================

  const updateOccupationBonus = (occName, field, value) => {
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          [field]: value
        }
      }
    }));
  };

  const addEquipToOccupation = (occName) => {
    if (!newEquipItem.trim()) return;
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          equipo_extra: [...(prev.occupation_bonuses[occName].equipo_extra || []), newEquipItem.trim()]
        }
      }
    }));
    setNewEquipItem('');
  };

  const removeEquipFromOccupation = (occName, index) => {
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          equipo_extra: prev.occupation_bonuses[occName].equipo_extra.filter((_, i) => i !== index)
        }
      }
    }));
  };

  // ============================================================================
  // STEP UPDATE HANDLERS
  // ============================================================================

  const updateStepNote = (stepId, newNote) => {
    setCreationSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, notas: newNote } : step
    ));
  };

  const updateStepDetailEditable = (stepId, pasoIndex, editable) => {
    setCreationSteps(prev => prev.map(step => {
      if (step.id === stepId) {
        const newPasos = [...step.pasos_detallados];
        newPasos[pasoIndex] = { ...newPasos[pasoIndex], editable };
        return { ...step, pasos_detallados: newPasos };
      }
      return step;
    }));
  };

  // ============================================================================
  // RENDER TABS
  // ============================================================================

  const renderTabs = () => (
    <div className="flex gap-2 mb-6 flex-wrap">
      {TABS.map(tab => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? 'default' : 'outline'}
          onClick={() => setActiveTab(tab.id)}
          className={activeTab === tab.id ? 'bg-[hsl(var(--gold))] text-black' : ''}
          data-testid={`tab-${tab.id}`}
        >
          <tab.icon className="w-4 h-4 mr-2" />
          {tab.name}
        </Button>
      ))}
    </div>
  );

  // ============================================================================
  // RENDER CREATION STEPS TAB
  // ============================================================================

  const renderCreationStepsTab = () => {
    const faseColors = {
      cultura: 'border-l-blue-500 bg-blue-900/10',
      trasfondo: 'border-l-purple-500 bg-purple-900/10',
      ocupacion: 'border-l-red-500 bg-red-900/10',
      virtud: 'border-l-yellow-500 bg-yellow-900/10',
      estadisticas: 'border-l-green-500 bg-green-900/10',
      equipo: 'border-l-orange-500 bg-orange-900/10',
      detalles: 'border-l-pink-500 bg-pink-900/10',
      finalizacion: 'border-l-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10',
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Pasos de Creación de Personaje</h3>
            <p className="text-sm text-muted-foreground">Guía completa del proceso de creación, paso a paso</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 p-3 bg-black/20 rounded-lg text-xs">
          <span className="font-medium text-muted-foreground">Fases:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Cultura</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded"></span> Trasfondo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded"></span> Ocupación</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded"></span> Virtud</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded"></span> Estadísticas</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded"></span> Equipo</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-pink-500 rounded"></span> Detalles</span>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {creationSteps.map((step, index) => {
            const IconComponent = ICONS[step.icon] || BookOpen;
            const isExpanded = expandedStep === step.id;
            
            return (
              <div 
                key={step.id}
                className={`rounded-lg border-l-4 ${faseColors[step.fase] || 'border-l-gray-500 bg-gray-900/10'} border border-border/30`}
              >
                {/* Step Header */}
                <button
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 border border-border/50">
                      <span className="font-bold text-[hsl(var(--gold))]">{step.numero}</span>
                    </div>
                    <IconComponent className="w-5 h-5 text-[hsl(var(--gold))]" />
                    <div>
                      <h4 className="font-medium text-white">{step.titulo}</h4>
                      <p className="text-sm text-muted-foreground">{step.descripcion}</p>
                      {step.condicional && (
                        <span className="text-xs text-yellow-400 flex items-center gap-1 mt-1">
                          <Sparkles className="w-3 h-3" /> {step.condicion}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Sub-steps */}
                    <div>
                      <h5 className="text-sm font-medium text-[hsl(var(--gold))] mb-2">Pasos Detallados:</h5>
                      <div className="space-y-2">
                        {step.pasos_detallados.map((paso, pasoIndex) => (
                          <div 
                            key={pasoIndex}
                            className="flex items-start gap-3 p-2 bg-black/20 rounded"
                          >
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[hsl(var(--gold))]/20 flex items-center justify-center text-xs font-bold text-[hsl(var(--gold))]">
                              {paso.orden}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{paso.accion}</span>
                                {isAdmin && (
                                  <button
                                    className={`text-xs px-2 py-0.5 rounded ${paso.editable ? 'bg-green-900/30 text-green-400' : 'bg-gray-900/30 text-gray-400'}`}
                                    onClick={() => updateStepDetailEditable(step.id, pasoIndex, !paso.editable)}
                                  >
                                    {paso.editable ? 'Editable' : 'Fijo'}
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{paso.descripcion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Generated Data */}
                    <div>
                      <h5 className="text-sm font-medium text-[hsl(var(--torch-orange))] mb-2">Datos Generados:</h5>
                      <div className="flex flex-wrap gap-2">
                        {step.datos_generados.map((dato, i) => (
                          <span 
                            key={i}
                            className="text-xs px-2 py-1 bg-[hsl(var(--torch-orange))]/10 border border-[hsl(var(--torch-orange))]/30 rounded"
                          >
                            {dato}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <h5 className="text-sm font-medium text-muted-foreground mb-2">Notas:</h5>
                      {isAdmin ? (
                        <textarea
                          className="w-full bg-black/30 border border-border rounded px-3 py-2 text-sm"
                          value={step.notas}
                          onChange={(e) => updateStepNote(step.id, e.target.value)}
                          rows={2}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">{step.notas}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER WEALTH LEVELS TAB
  // ============================================================================

  const renderWealthLevelsTab = () => {
    if (!config?.wealth_levels) {
      return <div className="text-center py-8 text-muted-foreground">No hay datos de niveles de vida</div>;
    }

    const levels = Object.entries(config.wealth_levels);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Niveles de Vida</h3>
            <p className="text-sm text-muted-foreground">Dinero y equipo inicial según el nivel de vida de la cultura</p>
          </div>
        </div>

        <div className="space-y-3">
          {levels.map(([levelName, levelData]) => (
            <div 
              key={levelName}
              className={`rounded-lg p-4 border ${WEALTH_COLORS[levelName] || 'bg-gray-900/30 border-gray-700'}`}
            >
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-heading text-lg flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[hsl(var(--gold))]" />
                  {levelName}
                </h4>
                <button
                  onClick={() => setExpandedLevel(expandedLevel === levelName ? null : levelName)}
                  className="text-sm text-muted-foreground hover:text-white"
                >
                  {expandedLevel === levelName ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {/* Summary */}
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  Dinero: <span className="text-[hsl(var(--gold))] font-medium">
                    {levelData.dinero?.oro || 0}mo, {levelData.dinero?.plata || 0}mp, {levelData.dinero?.cobre || 0}mc
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Equipo extra: <span className="text-white">{levelData.equipo_extra?.length || 0} items</span>
                </span>
              </div>

              {/* Expanded Editor */}
              {expandedLevel === levelName && isAdmin && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                  {/* Description */}
                  <div>
                    <label className="text-sm text-muted-foreground">Descripción</label>
                    <Input
                      value={levelData.descripcion || ''}
                      onChange={(e) => updateWealthLevel(levelName, 'descripcion', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {/* Money */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Dinero Inicial</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(CURRENCY_CONFIG).map(([key, curr]) => (
                        <div key={key}>
                          <label className={`text-xs ${curr.color}`}>{curr.label} ({curr.symbol})</label>
                          <Input
                            type="number"
                            value={levelData.dinero?.[key] || 0}
                            onChange={(e) => updateWealthMoney(levelName, key, e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Extra Equipment */}
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Equipo Extra</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(levelData.equipo_extra || []).map((item, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs bg-black/30 px-2 py-1 rounded">
                          {item}
                          <button 
                            onClick={() => removeEquipFromLevel(levelName, i)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nuevo item..."
                        value={newEquipItem}
                        onChange={(e) => setNewEquipItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEquipToLevel(levelName)}
                      />
                      <Button size="sm" onClick={() => addEquipToLevel(levelName)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER OCCUPATION BONUSES TAB
  // ============================================================================

  const renderOccupationBonusesTab = () => {
    if (!config?.occupation_bonuses) {
      return <div className="text-center py-8 text-muted-foreground">No hay datos de ocupaciones</div>;
    }

    const occupations = Object.entries(config.occupation_bonuses);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Bonificaciones por Ocupación</h3>
            <p className="text-sm text-muted-foreground">Dinero y equipo adicional según la ocupación elegida</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {occupations.map(([occName, occData]) => (
            <div 
              key={occName}
              className="rounded-lg p-4 bg-black/20 border border-border/30"
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-heading flex items-center gap-2">
                  <Swords className="w-4 h-4 text-[hsl(var(--torch-orange))]" />
                  {occName}
                </h4>
                {isAdmin && (
                  <button
                    onClick={() => setExpandedOccupation(expandedOccupation === occName ? null : occName)}
                    className="text-sm text-muted-foreground hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  Dinero extra: <span className="text-[hsl(var(--gold))]">{occData.dinero_extra || 0} mp</span>
                </p>
                {occData.equipo_extra?.length > 0 && (
                  <p className="text-muted-foreground">
                    Equipo: <span className="text-white">{occData.equipo_extra.join(', ')}</span>
                  </p>
                )}
              </div>

              {/* Expanded Editor */}
              {expandedOccupation === occName && isAdmin && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Dinero Extra (mp)</label>
                    <Input
                      type="number"
                      value={occData.dinero_extra || 0}
                      onChange={(e) => updateOccupationBonus(occName, 'dinero_extra', parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Equipo Extra</label>
                    <div className="flex flex-wrap gap-1 my-2">
                      {(occData.equipo_extra || []).map((item, i) => (
                        <span key={i} className="flex items-center gap-1 text-xs bg-black/30 px-2 py-1 rounded">
                          {item}
                          <button 
                            onClick={() => removeEquipFromOccupation(occName, i)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nuevo item..."
                        value={newEquipItem}
                        onChange={(e) => setNewEquipItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addEquipToOccupation(occName)}
                        className="text-sm"
                      />
                      <Button size="sm" onClick={() => addEquipToOccupation(occName)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER CONFIG TAB
  // ============================================================================

  const renderConfigTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Arrays y Fórmulas</h3>
        </div>

        {/* Standard Array */}
        <div className="bg-black/20 rounded-lg p-4 border border-border/30">
          <h4 className="font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
            <Dices className="w-5 h-5" />
            Array Estándar de Características
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Valores base que el jugador distribuye entre las 6 características
          </p>
          <div className="flex flex-wrap gap-2">
            {(config?.standard_array || [15, 14, 13, 12, 10, 8]).map((val, i) => (
              <div key={i} className="w-16">
                {isAdmin ? (
                  <Input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newArray = [...(config?.standard_array || [15, 14, 13, 12, 10, 8])];
                      newArray[i] = parseInt(e.target.value) || 0;
                      setConfig(prev => ({ ...prev, standard_array: newArray }));
                    }}
                    className="text-center"
                  />
                ) : (
                  <div className="text-center py-2 bg-black/30 rounded border border-border/30 font-bold text-[hsl(var(--gold))]">
                    {val}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Proficiency Bonus */}
        <div className="bg-black/20 rounded-lg p-4 border border-border/30">
          <h4 className="font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Bonificador de Competencia Nivel 1
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Bonificador que se aplica a tiradas con competencia
          </p>
          {isAdmin ? (
            <Input
              type="number"
              value={config?.proficiency_bonus_level_1 || 2}
              onChange={(e) => setConfig(prev => ({ ...prev, proficiency_bonus_level_1: parseInt(e.target.value) || 2 }))}
              className="w-24"
            />
          ) : (
            <span className="font-bold text-[hsl(var(--gold))] text-xl">+{config?.proficiency_bonus_level_1 || 2}</span>
          )}
        </div>

        {/* HP Formula */}
        <div className="bg-black/20 rounded-lg p-4 border border-border/30">
          <h4 className="font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Fórmulas de Estadísticas
          </h4>
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground w-40">Puntos de Golpe:</span>
              <code className="bg-black/30 px-2 py-1 rounded text-[hsl(var(--torch-orange))]">
                Dado de Golpe (máximo) + Mod. CON
              </code>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground w-40">Clase de Armadura:</span>
              <code className="bg-black/30 px-2 py-1 rounded text-[hsl(var(--torch-orange))]">
                10 + Mod. DES (sin armadura)
              </code>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground w-40">Iniciativa:</span>
              <code className="bg-black/30 px-2 py-1 rounded text-[hsl(var(--torch-orange))]">
                Mod. DES
              </code>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground w-40">Esperanza:</span>
              <code className="bg-black/30 px-2 py-1 rounded text-[hsl(var(--torch-orange))]">
                8 + Mod. CAR
              </code>
            </p>
          </div>
        </div>

        {/* Cultures with Virtue at Level 1 */}
        <div className="bg-black/20 rounded-lg p-4 border border-border/30">
          <h4 className="font-medium text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Culturas con Virtud al Nivel 1
          </h4>
          <p className="text-sm text-muted-foreground mb-3">
            Estas culturas obtienen una virtud durante la creación del personaje
          </p>
          <div className="flex flex-wrap gap-2">
            {(config?.cultures_with_virtue || ['Hombres del lago', 'Hombres de Bree', 'Beornidas']).map((culture, i) => (
              <span key={i} className="px-3 py-1 bg-yellow-900/30 border border-yellow-600 rounded text-yellow-400 text-sm">
                {culture}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="character-creation-section">
      {/* Header with Save/Reset */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">Lógica de Creación de Personajes</h2>
          <p className="text-sm text-muted-foreground">Todos los pasos y reglas del proceso de creación</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetConfig} disabled={saving}>
              <RefreshCw className="w-4 h-4 mr-2" /> Restablecer
            </Button>
            <Button size="sm" onClick={saveConfig} disabled={saving} className="bg-[hsl(var(--torch-orange))] text-black">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </div>
        )}
      </div>

      {renderTabs()}

      {activeTab === 'pasos' && renderCreationStepsTab()}
      {activeTab === 'riqueza' && renderWealthLevelsTab()}
      {activeTab === 'ocupaciones' && renderOccupationBonusesTab()}
      {activeTab === 'config' && renderConfigTab()}

      {/* Info Box */}
      <div className="bg-[hsl(var(--magic-blue))]/10 border border-[hsl(var(--magic-blue))]/30 rounded-lg p-4">
        <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">Información</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• Los pasos marcados como <span className="text-green-400">"Editable"</span> permiten al jugador modificar el resultado</li>
          <li>• Los pasos <span className="text-gray-400">"Fijos"</span> se calculan automáticamente según las reglas</li>
          <li>• El paso de Virtud solo aparece para las culturas que obtienen virtud al nivel 1</li>
          <li>• El equipo y dinero inicial se acumulan: Nivel de Vida + Trasfondo + Ocupación</li>
        </ul>
      </div>
    </div>
  );
};

export default CharacterCreationSection;
