/**
 * Step 1: FASE 1 - CULTURA COMPLETA (30 pasos del plan)
 * 
 * Flujo:
 * 1. Seleccionar Raza → Subcultura
 * 2. Al continuar: generar todos los datos automáticos (nombre, físicos, características)
 * 3. Mostrar selecciones requeridas (habilidades, herramientas)
 * 4. Si tiene virtud inicial → marcar para después de cultura
 */
import { useState, useEffect } from 'react';
import { Loader2, Shuffle, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { getCultures, getCultureNames, updateDraftStep1, generateRandomName } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

const CULTURE_CATEGORIES = [
  { id: 'Elfos', name: 'Elfos', image: '/images/races/elfos.png' },
  { id: 'Enanos', name: 'Enanos', image: '/images/races/enanos.png' },
  { id: 'Hombres', name: 'Hombres', image: '/images/races/hombres.png' },
  { id: 'Hobbits', name: 'Hobbits', image: '/images/races/hobbits.png' },
];

// Equipment by living standard
const EQUIPMENT_BY_LEVEL = {
  'Frugal': ['Ropa sencilla', 'Mochila básica', '1d6 monedas de plata'],
  'Común': ['Ropa de viaje', 'Mochila', 'Saco de dormir', '2d6 monedas de plata'],
  'Próspero': ['Ropa fina de viaje', 'Mochila de calidad', 'Saco de dormir', 'Tienda individual', '3d6 monedas de plata'],
};

// Sub-step constants
const SUB_STEPS = {
  SELECT_CULTURE: 'select_culture',
  PHYSICAL_DATA: 'physical_data',
  CHARACTERISTICS: 'characteristics',
  CULTURE_SELECTIONS: 'culture_selections',
};

const Step1Culture = ({ draftId, draft, onComplete, onBack }) => {
  // Main state
  const [cultures, setCultures] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [expandedCulture, setExpandedCulture] = useState(null);
  const [nameData, setNameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  
  // Sub-step navigation
  const [currentSubStep, setCurrentSubStep] = useState(SUB_STEPS.SELECT_CULTURE);
  
  // Physical data (generated after culture selection)
  const [gender, setGender] = useState('hombre');
  const [characterName, setCharacterName] = useState('');
  const [surname, setSurname] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [edad, setEdad] = useState(0);
  const [altura, setAltura] = useState(0);
  const [peso, setPeso] = useState(0);
  const [ojos, setOjos] = useState('');
  const [piel, setPiel] = useState('');
  const [pelo, setPelo] = useState('');
  
  // Characteristic scores (base 8 + culture bonuses)
  const [caracteristicas, setCaracteristicas] = useState({
    fuerza: 8, destreza: 8, constitucion: 8,
    inteligencia: 8, sabiduria: 8, carisma: 8
  });
  const [noldorBonus, setNoldorBonus] = useState(null); // Selected characteristic for Noldor
  
  // Culture selections
  const [selectedSkillCompetency, setSelectedSkillCompetency] = useState(null);
  const [selectedTool1, setSelectedTool1] = useState(null);
  const [selectedTools2, setSelectedTools2] = useState([]);

  // Load cultures on mount
  useEffect(() => {
    const loadCultures = async () => {
      try {
        const data = await getCultures();
        setCultures(data);
      } catch (err) {
        console.error('Error loading cultures:', err);
        setError('No se pudieron cargar las culturas');
      } finally {
        setLoading(false);
      }
    };
    loadCultures();
  }, []);

  // Filter cultures by category
  const filteredCultures = selectedCategory
    ? cultures.filter(c => c.raza === selectedCategory)
    : cultures;

  // Helper: Random from array
  const randomFrom = (arr) => arr && arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : '';

  // Helper: Random in range
  const randomInRange = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Generate all physical data when moving to sub-step 2
  const generatePhysicalData = async () => {
    if (!selectedCulture) return;
    
    // Load name data for this culture
    try {
      const names = await getCultureNames(selectedCulture.nombre);
      setNameData(names);
      
      // Generate name
      if (names) {
        const genderData = names[gender] || names.hombre;
        if (genderData) {
          const prefix = randomFrom(genderData.prefijos);
          const suffix = randomFrom(genderData.sufijos);
          setCharacterName(prefix + suffix);
        }
        setSurname(randomFrom(names.apellidos));
      }
    } catch (err) {
      console.error('Error loading names:', err);
    }
    
    // Generate physical attributes
    const newEdad = randomInRange(selectedCulture.edad_min || 18, selectedCulture.edad_max || 80);
    const newAltura = randomInRange(selectedCulture.altura_min || 150, selectedCulture.altura_max || 200);
    
    // Calculate weight using IMC formula
    const imc = selectedCulture.imc || { min: 20, max: 24 };
    const imcValue = Math.random() * (imc.max - imc.min) + imc.min;
    const modPeso = selectedCulture.mod_peso || 0;
    const alturaM = newAltura / 100;
    const newPeso = Math.round((alturaM ** 2) * imcValue * (1 + modPeso / 100) * 10) / 10;
    
    setEdad(newEdad);
    setAltura(newAltura);
    setPeso(newPeso);
    
    // Generate physical traits
    const rasgos = selectedCulture.rasgos_fisicos || {};
    setOjos(randomFrom(rasgos.ojos || []));
    setPiel(randomFrom(rasgos.piel || []));
    setPelo(randomFrom(rasgos.pelo || []));
    
    // Calculate characteristics (base 8 + bonuses)
    const bonuses = selectedCulture.bonificadores_caracteristicas || {};
    setCaracteristicas({
      fuerza: 8 + (bonuses.fuerza || 0),
      destreza: 8 + (bonuses.destreza || 0),
      constitucion: 8 + (bonuses.constitucion || 0),
      inteligencia: 8 + (bonuses.inteligencia || 0),
      sabiduria: 8 + (bonuses.sabiduria || 0),
      carisma: 8 + (bonuses.carisma || 0),
    });
  };

  // Regenerate name
  const handleRegenerateName = () => {
    if (nameData) {
      const genderData = nameData[gender] || nameData.hombre;
      if (genderData) {
        const prefix = randomFrom(genderData.prefijos);
        const suffix = randomFrom(genderData.sufijos);
        setCharacterName(prefix + suffix);
      }
      setSurname(randomFrom(nameData.apellidos));
    }
  };

  // Handle gender change and regenerate name
  const handleGenderChange = (newGender) => {
    setGender(newGender);
    if (nameData) {
      const genderData = nameData[newGender] || nameData.hombre;
      if (genderData) {
        const prefix = randomFrom(genderData.prefijos);
        const suffix = randomFrom(genderData.sufijos);
        setCharacterName(prefix + suffix);
      }
    }
  };

  // Handle continuing from culture selection
  const handleCultureContinue = async () => {
    if (!selectedCulture) return;
    await generatePhysicalData();
    setCurrentSubStep(SUB_STEPS.PHYSICAL_DATA);
  };

  // Handle continuing to characteristics
  const handlePhysicalContinue = () => {
    setCurrentSubStep(SUB_STEPS.CHARACTERISTICS);
  };

  // Handle continuing to selections
  const handleCharacteristicsContinue = () => {
    // Check if Noldor needs to select bonus
    if (selectedCulture?.mejora_noldor && !noldorBonus) {
      setError('Debes elegir una característica para el bonus Noldor (+1)');
      return;
    }
    setCurrentSubStep(SUB_STEPS.CULTURE_SELECTIONS);
  };

  // Final submit
  const handleSubmit = async () => {
    // Validate selections
    const skillOptions = selectedCulture?.competencia_habilidad_elegir || [];
    const tool1Options = selectedCulture?.competencia_herramienta_elegir_1 || [];
    const tool2Options = selectedCulture?.competencia_herramienta_elegir_2 || [];
    
    if (skillOptions.length > 0 && !selectedSkillCompetency) {
      setError('Debes elegir una competencia de habilidad');
      return;
    }
    if (tool1Options.length > 0 && !selectedTool1) {
      setError('Debes elegir una herramienta');
      return;
    }
    if (tool2Options.length > 0 && selectedTools2.length === 0) {
      setError('Debes elegir al menos una herramienta');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Calculate final characteristics with Noldor bonus
      const finalCaracteristicas = { ...caracteristicas };
      if (noldorBonus) {
        finalCaracteristicas[noldorBonus] += 1;
      }
      
      const updateData = {
        cultura_id: selectedCulture.id,
        nombre: `${characterName} ${surname}`.trim(),
        jugador: playerName,
        
        // Physical data
        genero: gender,
        edad,
        altura_cm: altura,
        peso_kg: peso,
        ojos,
        piel,
        pelo,
        
        // Culture data
        raza: selectedCulture.raza,
        velocidad: selectedCulture.velocidad,
        descanso: selectedCulture.descanso,
        tamanio: selectedCulture.tamanio,
        nivel_vida: selectedCulture.nivel_vida,
        
        // Characteristics
        caracteristicas: finalCaracteristicas,
        mejora_noldor: noldorBonus,
        
        // Skills and competencies
        habilidades_puntuaciones: selectedCulture.habilidades_puntuaciones,
        competencias_habilidades: selectedCulture.competencias_habilidades,
        rasgos_culturales: selectedCulture.rasgos_culturales,
        idiomas: selectedCulture.idiomas,
        
        // Selections
        competencia_habilidad_cultura: selectedSkillCompetency,
        competencia_herramienta_1: selectedTool1,
        competencias_herramientas_2: selectedTools2,
        competencia_adicional: selectedCulture.competencia_adicional,
        
        // Special features
        pg_extra_nivel: selectedCulture.pg_extra_nivel,
        capacidad_carga_x2: selectedCulture.capacidad_carga_x2,
        tiene_virtud_inicial: selectedCulture.tiene_virtud_inicial,
      };
      
      await updateDraftStep1(draftId, updateData);
      onComplete(updateData);
    } catch (err) {
      console.error('Error saving:', err);
      setError('Error al guardar los datos');
    } finally {
      setSaving(false);
    }
  };

  // =====================
  // RENDER: Culture Selection (Sub-step 1)
  // =====================
  const renderCultureSelection = () => (
    <div className="space-y-6">
      {/* Race Categories */}
      <div>
        <Label className="text-[hsl(var(--gold))] font-heading mb-3 block">Selecciona tu Raza</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CULTURE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategory(category.id);
                setSelectedCulture(null);
                setExpandedCulture(null);
              }}
              className={cn(
                "selection-card p-4 rounded-lg text-center transition-all",
                selectedCategory === category.id && "selected"
              )}
              data-testid={`category-${category.id}`}
            >
              <span className="text-3xl mb-2 block">{category.icon}</span>
              <span className="font-heading text-sm">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cultures List */}
      {selectedCategory && (
        <div>
          <Label className="text-[hsl(var(--gold))] font-heading mb-3 block">
            Culturas de {selectedCategory}
          </Label>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredCultures.map((culture) => {
                const isExpanded = expandedCulture === culture.id;
                const isSelected = selectedCulture?.id === culture.id;
                
                return (
                  <div key={culture.id} className="rounded-lg overflow-hidden">
                    {/* Culture Header */}
                    <button
                      onClick={() => {
                        setExpandedCulture(isExpanded ? null : culture.id);
                        setSelectedCulture(culture);
                      }}
                      className={cn(
                        "w-full selection-card p-4 text-left flex items-center justify-between",
                        isSelected && "selected"
                      )}
                      data-testid={`culture-${culture.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-heading text-lg">{culture.nombre}</h4>
                          {isSelected && <Check className="w-4 h-4 text-[hsl(var(--gold))]" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {culture.nivel_vida || 'Común'} • Velocidad: {culture.velocidad}m
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    
                    {/* Expanded Culture Details */}
                    {isExpanded && (
                      <div className="bg-black/20 p-4 border-t border-border/30">
                        {/* Description */}
                        <p className="text-sm text-muted-foreground mb-4">
                          {culture.descripcion}
                        </p>
                        
                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                          <div>
                            <span className="text-[hsl(var(--gold))]">Edad:</span>{' '}
                            {culture.edad_min}-{culture.edad_max} años
                          </div>
                          <div>
                            <span className="text-[hsl(var(--gold))]">Altura:</span>{' '}
                            {culture.altura_min}-{culture.altura_max} cm
                          </div>
                          <div>
                            <span className="text-[hsl(var(--gold))]">Tamaño:</span>{' '}
                            {culture.tamanio}
                          </div>
                          <div>
                            <span className="text-[hsl(var(--gold))]">Velocidad:</span>{' '}
                            {culture.velocidad} m
                          </div>
                          <div>
                            <span className="text-[hsl(var(--gold))]">Descanso:</span>{' '}
                            {culture.descanso} h
                          </div>
                          <div>
                            <span className="text-[hsl(var(--gold))]">Nivel vida:</span>{' '}
                            {culture.nivel_vida}
                          </div>
                        </div>
                        
                        {/* Characteristic Bonuses */}
                        {culture.bonificadores_caracteristicas && (
                          <div className="mb-4">
                            <span className="text-[hsl(var(--gold))] text-sm">Bonificadores:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {Object.entries(culture.bonificadores_caracteristicas).map(([attr, val]) =>
                                val > 0 && (
                                  <span key={attr} className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-1 rounded">
                                    {attr.substring(0, 3).toUpperCase()} +{val}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Languages */}
                        {culture.idiomas?.length > 0 && (
                          <div className="mb-4">
                            <span className="text-[hsl(var(--gold))] text-sm">Idiomas:</span>
                            <p className="text-sm text-muted-foreground">
                              {culture.idiomas.join(', ')}
                            </p>
                          </div>
                        )}
                        
                        {/* Cultural Traits */}
                        {culture.rasgos_culturales?.length > 0 && (
                          <div className="mb-4">
                            <span className="text-[hsl(var(--gold))] text-sm">Rasgos Culturales:</span>
                            <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                              {culture.rasgos_culturales.map((rasgo, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-[hsl(var(--gold))]">•</span>
                                  {rasgo}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Special Features */}
                        {culture.mejora_noldor && (
                          <div className="text-xs bg-[hsl(var(--magic-blue))/10] text-[hsl(var(--magic-blue))] p-2 rounded mb-2">
                            ★ Mejora Noldor: Podrás elegir +1 a una característica
                          </div>
                        )}
                        {culture.pg_extra_nivel && (
                          <div className="text-xs bg-[hsl(var(--torch-orange))/10] text-[hsl(var(--torch-orange))] p-2 rounded mb-2">
                            ★ +{culture.pg_extra_nivel} PG extra por nivel
                          </div>
                        )}
                        {culture.capacidad_carga_x2 && (
                          <div className="text-xs bg-[hsl(var(--torch-orange))/10] text-[hsl(var(--torch-orange))] p-2 rounded mb-2">
                            ★ Capacidad de carga x{culture.capacidad_carga_x2}
                          </div>
                        )}
                        {culture.tiene_virtud_inicial && (
                          <div className="text-xs bg-[hsl(var(--gold))/10] text-[hsl(var(--gold))] p-2 rounded mb-2">
                            ★ Obtiene Virtud al nivel 1
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-4 border-t border-border/30">
        <Button
          onClick={handleCultureContinue}
          disabled={!selectedCulture}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
          data-testid="culture-continue-btn"
        >
          Continuar
        </Button>
      </div>
    </div>
  );

  // =====================
  // RENDER: Physical Data (Sub-step 2)
  // =====================
  const renderPhysicalData = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="font-heading text-2xl text-[hsl(var(--gold))]">
          {selectedCulture?.nombre}
        </h3>
        <p className="text-muted-foreground text-sm">{selectedCulture?.raza}</p>
      </div>

      {/* Name Generation */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Nombre del Personaje</h4>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label className="text-sm text-muted-foreground">Género</Label>
            <Select value={gender} onValueChange={handleGenderChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hombre">Hombre</SelectItem>
                <SelectItem value="mujer">Mujer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={handleRegenerateName}
              className="w-full"
              data-testid="regenerate-name-btn"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Regenerar Nombre
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Nombre</Label>
            <Input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="mt-1"
              data-testid="character-name-input"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Apellido</Label>
            <Input
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="mt-1"
              data-testid="character-surname-input"
            />
          </div>
        </div>
        
        <div className="mt-4">
          <Label className="text-sm text-muted-foreground">Nombre del Jugador</Label>
          <Input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Tu nombre real"
            className="mt-1"
            data-testid="player-name-input"
          />
        </div>
      </div>

      {/* Physical Attributes */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Atributos Físicos</h4>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <Label className="text-sm text-muted-foreground">Edad</Label>
            <Input
              type="number"
              value={edad}
              onChange={(e) => setEdad(parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Altura (cm)</Label>
            <Input
              type="number"
              value={altura}
              onChange={(e) => setAltura(parseInt(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Peso (kg)</Label>
            <Input
              type="number"
              value={peso}
              onChange={(e) => setPeso(parseFloat(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">Ojos</Label>
            <Input value={ojos} onChange={(e) => setOjos(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Piel</Label>
            <Input value={piel} onChange={(e) => setPiel(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Pelo</Label>
            <Input value={pelo} onChange={(e) => setPelo(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Culture Stats (Read-only) */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Datos de Cultura</h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Velocidad:</span>
            <span className="ml-2 text-foreground">{selectedCulture?.velocidad} m</span>
          </div>
          <div>
            <span className="text-muted-foreground">Descanso:</span>
            <span className="ml-2 text-foreground">{selectedCulture?.descanso} h</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tamaño:</span>
            <span className="ml-2 text-foreground">{selectedCulture?.tamanio}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Nivel Vida:</span>
            <span className="ml-2 text-foreground">{selectedCulture?.nivel_vida}</span>
          </div>
        </div>
        
        {/* Equipment by living standard */}
        {selectedCulture?.nivel_vida && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <span className="text-sm text-[hsl(var(--gold))]">Equipo inicial ({selectedCulture.nivel_vida}):</span>
            <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside">
              {(EQUIPMENT_BY_LEVEL[selectedCulture.nivel_vida] || EQUIPMENT_BY_LEVEL['Común']).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-border/30">
        <Button
          variant="outline"
          onClick={() => setCurrentSubStep(SUB_STEPS.SELECT_CULTURE)}
          data-testid="physical-back-btn"
        >
          Atrás
        </Button>
        <Button
          onClick={handlePhysicalContinue}
          disabled={!characterName.trim()}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
          data-testid="physical-continue-btn"
        >
          Continuar
        </Button>
      </div>
    </div>
  );

  // =====================
  // RENDER: Characteristics (Sub-step 3)
  // =====================
  const renderCharacteristics = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
          Características Base
        </h3>
        <p className="text-muted-foreground text-sm">Base 8 + bonificadores de cultura</p>
      </div>

      {/* Characteristic Scores */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Características</h4>
        
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {Object.entries(caracteristicas).map(([attr, value]) => {
            const bonus = (selectedCulture?.bonificadores_caracteristicas?.[attr] || 0);
            const noldorSelected = noldorBonus === attr;
            const finalValue = value + (noldorSelected ? 1 : 0);
            
            return (
              <div key={attr} className="text-center">
                <div className="text-xs text-muted-foreground uppercase mb-1">
                  {attr.substring(0, 3)}
                </div>
                <div className={cn(
                  "text-2xl font-heading",
                  bonus > 0 && "text-[hsl(var(--magic-blue))]",
                  noldorSelected && "text-[hsl(var(--gold))]"
                )}>
                  {finalValue}
                </div>
                {bonus > 0 && (
                  <div className="text-xs text-[hsl(var(--magic-blue))]">
                    (8 + {bonus})
                  </div>
                )}
                {noldorSelected && (
                  <div className="text-xs text-[hsl(var(--gold))]">
                    +1 Noldor
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Noldor Selection */}
        {selectedCulture?.mejora_noldor && (
          <div className="mt-6 pt-4 border-t border-border/30">
            <Label className="text-[hsl(var(--gold))] font-heading mb-3 block">
              Mejora Noldor: Elige +1 a una característica
            </Label>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {Object.keys(caracteristicas).map((attr) => (
                <button
                  key={attr}
                  onClick={() => setNoldorBonus(attr)}
                  className={cn(
                    "selection-card p-2 rounded text-center text-sm",
                    noldorBonus === attr && "selected"
                  )}
                >
                  {attr.substring(0, 3).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Skills with scores */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">
          Habilidades (19)
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Object.entries(selectedCulture?.habilidades_puntuaciones || {}).map(([skill, score]) => {
            const hasCompetency = selectedCulture?.competencias_habilidades?.includes(skill);
            return (
              <div 
                key={skill}
                className={cn(
                  "flex justify-between p-2 rounded",
                  hasCompetency && "bg-[hsl(var(--magic-blue))/10]"
                )}
              >
                <span className={cn(
                  hasCompetency && "text-[hsl(var(--magic-blue))]"
                )}>
                  {skill.split(' (')[0]}
                  {hasCompetency && ' ★'}
                </span>
                <span className="text-muted-foreground">{score}</span>
              </div>
            );
          })}
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          ★ = Competencia de cultura
        </div>
      </div>

      {/* Cultural Traits */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Rasgos Culturales</h4>
        <ul className="space-y-2 text-sm">
          {selectedCulture?.rasgos_culturales?.map((rasgo, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[hsl(var(--gold))]">•</span>
              <span className="text-muted-foreground">{rasgo}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Languages */}
      <div className="card-parchment rounded-lg p-4">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Idiomas</h4>
        <div className="flex flex-wrap gap-2">
          {selectedCulture?.idiomas?.map((idioma, i) => (
            <span key={i} className="bg-black/30 px-3 py-1 rounded text-sm">
              {idioma}
            </span>
          ))}
        </div>
      </div>

      {/* Special Features */}
      {(selectedCulture?.pg_extra_nivel || selectedCulture?.capacidad_carga_x2 || selectedCulture?.tiene_virtud_inicial) && (
        <div className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">Rasgos Especiales</h4>
          <div className="space-y-2">
            {selectedCulture?.pg_extra_nivel && (
              <div className="bg-[hsl(var(--torch-orange))/10] text-[hsl(var(--torch-orange))] p-2 rounded text-sm">
                +{selectedCulture.pg_extra_nivel} Punto de Golpe extra por nivel
              </div>
            )}
            {selectedCulture?.capacidad_carga_x2 && (
              <div className="bg-[hsl(var(--torch-orange))/10] text-[hsl(var(--torch-orange))] p-2 rounded text-sm">
                Capacidad de carga x{selectedCulture.capacidad_carga_x2}
              </div>
            )}
            {selectedCulture?.tiene_virtud_inicial && (
              <div className="bg-[hsl(var(--gold))/10] text-[hsl(var(--gold))] p-2 rounded text-sm">
                ★ Este personaje elegirá una Virtud al nivel 1
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-border/30">
        <Button
          variant="outline"
          onClick={() => setCurrentSubStep(SUB_STEPS.PHYSICAL_DATA)}
          data-testid="characteristics-back-btn"
        >
          Atrás
        </Button>
        <Button
          onClick={handleCharacteristicsContinue}
          disabled={selectedCulture?.mejora_noldor && !noldorBonus}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
          data-testid="characteristics-continue-btn"
        >
          Continuar
        </Button>
      </div>
    </div>
  );

  // =====================
  // RENDER: Culture Selections (Sub-step 4)
  // =====================
  const renderCultureSelections = () => {
    const skillOptions = selectedCulture?.competencia_habilidad_elegir || [];
    const tool1Options = selectedCulture?.competencia_herramienta_elegir_1 || [];
    const tool2Options = selectedCulture?.competencia_herramienta_elegir_2 || [];
    const hasSelections = skillOptions.length > 0 || tool1Options.length > 0 || tool2Options.length > 0;
    
    if (!hasSelections) {
      // No selections needed, auto-continue
      return (
        <div className="space-y-6">
          <div className="card-parchment rounded-lg p-6 text-center">
            <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              Cultura Completa
            </h4>
            <p className="text-muted-foreground">
              No hay selecciones adicionales para esta cultura.
            </p>
            {selectedCulture?.competencia_adicional && (
              <div className="mt-4 bg-[hsl(var(--magic-blue))/10] p-3 rounded">
                <span className="text-sm text-[hsl(var(--magic-blue))]">
                  Competencia adicional: {selectedCulture.competencia_adicional}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex justify-between pt-4 border-t border-border/30">
            <Button
              variant="outline"
              onClick={() => setCurrentSubStep(SUB_STEPS.CHARACTERISTICS)}
            >
              Atrás
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
              data-testid="finish-culture-btn"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Finalizar Cultura
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Selecciones de Cultura
          </h3>
          <p className="text-muted-foreground text-sm">
            Elige tus competencias adicionales
          </p>
        </div>

        {/* Skill Competency Selection */}
        {skillOptions.length > 0 && (
          <div className="card-parchment rounded-lg p-4">
            <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              Competencia de Habilidad
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              "Saber de los elfos/bosques. Tienes competencia en una de las siguientes:"
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {skillOptions.map((skill) => (
                <button
                  key={skill}
                  onClick={() => setSelectedSkillCompetency(skill)}
                  className={cn(
                    "selection-card p-3 rounded text-left text-sm",
                    selectedSkillCompetency === skill && "selected"
                  )}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tool 1 Selection */}
        {tool1Options.length > 0 && (
          <div className="card-parchment rounded-lg p-4">
            <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              Competencia de Herramienta
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              "Tus primeros años no han sido ociosos. Elige una:"
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {tool1Options.map((tool) => (
                <button
                  key={tool}
                  onClick={() => setSelectedTool1(tool)}
                  className={cn(
                    "selection-card p-3 rounded text-left text-sm",
                    selectedTool1 === tool && "selected"
                  )}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tool 2 Selection (multiple) */}
        {tool2Options.length > 0 && (
          <div className="card-parchment rounded-lg p-4">
            <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              Herramientas Adicionales
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              Elige hasta 2 herramientas:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {tool2Options.map((tool) => {
                const isSelected = selectedTools2.includes(tool);
                return (
                  <button
                    key={tool}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTools2(selectedTools2.filter(t => t !== tool));
                      } else if (selectedTools2.length < 2) {
                        setSelectedTools2([...selectedTools2, tool]);
                      }
                    }}
                    className={cn(
                      "selection-card p-3 rounded text-left text-sm",
                      isSelected && "selected"
                    )}
                  >
                    {tool}
                    {isSelected && <Check className="w-4 h-4 inline ml-2" />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Seleccionadas: {selectedTools2.length}/2
            </p>
          </div>
        )}

        {/* Additional Competency (if any) */}
        {selectedCulture?.competencia_adicional && (
          <div className="card-parchment rounded-lg p-4">
            <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-2">
              Competencia Adicional (Automática)
            </h4>
            <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
              <span className="text-sm text-[hsl(var(--magic-blue))]">
                {selectedCulture.competencia_adicional}
              </span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border/30">
          <Button
            variant="outline"
            onClick={() => setCurrentSubStep(SUB_STEPS.CHARACTERISTICS)}
          >
            Atrás
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || (skillOptions.length > 0 && !selectedSkillCompetency) || (tool1Options.length > 0 && !selectedTool1)}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-black font-heading"
            data-testid="finish-culture-btn"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Finalizar Cultura
          </Button>
        </div>
      </div>
    );
  };

  // =====================
  // MAIN RENDER
  // =====================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto" data-testid="step-1-culture">
      {/* Sub-step indicator */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: SUB_STEPS.SELECT_CULTURE, label: '1. Cultura' },
            { key: SUB_STEPS.PHYSICAL_DATA, label: '2. Físico' },
            { key: SUB_STEPS.CHARACTERISTICS, label: '3. Características' },
            { key: SUB_STEPS.CULTURE_SELECTIONS, label: '4. Selecciones' },
          ].map((step, i) => (
            <div key={step.key} className="flex items-center">
              <span className={cn(
                "px-3 py-1 rounded",
                currentSubStep === step.key
                  ? "bg-[hsl(var(--gold))] text-black"
                  : "bg-black/30 text-muted-foreground"
              )}>
                {step.label}
              </span>
              {i < 3 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Content based on sub-step */}
      {currentSubStep === SUB_STEPS.SELECT_CULTURE && renderCultureSelection()}
      {currentSubStep === SUB_STEPS.PHYSICAL_DATA && renderPhysicalData()}
      {currentSubStep === SUB_STEPS.CHARACTERISTICS && renderCharacteristics()}
      {currentSubStep === SUB_STEPS.CULTURE_SELECTIONS && renderCultureSelections()}
    </div>
  );
};

export default Step1Culture;
