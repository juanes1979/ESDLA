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
import Step4Attributes from './steps/Step4Attributes';
import Step5Virtue from './steps/Step5Virtue';
import Step6Skills from './steps/Step6Skills';
import Step7Equipment from './steps/Step7Equipment';
import Step8Details from './steps/Step8Details';
import CharacterSummary from './CharacterSummary';

// Las culturas que obtienen virtud al nivel 1 según las reglas
export const CULTURAS_CON_VIRTUD = ['Hombres del lago', 'Hombres de Bree', 'Beornidas'];

const STEPS = [
  { num: 1, title: 'Cultura', description: 'Elige tu linaje' },
  { num: 2, title: 'Trasfondo', description: 'Tu historia pasada' },
  { num: 3, title: 'Ocupación', description: 'Tu vocación' },
  { num: 4, title: 'Atributos', description: 'Tus capacidades' },
  { num: 5, title: 'Virtud', description: 'Tu don especial', conditional: true },
  { num: 6, title: 'Habilidades', description: 'Tus competencias' },
  { num: 7, title: 'Equipo', description: 'Tus posesiones' },
  { num: 8, title: 'Detalles', description: 'Tu personalidad' },
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

  // Handle step completion
  const handleStepComplete = useCallback((updatedDraft) => {
    setDraft(updatedDraft);
    let nextStep = updatedDraft.paso_actual || currentStep + 1;
    
    // Si estamos en paso 4 (atributos) y la cultura NO obtiene virtud, saltamos al paso 6
    if (currentStep === 4 && !cultureGetsVirtue(updatedDraft.cultura_nombre)) {
      nextStep = 6;
    }
    
    setCurrentStep(nextStep);
    
    if (nextStep > 8) {
      setIsComplete(true);
    }
  }, [currentStep, cultureGetsVirtue]);

  // Navigate to previous step
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

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
        return <Step4Attributes {...commonProps} />;
      case 5:
        return <Step5Virtue {...commonProps} />;
      case 6:
        return <Step6Skills {...commonProps} />;
      case 7:
        return <Step7Equipment {...commonProps} />;
      case 8:
        return <Step8Patron {...commonProps} />;
      case 9:
        return <Step9Details {...commonProps} />;
      default:
        return null;
    }
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
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors text-sm"
            data-testid="cancel-creation-btn"
          >
            Cancelar
          </button>
        </div>
      </header>

      {/* Step Indicator */}
      <div className="container mx-auto px-4 py-6">
        <StepIndicator steps={STEPS} currentStep={currentStep} />
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
