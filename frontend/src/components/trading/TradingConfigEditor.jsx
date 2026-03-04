/**
 * Trading Config Editor - Admin interface for editing all trading parameters
 */
import React, { useState, useEffect } from 'react';
import { 
  Save, Loader2, RefreshCw, ChevronDown, ChevronUp, Plus, Trash2,
  Users, Briefcase, History, Percent, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const TradingConfigEditor = ({ config: initialConfig, onConfigUpdate }) => {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      await api.put('/trading/config', config);
      toast.success('Configuración guardada');
      onConfigUpdate?.();
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
      await api.post('/trading/config/reset');
      const res = await api.get('/trading/config');
      setConfig(res.data);
      toast.success('Configuración restablecida');
      onConfigUpdate?.();
    } catch (err) {
      toast.error('Error al restablecer');
    } finally {
      setSaving(false);
    }
  };

  // Update nested config value
  const updateValue = (section, key, field, value) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: {
          ...prev[section][key],
          [field]: value
        }
      }
    }));
  };

  // Add new item to section
  const addItem = (section, defaultItem) => {
    const key = prompt('ID único (sin espacios):');
    if (!key) return;
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: defaultItem
      }
    }));
  };

  // Delete item from section
  const deleteItem = (section, key) => {
    if (!confirm(`¿Eliminar "${key}"?`)) return;
    setConfig(prev => {
      const newSection = { ...prev[section] };
      delete newSection[key];
      return { ...prev, [section]: newSection };
    });
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  if (!config) return null;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={resetConfig} disabled={saving}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Restablecer
        </Button>
        <Button onClick={saveConfig} disabled={saving} className="bg-[hsl(var(--gold))] text-black">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Guardar Todo
        </Button>
      </div>

      {/* Relationship Levels */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('relationships')}
        >
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-400" />
            <h3 className="font-heading text-green-400">Niveles de Relación</h3>
            <span className="text-xs text-gray-400">({Object.keys(config.relationship_levels || {}).length})</span>
          </div>
          {expandedSection === 'relationships' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'relationships' && (
          <div className="border-t border-gray-700 p-4 space-y-3">
            {Object.entries(config.relationship_levels || {}).sort((a, b) => a[1].orden - b[1].orden).map(([key, val]) => (
              <div key={key} className="grid grid-cols-6 gap-2 items-center bg-black/30 p-2 rounded">
                <div className="col-span-1">
                  <span className="text-sm text-white font-medium">{val.nombre}</span>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Mod. Compra %</label>
                  <Input
                    type="number"
                    value={val.mod_compra}
                    onChange={(e) => updateValue('relationship_levels', key, 'mod_compra', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Mod. Venta %</label>
                  <Input
                    type="number"
                    value={val.mod_venta}
                    onChange={(e) => updateValue('relationship_levels', key, 'mod_venta', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Bono Tirada</label>
                  <Input
                    type="number"
                    value={val.bono_tirada}
                    onChange={(e) => updateValue('relationship_levels', key, 'bono_tirada', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Orden</label>
                  <Input
                    type="number"
                    value={val.orden}
                    onChange={(e) => updateValue('relationship_levels', key, 'orden', parseInt(e.target.value) || 1)}
                    className="bg-black/50 border-gray-600 h-8"
                    min="1"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => deleteItem('relationship_levels', key)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addItem('relationship_levels', { nombre: 'Nuevo', orden: 7, mod_compra: 0, mod_venta: 0, bono_tirada: 0 })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir Nivel
            </Button>
          </div>
        )}
      </div>

      {/* Merchant Profiles */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('merchants')}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-400" />
            <h3 className="font-heading text-blue-400">Perfiles de Comerciante</h3>
            <span className="text-xs text-gray-400">({Object.keys(config.merchant_profiles || {}).length})</span>
          </div>
          {expandedSection === 'merchants' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'merchants' && (
          <div className="border-t border-gray-700 p-4 space-y-3">
            {Object.entries(config.merchant_profiles || {}).map(([key, val]) => (
              <div key={key} className="bg-black/30 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{val.nombre}</span>
                  <Button variant="ghost" size="sm" onClick={() => deleteItem('merchant_profiles', key)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={val.descripcion || ''}
                  onChange={(e) => updateValue('merchant_profiles', key, 'descripcion', e.target.value)}
                  placeholder="Descripción..."
                  className="bg-black/50 border-gray-600 text-sm"
                />
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Umbral Enfado</label>
                    <Input
                      type="number"
                      value={val.umbral_enfado}
                      onChange={(e) => updateValue('merchant_profiles', key, 'umbral_enfado', parseInt(e.target.value) || 30)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Margen Contra.</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={val.margen_contraoferta}
                      onChange={(e) => updateValue('merchant_profiles', key, 'margen_contraoferta', parseFloat(e.target.value) || 0.5)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Prob. Engaño %</label>
                    <Input
                      type="number"
                      value={val.probabilidad_engano}
                      onChange={(e) => updateValue('merchant_profiles', key, 'probabilidad_engano', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Mod. Precio %</label>
                    <Input
                      type="number"
                      value={val.mod_precio_base}
                      onChange={(e) => updateValue('merchant_profiles', key, 'mod_precio_base', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addItem('merchant_profiles', { 
                nombre: 'Nuevo Perfil', 
                descripcion: '', 
                umbral_enfado: 30, 
                margen_contraoferta: 0.5, 
                probabilidad_engano: 0, 
                mod_precio_base: 0 
              })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir Perfil
            </Button>
          </div>
        )}
      </div>

      {/* Historical Contexts */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('contexts')}
        >
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-400" />
            <h3 className="font-heading text-purple-400">Contextos Históricos</h3>
            <span className="text-xs text-gray-400">({Object.keys(config.historical_contexts || {}).length})</span>
          </div>
          {expandedSection === 'contexts' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'contexts' && (
          <div className="border-t border-gray-700 p-4 space-y-3">
            {Object.entries(config.historical_contexts || {}).map(([key, val]) => (
              <div key={key} className="bg-black/30 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={val.nombre}
                    onChange={(e) => updateValue('historical_contexts', key, 'nombre', e.target.value)}
                    className="bg-transparent border-0 text-white font-medium p-0 h-auto"
                  />
                  <Button variant="ghost" size="sm" onClick={() => deleteItem('historical_contexts', key)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  value={val.descripcion || ''}
                  onChange={(e) => updateValue('historical_contexts', key, 'descripcion', e.target.value)}
                  placeholder="Descripción..."
                  className="bg-black/50 border-gray-600 text-sm"
                />
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Armas %</label>
                    <Input
                      type="number"
                      value={val.mod_armas}
                      onChange={(e) => updateValue('historical_contexts', key, 'mod_armas', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Lujo %</label>
                    <Input
                      type="number"
                      value={val.mod_lujo}
                      onChange={(e) => updateValue('historical_contexts', key, 'mod_lujo', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Comida %</label>
                    <Input
                      type="number"
                      value={val.mod_comida}
                      onChange={(e) => updateValue('historical_contexts', key, 'mod_comida', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">General %</label>
                    <Input
                      type="number"
                      value={val.mod_general}
                      onChange={(e) => updateValue('historical_contexts', key, 'mod_general', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Bono Tirada</label>
                    <Input
                      type="number"
                      value={val.bono_tirada}
                      onChange={(e) => updateValue('historical_contexts', key, 'bono_tirada', parseInt(e.target.value) || 0)}
                      className="bg-black/50 border-gray-600 h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addItem('historical_contexts', { 
                nombre: 'Nuevo Contexto', 
                descripcion: '', 
                mod_armas: 0, 
                mod_lujo: 0, 
                mod_comida: 0, 
                mod_general: 0, 
                bono_tirada: 0 
              })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir Contexto
            </Button>
          </div>
        )}
      </div>

      {/* Blessing Modifiers */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('blessings')}
        >
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-yellow-400" />
            <h3 className="font-heading text-yellow-400">Modificadores de Bendición</h3>
          </div>
          {expandedSection === 'blessings' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'blessings' && (
          <div className="border-t border-gray-700 p-4 space-y-2">
            {Object.entries(config.blessing_modifiers || {}).map(([key, val]) => (
              <div key={key} className="grid grid-cols-3 gap-2 items-center bg-black/30 p-2 rounded">
                <Input
                  value={val.nombre}
                  onChange={(e) => updateValue('blessing_modifiers', key, 'nombre', e.target.value)}
                  className="bg-black/50 border-gray-600"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={val.modificador}
                    onChange={(e) => updateValue('blessing_modifiers', key, 'modificador', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600"
                  />
                  <span className="text-gray-400">%</span>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => deleteItem('blessing_modifiers', key)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addItem('blessing_modifiers', { nombre: 'Nueva Bendición', modificador: 10 })}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" /> Añadir Bendición
            </Button>
          </div>
        )}
      </div>

      {/* Anger Consequences */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('anger')}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h3 className="font-heading text-red-400">Consecuencias del Enfado</h3>
          </div>
          {expandedSection === 'anger' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'anger' && (
          <div className="border-t border-gray-700 p-4 space-y-2">
            {Object.entries(config.anger_consequences || {}).map(([key, val]) => (
              <div key={key} className="grid grid-cols-5 gap-2 items-center bg-black/30 p-2 rounded">
                <Input
                  value={val.nombre}
                  onChange={(e) => updateValue('anger_consequences', key, 'nombre', e.target.value)}
                  className="bg-black/50 border-gray-600"
                />
                <div>
                  <label className="text-xs text-gray-400">Cambio Rel.</label>
                  <Input
                    type="number"
                    value={val.cambio_relacion}
                    onChange={(e) => updateValue('anger_consequences', key, 'cambio_relacion', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Penal. Precio %</label>
                  <Input
                    type="number"
                    value={val.penalizacion_precio}
                    onChange={(e) => updateValue('anger_consequences', key, 'penalizacion_precio', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Días Sin Comercio</label>
                  <Input
                    type="number"
                    value={val.dias_sin_comercio}
                    onChange={(e) => updateValue('anger_consequences', key, 'dias_sin_comercio', parseInt(e.target.value) || 0)}
                    className="bg-black/50 border-gray-600 h-8"
                  />
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => deleteItem('anger_consequences', key)} className="text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trading Thresholds (simplified view) */}
      <div className="bg-black/40 border border-gray-700 rounded-lg overflow-hidden">
        <div 
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5"
          onClick={() => toggleSection('thresholds')}
        >
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-cyan-400" />
            <h3 className="font-heading text-cyan-400">Umbrales de Negociación</h3>
          </div>
          {expandedSection === 'thresholds' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        
        {expandedSection === 'thresholds' && (
          <div className="border-t border-gray-700 p-4 space-y-4">
            {['compra', 'venta'].map(modo => (
              <div key={modo} className="space-y-2">
                <h4 className="text-sm font-heading text-white capitalize">{modo}</h4>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(config.trading_thresholds?.[modo] || {}).map(([key, val]) => (
                    <div key={key}>
                      <label className="text-xs text-gray-400">{key.replace(/_/g, ' ')}</label>
                      <Input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          setConfig(prev => ({
                            ...prev,
                            trading_thresholds: {
                              ...prev.trading_thresholds,
                              [modo]: {
                                ...prev.trading_thresholds[modo],
                                [key]: parseInt(e.target.value) || 0
                              }
                            }
                          }));
                        }}
                        className="bg-black/50 border-gray-600 h-8"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingConfigEditor;
