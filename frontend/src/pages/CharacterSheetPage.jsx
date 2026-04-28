/**
 * Character Sheet Page - Interactive character view
 * Refactored to use modular sub-components
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, FileText, FileDown } from 'lucide-react';
import { getCharacter, deleteCharacter } from '@/services/api';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { downloadCharacterPDF } from '@/utils/characterPDF';
import EquipmentManagerModal from '@/components/character-sheet/EquipmentManagerModal';

// Import modular components
import {
  CharacterHeader,
  CombatStatsCard,
  CompetenciesCard,
  AttributesCard,
  SkillsCard,
  OccupationCard,
  EquipmentCard,
  AppearanceCard,
  PersonalityCard,
  BackgroundCard,
  ShadowPathCard,
  CultureCard,
  PrivateNotesCard,
} from '@/components/character-sheet/summary';

const CharacterSheetPage = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [character, setCharacter] = useState(null);
  const [occupation, setOccupation] = useState(null);
  const [culture, setCulture] = useState(null);
  const [background, setBackground] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingHp, setSavingHp] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);

  // Load character and related data
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        setLoading(true);
        const data = await getCharacter(characterId);
        setCharacter(data);
        
        // Load culture, occupation and background data in parallel
        const [culturesRes, occupationsRes, backgroundsRes] = await Promise.all([
          api.get('/data/cultures'),
          api.get('/data/occupations'),
          api.get('/data/backgrounds')
        ]);
        
        // Find the matching culture
        const cultures = culturesRes.data?.cultures || [];
        const cult = cultures.find(c => c.id === data.cultura_id || c.nombre === data.cultura_nombre);
        if (cult) setCulture(cult);
        
        // Find the matching occupation
        const occupations = occupationsRes.data?.occupations || [];
        const occ = occupations.find(o => o.id === data.ocupacion_id || o.vocacion === data.vocacion_nombre);
        if (occ) setOccupation(occ);
        
        // Find the matching background
        const backgrounds = backgroundsRes.data?.backgrounds || [];
        const bg = backgrounds.find(b => b.id === data.trasfondo_id || b.nombre === data.trasfondo_nombre);
        if (bg) setBackground(bg);
        
      } catch (err) {
        console.error('Error loading character:', err);
        setError('No se pudo cargar el personaje');
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId]);

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!character) return;
    try {
      setGeneratingPDF(true);
      await downloadCharacterPDF(character);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Handle HP change
  const handleHpChange = async (delta) => {
    if (!character) return;
    try {
      setSavingHp(true);
      const response = await api.patch(`/characters/${characterId}/hp`, { hp_change: delta });
      setCharacter(prev => ({
        ...prev,
        puntos_golpe_actual: response.data.puntos_golpe_actual
      }));
    } catch (err) {
      console.error('Error updating HP:', err);
    } finally {
      setSavingHp(false);
    }
  };

  // Handle shadow change
  const handleShadowChange = async (delta) => {
    if (!character) return;
    try {
      const response = await api.patch(`/characters/${characterId}/shadow`, { shadow_change: delta });
      setCharacter(prev => ({
        ...prev,
        puntos_sombra: response.data.puntos_sombra
      }));
    } catch (err) {
      console.error('Error updating shadow:', err);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que quieres eliminar este personaje?')) return;
    try {
      await deleteCharacter(characterId);
      navigate('/');
    } catch (err) {
      console.error('Error deleting character:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  // Error state
  if (error || !character) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center p-4">
        <div className="card-parchment rounded-lg p-8 max-w-md text-center">
          <h2 className="font-heading text-2xl text-[hsl(var(--destructive))] mb-4">Error</h2>
          <p className="text-muted-foreground mb-6">{error || 'Personaje no encontrado'}</p>
          <Button onClick={() => navigate('/')} className="bg-[hsl(var(--gold))]">
            Volver al Inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen tavern-bg" data-testid="character-sheet">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/characters')}
            className="text-muted-foreground hover:text-foreground"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="font-heading text-2xl text-[hsl(var(--gold))] text-glow-gold">
            Hoja de Personaje
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={generatingPDF}
              className="border-[hsl(var(--magic-blue))] text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))/10]"
              data-testid="download-pdf-btn"
            >
              {generatingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              Descargar PDF (3 hojas)
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/character/${characterId}/sheet`)}
              className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
              data-testid="official-sheet-btn"
            >
              <FileText className="w-4 h-4 mr-2" />
              Ficha Oficial
            </Button>
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="text-muted-foreground hover:text-[hsl(var(--destructive))]"
              data-testid="delete-btn"
            >
              Eliminar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Character Header */}
        <CharacterHeader 
          character={character} 
          onLevelUp={(data) => setCharacter(prev => ({ ...prev, ...data }))}
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Combat Stats & Competencies */}
          <div className="space-y-6">
            <CombatStatsCard
              character={character}
              onHpChange={handleHpChange}
              onShadowChange={handleShadowChange}
              savingHp={savingHp}
            />
            <CompetenciesCard character={character} occupation={occupation} />
          </div>

          {/* Middle Column - Attributes, Skills & Equipment */}
          <div className="space-y-6">
            <AttributesCard character={character} />
            <SkillsCard character={character} />
            <OccupationCard character={character} occupation={occupation} />
            <EquipmentCard 
              character={character} 
              onManageClick={() => setShowEquipmentModal(true)} 
            />
          </div>

          {/* Right Column - Background, Culture & Personality */}
          <div className="space-y-6">
            <AppearanceCard character={character} />
            <PersonalityCard character={character} />
            <BackgroundCard character={character} background={background} />
            <ShadowPathCard character={character} />
            <CultureCard character={character} culture={culture} />
            <PrivateNotesCard
              character={character}
              onUpdate={(updated) => setCharacter(prev => ({ ...prev, ...updated }))}
            />
          </div>
        </div>
      </main>
      
      {/* Equipment Manager Modal */}
      <EquipmentManagerModal
        isOpen={showEquipmentModal}
        character={character}
        onClose={() => setShowEquipmentModal(false)}
        onCharacterUpdate={(updatedChar) => setCharacter(updatedChar)}
      />
    </div>
  );
};

export default CharacterSheetPage;
