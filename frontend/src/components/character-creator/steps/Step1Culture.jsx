/**
 * Step 1: Culture Selection with Name Generator
 */
import { useState, useEffect } from 'react';
import { Loader2, Shuffle, User, ChevronDown } from 'lucide-react';
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
  { id: 'ELFOS', name: 'Elfos', icon: '🌿' },
  { id: 'ENANOS', name: 'Enanos', icon: '⛏️' },
  { id: 'HOMBRES', name: 'Hombres', icon: '⚔️' },
  { id: 'HOBBITS', name: 'Hobbits', icon: '🍃' },
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

  // Load name data when culture changes
  useEffect(() => {
    const loadNameData = async () => {
      if (!selectedCulture) return;
      try {
        const data = await getCultureNames(selectedCulture.nombre);
        setNameData(data);
      } catch (err) {
        console.error('Error loading names:', err);
        setNameData(null);
      }
    };
    loadNameData();
  }, [selectedCulture]);

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

  // Handle category selection
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedCulture(null);
  };

  // Handle culture selection
  const handleCultureSelect = (culture) => {
    setSelectedCulture(culture);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedCulture || !characterName.trim()) return;

    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep1(draftId, {
        nombre: characterName.trim(),
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

      {/* Name Input Section */}
      <div className="card-parchment rounded-lg p-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Character Name */}
          <div className="space-y-2">
            <Label htmlFor="characterName" className="text-[hsl(var(--parchment))]">
              Nombre del Personaje *
            </Label>
            <div className="flex gap-2">
              <Input
                id="characterName"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Escribe o genera un nombre..."
                className="bg-[hsl(var(--input))] border-border"
                data-testid="character-name-input"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleGenerateName}
                disabled={!nameData}
                title="Generar nombre aleatorio"
                className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
                data-testid="generate-name-btn"
              >
                <Shuffle className="w-4 h-4 text-[hsl(var(--gold))]" />
              </Button>
            </div>
            {selectedCulture && nameData && (
              <p className="text-xs text-muted-foreground">
                Haz clic en el dado para generar un nombre {selectedCulture.nombre.toLowerCase()}
              </p>
            )}
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
              <Select value={gender} onValueChange={setGender}>
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
          <ScrollArea className="h-[400px] pr-4">
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
                  {(culture.mod_fuerza || culture.mod_destreza || culture.mod_constitucion || 
                    culture.mod_inteligencia || culture.mod_sabiduria || culture.mod_carisma) && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                      {culture.mod_fuerza > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          FUE +{culture.mod_fuerza}
                        </span>
                      )}
                      {culture.mod_destreza > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          DES +{culture.mod_destreza}
                        </span>
                      )}
                      {culture.mod_constitucion > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          CON +{culture.mod_constitucion}
                        </span>
                      )}
                      {culture.mod_inteligencia > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          INT +{culture.mod_inteligencia}
                        </span>
                      )}
                      {culture.mod_sabiduria > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          SAB +{culture.mod_sabiduria}
                        </span>
                      )}
                      {culture.mod_carisma > 0 && (
                        <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                          CAR +{culture.mod_carisma}
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

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!selectedCulture || !characterName.trim() || saving}
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
