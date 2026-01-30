/**
 * Step 1: Culture Selection with Auto Name Generator
 */
import { useState, useEffect } from 'react';
import { Loader2, Shuffle } from 'lucide-react';
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
  { id: 'Elfos', name: 'Elfos', icon: '🌿' },
  { id: 'Enanos', name: 'Enanos', icon: '⛏️' },
  { id: 'Hombres', name: 'Hombres', icon: '⚔️' },
  { id: 'Hobbits', name: 'Hobbits', icon: '🍃' },
];

const Step1Culture = ({ draftId, draft, onComplete, onBack }) => {
  const [cultures, setCultures] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [characterName, setCharacterName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [gender, setGender] = useState('hombre');
  const [nameData, setNameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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

  // Load name data and auto-generate name when culture changes
  useEffect(() => {
    const loadNameDataAndGenerateName = async () => {
      if (!selectedCulture) return;
      try {
        const data = await getCultureNames(selectedCulture.nombre);
        setNameData(data);
        // Auto-generate name when culture is selected
        if (data && !characterName) {
          const name = generateRandomName(data, gender);
          if (name) setCharacterName(name);
        }
      } catch (err) {
        console.error('Error loading names:', err);
        setNameData(null);
      }
    };
    loadNameDataAndGenerateName();
  }, [selectedCulture]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter cultures by category
  const filteredCultures = selectedCategory
    ? cultures.filter(c => c.categoria === selectedCategory)
    : cultures;

  // Generate random name
  const handleGenerateName = () => {
    if (nameData) {
      const name = generateRandomName(nameData, gender);
      if (name) setCharacterName(name);
    }
  };

  // Regenerate name when gender changes
  const handleGenderChange = (newGender) => {
    setGender(newGender);
    if (nameData) {
      const name = generateRandomName(nameData, newGender);
      if (name) setCharacterName(name);
    }
  };

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedCulture(null);
    setCharacterName(''); // Reset name when changing category
  };

  // Handle culture selection
  const handleCultureSelect = (culture) => {
    setSelectedCulture(culture);
  };

  // Handle submit - name will be auto-generated if empty
  const handleSubmit = async () => {
    if (!selectedCulture) return;

    // Generate name if not provided
    let finalName = characterName.trim();
    if (!finalName && nameData) {
      finalName = generateRandomName(nameData, gender);
    }
    if (!finalName) {
      finalName = `${selectedCulture.nombre} Aventurero`;
    }

    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep1(draftId, {
        nombre: finalName,
        jugador: playerName.trim() || null,
        cultura_id: selectedCulture.id,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 1:', err);
      setError('No se pudo guardar la cultura');
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

  return (
    <div className="space-y-8" data-testid="step-1-culture">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Cultura
        </h2>
        <p className="text-muted-foreground">
          Tu cultura define tu linaje y las tierras de donde provienes
        </p>
      </div>

      {/* Category Selection */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CULTURE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategorySelect(category.id)}
            className={cn(
              'selection-card rounded-lg p-4 text-center transition-all',
              selectedCategory === category.id && 'selected'
            )}
            data-testid={`category-${category.id}`}
          >
            <span className="text-3xl mb-2 block">{category.icon}</span>
            <span className="font-heading text-lg">{category.name}</span>
          </button>
        ))}
      </div>

      {/* Culture List */}
      {selectedCategory && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-4">
            Culturas de {CULTURE_CATEGORIES.find(c => c.id === selectedCategory)?.name}
          </h3>
          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-3">
              {filteredCultures.map((culture) => (
                <button
                  key={culture.id}
                  onClick={() => handleCultureSelect(culture)}
                  className={cn(
                    'selection-card w-full rounded-lg p-4 text-left',
                    selectedCulture?.id === culture.id && 'selected'
                  )}
                  data-testid={`culture-${culture.id}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-heading text-lg text-foreground">
                      {culture.nombre}
                    </h4>
                    <span className="text-xs text-muted-foreground bg-black/30 px-2 py-1 rounded">
                      Nivel de Vida: {culture.nivel_vida || 'Común'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {culture.descripcion?.substring(0, 150)}...
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="text-[hsl(var(--gold))]">Edad:</span>{' '}
                      {culture.edad_min}-{culture.edad_max} años
                    </div>
                    <div>
                      <span className="text-[hsl(var(--gold))]">Altura:</span>{' '}
                      {culture.altura_min}-{culture.altura_max} cm
                    </div>
                    <div>
                      <span className="text-[hsl(var(--gold))]">Velocidad:</span>{' '}
                      {culture.velocidad}m
                    </div>
                  </div>
                  
                  {/* Characteristic modifiers */}
                  {culture.bonificadores_caracteristicas && Object.values(culture.bonificadores_caracteristicas).some(v => v > 0) && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                      {culture.bonificadores_caracteristicas.fuerza > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          FUE +{culture.bonificadores_caracteristicas.fuerza}
                        </span>
                      )}
                      {culture.bonificadores_caracteristicas.destreza > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          DES +{culture.bonificadores_caracteristicas.destreza}
                        </span>
                      )}
                      {culture.bonificadores_caracteristicas.constitucion > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          CON +{culture.bonificadores_caracteristicas.constitucion}
                        </span>
                      )}
                      {culture.bonificadores_caracteristicas.inteligencia > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          INT +{culture.bonificadores_caracteristicas.inteligencia}
                        </span>
                      )}
                      {culture.bonificadores_caracteristicas.sabiduria > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          SAB +{culture.bonificadores_caracteristicas.sabiduria}
                        </span>
                      )}
                      {culture.bonificadores_caracteristicas.carisma > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          CAR +{culture.bonificadores_caracteristicas.carisma}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Name Input Section - Only shows after culture is selected */}
      {selectedCulture && (
        <div className="card-parchment rounded-lg p-6 animate-slide-up">
          <h3 className="font-heading text-xl text-[hsl(var(--gold))] mb-4">
            Personaliza tu Personaje
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Character Name */}
            <div className="space-y-2">
              <Label htmlFor="characterName" className="text-[hsl(var(--parchment))]">
                Nombre del Personaje
              </Label>
              <div className="flex gap-2">
                <Input
                  id="characterName"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Nombre generado automáticamente..."
                  className="bg-[hsl(var(--input))] border-border"
                  data-testid="character-name-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleGenerateName}
                  disabled={!nameData}
                  title="Generar otro nombre aleatorio"
                  className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
                  data-testid="generate-name-btn"
                >
                  <Shuffle className="w-4 h-4 text-[hsl(var(--gold))]" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se generará un nombre aleatorio si lo dejas vacío
              </p>
            </div>

            {/* Player Name & Gender */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playerName" className="text-[hsl(var(--parchment))]">
                  Nombre del Jugador (opcional)
                </Label>
                <Input
                  id="playerName"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Tu nombre real..."
                  className="bg-[hsl(var(--input))] border-border"
                  data-testid="player-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[hsl(var(--parchment))]">Género (para nombres)</Label>
                <Select value={gender} onValueChange={handleGenderChange}>
                  <SelectTrigger className="bg-[hsl(var(--input))] border-border" data-testid="gender-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hombre">Masculino</SelectItem>
                    <SelectItem value="mujer">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Selected culture summary */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground">
              <span className="text-[hsl(var(--gold))]">Cultura seleccionada:</span> {selectedCulture.nombre}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end pt-4 pb-16">
        <Button
          onClick={handleSubmit}
          disabled={!selectedCulture || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-1-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step1Culture;
