/**
 * Step 3: Occupation/Class Selection with all sub-questions
 * Includes: skills, armor (A/B), weapons, and expertise selection
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Sword, Shield, BookOpen, Compass, Crown, Wind, CheckCircle, Star } from 'lucide-react';
import { getOccupations, updateDraftStep3 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const OCCUPATION_ICONS = {
  'Buscador de tesoros': Compass,
  'Campeón': Sword,
  'Capitán': Crown,
  'Erudito': BookOpen,
  'Guardian': Shield,
  'Mensajero': Wind,
};

// Sub-steps within occupation selection
const SUB_STEPS = {
  SELECT_OCCUPATION: 0,
  SELECT_SKILLS: 1,
  SELECT_ARMOR: 2,
  SELECT_WEAPONS: 3,
  SELECT_EXPERTISE: 4, // Solo para Buscador de tesoros
};

const Step3Occupation = ({ draftId, draft, onComplete, onBack }) => {
  const [occupations, setOccupations] = useState([]);
  const [selectedOccupation, setSelectedOccupation] = useState(null);
  const [subStep, setSubStep] = useState(SUB_STEPS.SELECT_OCCUPATION);
  
  // Selections state
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedArmor, setSelectedArmor] = useState(null); // 'A' or 'B'
  const [weaponSelections, setWeaponSelections] = useState({}); // { arma1: [...], arma2: [...], arma3: 'A'|'B', arma3_b: [...] }
  const [currentWeaponIndex, setCurrentWeaponIndex] = useState(0);
  const [selectedExpertise, setSelectedExpertise] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load occupations
  useEffect(() => {
    const loadOccupations = async () => {
      try {
        setLoading(true);
        const data = await getOccupations();
        setOccupations(data);
      } catch (err) {
        console.error('Error loading occupations:', err);
        setError('No se pudieron cargar las ocupaciones');
      } finally {
        setLoading(false);
      }
    };
    loadOccupations();
  }, []);

  // Get current occupation data
  const occupationData = useMemo(() => {
    return selectedOccupation || {};
  }, [selectedOccupation]);

  // Check if has expertise (only Buscador de tesoros)
  const hasExpertise = occupationData.pericia && occupationData.pericia.cantidad > 0;

  // Handle occupation selection
  const handleOccupationSelect = (occ) => {
    setSelectedOccupation(occ);
    // Reset all sub-selections
    setSelectedSkills([]);
    setSelectedArmor(null);
    setWeaponSelections({});
    setCurrentWeaponIndex(0);
    setSelectedExpertise([]);
  };

  // Move to next sub-step
  const goToNextSubStep = () => {
    if (subStep === SUB_STEPS.SELECT_OCCUPATION) {
      setSubStep(SUB_STEPS.SELECT_SKILLS);
    } else if (subStep === SUB_STEPS.SELECT_SKILLS) {
      // Check if there are armor options
      if (occupationData.armadura?.opcion_a?.length > 0 || occupationData.armadura?.opcion_b?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_ARMOR);
      } else if (occupationData.armas?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_WEAPONS);
      } else if (hasExpertise) {
        setSubStep(SUB_STEPS.SELECT_EXPERTISE);
      } else {
        handleFinalSubmit();
      }
    } else if (subStep === SUB_STEPS.SELECT_ARMOR) {
      if (occupationData.armas?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_WEAPONS);
      } else if (hasExpertise) {
        setSubStep(SUB_STEPS.SELECT_EXPERTISE);
      } else {
        handleFinalSubmit();
      }
    } else if (subStep === SUB_STEPS.SELECT_WEAPONS) {
      if (hasExpertise) {
        setSubStep(SUB_STEPS.SELECT_EXPERTISE);
      } else {
        handleFinalSubmit();
      }
    } else if (subStep === SUB_STEPS.SELECT_EXPERTISE) {
      handleFinalSubmit();
    }
  };

  // Go back in sub-steps
  const goToPrevSubStep = () => {
    if (subStep === SUB_STEPS.SELECT_SKILLS) {
      setSubStep(SUB_STEPS.SELECT_OCCUPATION);
    } else if (subStep === SUB_STEPS.SELECT_ARMOR) {
      setSubStep(SUB_STEPS.SELECT_SKILLS);
    } else if (subStep === SUB_STEPS.SELECT_WEAPONS) {
      if (occupationData.armadura?.opcion_a?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_ARMOR);
      } else {
        setSubStep(SUB_STEPS.SELECT_SKILLS);
      }
    } else if (subStep === SUB_STEPS.SELECT_EXPERTISE) {
      if (occupationData.armas?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_WEAPONS);
      } else if (occupationData.armadura?.opcion_a?.length > 0) {
        setSubStep(SUB_STEPS.SELECT_ARMOR);
      } else {
        setSubStep(SUB_STEPS.SELECT_SKILLS);
      }
    } else {
      onBack();
    }
  };

  // Toggle skill selection
  const toggleSkill = (skill) => {
    const maxSkills = occupationData.habilidades?.cantidad || 2;
    setSelectedSkills(prev => {
      if (prev.includes(skill)) {
        return prev.filter(s => s !== skill);
      }
      if (prev.length >= maxSkills) {
        return prev;
      }
      return [...prev, skill];
    });
  };

  // Toggle expertise selection (only from already selected skills)
  const toggleExpertise = (skill) => {
    const maxExpertise = occupationData.pericia?.cantidad || 2;
    setSelectedExpertise(prev => {
      if (prev.includes(skill)) {
        return prev.filter(s => s !== skill);
      }
      if (prev.length >= maxExpertise) {
        return prev;
      }
      return [...prev, skill];
    });
  };

  // Handle weapon selection for current weapon block
  const handleWeaponSelection = (armaIndex, selection) => {
    const arma = occupationData.armas[armaIndex];
    
    if (arma.tipo === 'ab') {
      // A/B selection
      setWeaponSelections(prev => ({
        ...prev,
        [`arma${arma.numero}`]: selection, // 'A' or 'B'
        [`arma${arma.numero}_items`]: selection === 'A' ? arma.opcion_a : []
      }));
    } else {
      // Simple selection - toggle item
      const key = `arma${arma.numero}`;
      const maxItems = arma.cantidad || 1;
      setWeaponSelections(prev => {
        const current = prev[key] || [];
        if (current.includes(selection)) {
          return { ...prev, [key]: current.filter(i => i !== selection) };
        }
        if (current.length >= maxItems) {
          return prev;
        }
        return { ...prev, [key]: [...current, selection] };
      });
    }
  };

  // Handle B option items selection (for arma tipo 'ab')
  const handleWeaponBSelection = (armaIndex, item) => {
    const arma = occupationData.armas[armaIndex];
    const key = `arma${arma.numero}_b_items`;
    const maxItems = arma.cantidad_b || 1;
    
    setWeaponSelections(prev => {
      const current = prev[key] || [];
      if (current.includes(item)) {
        return { ...prev, [key]: current.filter(i => i !== item) };
      }
      if (current.length >= maxItems) {
        return prev;
      }
      return { ...prev, [key]: [...current, item] };
    });
  };

  // Final submit
  const handleFinalSubmit = async () => {
    try {
      setSaving(true);
      
      // Compile all selected equipment
      const equipoSeleccionado = [];
      
      // Add armor
      if (selectedArmor === 'A') {
        equipoSeleccionado.push(...(occupationData.armadura?.opcion_a || []));
      } else if (selectedArmor === 'B') {
        equipoSeleccionado.push(...(occupationData.armadura?.opcion_b || []));
      }
      
      // Add weapons
      occupationData.armas?.forEach((arma, index) => {
        const key = `arma${arma.numero}`;
        if (arma.tipo === 'ab') {
          const choice = weaponSelections[key];
          if (choice === 'A') {
            equipoSeleccionado.push(...(arma.opcion_a || []));
          } else if (choice === 'B') {
            equipoSeleccionado.push(...(weaponSelections[`${key}_b_items`] || []));
          }
        } else {
          equipoSeleccionado.push(...(weaponSelections[key] || []));
        }
      });
      
      const updatedDraft = await updateDraftStep3(draftId, {
        ocupacion_id: selectedOccupation.id,
        habilidades_elegidas: selectedSkills,
        pericia_elegida: selectedExpertise,
        equipo_ocupacion: equipoSeleccionado,
        armadura_elegida: selectedArmor,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 3:', err);
      setError('No se pudo guardar la ocupación');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card-parchment rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  // Render sub-step indicator
  const renderSubStepIndicator = () => {
    const steps = [
      { id: 0, label: 'Ocupación' },
      { id: 1, label: 'Habilidades' },
    ];
    if (occupationData.armadura?.opcion_a?.length > 0) {
      steps.push({ id: 2, label: 'Armadura' });
    }
    if (occupationData.armas?.length > 0) {
      steps.push({ id: 3, label: 'Armas' });
    }
    if (hasExpertise) {
      steps.push({ id: 4, label: 'Pericia' });
    }

    return (
      <div className="flex justify-center gap-2 mb-6">
        {steps.map((step, index) => (
          <div 
            key={step.id}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all',
              subStep === step.id 
                ? 'bg-[hsl(var(--gold))] text-[hsl(var(--primary-foreground))]'
                : subStep > step.id
                  ? 'bg-[hsl(var(--gold))/30] text-[hsl(var(--gold))]'
                  : 'bg-secondary text-muted-foreground'
            )}
          >
            {step.label}
          </div>
        ))}
      </div>
    );
  };

  // Render occupation selection
  const renderOccupationSelection = () => (
    <>
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Ocupación
        </h2>
        <p className="text-muted-foreground">
          Tu ocupación define tu rol en la Comunidad y tus habilidades de combate
        </p>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="grid md:grid-cols-2 gap-4">
          {occupations.map(occ => {
            const Icon = OCCUPATION_ICONS[occ.vocacion] || Sword;
            const isSelected = selectedOccupation?.id === occ.id;
            
            return (
              <button
                key={occ.id}
                onClick={() => handleOccupationSelect(occ)}
                className={cn(
                  'selection-card rounded-lg p-4 text-left h-full',
                  isSelected && 'selected'
                )}
                data-testid={`occupation-${occ.vocacion?.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    isSelected ? 'bg-[hsl(var(--gold))/30]' : 'bg-secondary'
                  )}>
                    <Icon className={cn(
                      'w-5 h-5',
                      isSelected ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
                    )} />
                  </div>
                  <div>
                    <h4 className="font-heading text-lg text-foreground">{occ.vocacion}</h4>
                    <p className="text-xs text-muted-foreground">
                      {occ.dado_golpe} · {occ.habilidades?.cantidad || 0} habilidades
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {occ.caracteristicas_principales?.map(char => (
                    <span key={char} className="text-xs px-2 py-0.5 rounded bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))]">
                      {char}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={goToNextSubStep}
          disabled={!selectedOccupation}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading"
        >
          Continuar
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </>
  );

  // Render skills selection
  const renderSkillsSelection = () => {
    const maxSkills = occupationData.habilidades?.cantidad || 2;
    const question = occupationData.habilidades?.pregunta || 'Elige tus habilidades:';
    const allOptions = occupationData.habilidades?.opciones || [];
    
    // Filter out already selected skills from culture and background
    const existingSkills = [
      ...(draft?.competencias_habilidades_cultura || []),
      ...(draft?.competencia_habilidad_cultura ? [draft.competencia_habilidad_cultura] : []),
      ...(draft?.competencias_habilidades_trasfondo || []),
    ];
    
    // Clean skill names for comparison (remove attribute in parenthesis)
    const cleanSkillName = (skill) => skill?.split(' (')[0]?.trim().toLowerCase();
    const existingClean = existingSkills.map(cleanSkillName);
    
    // Filter available options
    const options = allOptions.filter(skill => !existingClean.includes(cleanSkillName(skill)));

    return (
      <>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
            Habilidades de {occupationData.vocacion}
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            {question}
          </p>
          {existingSkills.length > 0 && (
            <p className="text-xs text-[hsl(var(--torch-orange))] mt-2">
              Ya tienes competencia en: {existingSkills.join(', ')}
            </p>
          )}
        </div>

        <div className="card-parchment rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted-foreground">
              Selecciona {maxSkills} habilidades
            </span>
            <span className={cn(
              'text-sm font-medium',
              selectedSkills.length === maxSkills ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
            )}>
              {selectedSkills.length} / {maxSkills}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            {options.map(skill => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  disabled={!isSelected && selectedSkills.length >= maxSkills}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    isSelected 
                      ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
                      : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]',
                    !isSelected && selectedSkills.length >= maxSkills && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      'font-medium',
                      isSelected ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {skill}
                    </span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={goToPrevSubStep} className="text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={goToNextSubStep}
            disabled={selectedSkills.length < maxSkills}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading"
          >
            Continuar
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </>
    );
  };

  // Render armor selection (A/B)
  const renderArmorSelection = () => {
    const question = occupationData.armadura?.pregunta || 'Elige tu armadura:';
    const optionA = occupationData.armadura?.opcion_a || [];
    const optionB = occupationData.armadura?.opcion_b || [];

    return (
      <>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
            Armadura
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            {question}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Option A */}
          <button
            onClick={() => setSelectedArmor('A')}
            className={cn(
              'card-parchment rounded-lg p-6 text-left transition-all',
              selectedArmor === 'A' && 'border-2 border-[hsl(var(--gold))]'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">Opción A</span>
              {selectedArmor === 'A' && <CheckCircle className="w-6 h-6 text-[hsl(var(--gold))]" />}
            </div>
            <div className="space-y-2">
              {optionA.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </button>

          {/* Option B */}
          <button
            onClick={() => setSelectedArmor('B')}
            className={cn(
              'card-parchment rounded-lg p-6 text-left transition-all',
              selectedArmor === 'B' && 'border-2 border-[hsl(var(--gold))]'
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">Opción B</span>
              {selectedArmor === 'B' && <CheckCircle className="w-6 h-6 text-[hsl(var(--gold))]" />}
            </div>
            <div className="space-y-2">
              {optionB.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </button>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={goToPrevSubStep} className="text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={goToNextSubStep}
            disabled={!selectedArmor}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading"
          >
            Continuar
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </>
    );
  };

  // Render weapons selection (multiple questions)
  const renderWeaponsSelection = () => {
    const armas = occupationData.armas || [];
    const currentArma = armas[currentWeaponIndex];
    
    if (!currentArma) {
      goToNextSubStep();
      return null;
    }

    const isABType = currentArma.tipo === 'ab';
    const currentSelection = weaponSelections[`arma${currentArma.numero}`];
    const currentBItems = weaponSelections[`arma${currentArma.numero}_b_items`] || [];

    // Check if current weapon selection is complete
    const isComplete = () => {
      if (isABType) {
        if (!currentSelection) return false;
        if (currentSelection === 'B' && currentBItems.length < (currentArma.cantidad_b || 1)) return false;
        return true;
      } else {
        const selected = weaponSelections[`arma${currentArma.numero}`] || [];
        return selected.length >= (currentArma.cantidad || 1);
      }
    };

    // Go to next weapon or next step
    const handleNextWeapon = () => {
      if (currentWeaponIndex < armas.length - 1) {
        setCurrentWeaponIndex(currentWeaponIndex + 1);
      } else {
        goToNextSubStep();
      }
    };

    const handlePrevWeapon = () => {
      if (currentWeaponIndex > 0) {
        setCurrentWeaponIndex(currentWeaponIndex - 1);
      } else {
        goToPrevSubStep();
      }
    };

    return (
      <>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
            Arma {currentWeaponIndex + 1} de {armas.length}
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            {currentArma.pregunta}
          </p>
        </div>

        {isABType ? (
          // A/B type weapon selection
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Option A */}
              <button
                onClick={() => handleWeaponSelection(currentWeaponIndex, 'A')}
                className={cn(
                  'card-parchment rounded-lg p-6 text-left transition-all',
                  currentSelection === 'A' && 'border-2 border-[hsl(var(--gold))]'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-heading text-lg text-[hsl(var(--gold))]">Opción A</span>
                  {currentSelection === 'A' && <CheckCircle className="w-5 h-5 text-[hsl(var(--gold))]" />}
                </div>
                <div className="space-y-2">
                  {currentArma.opcion_a?.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Sword className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </button>

              {/* Option B */}
              <button
                onClick={() => handleWeaponSelection(currentWeaponIndex, 'B')}
                className={cn(
                  'card-parchment rounded-lg p-6 text-left transition-all',
                  currentSelection === 'B' && 'border-2 border-[hsl(var(--gold))]'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="font-heading text-lg text-[hsl(var(--gold))]">
                    Opción B (elige {currentArma.cantidad_b})
                  </span>
                  {currentSelection === 'B' && <CheckCircle className="w-5 h-5 text-[hsl(var(--gold))]" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  Elige de la lista de abajo
                </p>
              </button>
            </div>

            {/* B items selection */}
            {currentSelection === 'B' && (
              <div className="card-parchment rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-muted-foreground">
                    Elige {currentArma.cantidad_b} arma(s)
                  </span>
                  <span className={cn(
                    'text-sm font-medium',
                    currentBItems.length === currentArma.cantidad_b ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
                  )}>
                    {currentBItems.length} / {currentArma.cantidad_b}
                  </span>
                </div>
                <div className="grid md:grid-cols-2 gap-2">
                  {currentArma.opcion_b?.map((item, i) => {
                    const isSelected = currentBItems.includes(item);
                    return (
                      <button
                        key={i}
                        onClick={() => handleWeaponBSelection(currentWeaponIndex, item)}
                        disabled={!isSelected && currentBItems.length >= currentArma.cantidad_b}
                        className={cn(
                          'p-3 rounded-lg border text-left transition-all',
                          isSelected 
                            ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
                            : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]'
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className={isSelected ? 'text-foreground' : 'text-muted-foreground'}>
                            {item}
                          </span>
                          {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Simple weapon selection
          <div className="card-parchment rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-muted-foreground">
                Elige {currentArma.cantidad || 1} arma(s)
              </span>
              <span className={cn(
                'text-sm font-medium',
                (weaponSelections[`arma${currentArma.numero}`]?.length || 0) >= (currentArma.cantidad || 1) 
                  ? 'text-[hsl(var(--gold))]' 
                  : 'text-muted-foreground'
              )}>
                {weaponSelections[`arma${currentArma.numero}`]?.length || 0} / {currentArma.cantidad || 1}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {currentArma.opciones?.map((item, i) => {
                const selected = weaponSelections[`arma${currentArma.numero}`] || [];
                const isSelected = selected.includes(item);
                return (
                  <button
                    key={i}
                    onClick={() => handleWeaponSelection(currentWeaponIndex, item)}
                    disabled={!isSelected && selected.length >= (currentArma.cantidad || 1)}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-all',
                      isSelected 
                        ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
                        : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]'
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <span className={isSelected ? 'text-foreground' : 'text-muted-foreground'}>
                        {item}
                      </span>
                      {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={handlePrevWeapon} className="text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={handleNextWeapon}
            disabled={!isComplete()}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading"
          >
            {currentWeaponIndex < armas.length - 1 ? 'Siguiente Arma' : 'Continuar'}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </>
    );
  };

  // Render expertise selection (only for Buscador de tesoros)
  const renderExpertiseSelection = () => {
    const pericia = occupationData.pericia;
    const maxExpertise = pericia?.cantidad || 2;
    
    // Expertise can only be selected from already chosen skills
    const availableForExpertise = selectedSkills.length > 0 
      ? selectedSkills 
      : pericia?.opciones || [];

    return (
      <>
        <div className="text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
            Pericia
          </h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            {pericia?.descripcion}
          </p>
        </div>

        <div className="card-parchment rounded-lg p-4">
          <div className="bg-[hsl(var(--magic-blue))/10] rounded-lg p-3 mb-4">
            <p className="text-sm text-[hsl(var(--magic-blue))]">
              <Star className="w-4 h-4 inline mr-2" />
              La pericia duplica tu bonificador de competencia para estas habilidades
            </p>
          </div>

          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-muted-foreground">
              Selecciona {maxExpertise} habilidades para pericia
            </span>
            <span className={cn(
              'text-sm font-medium',
              selectedExpertise.length === maxExpertise ? 'text-[hsl(var(--gold))]' : 'text-muted-foreground'
            )}>
              {selectedExpertise.length} / {maxExpertise}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-2">
            {availableForExpertise.map(skill => {
              const isSelected = selectedExpertise.includes(skill);
              return (
                <button
                  key={skill}
                  onClick={() => toggleExpertise(skill)}
                  disabled={!isSelected && selectedExpertise.length >= maxExpertise}
                  className={cn(
                    'p-3 rounded-lg border text-left transition-all',
                    isSelected 
                      ? 'bg-[hsl(var(--magic-blue))/15] border-[hsl(var(--magic-blue))]' 
                      : 'bg-secondary border-border hover:border-[hsl(var(--magic-blue))/50]'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {isSelected && <Star className="w-4 h-4 text-[hsl(var(--magic-blue))]" />}
                      <span className={cn(
                        'font-medium',
                        isSelected ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {skill}
                      </span>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--magic-blue))]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="ghost" onClick={goToPrevSubStep} className="text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={handleFinalSubmit}
            disabled={selectedExpertise.length < maxExpertise || saving}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Finalizar Ocupación
          </Button>
        </div>
      </>
    );
  };

  return (
    <div className="space-y-6" data-testid="step-3-occupation">
      {/* Sub-step indicator */}
      {selectedOccupation && renderSubStepIndicator()}

      {/* Character summary */}
      {selectedOccupation && (
        <div className="card-parchment rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-lg text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-foreground font-medium">{draft?.nombre}</span>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-muted-foreground">{draft?.cultura_nombre}</span>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-[hsl(var(--gold))]">{selectedOccupation.vocacion}</span>
            </div>
          </div>
        </div>
      )}

      {/* Render current sub-step */}
      {subStep === SUB_STEPS.SELECT_OCCUPATION && renderOccupationSelection()}
      {subStep === SUB_STEPS.SELECT_SKILLS && renderSkillsSelection()}
      {subStep === SUB_STEPS.SELECT_ARMOR && renderArmorSelection()}
      {subStep === SUB_STEPS.SELECT_WEAPONS && renderWeaponsSelection()}
      {subStep === SUB_STEPS.SELECT_EXPERTISE && renderExpertiseSelection()}

      {/* Error */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Step3Occupation;
