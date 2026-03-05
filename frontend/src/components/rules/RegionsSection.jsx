/**
 * Regions Section Component
 * Manages regions and sub-regions for the map with terrain and danger class settings
 */
import { useState } from 'react';
import { MapPin, Plus, Edit, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

// Terrain types (difficulty)
const TIPOS_TERRENO = [
  { value: 'facil', label: 'Fácil', color: '#d3ba84' },
  { value: 'moderado', label: 'Moderado', color: '#948c4d' },
  { value: 'dificil', label: 'Difícil', color: '#c38d4f' },
  { value: 'muy_dificil', label: 'Muy Difícil', color: '#a57044' },
  { value: 'desalentador', label: 'Desalentador', color: '#af4b27' },
  { value: 'infranqueable', label: 'Infranqueable', color: '#664540' },
];

// Region classes (danger level)
const CLASES_REGION = [
  { value: 'tierras_libres', label: 'Tierras Libres', color: '#4ade80' },
  { value: 'tierras_fronterizas', label: 'Tierras Fronterizas', color: '#facc15' },
  { value: 'tierras_salvajes', label: 'Tierras Salvajes', color: '#fb923c' },
  { value: 'tierras_sombra', label: 'Tierras de la Sombra', color: '#f87171' },
  { value: 'tierras_oscuras', label: 'Tierras Oscuras', color: '#991b1b' },
];

const RegionsSection = ({ 
  data, 
  isAdmin = false, 
  onRefresh 
}) => {
  // Ensure regions is always an array
  const regions = Array.isArray(data) ? data : (data?.regions || []);
  
  // Local state
  const [editingRegion, setEditingRegion] = useState(null);
  const [newRegionName, setNewRegionName] = useState('');
  const [newSubregionName, setNewSubregionName] = useState('');
  const [selectedParentRegion, setSelectedParentRegion] = useState(null);
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [isAddingSubregion, setIsAddingSubregion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState({});

  // Toggle region expansion
  const toggleExpand = (regionId) => {
    setExpandedRegions(prev => ({
      ...prev,
      [regionId]: !prev[regionId]
    }));
  };

  // Update region terrain/class
  const updateRegionTerrain = async (regionId, field, value) => {
    try {
      await api.put(`/data/regions/${regionId}`, { [field]: value });
      onRefresh?.();
    } catch (err) {
      console.error('Error updating region:', err);
      toast.error('Error al actualizar la región');
    }
  };

  // Create new region
  const createRegion = async (name, parentId = null) => {
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      await api.post('/data/regions', { nombre: name.trim(), parent_id: parentId });
      toast.success(`Región "${name}" creada`);
      setNewRegionName('');
      setNewSubregionName('');
      setIsAddingRegion(false);
      setIsAddingSubregion(false);
      setSelectedParentRegion(null);
      onRefresh?.();
    } catch (err) {
      toast.error('Error al crear la región');
    } finally {
      setLoading(false);
    }
  };

  // Update region name
  const updateRegion = async (regionId, newName) => {
    if (!newName.trim()) return;
    
    setLoading(true);
    try {
      await api.put(`/data/regions/${regionId}`, { nombre: newName.trim() });
      toast.success('Región actualizada');
      setEditingRegion(null);
      onRefresh?.();
    } catch (err) {
      toast.error('Error al actualizar la región');
    } finally {
      setLoading(false);
    }
  };

  // Delete region
  const deleteRegion = async (regionId, regionName) => {
    if (!window.confirm(`¿Eliminar la región "${regionName}" y todas sus sub-regiones?`)) return;
    
    setLoading(true);
    try {
      await api.delete(`/data/regions/${regionId}`);
      toast.success(`Región "${regionName}" eliminada`);
      onRefresh?.();
    } catch (err) {
      toast.error('Error al eliminar la región');
    } finally {
      setLoading(false);
    }
  };

  // Seed initial regions
  const seedRegions = async () => {
    setLoading(true);
    try {
      await api.post('/data/regions/seed');
      toast.success('Regiones iniciales cargadas');
      onRefresh?.();
    } catch (err) {
      toast.error('Error al cargar las regiones iniciales');
    } finally {
      setLoading(false);
    }
  };

  // Get terrain badge style
  const getTerrenoBadge = (tipo) => {
    const t = TIPOS_TERRENO.find(t => t.value === tipo);
    if (!t) return null;
    return (
      <span 
        className="px-2 py-0.5 rounded text-xs font-medium" 
        style={{ backgroundColor: t.color, color: '#000' }}
      >
        {t.label}
      </span>
    );
  };
  
  // Get class badge style
  const getClaseBadge = (clase) => {
    const c = CLASES_REGION.find(c => c.value === clase);
    if (!c) return null;
    return (
      <span 
        className="px-2 py-0.5 rounded text-xs font-medium" 
        style={{ backgroundColor: c.color, color: c.value === 'tierras_oscuras' ? '#fff' : '#000' }}
      >
        {c.label}
      </span>
    );
  };

  return (
    <div className="space-y-6" data-testid="regions-section">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/30">
        <div>
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            <MapPin className="w-5 h-5 inline mr-2" />
            Gestión de Regiones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Define las regiones principales y sus sub-regiones para organizar el mapa
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            {regions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={seedRegions}
                disabled={loading}
                data-testid="seed-regions-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Cargar Regiones Iniciales
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsAddingRegion(true)}
              disabled={loading}
              className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
              data-testid="add-region-btn"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nueva Región Principal
            </Button>
          </div>
        )}
      </div>

      {/* Add new main region form */}
      {isAddingRegion && (
        <div className="card-parchment p-4 rounded-lg border-2 border-dashed border-[hsl(var(--gold))]/50">
          <h3 className="text-sm font-medium text-[hsl(var(--gold))] mb-3">Nueva Región Principal</h3>
          <div className="flex gap-2">
            <Input
              value={newRegionName}
              onChange={(e) => setNewRegionName(e.target.value)}
              placeholder="Nombre de la región..."
              className="flex-1"
              autoFocus
              data-testid="new-region-input"
            />
            <Button
              onClick={() => createRegion(newRegionName)}
              disabled={!newRegionName.trim() || loading}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Crear'}
            </Button>
            <Button
              onClick={() => { setIsAddingRegion(false); setNewRegionName(''); }}
              variant="ghost"
              size="sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Legend - Terrain and Danger Classes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Terrain Difficulty Legend */}
        <div className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-3">
            Dificultad del Terreno (Afecta tiempo de viaje)
          </h4>
          <div className="space-y-1.5 text-xs">
            {TIPOS_TERRENO.map(t => (
              <div key={t.value} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: t.color }}></span>
                <span className="font-medium w-24">{t.label}</span>
                <span className="text-muted-foreground">
                  {t.value === 'facil' && '×1.0 - Caminos, llanuras'}
                  {t.value === 'moderado' && '×1.25 - Colinas, bosques claros'}
                  {t.value === 'dificil' && '×1.5 - Bosques densos, páramos'}
                  {t.value === 'muy_dificil' && '×2.0 - Montañas, pantanos'}
                  {t.value === 'desalentador' && '×3.0 - Volcánico, maldito'}
                  {t.value === 'infranqueable' && '⛔ Solo por pasos de montaña'}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Danger Class Legend */}
        <div className="card-parchment rounded-lg p-4">
          <h4 className="font-heading text-sm text-[hsl(var(--gold))] mb-3">
            Clase de Peligro (Afecta encuentros)
          </h4>
          <div className="space-y-1.5 text-xs">
            {CLASES_REGION.map(c => (
              <div key={c.value} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: c.color }}></span>
                <span className="font-medium w-32">{c.label}</span>
                <span className="text-muted-foreground">
                  {c.value === 'tierras_libres' && '5% encuentros - Seguro'}
                  {c.value === 'tierras_fronterizas' && '15% encuentros - Ocasional'}
                  {c.value === 'tierras_salvajes' && '25% encuentros - Regular'}
                  {c.value === 'tierras_sombra' && '40% encuentros - Frecuente'}
                  {c.value === 'tierras_oscuras' && '60% encuentros - Constante'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regions list */}
      {regions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No hay regiones definidas.</p>
          {isAdmin && <p className="text-sm mt-2">Haz clic en "Cargar Regiones Iniciales" para empezar con las regiones de la Tierra Media.</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {regions.map((region) => (
            <div key={region.id} className="card-parchment rounded-lg overflow-hidden" data-testid={`region-${region.id}`}>
              {/* Main region header */}
              <div className="flex items-center justify-between p-4 bg-black/10">
                {editingRegion === region.id ? (
                  <div className="flex gap-2 flex-1 mr-4">
                    <Input
                      defaultValue={region.nombre}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateRegion(region.id, e.target.value);
                        if (e.key === 'Escape') setEditingRegion(null);
                      }}
                      className="flex-1"
                      autoFocus
                      data-testid={`edit-region-input-${region.id}`}
                    />
                    <Button
                      onClick={(e) => {
                        const input = e.target.closest('.flex').querySelector('input');
                        updateRegion(region.id, input?.value || region.nombre);
                      }}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                    </Button>
                    <Button
                      onClick={() => setEditingRegion(null)}
                      variant="ghost"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div 
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => toggleExpand(region.id)}
                    >
                      <MapPin className="w-5 h-5 text-[hsl(var(--gold))]" />
                      <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{region.nombre}</h3>
                      <span className="text-xs text-muted-foreground">
                        ({region.subregions?.length || 0} sub-regiones)
                      </span>
                      {expandedRegions[region.id] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                    
                    {/* Badges and actions */}
                    <div className="flex items-center gap-3">
                      {getTerrenoBadge(region.tipo_terreno)}
                      {getClaseBadge(region.clase_region)}
                      
                      {isAdmin && (
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingRegion(region.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRegion(region.id, region.nombre)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Expanded content: terrain selectors and subregions */}
              {expandedRegions[region.id] && (
                <div className="p-4 border-t border-border/20">
                  {/* Terrain/Class selectors for admin */}
                  {isAdmin && (
                    <div className="flex gap-4 mb-4 pb-4 border-b border-border/20">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Tipo de Terreno</label>
                        <select
                          value={region.tipo_terreno || ''}
                          onChange={(e) => updateRegionTerrain(region.id, 'tipo_terreno', e.target.value)}
                          className="w-full h-8 px-2 text-sm bg-background border border-border rounded"
                        >
                          <option value="">Sin definir</option>
                          {TIPOS_TERRENO.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Clase de Región</label>
                        <select
                          value={region.clase_region || ''}
                          onChange={(e) => updateRegionTerrain(region.id, 'clase_region', e.target.value)}
                          className="w-full h-8 px-2 text-sm bg-background border border-border rounded"
                        >
                          <option value="">Sin definir</option>
                          {CLASES_REGION.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Subregions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-muted-foreground">Sub-regiones</h4>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedParentRegion(region.id);
                            setIsAddingSubregion(true);
                          }}
                          className="h-7 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Añadir
                        </Button>
                      )}
                    </div>

                    {/* Add subregion form */}
                    {isAddingSubregion && selectedParentRegion === region.id && (
                      <div className="flex gap-2 p-2 bg-black/10 rounded">
                        <Input
                          value={newSubregionName}
                          onChange={(e) => setNewSubregionName(e.target.value)}
                          placeholder="Nombre de la sub-región..."
                          className="flex-1 h-8"
                          autoFocus
                        />
                        <Button
                          onClick={() => createRegion(newSubregionName, region.id)}
                          disabled={!newSubregionName.trim() || loading}
                          size="sm"
                          className="h-8 bg-green-600 hover:bg-green-700"
                        >
                          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Crear'}
                        </Button>
                        <Button
                          onClick={() => {
                            setIsAddingSubregion(false);
                            setNewSubregionName('');
                            setSelectedParentRegion(null);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-8"
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}

                    {/* Subregions list */}
                    {region.subregions?.length > 0 ? (
                      <div className="grid gap-2">
                        {region.subregions.map((sub) => (
                          <div 
                            key={sub.id} 
                            className="flex items-center justify-between p-2 bg-black/5 rounded hover:bg-black/10"
                            data-testid={`subregion-${sub.id}`}
                          >
                            <span className="text-sm">{sub.nombre}</span>
                            <div className="flex items-center gap-2">
                              {getTerrenoBadge(sub.tipo_terreno)}
                              {getClaseBadge(sub.clase_region)}
                              
                              {isAdmin && (
                                <div className="flex gap-1 ml-2">
                                  <select
                                    value={sub.tipo_terreno || ''}
                                    onChange={(e) => updateRegionTerrain(sub.id, 'tipo_terreno', e.target.value)}
                                    className="h-6 px-1 text-xs bg-background border border-border rounded"
                                    title="Tipo de terreno"
                                  >
                                    <option value="">Terreno</option>
                                    {TIPOS_TERRENO.map(t => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={sub.clase_region || ''}
                                    onChange={(e) => updateRegionTerrain(sub.id, 'clase_region', e.target.value)}
                                    className="h-6 px-1 text-xs bg-background border border-border rounded"
                                    title="Clase de región"
                                  >
                                    <option value="">Clase</option>
                                    {CLASES_REGION.map(c => (
                                      <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                  </select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteRegion(sub.id, sub.nombre)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No hay sub-regiones definidas</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegionsSection;
