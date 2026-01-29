/**
 * Character Sheet Page - Interactive character view
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Loader2, ArrowLeft, Heart, Shield, Footprints, Eye, 
  Swords, Star, Book, Crown, Package, Scroll, Edit2,
  Plus, Minus, Save
} from 'lucide-react';
import { getCharacter, deleteCharacter } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import api from '@/services/api';

const getModifier = (score) => Math.floor((score - 10) / 2);
const formatModifier = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

const ATTRIBUTES = [
  { key: 'fuerza', name: 'Fuerza', abbr: 'FUE' },
  { key: 'destreza', name: 'Destreza', abbr: 'DES' },
  { key: 'constitucion', name: 'Constitución', abbr: 'CON' },
  { key: 'inteligencia', name: 'Inteligencia', abbr: 'INT' },
  { key: 'sabiduria', name: 'Sabiduría', abbr: 'SAB' },
  { key: 'carisma', name: 'Carisma', abbr: 'CAR' },
];

const CharacterSheetPage = () => {
  const { characterId } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingHp, setEditingHp] = useState(false);
  const [hpChange, setHpChange] = useState(0);
  const [savingHp, setSavingHp] = useState(false);

  // Load character
  useEffect(() => {
    const loadCharacter = async () => {
      try {
        setLoading(true);
        const data = await getCharacter(characterId);
        setCharacter(data);
      } catch (err) {
        console.error('Error loading character:', err);
        setError('No se pudo cargar el personaje');
      } finally {
        setLoading(false);
      }
    };
    loadCharacter();
  }, [characterId]);

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

  if (loading) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

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

  const attributes = character.atributos || {};
  const hpPercent = (character.puntos_golpe_actual / character.puntos_golpe_max) * 100;
  const ac = character.clase_armadura || (10 + getModifier(attributes.destreza || 10));

  return (
    <div className="min-h-screen tavern-bg" data-testid="character-sheet">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="font-heading text-2xl text-[hsl(var(--gold))] text-glow-gold">
            Hoja de Personaje
          </h1>
          <Button
            variant="ghost"
            onClick={handleDelete}
            className="text-muted-foreground hover:text-[hsl(var(--destructive))]"
            data-testid="delete-btn"
          >
            Eliminar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Character Header */}
        <div className="card-parchment rounded-lg p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center border-2 border-[hsl(var(--gold))]">
              <span className="font-heading text-4xl text-[hsl(var(--gold))]">
                {character.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="font-heading text-3xl text-foreground mb-1">
                {character.nombre}
              </h1>
              <p className="text-lg text-muted-foreground">
                {character.cultura_nombre} {character.vocacion_nombre}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                <span>Nivel {character.nivel || 1}</span>
                <span>·</span>
                <span>{character.edad} años</span>
                <span>·</span>
                <span>{character.altura_cm} cm</span>
                <span>·</span>
                <span>{character.peso_kg} kg</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Experiencia</p>
              <p className="font-heading text-2xl text-[hsl(var(--gold))]">
                {character.experiencia || 0} XP
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Combat Stats */}
          <div className="space-y-6">
            {/* HP */}
            <div className="card-parchment rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Puntos de Golpe
                </h3>
              </div>
              <div className="text-center mb-3">
                <span className="font-heading text-4xl text-foreground">
                  {character.puntos_golpe_actual}
                </span>
                <span className="text-muted-foreground text-xl"> / {character.puntos_golpe_max}</span>
              </div>
              {/* HP Bar */}
              <div className="h-4 bg-secondary rounded-full overflow-hidden mb-3">
                <div 
                  className={cn(
                    'h-full transition-all duration-300',
                    hpPercent > 50 ? 'bg-green-600' : hpPercent > 25 ? 'bg-yellow-600' : 'bg-red-600'
                  )}
                  style={{ width: `${Math.max(0, hpPercent)}%` }}
                />
              </div>
              {/* HP Controls */}
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHpChange(-1)}
                  disabled={savingHp || character.puntos_golpe_actual <= 0}
                  className="border-red-500/50 hover:bg-red-500/10"
                  data-testid="hp-minus"
                >
                  <Minus className="w-4 h-4 text-red-500" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHpChange(-5)}
                  disabled={savingHp || character.puntos_golpe_actual <= 0}
                  className="border-red-500/50 hover:bg-red-500/10"
                >
                  -5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHpChange(5)}
                  disabled={savingHp || character.puntos_golpe_actual >= character.puntos_golpe_max}
                  className="border-green-500/50 hover:bg-green-500/10"
                >
                  +5
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleHpChange(1)}
                  disabled={savingHp || character.puntos_golpe_actual >= character.puntos_golpe_max}
                  className="border-green-500/50 hover:bg-green-500/10"
                  data-testid="hp-plus"
                >
                  <Plus className="w-4 h-4 text-green-500" />
                </Button>
              </div>
            </div>

            {/* Combat Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card-parchment rounded-lg p-4 text-center">
                <Shield className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--magic-blue))]" />
                <p className="text-xs text-muted-foreground">Clase Armadura</p>
                <p className="font-heading text-2xl text-foreground">{ac}</p>
              </div>
              <div className="card-parchment rounded-lg p-4 text-center">
                <Footprints className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--gold))]" />
                <p className="text-xs text-muted-foreground">Velocidad</p>
                <p className="font-heading text-2xl text-foreground">{character.velocidad}m</p>
              </div>
              <div className="card-parchment rounded-lg p-4 text-center">
                <Swords className="w-6 h-6 mx-auto mb-2 text-[hsl(var(--torch-orange))]" />
                <p className="text-xs text-muted-foreground">Dado Golpe</p>
                <p className="font-heading text-xl text-foreground">{character.dado_golpe}</p>
              </div>
            </div>

            {/* Shadow Points */}
            <div className="card-parchment rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading text-lg text-purple-400 flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Puntos de Sombra
                </h3>
              </div>
              <div className="text-center mb-3">
                <span className="font-heading text-3xl text-purple-400">
                  {character.puntos_sombra || 0}
                </span>
                {character.puntos_sombra_permanentes > 0 && (
                  <span className="text-sm text-muted-foreground ml-2">
                    ({character.puntos_sombra_permanentes} perm.)
                  </span>
                )}
              </div>
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShadowChange(-1)}
                  disabled={character.puntos_sombra <= 0}
                  className="border-purple-500/50 hover:bg-purple-500/10"
                  data-testid="shadow-minus"
                >
                  <Minus className="w-4 h-4 text-purple-400" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleShadowChange(1)}
                  className="border-purple-500/50 hover:bg-purple-500/10"
                  data-testid="shadow-plus"
                >
                  <Plus className="w-4 h-4 text-purple-400" />
                </Button>
              </div>
            </div>
          </div>

          {/* Middle Column - Attributes */}
          <div className="space-y-6">
            {/* Attributes */}
            <div className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
                <Star className="w-5 h-5" />
                Atributos
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {ATTRIBUTES.map(attr => {
                  const value = attributes[attr.key] || 10;
                  const mod = getModifier(value);
                  return (
                    <div key={attr.key} className="stat-box p-3 text-center">
                      <p className="text-xs text-muted-foreground">{attr.name}</p>
                      <p className="font-heading text-2xl text-[hsl(var(--gold))]">{value}</p>
                      <p className="text-sm text-muted-foreground">({formatModifier(mod)})</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Skills */}
            <div className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
                <Book className="w-5 h-5" />
                Habilidades
              </h3>
              <div className="flex flex-wrap gap-2">
                {(character.habilidades || []).map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-sm"
                  >
                    {skill}
                  </span>
                ))}
                {(character.competencias?.habilidades_trasfondo || []).map((skill, i) => (
                  <span
                    key={`bg-${i}`}
                    className="px-3 py-1 rounded-full bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Competencies */}
            <div className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3">
                Competencias
              </h3>
              <div className="space-y-2 text-sm">
                {character.competencias?.tiradas_salvacion?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Tiradas de salvación: </span>
                    <span className="text-foreground">
                      {character.competencias.tiradas_salvacion.join(', ')}
                    </span>
                  </div>
                )}
                {character.competencias?.armaduras?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Armaduras: </span>
                    <span className="text-foreground">
                      {character.competencias.armaduras.join(', ')}
                    </span>
                  </div>
                )}
                {character.competencias?.armas?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Armas: </span>
                    <span className="text-foreground">
                      {character.competencias.armas.join(', ')}
                    </span>
                  </div>
                )}
                {character.competencias?.idiomas?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Idiomas: </span>
                    <span className="text-foreground">
                      {character.competencias.idiomas.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Background & Equipment */}
          <div className="space-y-6">
            {/* Background Info */}
            <div className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
                <Scroll className="w-5 h-5" />
                Trasfondo
              </h3>
              <div className="space-y-2">
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Trasfondo</p>
                  <p className="text-foreground">{character.trasfondo_nombre}</p>
                </div>
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Virtud</p>
                  <p className="text-foreground">{character.virtud_nombre}</p>
                </div>
                {character.patron_nombre && (
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Crown className="w-3 h-3" /> Mecenas
                    </p>
                    <p className="text-foreground">{character.patron_nombre}</p>
                    <p className="text-xs text-[hsl(var(--magic-blue))]">
                      Puntos de Comunidad: {character.puntos_comunidad || 0}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Personality */}
            {(character.rasgo_distintivo || character.defecto || character.motivacion) && (
              <div className="card-parchment rounded-lg p-4">
                <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
                  Personalidad
                </h3>
                <div className="space-y-2 text-sm">
                  {character.rasgo_distintivo && (
                    <div>
                      <span className="text-[hsl(var(--gold))]">Rasgo: </span>
                      <span className="text-muted-foreground">{character.rasgo_distintivo}</span>
                    </div>
                  )}
                  {character.defecto && (
                    <div>
                      <span className="text-[hsl(var(--gold))]">Defecto: </span>
                      <span className="text-muted-foreground">{character.defecto}</span>
                    </div>
                  )}
                  {character.motivacion && (
                    <div>
                      <span className="text-[hsl(var(--gold))]">Motivación: </span>
                      <span className="text-muted-foreground">{character.motivacion}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Equipment */}
            <div className="card-parchment rounded-lg p-4">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Equipo
              </h3>
              {character.inventario?.length > 0 ? (
                <div className="space-y-1">
                  {character.inventario.map((item, i) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      • {item.nombre} {item.cantidad > 1 && `(x${item.cantidad})`}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin equipo registrado</p>
              )}
              
              {/* Money */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Dinero</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-[hsl(var(--gold))]">{character.dinero?.mo || 0} mo</span>
                  <span className="text-gray-400">{character.dinero?.mp || 0} mp</span>
                  <span className="text-amber-700">{character.dinero?.mc || 0} mc</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CharacterSheetPage;
