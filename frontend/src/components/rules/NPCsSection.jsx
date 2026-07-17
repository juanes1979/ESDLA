/**
 * NPCs Section - Enemies, NPCs, Animals, Specials
 * Displays all non-player characters with structured stats and abilities
 * V2: Support for new structured data model with separate weapons, actions, specials
 */
import { useState } from 'react';
import { Skull, Users, PawPrint, Sparkles, Shield, Heart, Zap, Eye, Swords, ChevronDown, ChevronUp, Plus, Edit2, Trash2, Copy, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import NPCEditor from './NPCEditor';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NPCsSection = ({ data, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('malignos');
  const [expandedNPC, setExpandedNPC] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingNPC, setEditingNPC] = useState(null);

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

  // 5e XP → CR table — used to derive "Desafío" when only `experiencia` is set.
  const XP_TO_CR = [
    [0, '0'], [10, '0'], [25, '1/8'], [50, '1/4'], [100, '1/2'],
    [200, '1'], [450, '2'], [700, '3'], [1100, '4'], [1800, '5'],
    [2300, '6'], [2900, '7'], [3900, '8'], [5000, '9'], [5900, '10'],
    [7200, '11'], [8400, '12'], [10000, '13'], [11500, '14'], [13000, '15'],
    [15000, '16'], [18000, '17'], [20000, '18'], [22000, '19'], [25000, '20'],
    [33000, '21'], [41000, '22'], [50000, '23'], [62000, '24'], [75000, '25'],
    [90000, '26'], [105000, '27'], [120000, '28'], [135000, '29'], [155000, '30'],
  ];
  const xpToCr = (xp) => {
    if (xp == null || xp === '') return null;
    const n = Number(xp);
    if (!Number.isFinite(n) || n < 0) return null;
    let chosen = '0';
    for (const [thresholdXp, cr] of XP_TO_CR) {
      if (n >= thresholdXp) chosen = cr;
      else break;
    }
    return chosen;
  };
  const formatDesafio = (npc) => {
    // Si tiene desafio explícito (ej. "3 (700 PX)"), usarlo
    if (npc.desafio && String(npc.desafio).trim()) return npc.desafio;
    // Derivar desde experiencia
    const cr = xpToCr(npc.experiencia);
    if (cr == null) return null;
    return `${cr} (${npc.experiencia || 0} PX)`;
  };
  const formatAlineamiento = (npc) => {
    const a = (npc.alineamiento || '').trim();
    if (a) return a;
    return null; // no mostramos badge si está vacío
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

  // Agrupación por raza/tipo para Malignos y PNJ; alfabético para Animales y Especiales.
  const RACE_GROUPS = [
    [/orco|uruk|trasgo|snaga|goblin/i, 'Orcos'],
    [/trol|troll/i, 'Trols'],
    [/huargo|warg|lobo/i, 'Huargos'],
    [/espectr|nazg|muerto viviente|no-?muerto|tumular|sombra|apareci|fantasma|esp[ií]ritu/i, 'Espectros y No-muertos'],
    [/hobbit|mediano peque/i, 'Hobbits'],
    [/elfo|\belf\b/i, 'Elfos'],
    [/enano|dwarf/i, 'Enanos'],
    [/h[oó]mbre|humano|d[uú]nedain|gondor|rohan|\bbree\b|n[uú]menor/i, 'Hombres'],
  ];
  const grupoRaza = (npc) => {
    const paren = (npc.tipo || '').match(/\(([^)]+)\)/);
    // Prioriza el paréntesis del tipo; si no resuelve, usa tipo + nombre.
    const basisParen = (paren ? paren[1] : '').toLowerCase();
    for (const [re, label] of RACE_GROUPS) if (re.test(basisParen)) return label;
    const basisFull = `${npc.tipo || ''} ${npc.nombre || ''}`.toLowerCase();
    for (const [re, label] of RACE_GROUPS) if (re.test(basisFull)) return label;
    const first = (npc.tipo || '').split(/[\s(]/)[0];
    return first ? (first.charAt(0).toUpperCase() + first.slice(1)) : 'Otros';
  };
  const byName = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es');
  const isGrouped = activeCategory === 'malignos' || activeCategory === 'pnj';
  let sections;
  if (isGrouped) {
    const map = {};
    currentNPCs.forEach((n) => { const g = grupoRaza(n); (map[g] = map[g] || []).push(n); });
    sections = Object.entries(map)
      .map(([g, arr]) => [g, arr.slice().sort(byName)])
      .sort((a, b) => a[0].localeCompare(b[0], 'es'));
  } else {
    sections = [[null, currentNPCs.slice().sort(byName)]];
  }

  const handleCreateNew = () => {
    setEditingNPC(null);
    setShowEditor(true);
  };

  const handleEdit = (npc) => {
    setEditingNPC(npc);
    setShowEditor(true);
  };

  const handleDelete = async (npc) => {
    if (!window.confirm(`¿Eliminar "${npc.nombre}"? Esta acción no se puede deshacer.`)) return;
    
    try {
      const response = await fetch(`${API_URL}/api/data/npcs/${npc.id}`, { method: 'DELETE' });
      if (response.ok && onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Error deleting NPC:', err);
    }
  };

  const handleCopy = async (npc) => {
    const newName = prompt('Nombre para la copia:', `${npc.nombre} (copia)`);
    if (!newName) return;
    
    try {
      const response = await fetch(`${API_URL}/api/data/npcs/${npc.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName })
      });
      if (response.ok && onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Error copying NPC:', err);
    }
  };

  const handleSave = (savedNPC) => {
    setShowEditor(false);
    setEditingNPC(null);
    if (onRefresh) onRefresh();
  };

  // Render structured specials
  const renderSpeciales = (especiales) => {
    if (!especiales || especiales.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs text-purple-400 font-bold flex items-center gap-1">
          <Sparkles className="w-4 h-4" /> Habilidades Especiales
        </p>
        {especiales.map((esp, i) => (
          <div key={i} className="p-2 bg-purple-500/10 rounded">
            <p className="font-semibold text-purple-300">{esp.nombre}</p>
            <p className="text-sm text-muted-foreground">{esp.descripcion}</p>
          </div>
        ))}
      </div>
    );
  };

  // Render structured weapons
  const renderArmas = (armas, ataqueMultiple) => {
    if ((!armas || armas.length === 0) && !ataqueMultiple) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs text-[hsl(var(--destructive))] font-bold flex items-center gap-1">
          <Swords className="w-4 h-4" /> Ataques
        </p>
        {ataqueMultiple && (
          <p className="text-sm text-muted-foreground italic bg-[hsl(var(--destructive))/5] p-2 rounded">
            <strong>Ataque Múltiple:</strong> {ataqueMultiple}
          </p>
        )}
        {armas?.map((arma, i) => (
          <div key={i} className="p-2 bg-[hsl(var(--destructive))/10] rounded">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[hsl(var(--destructive))]">{arma.nombre}</p>
              <Badge variant="outline" className="text-xs">{arma.tipo}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1 text-sm">
              <span><strong>+{arma.bonificador_impacto}</strong> al impacto</span>
              <span>{arma.alcance_metros}</span>
              <span><strong>{arma.dano}</strong> {arma.tipo_dano}</span>
            </div>
            {arma.efecto && (
              <p className="text-xs text-muted-foreground mt-1 italic">{arma.efecto}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render structured actions
  const renderAcciones = (acciones) => {
    if (!acciones || (Array.isArray(acciones) && acciones.length === 0)) return null;
    
    // Handle legacy string format
    if (typeof acciones === 'string') {
      return (
        <div className="flex items-start gap-2 p-2 bg-[hsl(var(--gold))/10] rounded">
          <Swords className="w-4 h-4 text-[hsl(var(--gold))] mt-0.5" />
          <div>
            <p className="text-xs text-[hsl(var(--gold))] font-bold">Acciones</p>
            <p className="text-sm text-muted-foreground">{acciones}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-xs text-[hsl(var(--gold))] font-bold flex items-center gap-1">
          <Zap className="w-4 h-4" /> Otras Acciones
        </p>
        {acciones.map((acc, i) => (
          <div key={i} className="p-2 bg-[hsl(var(--gold))/10] rounded">
            <p className="font-semibold text-[hsl(var(--gold))]">{acc.nombre}</p>
            <p className="text-sm text-muted-foreground">{acc.descripcion}</p>
          </div>
        ))}
      </div>
    );
  };

  // Render reactions
  const renderReacciones = (reacciones) => {
    if (!reacciones || reacciones.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs text-[hsl(var(--torch-orange))] font-bold flex items-center gap-1">
          <Zap className="w-4 h-4" /> Reacciones
        </p>
        {reacciones.map((rea, i) => (
          <div key={i} className="p-2 bg-[hsl(var(--torch-orange))/10] rounded">
            <p className="font-semibold text-[hsl(var(--torch-orange))]">{rea.nombre}</p>
            <p className="text-sm text-muted-foreground">{rea.descripcion}</p>
          </div>
        ))}
      </div>
    );
  };

  // Render defenses
  const renderDefensas = (npc) => {
    const hasDefenses = (npc.resistencias?.length > 0) || 
                        (npc.inmunidades_dano?.length > 0) || 
                        (npc.inmunidades_estados?.length > 0) ||
                        (npc.vulnerabilidades?.length > 0);
    if (!hasDefenses) return null;

    return (
      <div className="space-y-2">
        {npc.resistencias?.length > 0 && (
          <div>
            <p className="text-xs text-blue-400 font-bold">Resistencias</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {npc.resistencias.map((r, i) => (
                <Badge key={i} variant="outline" className="text-blue-400 border-blue-400/30">{r}</Badge>
              ))}
            </div>
          </div>
        )}
        {npc.inmunidades_dano?.length > 0 && (
          <div>
            <p className="text-xs text-green-400 font-bold">Inmunidades (Daño)</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {npc.inmunidades_dano.map((r, i) => (
                <Badge key={i} variant="outline" className="text-green-400 border-green-400/30">{r}</Badge>
              ))}
            </div>
          </div>
        )}
        {npc.inmunidades_estados?.length > 0 && (
          <div>
            <p className="text-xs text-purple-400 font-bold">Inmunidades (Estados)</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {npc.inmunidades_estados.map((r, i) => (
                <Badge key={i} variant="outline" className="text-purple-400 border-purple-400/30">{r}</Badge>
              ))}
            </div>
          </div>
        )}
        {npc.vulnerabilidades?.length > 0 && (
          <div>
            <p className="text-xs text-red-400 font-bold">Vulnerabilidades</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {npc.vulnerabilidades.map((r, i) => (
                <Badge key={i} variant="outline" className="text-red-400 border-red-400/30">{r}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 mr-4">
          <Input
            placeholder="Buscar NPC, enemigo, animal..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black/20"
            data-testid="npc-search-input"
          />
        </div>
        <Button 
          onClick={handleCreateNew}
          className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
          data-testid="create-npc-button"
        >
          <Plus className="w-4 h-4 mr-2" /> Crear NPC
        </Button>
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
              data-testid={`category-tab-${cat.id}`}
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
          sections.map(([grupo, items]) => (
            <div key={grupo || 'all'} className="space-y-3">
              {grupo && (
                <h3 className="text-sm font-heading text-[hsl(var(--gold))]/90 border-b border-[hsl(var(--gold))]/20 pb-1 pt-2" data-testid={`bestiary-group-${grupo}`}>
                  {grupo} <span className="text-xs text-muted-foreground">({items.length})</span>
                </h3>
              )}
              {items.map((npc, i) => (
            <div
              key={npc.id || i}
              className={`card-parchment rounded-lg border transition-all ${
                expandedNPC === npc.id
                  ? `border-[hsl(var(--${currentCategory?.color || 'gold'}))]`
                  : 'border-border/20'
              }`}
              data-testid={`npc-card-${npc.id}`}
            >
              {/* Header - Always visible */}
              <button
                onClick={() => setExpandedNPC(expandedNPC === npc.id ? null : npc.id)}
                className="w-full p-3 text-left flex items-center justify-between"
                data-testid={`npc-expand-${npc.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-[hsl(var(--${currentCategory?.color || 'gold'}))/20] flex items-center justify-center`}>
                    {currentCategory?.icon && <currentCategory.icon className={`w-5 h-5 text-[hsl(var(--${currentCategory?.color || 'gold'}))]`} />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{npc.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {npc.tipo}
                      {formatAlineamiento(npc) && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-300/80">
                          · {formatAlineamiento(npc)}
                        </span>
                      )}
                    </p>
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
                  {/* Action buttons */}
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(npc)} data-testid={`edit-npc-${npc.id}`}>
                      <Edit2 className="w-4 h-4 mr-1" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleCopy(npc)}>
                      <Copy className="w-4 h-4 mr-1" /> Copiar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(npc)}>
                      <Trash2 className="w-4 h-4 mr-1" /> Eliminar
                    </Button>
                  </div>

                  {/* Identity badges */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {npc.tipo && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                        {npc.tipo}
                      </Badge>
                    )}
                    {npc.tamanio && (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-300">
                        {npc.tamanio}
                      </Badge>
                    )}
                    {formatAlineamiento(npc) && (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-300">
                        {formatAlineamiento(npc)}
                      </Badge>
                    )}
                    {formatDesafio(npc) && (
                      <Badge variant="outline" className="border-rose-500/30 text-rose-300">
                        Desafío {formatDesafio(npc)}
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  {npc.descripcion && (
                    <p className="text-sm text-muted-foreground italic">{npc.descripcion}</p>
                  )}

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-[hsl(var(--magic-blue))/10] p-2 rounded text-center">
                      <Shield className="w-4 h-4 mx-auto text-[hsl(var(--magic-blue))]" />
                      <p className="text-xs text-muted-foreground mt-1">CA</p>
                      <p className="text-lg font-bold text-[hsl(var(--magic-blue))]">{npc.clase_armadura}</p>
                      {npc.descripcion_armadura && (
                        <p className="text-xs text-muted-foreground">{npc.descripcion_armadura}</p>
                      )}
                    </div>
                    <div className="bg-red-500/10 p-2 rounded text-center">
                      <Heart className="w-4 h-4 mx-auto text-red-400" />
                      <p className="text-xs text-muted-foreground mt-1">PG</p>
                      <p className="text-lg font-bold text-red-400">{npc.puntos_golpe}</p>
                      {npc.dados_golpe && (
                        <p className="text-xs text-muted-foreground">{npc.dados_golpe}</p>
                      )}
                    </div>
                    <div className="bg-yellow-500/10 p-2 rounded text-center">
                      <Zap className="w-4 h-4 mx-auto text-yellow-400" />
                      <p className="text-xs text-muted-foreground mt-1">Velocidad</p>
                      <p className="text-lg font-bold text-yellow-400">{npc.velocidad}m</p>
                      {npc.velocidades_especiales && Object.keys(npc.velocidades_especiales).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {Object.entries(npc.velocidades_especiales).map(([k, v]) => `${k}: ${v}m`).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="bg-[hsl(var(--gold))/10] p-2 rounded text-center">
                      <Sparkles className="w-4 h-4 mx-auto text-[hsl(var(--gold))]" />
                      <p className="text-xs text-muted-foreground mt-1">PX</p>
                      <p className="text-lg font-bold text-[hsl(var(--gold))]">{npc.experiencia}</p>
                      {formatDesafio(npc) && (
                        <p className="text-xs text-muted-foreground">Desafío: {formatDesafio(npc)}</p>
                      )}
                    </div>
                    <div className="bg-cyan-500/10 p-2 rounded text-center">
                      <Eye className="w-4 h-4 mx-auto text-cyan-400" />
                      <p className="text-xs text-muted-foreground mt-1">Percepción</p>
                      <p className="text-lg font-bold text-cyan-400">{npc.percepcion_pasiva || 10}</p>
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
                  {npc.sentidos && (Array.isArray(npc.sentidos) ? npc.sentidos.length > 0 : npc.sentidos) && (
                    <div className="flex items-start gap-2 p-2 bg-black/10 rounded">
                      <Eye className="w-4 h-4 text-[hsl(var(--magic-blue))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--magic-blue))] font-bold">Sentidos</p>
                        <p className="text-sm text-muted-foreground">
                          {Array.isArray(npc.sentidos) ? npc.sentidos.join(', ') : npc.sentidos}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {npc.idiomas?.length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-black/10 rounded">
                      <BookOpen className="w-4 h-4 text-[hsl(var(--gold))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--gold))] font-bold">Idiomas</p>
                        <p className="text-sm text-muted-foreground">{npc.idiomas.join(', ')}</p>
                      </div>
                    </div>
                  )}

                  {/* Habilidades (Percepción +3, Sigilo +4, …) */}
                  {npc.habilidades && Object.keys(npc.habilidades).length > 0 && (
                    <div className="flex items-start gap-2 p-2 bg-cyan-500/10 rounded" data-testid={`npc-detail-habilidades-${npc.id}`}>
                      <Eye className="w-4 h-4 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-cyan-400 font-bold">Habilidades</p>
                        <p className="text-sm text-muted-foreground">
                          {Object.entries(npc.habilidades).map(([k, v]) => {
                            const n = parseInt(v, 10);
                            const mod = Number.isNaN(n) ? v : (n >= 0 ? `+${n}` : `${n}`);
                            return `${k} ${mod}`;
                          }).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Defenses */}
                  {renderDefensas(npc)}

                  {/* Special abilities (new structured format) */}
                  {renderSpeciales(npc.especiales)}

                  {/* Legacy especial field */}
                  {npc.especial && !npc.especiales?.length && (
                    <div className="flex items-start gap-2 p-2 bg-purple-500/10 rounded">
                      <Sparkles className="w-4 h-4 text-purple-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-purple-400 font-bold">Especial</p>
                        <p className="text-sm text-muted-foreground">{npc.especial}</p>
                      </div>
                    </div>
                  )}

                  {/* Weapons (new structured format) */}
                  {renderArmas(npc.armas, npc.ataque_multiple)}

                  {/* Other Actions */}
                  {renderAcciones(npc.acciones)}

                  {/* Reactions */}
                  {renderReacciones(npc.reacciones)}

                  {/* Historia (if present) */}
                  {npc.historia && (
                    <div className="flex items-start gap-2 p-3 bg-[hsl(var(--gold))/10] rounded border border-[hsl(var(--gold))/30]">
                      <BookOpen className="w-4 h-4 text-[hsl(var(--gold))] mt-0.5" />
                      <div>
                        <p className="text-xs text-[hsl(var(--gold))] font-bold">Historia / Trasfondo</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{npc.historia}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* NPC Editor Modal */}
      {showEditor && (
        <NPCEditor 
          npc={editingNPC}
          onSave={handleSave}
          onClose={() => {
            setShowEditor(false);
            setEditingNPC(null);
          }}
        />
      )}
    </div>
  );
};

export default NPCsSection;
