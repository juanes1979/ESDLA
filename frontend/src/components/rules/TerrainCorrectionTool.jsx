/**
 * Terrain Data Correction Tool
 * Allows admins to view and correct terrain assignments for locations
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Search, MapPin, Filter, AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import RegionHierarchyTree from './RegionHierarchyTree';

// Valid terrain difficulty values
const TERRAIN_OPTIONS = [
  { value: 'facil', label: 'Fácil', color: '#c4b998', description: 'Caminos y terreno llano' },
  { value: 'moderado', label: 'Moderado', color: '#8b9a6b', description: 'Colinas suaves, bosques claros' },
  { value: 'dificil', label: 'Difícil', color: '#a08060', description: 'Bosques densos, terreno irregular' },
  { value: 'muy_dificil', label: 'Muy Difícil', color: '#8b6914', description: 'Montañas, pantanos' },
  { value: 'desalentador', label: 'Desalentador', color: '#c45c30', description: 'Terreno hostil, peligroso' },
  { value: 'infranqueable', label: 'Infranqueable', color: '#4a3728', description: 'Imposible de atravesar' },
];

// Valid land type values
const LAND_TYPE_OPTIONS = [
  { value: 'tierras_libres', label: 'Tierras Libres', color: '#22c55e', description: 'Territorios seguros y civilizados' },
  { value: 'fronterizas', label: 'Fronterizas', color: '#eab308', description: 'Entre lo seguro y lo salvaje' },
  { value: 'tierras_salvajes', label: 'Tierras Salvajes', color: '#f97316', description: 'Territorios sin ley' },
  { value: 'tierras_sombra', label: 'Tierras de la Sombra', color: '#ef4444', description: 'Influencia del mal' },
  { value: 'tierras_oscuras', label: 'Tierras Oscuras', color: '#7c3aed', description: 'Dominios del enemigo' },
];

const TerrainCorrectionTool = ({ isAdmin }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerrain, setFilterTerrain] = useState('all');
  const [filterLandType, setFilterLandType] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterProblems, setFilterProblems] = useState(false);
  const [pendingChanges, setPendingChanges] = useState({});
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data/locations');
      const data = response.data || {};
      const locs = data.locations || [];
      setLocations(locs);
      
      // Extract unique regions
      const uniqueRegions = [...new Set(locs.map(l => l.region).filter(Boolean))].sort();
      setRegions(uniqueRegions);
    } catch (err) {
      console.error('Error loading locations:', err);
      toast.error('Error al cargar ubicaciones');
    } finally {
      setLoading(false);
    }
  };

  // Detect problematic entries
  const hasProblems = (loc) => {
    // Check for missing data
    if (!loc.tipo_terreno || !loc.clase_region) return true;
    
    // Check for invalid terrain values
    if (!TERRAIN_OPTIONS.find(t => t.value === loc.tipo_terreno)) return true;
    
    // Check for invalid/inconsistent land type values
    const validLandTypes = LAND_TYPE_OPTIONS.map(l => l.value);
    if (!validLandTypes.includes(loc.clase_region)) {
      // Check for common variations that need normalization
      if (loc.clase_region === 'tierras_de_la_sombra' || 
          loc.clase_region === 'tierras_fronterizas' ||
          loc.clase_region === 'severo') {
        return true;
      }
    }
    
    return false;
  };

  // Filter and search locations
  const filteredLocations = useMemo(() => {
    return locations.filter(loc => {
      // Search filter
      if (searchTerm && !loc.nombre?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Terrain filter
      if (filterTerrain !== 'all' && loc.tipo_terreno !== filterTerrain) {
        return false;
      }
      
      // Land type filter
      if (filterLandType !== 'all' && loc.clase_region !== filterLandType) {
        return false;
      }
      
      // Region filter
      if (filterRegion !== 'all' && loc.region !== filterRegion) {
        return false;
      }
      
      // Problems filter
      if (filterProblems && !hasProblems(loc)) {
        return false;
      }
      
      return true;
    }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [locations, searchTerm, filterTerrain, filterLandType, filterRegion, filterProblems]);

  // Count problems
  const problemCount = useMemo(() => {
    return locations.filter(hasProblems).length;
  }, [locations]);

  // Handle terrain change
  const handleTerrainChange = (locationId, field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      [locationId]: {
        ...prev[locationId],
        [field]: value
      }
    }));
  };

  // Get current value (pending change or original)
  const getCurrentValue = (loc, field) => {
    // Use 'id' not '_id' for location identifier
    const locId = loc.id;
    if (pendingChanges[locId] && pendingChanges[locId][field] !== undefined) {
      return pendingChanges[locId][field];
    }
    return loc[field];
  };

  // Save all pending changes
  const saveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('No hay cambios pendientes');
      return;
    }

    try {
      setSaving(true);
      
      // Save each change
      for (const [locationId, changes] of Object.entries(pendingChanges)) {
        await api.put(`/data/locations/${locationId}`, changes);
      }
      
      toast.success(`${Object.keys(pendingChanges).length} ubicaciones actualizadas`);
      setPendingChanges({});
      await loadLocations();
    } catch (err) {
      console.error('Error saving changes:', err);
      toast.error('Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  // Discard changes
  const discardChanges = () => {
    setPendingChanges({});
    toast.info('Cambios descartados');
  };

  // Bulk: aplicar terreno + tipo de tierra a todas las ubicaciones de
  // una región. Útil cuando se quiere homogeneizar (ej. La Comarca →
  // tierras_libres + facil para todas sus ubicaciones).
  const [bulkRegion, setBulkRegion] = useState('');
  const [bulkTerrain, setBulkTerrain] = useState('');
  const [bulkLandType, setBulkLandType] = useState('');

  const applyBulkToRegion = () => {
    if (!bulkRegion) {
      toast.error('Selecciona una región');
      return;
    }
    if (!bulkTerrain && !bulkLandType) {
      toast.error('Indica al menos un valor (terreno o tipo de tierra)');
      return;
    }
    const targets = locations.filter(l => l.region === bulkRegion);
    if (targets.length === 0) {
      toast.warning(`Sin ubicaciones en "${bulkRegion}"`);
      return;
    }
    const updates = {};
    targets.forEach(loc => {
      const ch = { ...(pendingChanges[loc.id] || {}) };
      if (bulkTerrain) ch.tipo_terreno = bulkTerrain;
      if (bulkLandType) ch.clase_region = bulkLandType;
      updates[loc.id] = ch;
    });
    setPendingChanges(prev => ({ ...prev, ...updates }));
    toast.success(`${targets.length} ubicación(es) de "${bulkRegion}" preparadas. Pulsa "Guardar" para aplicar.`);
  };

  // Auto-fix common problems
  const autoFixProblems = async () => {
    const fixes = {};
    
    locations.forEach(loc => {
      const locFixes = {};
      const locId = loc.id;
      
      // Fix missing terrain
      if (!loc.tipo_terreno) {
        locFixes.tipo_terreno = 'moderado'; // Default
      }
      
      // Fix invalid terrain value
      if (loc.tipo_terreno === 'severo') {
        locFixes.tipo_terreno = 'desalentador';
      }
      
      // Fix missing land type
      if (!loc.clase_region) {
        locFixes.clase_region = 'tierras_salvajes'; // Default
      }
      
      // Normalize land type variations
      if (loc.clase_region === 'tierras_de_la_sombra') {
        locFixes.clase_region = 'tierras_sombra';
      }
      if (loc.clase_region === 'tierras_fronterizas') {
        locFixes.clase_region = 'fronterizas';
      }
      
      if (Object.keys(locFixes).length > 0) {
        fixes[locId] = locFixes;
      }
    });
    
    if (Object.keys(fixes).length === 0) {
      toast.info('No hay problemas automáticos que corregir');
      return;
    }
    
    setPendingChanges(prev => ({ ...prev, ...fixes }));
    toast.success(`${Object.keys(fixes).length} correcciones preparadas. Haz clic en "Guardar" para aplicarlas.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading text-[hsl(var(--gold))]">
            Corrección de Datos de Terreno
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {locations.length} ubicaciones • {problemCount > 0 && (
              <span className="text-orange-400">{problemCount} con problemas</span>
            )}
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-2">
            {problemCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={autoFixProblems}
                className="text-orange-400 border-orange-400/30 hover:bg-orange-400/10"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Auto-corregir ({problemCount})
              </Button>
            )}
            
            {Object.keys(pendingChanges).length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={discardChanges}
                  className="text-gray-400"
                >
                  <X className="h-4 w-4 mr-1" />
                  Descartar
                </Button>
                <Button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar ({Object.keys(pendingChanges).length})
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar ubicación..."
                className="pl-10 bg-black/50 border-gray-600"
              />
            </div>
          </div>
          
          {/* Region filter */}
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">Todas las regiones</option>
            {regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          
          {/* Terrain filter */}
          <select
            value={filterTerrain}
            onChange={(e) => setFilterTerrain(e.target.value)}
            className="bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">Todos los terrenos</option>
            {TERRAIN_OPTIONS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          
          {/* Land type filter */}
          <select
            value={filterLandType}
            onChange={(e) => setFilterLandType(e.target.value)}
            className="bg-black/50 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
          >
            <option value="all">Todos los tipos</option>
            {LAND_TYPE_OPTIONS.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          
          {/* Problems filter */}
          <Button
            variant={filterProblems ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterProblems(!filterProblems)}
            className={filterProblems ? "bg-orange-600" : ""}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Problemas
          </Button>
        </div>
      </div>

      {/* Region hierarchy tree (drag-and-drop) */}
      {isAdmin && (
        <div className="bg-black/30 border border-amber-500/30 rounded-lg p-4">
          <RegionHierarchyTree />
        </div>
      )}

      {/* Bulk apply by region */}
      {isAdmin && (
        <div className="bg-amber-900/20 border border-amber-500/40 rounded-lg p-4">
          <h3 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Aplicar masivamente a una región
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Selecciona una región y los valores que quieras imponer a TODAS sus ubicaciones (ej. La Comarca → Tierras Libres + Fácil).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 mb-1">Región</label>
              <select
                value={bulkRegion}
                onChange={(e) => setBulkRegion(e.target.value)}
                className="bg-black/60 border border-gray-600 rounded-md px-3 py-2 text-sm text-white min-w-[180px]"
                data-testid="bulk-region-select"
              >
                <option value="">— Selecciona —</option>
                {regions.map(r => {
                  const count = locations.filter(l => l.region === r).length;
                  return <option key={r} value={r}>{r} ({count})</option>;
                })}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 mb-1">Tipo de tierra</label>
              <select
                value={bulkLandType}
                onChange={(e) => setBulkLandType(e.target.value)}
                className="bg-black/60 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
                data-testid="bulk-landtype-select"
              >
                <option value="">— Sin cambio —</option>
                {LAND_TYPE_OPTIONS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 mb-1">Dificultad</label>
              <select
                value={bulkTerrain}
                onChange={(e) => setBulkTerrain(e.target.value)}
                className="bg-black/60 border border-gray-600 rounded-md px-3 py-2 text-sm text-white"
                data-testid="bulk-terrain-select"
              >
                <option value="">— Sin cambio —</option>
                {TERRAIN_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <Button
              onClick={applyBulkToRegion}
              disabled={!bulkRegion || (!bulkTerrain && !bulkLandType)}
              className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
              data-testid="bulk-apply-btn"
            >
              <Check className="h-4 w-4 mr-1" />
              Preparar cambios
            </Button>
          </div>
          {bulkRegion && (
            <p className="text-[11px] text-amber-200/80 mt-2">
              {locations.filter(l => l.region === bulkRegion).length} ubicación(es) en
              <span className="font-semibold"> {bulkRegion}</span>. Los cambios se añadirán al pendiente; pulsa &quot;Guardar&quot; arriba para confirmar.
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
          <h4 className="text-xs text-gray-400 mb-2">DIFICULTAD DEL TERRENO</h4>
          <div className="flex flex-wrap gap-2">
            {TERRAIN_OPTIONS.map(t => (
              <span
                key={t.value}
                className="px-2 py-1 rounded text-xs"
                style={{ backgroundColor: t.color + '40', color: t.color }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
          <h4 className="text-xs text-gray-400 mb-2">TIPO DE TIERRA</h4>
          <div className="flex flex-wrap gap-2">
            {LAND_TYPE_OPTIONS.map(l => (
              <span
                key={l.value}
                className="px-2 py-1 rounded text-xs"
                style={{ backgroundColor: l.color + '40', color: l.color }}
              >
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Location list */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/60 sticky top-0">
              <tr>
                <th className="text-left p-3 text-gray-400 font-normal">Ubicación</th>
                <th className="text-left p-3 text-gray-400 font-normal">Región</th>
                <th className="text-left p-3 text-gray-400 font-normal">Terreno</th>
                <th className="text-left p-3 text-gray-400 font-normal">Tipo de Tierra</th>
                <th className="text-center p-3 text-gray-400 font-normal w-16">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredLocations.map(loc => {
                const locId = loc.id;
                const hasProblem = hasProblems(loc);
                const hasChanges = pendingChanges[locId];
                const currentTerrain = getCurrentValue(loc, 'tipo_terreno');
                const currentLandType = getCurrentValue(loc, 'clase_region');
                
                return (
                  <tr 
                    key={locId} 
                    className={`
                      hover:bg-white/5 transition-colors
                      ${hasProblem ? 'bg-orange-900/10' : ''}
                      ${hasChanges ? 'bg-green-900/10' : ''}
                    `}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="text-white">{loc.nombre}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-400">{loc.region || '-'}</td>
                    <td className="p-3">
                      {isAdmin ? (
                        <select
                          value={currentTerrain || ''}
                          onChange={(e) => handleTerrainChange(locId, 'tipo_terreno', e.target.value)}
                          className="bg-black/50 border border-gray-600 rounded px-2 py-1 text-sm w-full"
                          style={{
                            borderColor: TERRAIN_OPTIONS.find(t => t.value === currentTerrain)?.color || '#666'
                          }}
                        >
                          <option value="">Sin definir</option>
                          {TERRAIN_OPTIONS.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span 
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: (TERRAIN_OPTIONS.find(t => t.value === currentTerrain)?.color || '#666') + '40',
                            color: TERRAIN_OPTIONS.find(t => t.value === currentTerrain)?.color || '#888'
                          }}
                        >
                          {TERRAIN_OPTIONS.find(t => t.value === currentTerrain)?.label || currentTerrain || 'Sin definir'}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {isAdmin ? (
                        <select
                          value={currentLandType || ''}
                          onChange={(e) => handleTerrainChange(locId, 'clase_region', e.target.value)}
                          className="bg-black/50 border border-gray-600 rounded px-2 py-1 text-sm w-full"
                          style={{
                            borderColor: LAND_TYPE_OPTIONS.find(l => l.value === currentLandType)?.color || '#666'
                          }}
                        >
                          <option value="">Sin definir</option>
                          {LAND_TYPE_OPTIONS.map(l => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span 
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: (LAND_TYPE_OPTIONS.find(l => l.value === currentLandType)?.color || '#666') + '40',
                            color: LAND_TYPE_OPTIONS.find(l => l.value === currentLandType)?.color || '#888'
                          }}
                        >
                          {LAND_TYPE_OPTIONS.find(l => l.value === currentLandType)?.label || currentLandType || 'Sin definir'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {hasChanges ? (
                        <span className="text-green-400" title="Cambios pendientes">
                          <Save className="h-4 w-4 inline" />
                        </span>
                      ) : hasProblem ? (
                        <span className="text-orange-400" title="Tiene problemas">
                          <AlertTriangle className="h-4 w-4 inline" />
                        </span>
                      ) : (
                        <span className="text-green-400" title="OK">
                          <Check className="h-4 w-4 inline" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredLocations.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No se encontraron ubicaciones con los filtros seleccionados
            </div>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="text-xs text-gray-400 text-center">
        Mostrando {filteredLocations.length} de {locations.length} ubicaciones
        {Object.keys(pendingChanges).length > 0 && (
          <span className="ml-2 text-green-400">
            • {Object.keys(pendingChanges).length} cambios pendientes
          </span>
        )}
      </div>
    </div>
  );
};

export default TerrainCorrectionTool;
