/**
 * Character Sheet Page - Interactive character view (tabbed layout)
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, FileText, FileDown } from 'lucide-react';
import { getCharacter, deleteCharacter } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  HeaderInfoCard,
  SavingThrowsCard,
  DeathSavesCard,
  WeightEncumbranceCard,
  ToolsProficiencyCard,
  ShadowExtendedCard,
  PatronCard,
  ProfessionSpecialsCard,
  HistoryCard,
} from '@/components/character-sheet/summary/ExtendedCards';
import ShadowDefectsCard from '@/components/character-sheet/summary/ShadowDefectsCard';

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
        {/* Character Header (shared) */}
        <CharacterHeader 
          character={character} 
          onLevelUp={(data) => setCharacter(prev => ({ ...prev, ...data }))}
        />

        <Tabs defaultValue="resumen" className="w-full" data-testid="character-tabs">
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 mb-6 w-full">
            <TabsTrigger value="resumen" data-testid="tab-resumen">Resumen</TabsTrigger>
            <TabsTrigger value="atributos" data-testid="tab-atributos">Atributos</TabsTrigger>
            <TabsTrigger value="combate" data-testid="tab-combate">Combate</TabsTrigger>
            <TabsTrigger value="equipo" data-testid="tab-equipo">Equipo</TabsTrigger>
            <TabsTrigger value="comunidad" data-testid="tab-comunidad">Comunidad</TabsTrigger>
            <TabsTrigger value="sombra" data-testid="tab-sombra">Sombra</TabsTrigger>
            <TabsTrigger value="trasfondo" data-testid="tab-trasfondo">Trasfondo</TabsTrigger>
            <TabsTrigger value="historia" data-testid="tab-historia">Historia</TabsTrigger>
          </TabsList>

          {/* RESUMEN — vista global rápida */}
          <TabsContent value="resumen" className="space-y-6">
            <HeaderInfoCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                <CombatStatsCard
                  character={character}
                  onHpChange={handleHpChange}
                  onShadowChange={handleShadowChange}
                  savingHp={savingHp}
                />
                <AppearanceCard character={character} />
              </div>
              <div className="space-y-6">
                <AttributesCard character={character} />
                <PersonalityCard character={character} />
              </div>
              <div className="space-y-6">
                <CultureCard character={character} culture={culture} />
                <OccupationCard character={character} occupation={occupation} />
              </div>
            </div>
          </TabsContent>

          {/* ATRIBUTOS — atributos, salvaciones, habilidades, herramientas */}
          <TabsContent value="atributos" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <AttributesCard character={character} />
              <SavingThrowsCard
                character={character}
                onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
              />
            </div>
            <SkillsCard character={character} />
            <CompetenciesCard character={character} occupation={occupation} />
            <ToolsProficiencyCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* COMBATE — HP, AC, iniciativa, dado golpe, salv. muerte */}
          <TabsContent value="combate" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <CombatStatsCard
                character={character}
                onHpChange={handleHpChange}
                onShadowChange={handleShadowChange}
                savingHp={savingHp}
              />
              <DeathSavesCard
                character={character}
                onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
              />
            </div>
            <HeaderInfoCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* EQUIPO — inventario y peso/carga */}
          <TabsContent value="equipo" className="space-y-6">
            <EquipmentCard
              character={character}
              onManageClick={() => setShowEquipmentModal(true)}
            />
            <WeightEncumbranceCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* COMUNIDAD — puntos comunidad, mecenas, heredero, virtudes, recompensas */}
          <TabsContent value="comunidad" className="space-y-6">
            <PatronCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
            <ProfessionSpecialsCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* SOMBRA — puntos sombra, estados, cicatrices, maldición, defectos */}
          <TabsContent value="sombra" className="space-y-6">
            <ShadowPathCard character={character} />
            <ShadowExtendedCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
            <ShadowDefectsCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* TRASFONDO — cultura, vocación, trasfondo, especiales */}
          <TabsContent value="trasfondo" className="space-y-6">
            <BackgroundCard character={character} background={background} />
            <CultureCard character={character} culture={culture} />
            <OccupationCard character={character} occupation={occupation} />
          </TabsContent>

          {/* HISTORIA — historia narrativa + notas + notas privadas */}
          <TabsContent value="historia" className="space-y-6">
            <HistoryCard
              character={character}
              onUpdate={(data) => setCharacter(prev => ({ ...prev, ...data }))}
            />
            <PrivateNotesCard
              character={character}
              onUpdate={(updated) => setCharacter(prev => ({ ...prev, ...updated }))}
            />
          </TabsContent>
        </Tabs>
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
