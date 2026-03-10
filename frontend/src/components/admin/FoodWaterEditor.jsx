/**
 * FoodWaterEditor - Bulk editor for marking items as food/water
 * Allows changing multiple items at once and moving between categories
 */
import { useState, useEffect } from 'react';
import { X, Loader2, Search, Utensils, Droplet, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '@/services/api';

// Categories that can contain food/water items
const FOOD_CATEGORIES = [
  { key: 'consumibles', name: 'Consumibles y Alimentación' },
  { key: 'comida_posadas', name: 'Comida en Posadas' },
  { key: 'equipo_general', name: 'Equipo General' },
  { key: 'herramientas', name: 'Herramientas' }
];

const ALL_CATEGORIES = [
  { key: 'consumibles', name: 'Consumibles y Alimentación' },
  { key: 'comida_posadas', name: 'Comida en Posadas' },
  { key: 'equipo_general', name: 'Equipo General' },
  { key: 'herramientas', name: 'Herramientas' },
  { key: 'hierbas', name: 'Hierbas Medicinales' },
  { key: 'venenos', name: 'Venenos' }
];

const FoodWaterEditor = ({ onClose }) => {
  const [catalog, setCatalog] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('consumibles');
  const [modifiedItems, setModifiedItems] = useState({});
  const [moveItem, setMoveItem] = useState(null);
  
  // Load equipment catalog
  useEffect(() => {
    loadCatalog();
  }, []);
  
  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await api.get('/data/equipment-catalog');
      setCatalog(res.data);
    } catch (err) {
      toast.error('Error al cargar el catálogo');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  // Get items for current category
  const getCurrentItems = () => {
    const items = catalog[selectedCategory] || [];
    if (!searchQuery) return items;
    return items.filter(item => 
      item.nombre?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };
  
  // Handle item property change
  const handleItemChange = (itemName, field, value) => {
    setModifiedItems(prev => ({
      ...prev,
      [`${selectedCategory}:${itemName}`]: {
        ...prev[`${selectedCategory}:${itemName}`],
        nombre: itemName,
        categoria: selectedCategory,
        [field]: value
      }
    }));
  };
  
  // Get modified value or original
  const getItemValue = (item, field) => {
    const key = `${selectedCategory}:${item.nombre}`;
    const modified = modifiedItems[key];
    if (modified && modified[field] !== undefined) {
      return modified[field];
    }
    return item[field];
  };
  
  // Save all changes
  const handleSave = async () => {
    const itemsToUpdate = Object.values(modifiedItems).map(item => ({
      nombre: item.nombre,
      categoria: item.categoria,
      es_comida: item.es_comida ?? false,
      es_agua: item.es_agua ?? false,
      porcentaje_racion: parseInt(item.porcentaje_racion) || 100,
      litros: parseFloat(item.litros) || 0
    }));
    
    if (itemsToUpdate.length === 0) {
      toast.info('No hay cambios para guardar');
      return;
    }
    
    setSaving(true);
    try {
      const res = await api.put('/data/equipment-catalog/food-water', { items: itemsToUpdate });
      if (res.data.success) {
        toast.success(`${res.data.updated} item(s) actualizados`);
        setModifiedItems({});
        await loadCatalog();
      }
    } catch (err) {
      toast.error('Error al guardar cambios');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };
  
  // Move item to another category
  const handleMoveItem = async (item, toCategory) => {
    try {
      const res = await api.put('/data/equipment-catalog/move-item', {
        nombre: item.nombre,
        from_categoria: selectedCategory,
        to_categoria: toCategory
      });
      if (res.data.success) {
        toast.success(`Item movido a ${toCategory}`);
        setMoveItem(null);
        await loadCatalog();
      }
    } catch (err) {
      toast.error('Error al mover item');
      console.error(err);
    }
  };
  
  // Quick mark multiple items
  const handleQuickMark = async (field, value) => {
    const items = getCurrentItems();
    const updates = {};
    items.forEach(item => {
      const key = `${selectedCategory}:${item.nombre}`;
      updates[key] = {
        ...modifiedItems[key],
        nombre: item.nombre,
        categoria: selectedCategory,
        [field]: value
      };
    });
    setModifiedItems(prev => ({ ...prev, ...updates }));
    toast.info(`${items.length} items marcados`);
  };
  
  const items = getCurrentItems();
  const hasChanges = Object.keys(modifiedItems).length > 0;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card-parchment rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex justify-between items-center">
          <div>
            <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
              Editor de Comida y Agua
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Marca items como comida/agua y configura % de ración diaria
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Toolbar */}
        <div className="p-4 border-b border-border/30 space-y-3">
          <div className="flex gap-3 items-center">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                {FOOD_CATEGORIES.map(cat => (
                  <SelectItem key={cat.key} value={cat.key}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleQuickMark('es_comida', true)}
              className="text-orange-400 border-orange-500/30"
            >
              <Utensils className="w-4 h-4 mr-1" />
              Marcar todos como Comida
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleQuickMark('es_agua', true)}
              className="text-blue-400 border-blue-500/30"
            >
              <Droplet className="w-4 h-4 mr-1" />
              Marcar todos como Agua
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleQuickMark('porcentaje_racion', 100)}
            >
              100% Ración
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleQuickMark('porcentaje_racion', 50)}
            >
              50% Ración
            </Button>
          </div>
        </div>
        
        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay items en esta categoría
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => {
                const isModified = modifiedItems[`${selectedCategory}:${item.nombre}`];
                const esComida = getItemValue(item, 'es_comida');
                const esAgua = getItemValue(item, 'es_agua');
                const porcentaje = getItemValue(item, 'porcentaje_racion') || 100;
                const litros = getItemValue(item, 'litros') || 0;
                
                return (
                  <Card 
                    key={idx} 
                    className={`p-3 ${isModified ? 'border-yellow-500/50 bg-yellow-500/5' : 'bg-black/20'}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Item name and info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.precio} {item.moneda} | {item.peso_kg || '?'} kg
                        </p>
                      </div>
                      
                      {/* Food/Water toggles */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleItemChange(item.nombre, 'es_comida', !esComida)}
                          className={`p-2 rounded ${esComida ? 'bg-orange-500/30 text-orange-400' : 'bg-black/30 text-muted-foreground'}`}
                          title="Es Comida"
                        >
                          <Utensils className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleItemChange(item.nombre, 'es_agua', !esAgua)}
                          className={`p-2 rounded ${esAgua ? 'bg-blue-500/30 text-blue-400' : 'bg-black/30 text-muted-foreground'}`}
                          title="Es Agua"
                        >
                          <Droplet className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Percentage input */}
                      {esComida && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={porcentaje}
                            onChange={(e) => handleItemChange(item.nombre, 'porcentaje_racion', parseInt(e.target.value) || 0)}
                            className="w-20 h-8 text-center"
                            min={0}
                            max={200}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                      
                      {/* Liters input for water */}
                      {esAgua && (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={litros}
                            onChange={(e) => handleItemChange(item.nombre, 'litros', parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-center"
                            min={0}
                            step={0.1}
                          />
                          <span className="text-xs text-muted-foreground">L</span>
                        </div>
                      )}
                      
                      {/* Move button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMoveItem(moveItem === item.nombre ? null : item.nombre)}
                        className="h-8 w-8"
                        title="Mover a otra categoría"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Move dropdown */}
                    {moveItem === item.nombre && (
                      <div className="mt-2 pt-2 border-t border-border/30 flex gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground self-center">Mover a:</span>
                        {ALL_CATEGORIES.filter(c => c.key !== selectedCategory).map(cat => (
                          <Button
                            key={cat.key}
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveItem(item, cat.key)}
                            className="text-xs"
                          >
                            {cat.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {hasChanges && (
              <span className="text-yellow-400">
                {Object.keys(modifiedItems).length} cambios pendientes
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Guardar Cambios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FoodWaterEditor;
