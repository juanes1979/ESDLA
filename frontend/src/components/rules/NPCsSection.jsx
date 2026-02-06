/**
 * NPCs Section - Enemies, NPCs, Animals, Specials
 * Displays all non-player characters with stats and abilities
 */
import { useState } from 'react';
import { Skull, Users, PawPrint, Sparkles, Shield, Heart, Zap, Eye, Swords, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const NPCsSection = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('malignos');
  const [expandedNPC, setExpandedNPC] = useState(null);

  if (!data) return <p className="text-muted-foreground">No hay datos de NPCs cargados</p>;

  const categories = [
    { id: 'malignos', name: 'Malignos', icon: Skull, color: 'destructive', count: data.malignos?.length || 0 },
    { id: 'pnj', name: 'PNJ', icon: Users, color: 'magic-blue', count: data.pnj?.length || 0 },
    { id: 'animales', name: 'Animales', icon: PawPrint, color: 'gold', count: data.animales?.length || 0 },
    { id: 'especiales', name: 'Especiales', icon: Sparkles, color: 'torch-orange', count: data.especiales?.length || 0 }
  ];

  const getModifier = (value) => {
    const mod = Math.floor((value - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const filterNPCs = (npcs) => {
    if (!searchTerm) return npcs || [];
    return (npcs || []).filter(npc => 
      npc.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      npc.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      npc.tipo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const currentNPCs = filterNPCs(data[activeCategory]);
  const currentCategory = categories.find(c => c.id === activeCategory);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Buscar NPC, enemigo, animal..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-black/20"
        />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                activeCategory === cat.id
                  ? `border-[hsl(var(--${cat.color}))] bg-[hsl(var(--${cat.color}))/20] text-[hsl(var(--${cat.color}))]`
                  : 'border-border/30 hover:border-border/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.name}</span>
              <Badge variant="outline" className="ml-1">{cat.count}</Badge>
            </button>
          );
        })}
      </div>

      {/* NPC List */}
      <div className="space-y-3">
        {currentNPCs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No se encontraron resultados</p>
        ) : (
          currentNPCs.map((npc, i) => (
            <div
              key={npc.id || i}
              className={`card-parchment rounded-lg border transition-all ${
                expandedNPC === npc.id
                  ? `border-[hsl(var(--${currentCategory?.color || 'gold'}))]`
                  : 'border-border/20'
              }`}
            >
              {/* Header - Always visible */}
              <button
                onClick={() => setExpandedNPC(expandedNPC === npc.id ? null : npc.id)}
                className="w-full p-3 text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-[hsl(var(--${currentCategory?.color || 'gold'}))/20] flex items-center justify-center`}>
                    {currentCategory?.icon && <currentCategory.icon className={`w-5 h-5 text-[hsl(var(--${currentCategory?.color || 'gold'}))]`} />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{npc.nombre}</p>
                    <p className="text-xs text-muted-foreground">{npc.tipo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Quick stats */}
                  <div className="hidden md:flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1" title="Clase de Armadura">
                      <Shield className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
                      {npc.clase_armadura}
                    </span>
                    <span className="flex items-center gap-1" title="Puntos de Golpe">
                      <Heart className="w-4 h-4 text-red-400" />
                      {npc.puntos_golpe}
                    </span>
                    <span className="flex items-center gap-1" title="Velocidad">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      {npc.velocidad}m
                    </span>
                    <span className="flex items-center gap-1" title="Experiencia">
                      <Sparkles className="w-4 h-4 text-[hsl(var(--gold))]" />
                      {npc.experiencia} PX
                    </span>
                  </div>
                  {expandedNPC === npc.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded content */}
              {expandedNPC === npc.id && (
                <div className="p-4 pt-0 border-t border-border/20 space-y-4">
                  {/* Description */}
                  {npc.descripcion && (
                    <p className="text-sm text-muted-foreground italic">{npc.descripcion}</p>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-[hsl(var(--magic-blue))/10] p-2 rounded text-center">
                      <Shield className="w-4 h-4 mx-auto text-[hsl(var(--magic-blue))]" />
                      <p className="text-xs text-muted-foreground mt-1">CA</p>
                      <p className="text-lg font-bold text-[hsl(var(--magic-blue))]">{npc.clase_armadura}</p>
                    </div>
                    <div className="bg-red-500/10 p-2 rounded text-center">
                      <Heart className="w-4 h-4 mx-auto text-red-400" />
                      <p className="text-xs text-muted-foreground mt-1">PG</p>
                      <p className="text-lg font-bold text-red-400">{npc.puntos_golpe}</p>
                    </div>
                    <div className="bg-yellow-500/10 p-2 rounded text-center">
                      <Zap className="w-4 h-4 mx-auto text-yellow-400" />
                      <p className="text-xs text-muted-foreground mt-1">Velocidad</p>
                      <p className="text-lg font-bold text-yellow-400">{npc.velocidad}m</p>
                      {npc.velocidad_nota && (
                        <p className="text-xs text-muted-foreground">{npc.velocidad_nota}</p>
                      )}
                    </div>
                    <div className="bg-[hsl(var(--gold))/10] p-2 rounded text-center">
                      <Sparkles className="w-4 h-4 mx-auto text-[hsl(var(--gold))]" />
                      <p className="text-xs text-muted-foreground mt-1">PX</p>
                      <p className="text-lg font-bold text-[hsl(var(--gold))]">{npc.experiencia}</p>
                    </div>
                  </div>

                  {/* Attributes */}
                  {npc.atributos && (
                    <div className="grid grid-cols-6 gap-2">
                      {[
                        { key: 'fuerza', abbr: 'FUE', color: 'red' },
                        { key: 'destreza', abbr: 'DES', color: 'green' },
                        { key: 'constitucion', abbr: 'CON', color: 'orange' },
                        { key: 'inteligencia', abbr: 'INT', color: 'blue' },
                        { key: 'sabiduria', abbr: 'SAB', color: 'purple' },
                        { key: 'carisma', abbr: 'CAR', color: 'pink' }
                      ].map(attr => (
                        <div key={attr.key} className={`bg-${attr.color}-500/10 p-2 rounded text-center`}>
                          <p className={`text-xs text-${attr.color}-400 font-bold`}>{attr.abbr}</p>
                          <p className="text-lg font-bold">{npc.atributos[attr.key]}</p>
                          <p className={`text-xs text-${attr.color}-400`}>
                            {getModifier(npc.atributos[attr.key])}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Senses */}
                  {npc.sentidos && (
                    <div className="flex items-start gap-2 p-2 bg-black/10 rounded">
                      <Eye className="w-4 h-4 text-[hsl(var(--magic-blue))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--magic-blue))] font-bold">Sentidos</p>
                        <p className="text-sm text-muted-foreground">{npc.sentidos}</p>
                      </div>
                    </div>
                  )}

                  {/* Special abilities */}
                  {npc.especial && (
                    <div className="flex items-start gap-2 p-2 bg-purple-500/10 rounded">
                      <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-400 font-bold">Especial</p>
                        <p className="text-sm text-muted-foreground">{npc.especial}</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {npc.acciones && (
                    <div className="flex items-start gap-2 p-2 bg-[hsl(var(--destructive))/10] rounded">
                      <Swords className="w-4 h-4 text-[hsl(var(--destructive))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--destructive))] font-bold">Acciones</p>
                        <p className="text-sm text-muted-foreground">{npc.acciones}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NPCsSection;
