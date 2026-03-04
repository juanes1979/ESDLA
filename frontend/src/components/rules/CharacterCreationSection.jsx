/**
 * Character Creation Logic Section
 * Manages wealth levels, occupation bonuses, and culture bonuses for character creation
 */
import { useState, useEffect } from 'react';
import { Loader2, Save, RefreshCw, Plus, Trash2, Edit, ChevronDown, ChevronUp, Coins, Package, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

// Currency icons/colors
const CURRENCY_CONFIG = {
  oro: { label: 'Oro', color: 'text-yellow-500', symbol: 'mo' },
  plata: { label: 'Plata', color: 'text-gray-300', symbol: 'mp' },
  cobre: { label: 'Cobre', color: 'text-orange-400', symbol: 'mc' },
  estano: { label: 'Estaño', color: 'text-gray-500', symbol: 'me' }
};

// Wealth level colors
const WEALTH_COLORS = {
  'Pobre': 'bg-red-900/30 border-red-700',
  'Frugal': 'bg-orange-900/30 border-orange-700',
  'Común': 'bg-yellow-900/30 border-yellow-700',
  'Próspero': 'bg-green-900/30 border-green-700',
  'Rico': 'bg-blue-900/30 border-blue-700'
};

const CharacterCreationSection = ({ isAdmin }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState(null);
  const [expandedOccupation, setExpandedOccupation] = useState(null);
  const [editingLevel, setEditingLevel] = useState(null);
  const [editingOccupation, setEditingOccupation] = useState(null);
  const [newEquipItem, setNewEquipItem] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get('/data/character-creation-config');
      setConfig(response.data);
    } catch (err) {
      console.error('Error loading config:', err);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.put('/data/character-creation-config', config);
      toast.success('Configuración guardada');
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('¿Restablecer toda la configuración a los valores por defecto?')) return;
    try {
      setSaving(true);
      await api.post('/data/character-creation-config/reset');
      await loadConfig();
      toast.success('Configuración restablecida');
    } catch (err) {
      toast.error('Error al restablecer');
    } finally {
      setSaving(false);
    }
  };

  const updateWealthLevel = (levelName, field, value) => {
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          [field]: value
        }
      }
    }));
  };

  const updateWealthMoney = (levelName, currency, value) => {
    const numValue = parseInt(value) || 0;
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          dinero_inicial: {
            ...prev.wealth_levels[levelName].dinero_inicial,
            [currency]: numValue
          }
        }
      }
    }));
  };

  const addEquipToLevel = (levelName) => {
    if (!newEquipItem.trim()) return;
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          equipo_adicional: [...(prev.wealth_levels[levelName].equipo_adicional || []), newEquipItem.trim()]
        }
      }
    }));
    setNewEquipItem('');
  };

  const removeEquipFromLevel = (levelName, index) => {
    setConfig(prev => ({
      ...prev,
      wealth_levels: {
        ...prev.wealth_levels,
        [levelName]: {
          ...prev.wealth_levels[levelName],
          equipo_adicional: prev.wealth_levels[levelName].equipo_adicional.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const updateOccupationBonus = (occName, field, value) => {
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          [field]: value
        }
      }
    }));
  };

  const updateOccupationMoney = (occName, currency, value) => {
    const numValue = parseInt(value) || 0;
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          dinero_extra: {
            ...(prev.occupation_bonuses[occName]?.dinero_extra || {}),
            [currency]: numValue
          }
        }
      }
    }));
  };

  const addEquipToOccupation = (occName) => {
    if (!newEquipItem.trim()) return;
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          equipo_adicional: [...(prev.occupation_bonuses[occName]?.equipo_adicional || []), newEquipItem.trim()]
        }
      }
    }));
    setNewEquipItem('');
  };

  const removeEquipFromOccupation = (occName, index) => {
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [occName]: {
          ...prev.occupation_bonuses[occName],
          equipo_adicional: prev.occupation_bonuses[occName].equipo_adicional.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const addNewOccupationBonus = () => {
    const name = prompt('Nombre de la ocupación:');
    if (!name) return;
    setConfig(prev => ({
      ...prev,
      occupation_bonuses: {
        ...prev.occupation_bonuses,
        [name]: {
          dinero_extra: { oro: 0, plata: 0, cobre: 0, estano: 0 },
          equipo_adicional: [],
          descripcion: ''
        }
      }
    }));
  };

  const deleteOccupationBonus = (occName) => {
    if (!confirm(`¿Eliminar bonificaciones de "${occName}"?`)) return;
    setConfig(prev => {
      const newBonuses = { ...prev.occupation_bonuses };
      delete newBonuses[occName];
      return { ...prev, occupation_bonuses: newBonuses };
    });
  };

  // Format money display
  const formatMoney = (money) => {
    if (!money) return '-';
    const parts = [];
    if (money.oro > 0) parts.push(`${money.oro} mo`);
    if (money.plata > 0) parts.push(`${money.plata} mp`);
    if (money.cobre > 0) parts.push(`${money.cobre} mc`);
    if (money.estano > 0) parts.push(`${money.estano} me`);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  if (!config) {
    return <div className="text-center py-8 text-gray-400">Error al cargar configuración</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-heading text-[hsl(var(--gold))]">Lógica de Creación de Personajes</h2>
          <p className="text-sm text-gray-400 mt-1">Define el dinero y equipo inicial según nivel de vida y ocupación</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetConfig}
              disabled={saving}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Restablecer
            </Button>
            <Button
              onClick={saveConfig}
              disabled={saving}
              className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar
            </Button>
          </div>
        )}
      </div>

      {/* Wealth Levels Section */}
      <div className="bg-black/40 border border-[hsl(var(--gold))/30] rounded-lg p-4">
        <h3 className="text-lg font-heading text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Dinero Inicial por Nivel de Vida
        </h3>
        
        <div className="space-y-3">
          {Object.entries(config.wealth_levels || {}).map(([levelName, levelData]) => (
            <div
              key={levelName}
              className={`border rounded-lg ${WEALTH_COLORS[levelName] || 'bg-gray-900/30 border-gray-700'}`}
            >
              {/* Level Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedLevel(expandedLevel === levelName ? null : levelName)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-white">{levelName}</span>
                  <span className="text-sm text-gray-400">{formatMoney(levelData.dinero_inicial)}</span>
                </div>
                {expandedLevel === levelName ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </div>

              {/* Expanded Content */}
              {expandedLevel === levelName && (
                <div className="p-4 pt-0 border-t border-white/10 space-y-4">
                  {/* Description */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descripción</label>
                    {isAdmin ? (
                      <Input
                        value={levelData.descripcion || ''}
                        onChange={(e) => updateWealthLevel(levelName, 'descripcion', e.target.value)}
                        className="bg-black/50 border-gray-600 text-white text-sm"
                        placeholder="Descripción del nivel de vida..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{levelData.descripcion || '-'}</p>
                    )}
                  </div>

                  {/* Money */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Dinero Inicial</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(CURRENCY_CONFIG).map(([currency, currConfig]) => (
                        <div key={currency} className="flex flex-col">
                          <span className={`text-xs ${currConfig.color} mb-1`}>{currConfig.label}</span>
                          {isAdmin ? (
                            <Input
                              type="number"
                              min="0"
                              value={levelData.dinero_inicial?.[currency] || 0}
                              onChange={(e) => updateWealthMoney(levelName, currency, e.target.value)}
                              className="bg-black/50 border-gray-600 text-white text-sm h-8"
                            />
                          ) : (
                            <span className="text-white">{levelData.dinero_inicial?.[currency] || 0}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Equipment */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Equipo Adicional</label>
                    {(levelData.equipo_adicional || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {levelData.equipo_adicional.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-black/50 border border-gray-600 rounded text-sm text-white flex items-center gap-1"
                          >
                            {item}
                            {isAdmin && (
                              <button
                                onClick={() => removeEquipFromLevel(levelName, idx)}
                                className="text-red-400 hover:text-red-300 ml-1"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-2">Sin equipo adicional</p>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Input
                          value={newEquipItem}
                          onChange={(e) => setNewEquipItem(e.target.value)}
                          placeholder="Añadir equipo..."
                          className="bg-black/50 border-gray-600 text-white text-sm flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && addEquipToLevel(levelName)}
                        />
                        <Button
                          size="sm"
                          onClick={() => addEquipToLevel(levelName)}
                          className="bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/30"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Occupation Bonuses Section */}
      <div className="bg-black/40 border border-[hsl(var(--magic-blue))/30] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading text-[hsl(var(--magic-blue))] flex items-center gap-2">
            <User className="h-5 w-5" />
            Bonificaciones por Ocupación
          </h3>
          {isAdmin && (
            <Button
              size="sm"
              onClick={addNewOccupationBonus}
              className="bg-[hsl(var(--magic-blue))]/20 text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/30"
            >
              <Plus className="h-4 w-4 mr-1" />
              Nueva
            </Button>
          )}
        </div>

        <div className="space-y-3">
          {Object.entries(config.occupation_bonuses || {}).map(([occName, occData]) => (
            <div
              key={occName}
              className="border border-[hsl(var(--magic-blue))/30] bg-[hsl(var(--magic-blue))]/5 rounded-lg"
            >
              {/* Occupation Header */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedOccupation(expandedOccupation === occName ? null : occName)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-white">{occName}</span>
                  <span className="text-sm text-gray-400">
                    {formatMoney(occData.dinero_extra)}
                    {(occData.equipo_adicional?.length || 0) > 0 && ` + ${occData.equipo_adicional.length} items`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOccupationBonus(occName); }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {expandedOccupation === occName ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedOccupation === occName && (
                <div className="p-4 pt-0 border-t border-white/10 space-y-4">
                  {/* Description */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descripción</label>
                    {isAdmin ? (
                      <Input
                        value={occData.descripcion || ''}
                        onChange={(e) => updateOccupationBonus(occName, 'descripcion', e.target.value)}
                        className="bg-black/50 border-gray-600 text-white text-sm"
                        placeholder="Descripción de las bonificaciones..."
                      />
                    ) : (
                      <p className="text-sm text-gray-300">{occData.descripcion || '-'}</p>
                    )}
                  </div>

                  {/* Extra Money */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Dinero Extra</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(CURRENCY_CONFIG).map(([currency, currConfig]) => (
                        <div key={currency} className="flex flex-col">
                          <span className={`text-xs ${currConfig.color} mb-1`}>{currConfig.label}</span>
                          {isAdmin ? (
                            <Input
                              type="number"
                              min="0"
                              value={occData.dinero_extra?.[currency] || 0}
                              onChange={(e) => updateOccupationMoney(occName, currency, e.target.value)}
                              className="bg-black/50 border-gray-600 text-white text-sm h-8"
                            />
                          ) : (
                            <span className="text-white">{occData.dinero_extra?.[currency] || 0}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Equipment */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Equipo Adicional</label>
                    {(occData.equipo_adicional || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {occData.equipo_adicional.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-black/50 border border-gray-600 rounded text-sm text-white flex items-center gap-1"
                          >
                            {item}
                            {isAdmin && (
                              <button
                                onClick={() => removeEquipFromOccupation(occName, idx)}
                                className="text-red-400 hover:text-red-300 ml-1"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mb-2">Sin equipo adicional</p>
                    )}
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Input
                          value={newEquipItem}
                          onChange={(e) => setNewEquipItem(e.target.value)}
                          placeholder="Añadir equipo..."
                          className="bg-black/50 border-gray-600 text-white text-sm flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && addEquipToOccupation(occName)}
                        />
                        <Button
                          size="sm"
                          onClick={() => addEquipToOccupation(occName)}
                          className="bg-[hsl(var(--magic-blue))]/20 text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))]/30"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-[hsl(var(--torch-orange))]/10 border border-[hsl(var(--torch-orange))]/30 rounded-lg p-4">
        <h4 className="text-sm font-heading text-[hsl(var(--torch-orange))] mb-2">Cómo funciona</h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• El <strong>Nivel de Vida</strong> de la cultura determina el dinero inicial base</li>
          <li>• La <strong>Ocupación</strong> puede añadir dinero y equipo extra</li>
          <li>• El dinero total = Dinero por nivel de vida + Dinero extra por ocupación</li>
          <li>• El equipo inicial incluye: equipo del nivel de vida + equipo de la ocupación</li>
        </ul>
      </div>
    </div>
  );
};

export default CharacterCreationSection;
