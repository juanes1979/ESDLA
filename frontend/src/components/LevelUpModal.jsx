/**
 * Level Up Component
 * Allows characters to level up and choose virtues/arts based on their occupation
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ArrowUp, Sparkles, BookOpen, Star, Check, AlertCircle,
  ChevronRight, Swords, Shield, Heart
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { cn } from '@/lib/utils';

// Parse virtue/art levels from occupation text
const parseVirtueLevels = (virtuesText) => {
  if (!virtuesText || !Array.isArray(virtuesText)) return { virtudes: [], artes: [] };
  
  const virtudesLevels = [];
  const artesLevels = [];
  
  virtuesText.forEach(text => {
    if (!text) return;
    
    // Extract virtue levels (e.g., "A nivel 4, y de nuevo a nivel 6 y 8")
    const virtudMatch = text.match(/virtud.*?nivel\s*(\d+)(?:.*?nivel\s*(\d+))?(?:.*?nivel\s*(\d+))?(?:.*?nivel\s*(\d+))?(?:.*?nivel\s*(\d+))?/i);
    if (virtudMatch || text.toLowerCase().includes('virtud')) {
      // Extract all numbers from the line about virtues
      const numbers = text.match(/nivel\s*(\d+)/gi);
      if (numbers) {
        numbers.forEach(n => {
          const num = parseInt(n.replace(/\D/g, ''));
          if (num && !virtudesLevels.includes(num)) {
            virtudesLevels.push(num);
          }
        });
      }
    }
    
    // Extract art levels (e.g., "A nivel 6, en lugar de elegir una virtud, puedes obtener un espacio de arte")
    if (text.toLowerCase().includes('arte')) {
      const arteMatches = text.match(/nivel\s*(\d+)/gi);
      if (arteMatches) {
        arteMatches.forEach(n => {
          const num = parseInt(n.replace(/\D/g, ''));
          if (num && !artesLevels.includes(num)) {
            artesLevels.push(num);
          }
        });
      }
    }
  });
  
  return {
    virtudes: virtudesLevels.sort((a, b) => a - b),
    artes: artesLevels.sort((a, b) => a - b)
  };
};

// Calculate HP gain on level up
const calculateHPGain = (dadoGolpe, conModifier) => {
  // Parse dado_golpe like "1d8" -> 8
  const diceMatch = dadoGolpe?.match(/\d*d(\d+)/i);
  const diceMax = diceMatch ? parseInt(diceMatch[1]) : 8;
  
  // Average roll + CON modifier
  const avgRoll = Math.ceil(diceMax / 2) + 1;
  return avgRoll + (conModifier || 0);
};

// Get proficiency bonus by level
const getProficiencyBonus = (level) => {
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
};

const LevelUpModal = ({ 
  isOpen, 
  onClose, 
  character, 
  onLevelUp 
}) => {
  const [step, setStep] = useState('confirm'); // confirm, choose_virtue, choose_art, summary
  const [virtues, setVirtues] = useState([]);
  const [artes, setArtes] = useState([]);
  const [selectedVirtue, setSelectedVirtue] = useState(null);
  const [selectedArte, setSelectedArte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [levelConfig, setLevelConfig] = useState({ virtudes: [], artes: [] });
  
  const currentLevel = character?.nivel || 1;
  const newLevel = currentLevel + 1;
  
  // Check if new level allows virtue or art selection
  useEffect(() => {
    const loadOccupationData = async () => {
      // If we already have virtudes_texto, use it
      if (character?.ocupacion_virtudes_texto?.length > 0) {
        const config = parseVirtueLevels(character.ocupacion_virtudes_texto);
        setLevelConfig(config);
        return;
      }
      
      // Otherwise, try to load from occupation
      const occupationName = character?.ocupacion || character?.vocacion_nombre;
      if (occupationName) {
        try {
          const res = await api.get('/data/occupations');
          const occupations = res.data?.occupations || res.data || [];
          const occupation = occupations.find(o => 
            o.vocacion === occupationName || o.vocacion?.toLowerCase() === occupationName?.toLowerCase()
          );
          if (occupation?.virtudes_texto) {
            const config = parseVirtueLevels(occupation.virtudes_texto);
            setLevelConfig(config);
          }
        } catch (err) {
          console.error('Error loading occupation:', err);
        }
      }
    };
    
    if (isOpen && character) {
      loadOccupationData();
    }
  }, [isOpen, character]);
  
  const canChooseVirtue = levelConfig.virtudes.includes(newLevel);
  const canChooseArt = levelConfig.artes.includes(newLevel);
  
  // Load virtues and artes when modal opens
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !character) return;
      
      setLoading(true);
      try {
        // Load virtues for culture
        if (character.cultura_id && canChooseVirtue) {
          const virtuesRes = await api.get(`/data/cultures/${character.cultura_id}/virtues`);
          // Filter out already selected virtues
          const alreadySelected = character.virtudes_obtenidas || [];
          const available = (virtuesRes.data.virtues || []).filter(
            v => !alreadySelected.some(s => s.id === v.id || s.nombre === v.nombre)
          );
          setVirtues(available);
        }
        
        // Load artes
        if (canChooseArt) {
          const artesRes = await api.get('/data/artes');
          // Filter out already selected artes
          const alreadySelected = character.artes_obtenidas || [];
          const available = (artesRes.data?.artes || artesRes.data || []).filter(
            a => !alreadySelected.some(s => s.nombre === a.nombre)
          );
          setArtes(available);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [isOpen, character, canChooseVirtue, canChooseArt]);
  
  // Calculate stats for new level
  const conModifier = Math.floor(((character?.atributos?.constitucion || character?.caracteristicas?.CON || 10) - 10) / 2);
  const hpGain = calculateHPGain(character?.dado_golpe || character?.ocupacion_dado_golpe, conModifier);
  const newHP = (character?.puntos_golpe_max || 0) + hpGain;
  const newProfBonus = getProficiencyBonus(newLevel);
  const currentProfBonus = getProficiencyBonus(currentLevel);
  
  // Handle level up confirmation
  const handleConfirmLevelUp = () => {
    if (canChooseVirtue || canChooseArt) {
      setStep(canChooseVirtue ? 'choose_virtue' : 'choose_art');
    } else {
      setStep('summary');
    }
  };
  
  // Handle virtue selection
  const handleVirtueSelected = () => {
    if (canChooseArt && !selectedArte) {
      setStep('choose_art');
    } else {
      setStep('summary');
    }
  };
  
  // Handle skip virtue (choose art instead)
  const handleSkipVirtue = () => {
    if (canChooseArt) {
      setSelectedVirtue(null);
      setStep('choose_art');
    } else {
      setStep('summary');
    }
  };
  
  // Handle final level up
  const handleFinalLevelUp = async () => {
    setLoading(true);
    try {
      const updateData = {
        nivel: newLevel,
        puntos_golpe_max: newHP,
        bonificador_competencia: newProfBonus,
      };
      
      // Add selected virtue
      if (selectedVirtue) {
        const currentVirtudes = character.virtudes_obtenidas || [];
        updateData.virtudes_obtenidas = [...currentVirtudes, {
          id: selectedVirtue.id,
          nombre: selectedVirtue.nombre,
          nivel_obtenido: newLevel
        }];
      }
      
      // Add selected arte
      if (selectedArte) {
        const currentArtes = character.artes_obtenidas || [];
        updateData.artes_obtenidas = [...currentArtes, {
          nombre: selectedArte.nombre,
          nivel_obtenido: newLevel
        }];
        // Also increase espacios_arte
        updateData.espacios_arte = (character.espacios_arte || 0) + 1;
      }
      
      await api.patch(`/characters/${character.id}`, updateData);
      
      toast.success(`¡${character.nombre} ha subido al nivel ${newLevel}!`);
      onLevelUp && onLevelUp(updateData);
      onClose();
    } catch (err) {
      console.error('Error leveling up:', err);
      toast.error('Error al subir de nivel');
    } finally {
      setLoading(false);
    }
  };
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setSelectedVirtue(null);
      setSelectedArte(null);
    }
  }, [isOpen]);
  
  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
          <ArrowUp className="w-10 h-10 text-[hsl(var(--gold))]" />
        </div>
        <h3 className="text-2xl font-heading text-[hsl(var(--gold))]">
          ¡Subir de Nivel!
        </h3>
        <p className="text-muted-foreground mt-2">
          {character?.nombre} pasará del nivel {currentLevel} al nivel {newLevel}
        </p>
      </div>
      
      {/* Stats preview */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-black/20">
          <CardContent className="pt-4 text-center">
            <Heart className="w-6 h-6 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-muted-foreground">Puntos de Golpe</p>
            <p className="text-xl font-bold">
              {character?.puntos_golpe_max || 0} → <span className="text-green-400">{newHP}</span>
            </p>
            <p className="text-xs text-green-400">+{hpGain} PG</p>
          </CardContent>
        </Card>
        
        <Card className="bg-black/20">
          <CardContent className="pt-4 text-center">
            <Shield className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-sm text-muted-foreground">Competencia</p>
            <p className="text-xl font-bold">
              +{currentProfBonus} → <span className={newProfBonus > currentProfBonus ? 'text-green-400' : ''}>+{newProfBonus}</span>
            </p>
            {newProfBonus > currentProfBonus && (
              <p className="text-xs text-green-400">¡Aumenta!</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Virtue/Art availability */}
      {(canChooseVirtue || canChooseArt) && (
        <Card className="bg-[hsl(var(--gold))/10] border-[hsl(var(--gold))/30]">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-[hsl(var(--gold))] mb-2">
              En el nivel {newLevel} puedes elegir:
            </p>
            <div className="space-y-1">
              {canChooseVirtue && (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--torch-orange))]" />
                  <span>Una Virtud</span>
                </div>
              )}
              {canChooseArt && (
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
                  <span>Un Arte (en lugar de virtud)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleConfirmLevelUp}>
          Continuar <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogFooter>
    </div>
  );
  
  const renderVirtueStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <Sparkles className="w-8 h-8 mx-auto text-[hsl(var(--torch-orange))]" />
        <h3 className="text-xl font-heading mt-2">Elige una Virtud</h3>
        <p className="text-sm text-muted-foreground">
          Nivel {newLevel} - {character?.cultura_nombre}
        </p>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Cargando virtudes...</div>
      ) : virtues.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          No hay virtudes disponibles
        </div>
      ) : (
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {virtues.map((virtue, i) => (
              <button
                key={virtue.id || i}
                onClick={() => setSelectedVirtue(virtue)}
                className={cn(
                  "w-full text-left p-3 rounded border transition-all",
                  selectedVirtue?.id === virtue.id
                    ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold))/20]"
                    : "border-border/30 hover:border-[hsl(var(--gold))/50]"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-[hsl(var(--torch-orange))]">{virtue.nombre}</span>
                  {selectedVirtue?.id === virtue.id && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {virtue.descripcion || virtue.rasgos_virtud}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
      
      <DialogFooter className="flex-col sm:flex-row gap-2">
        {canChooseArt && (
          <Button variant="outline" onClick={handleSkipVirtue} className="w-full sm:w-auto">
            <BookOpen className="w-4 h-4 mr-2" /> Elegir Arte en su lugar
          </Button>
        )}
        <Button 
          onClick={handleVirtueSelected} 
          disabled={!selectedVirtue}
          className="w-full sm:w-auto"
        >
          Continuar <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogFooter>
    </div>
  );
  
  const renderArteStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <BookOpen className="w-8 h-8 mx-auto text-[hsl(var(--magic-blue))]" />
        <h3 className="text-xl font-heading mt-2">Elige un Arte</h3>
        <p className="text-sm text-muted-foreground">
          Nivel {newLevel} - Obtienes un espacio de arte
        </p>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Cargando artes...</div>
      ) : artes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          No hay artes disponibles
        </div>
      ) : (
        <ScrollArea className="h-64">
          <div className="space-y-2">
            {artes.map((arte, i) => (
              <button
                key={i}
                onClick={() => setSelectedArte(arte)}
                className={cn(
                  "w-full text-left p-3 rounded border transition-all",
                  selectedArte?.nombre === arte.nombre
                    ? "border-[hsl(var(--magic-blue))] bg-[hsl(var(--magic-blue))/20]"
                    : "border-border/30 hover:border-[hsl(var(--magic-blue))/50]"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-[hsl(var(--magic-blue))]">{arte.nombre}</span>
                  {selectedArte?.nombre === arte.nombre && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {arte.descripcion_corta || arte.descripcion}
                </p>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('summary')}>
          Saltar
        </Button>
        <Button 
          onClick={() => setStep('summary')} 
          disabled={!selectedArte}
        >
          Continuar <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogFooter>
    </div>
  );
  
  const renderSummaryStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <Star className="w-8 h-8 mx-auto text-[hsl(var(--gold))]" />
        <h3 className="text-xl font-heading mt-2">Resumen de Subida de Nivel</h3>
      </div>
      
      <Card className="bg-black/20">
        <CardContent className="pt-4 space-y-3">
          <div className="flex justify-between">
            <span>Nivel</span>
            <span className="font-bold">{currentLevel} → {newLevel}</span>
          </div>
          <div className="flex justify-between">
            <span>Puntos de Golpe</span>
            <span className="font-bold text-green-400">+{hpGain} ({newHP} total)</span>
          </div>
          {newProfBonus > currentProfBonus && (
            <div className="flex justify-between">
              <span>Bonificador Competencia</span>
              <span className="font-bold text-green-400">+{currentProfBonus} → +{newProfBonus}</span>
            </div>
          )}
          
          {selectedVirtue && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[hsl(var(--torch-orange))]" />
                <span className="font-semibold">Nueva Virtud:</span>
              </div>
              <p className="text-[hsl(var(--torch-orange))] ml-6">{selectedVirtue.nombre}</p>
            </div>
          )}
          
          {selectedArte && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
                <span className="font-semibold">Nuevo Arte:</span>
              </div>
              <p className="text-[hsl(var(--magic-blue))] ml-6">{selectedArte.nombre}</p>
              <p className="text-xs text-muted-foreground ml-6">+1 espacio de arte</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DialogFooter>
        <Button variant="outline" onClick={() => setStep('confirm')}>Atrás</Button>
        <Button onClick={handleFinalLevelUp} disabled={loading}>
          {loading ? 'Guardando...' : 'Confirmar Subida de Nivel'}
        </Button>
      </DialogFooter>
    </div>
  );
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--gold))]">
            {step === 'confirm' && 'Subir de Nivel'}
            {step === 'choose_virtue' && 'Elegir Virtud'}
            {step === 'choose_art' && 'Elegir Arte'}
            {step === 'summary' && 'Confirmar'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'confirm' && renderConfirmStep()}
        {step === 'choose_virtue' && renderVirtueStep()}
        {step === 'choose_art' && renderArteStep()}
        {step === 'summary' && renderSummaryStep()}
      </DialogContent>
    </Dialog>
  );
};

// Tabla de PX requeridos para alcanzar cada nivel (D&D 5e estándar).
// Índice = nivel. xpThresholds[N] = experiencia mínima para SER nivel N.
export const XP_THRESHOLDS = [
  0,        // 1
  300,      // 2
  900,      // 3
  2700,     // 4
  6500,     // 5
  14000,    // 6
  23000,    // 7
  34000,    // 8
  48000,    // 9
  64000,    // 10
];

// Button component to trigger level up
export const LevelUpButton = ({ character, onLevelUp, className }) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentLevel = character?.nivel || 1;
  const currentXP = character?.experiencia || 0;
  const nextLevel = currentLevel + 1;
  const xpNeeded = XP_THRESHOLDS[nextLevel - 1] ?? Infinity;
  const canLevelUp = currentXP >= xpNeeded;
  const xpRestante = Math.max(0, xpNeeded - currentXP);

  if (currentLevel >= 10) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Nivel máximo (10)
      </Badge>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        disabled={!canLevelUp}
        className={cn(
          canLevelUp
            ? "bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/80 text-black"
            : "bg-muted text-muted-foreground cursor-not-allowed opacity-70",
          className
        )}
        title={canLevelUp
          ? `Pasa al nivel ${nextLevel}`
          : `Faltan ${xpRestante} PX para alcanzar el nivel ${nextLevel} (${xpNeeded} requeridos).`}
        data-testid="level-up-btn"
      >
        <ArrowUp className="w-4 h-4 mr-2" />
        {canLevelUp
          ? `Subir al Nivel ${nextLevel}`
          : `Nivel ${nextLevel}: faltan ${xpRestante} PX`}
      </Button>

      <LevelUpModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        character={character}
        onLevelUp={(data) => {
          onLevelUp && onLevelUp(data);
          setIsOpen(false);
        }}
      />
    </>
  );
};

export default LevelUpModal;
