/**
 * Character Creator Wizard - Main Component
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { createCharacterDraft, getCharacterDraft, finalizeCharacter } from '@/services/api';
import StepIndicator from './StepIndicator';
import Step1Culture from './steps/Step1Culture';
import Step2Background from './steps/Step2Background';
import Step3Occupation from './steps/Step3Occupation';
import Step5Virtue from './steps/Step5Virtue';
import Step7Equipment from './steps/Step7Equipment';
import Step8Details from './steps/Step8Details';
import CharacterSummary from './CharacterSummary';

// Las culturas que obtienen virtud al nivel 1 según las reglas
export const CULTURAS_CON_VIRTUD = ['Hombres del lago', 'Hombres de Bree', 'Beornidas'];

const STEPS = [
  { num: 1, title: 'Cultura', description: 'Elige tu linaje y asigna atributos' },
  { num: 2, title: 'Trasfondo', description: 'Tu historia pasada' },
  { num: 3, title: 'Ocupación', description: 'Tu vocación y habilidades' },
  { num: 4, title: 'Virtud', description: 'Tu don especial', conditional: true },
  { num: 5, title: 'Equipo', description: 'Tus posesiones' },
  { num: 6, title: 'Detalles', description: 'Tu personalidad' },
];

export const CharacterCreatorWizard = () => {
  const navigate = useNavigate();
  const [draftId, setDraftId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize draft on mount
  useEffect(() => {
    const initDraft = async () => {
      try {
        setLoading(true);
        const newDraft = await createCharacterDraft();
        setDraftId(newDraft.id);
        setDraft(newDraft);
        setCurrentStep(1);
      } catch (err) {
        console.error('Error creating draft:', err);
        setError('No se pudo iniciar la creación del personaje');
      } finally {
        setLoading(false);
      }
    };
    initDraft();
  }, []);

  // Refresh draft data
  const refreshDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      const updatedDraft = await getCharacterDraft(draftId);
      setDraft(updatedDraft);
      setCurrentStep(updatedDraft.paso_actual || 1);
    } catch (err) {
      console.error('Error refreshing draft:', err);
    }
  }, [draftId]);

  // Check if culture gets virtue at level 1
  const cultureGetsVirtue = useCallback((cultureName) => {
    return CULTURAS_CON_VIRTUD.includes(cultureName);
  }, []);

  // Mapea el `paso_actual` que devuelve el backend (que usa una numeración
  // más fina: 4=atributos, 5=virtud, 6=skills, 7=equipo, 8=detalles…) al
  // paso del wizard frontend (1..6: cultura, trasfondo, ocupación, virtud,
  // equipo, detalles). Esto evita que tras guardar la virtud el wizard
  // salte directamente a "Detalles" y se vea como si no avanzara o se
  // saltara el paso de Equipo.
  const mapBackendStepToWizard = useCallback((backendStep, currentWizardStep, cultureName) => {
    if (typeof backendStep !== 'number') return currentWizardStep + 1;
    const hasVirtue = cultureGetsVirtue(cultureName);
    // backend → wizard
    //   1 cultura       → 1
    //   2 trasfondo     → 2
    //   3 ocupación     → 3
    //   4 atributos     → 3 (los atributos se asignan dentro de la cultura)
    //   5 virtud        → 4 (sólo si la cultura tiene virtud; si no, 5)
    //   6 skills        → 5 (saltamos skills: ya se hace en Step3Occupation)
    //   7 equipo        → 5
    //   8 detalles      → 6
    //   9+ finalize     → 7 (isComplete)
    if (backendStep <= 1) return 1;
    if (backendStep === 2) return 2;
    if (backendStep === 3) return 3;
    if (backendStep === 4) return 3;
    if (backendStep === 5) return hasVirtue ? 4 : 5;
    if (backendStep === 6 || backendStep === 7) return 5;
    if (backendStep === 8) return 6;
    return 7; // ≥9 → completado
  }, [cultureGetsVirtue]);

  // Handle step completion
  const handleStepComplete = useCallback((updatedDraft) => {
    setDraft(updatedDraft);
    const cultureName = updatedDraft.cultura_nombre;
    let nextStep = mapBackendStepToWizard(updatedDraft.paso_actual, currentStep, cultureName);

    // Garantía: nunca retroceder.
    if (nextStep <= currentStep) nextStep = currentStep + 1;

    setCurrentStep(nextStep);

    if (nextStep > 6) {
      setIsComplete(true);
    }
  }, [currentStep, cultureGetsVirtue, mapBackendStepToWizard]);

  // Navigate to previous step - RESET current step data to prevent duplicates
  const handleBack = useCallback(async () => {
    if (currentStep > 1) {
      let prevStep = currentStep - 1;
      // Si estamos en paso 6 y la cultura NO obtiene virtud, volvemos al paso 4
      if (currentStep === 6 && !cultureGetsVirtue(draft?.cultura_nombre)) {
        prevStep = 4;
      }
      
      // Reset current step data in draft to prevent duplicates when re-selecting
      // We'll update the paso_actual in backend so next time it loads fresh
      try {
        // Fetch fresh draft data without accumulating selections
        const freshDraft = await getCharacterDraft(draftId);
        setDraft(freshDraft);
      } catch (err) {
        console.error('Error refreshing draft on back:', err);
      }
      
      setCurrentStep(prevStep);
    }
  }, [currentStep, cultureGetsVirtue, draft?.cultura_nombre, draftId]);

  // Finalize character
  const handleFinalize = useCallback(async () => {
    if (!draftId) return;
    try {
      setLoading(true);
      const character = await finalizeCharacter(draftId);
      navigate(`/character/${character.id}`);
    } catch (err) {
      console.error('Error finalizing character:', err);
      setError('No se pudo finalizar el personaje. Asegúrate de completar todos los pasos.');
    } finally {
      setLoading(false);
    }
  }, [draftId, navigate]);

  // Cancel and go home
  const handleCancel = useCallback(() => {
    if (window.confirm('¿Seguro que quieres cancelar? Se perderá todo el progreso.')) {
      navigate('/');
    }
  }, [navigate]);

  // Render step component
  const renderStep = () => {
    if (!draftId || !draft) return null;

    const commonProps = {
      draftId,
      draft,
      onComplete: handleStepComplete,
      onBack: handleBack,
    };

    switch (currentStep) {
      case 1:
        return <Step1Culture {...commonProps} />;
      case 2:
        return <Step2Background {...commonProps} />;
      case 3:
        return <Step3Occupation {...commonProps} />;
      case 4:
        // Solo se muestra si la cultura tiene virtud
        if (cultureGetsVirtue(draft?.cultura_nombre)) {
          return <Step5Virtue {...commonProps} />;
        }
        // Si no, saltamos a Equipo
        return <Step7Equipment {...commonProps} />;
      case 5:
        return <Step7Equipment {...commonProps} />;
      case 6:
        return <Step8Details {...commonProps} />;
      default:
        return null;
    }
  };

  // Get visible steps for indicator (filter out conditional if not applicable)
  const getVisibleSteps = () => {
    if (!draft?.cultura_nombre) return STEPS;
    if (cultureGetsVirtue(draft.cultura_nombre)) return STEPS;
    // Filter out virtue step for cultures that don't get it
    return STEPS.filter(s => s.num !== 4).map((s, i) => ({
      ...s,
      num: i + 1 // Renumber
    }));
  };

  if (loading && !draft) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))] mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Preparando el pergamino...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center p-4">
        <div className="card-parchment rounded-lg p-8 max-w-md text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--destructive))] mb-4">Error</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded font-heading"
          >
            Volver al Inicio
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen tavern-bg">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <CharacterSummary 
            draft={draft}
            draftId={draftId}
            onFinalize={handleFinalize} 
            onEdit={() => setIsComplete(false)}
            loading={loading}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen tavern-bg" data-testid="character-creator-wizard">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-heading text-2xl text-[hsl(var(--gold))] text-glow-gold">
            Creador de Personajes
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sheet-editor')}
              className="text-[hsl(var(--magic-blue))] hover:text-[hsl(var(--magic-blue-glow))] transition-colors text-sm flex items-center gap-1"
              title="Editor de posiciones de la ficha oficial"
            >
              <span>📐</span>
              <span className="hidden sm:inline">Editor Ficha</span>
            </button>
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              data-testid="cancel-creation-btn"
            >
              Cancelar
            </button>
          </div>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="container mx-auto px-4 py-6">
        <StepIndicator 
          steps={getVisibleSteps()} 
          currentStep={cultureGetsVirtue(draft?.cultura_nombre) ? currentStep : 
            currentStep > 5 ? currentStep - 1 : currentStep} 
        />
      </div>

      {/* Step Content */}
      <main className="container mx-auto px-4 pb-12 max-w-5xl">
        <div className="animate-fade-in" key={currentStep}>
          {renderStep()}
        </div>
      </main>
    </div>
  );
};

export default CharacterCreatorWizard;
