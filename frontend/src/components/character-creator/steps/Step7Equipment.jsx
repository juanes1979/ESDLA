/**
 * Step 7: Equipment Selection (Simplified)
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Package, Sword, Shield, Coins } from 'lucide-react';
import { getEquipment, getWeapons, getArmors, updateDraftStep7 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const Step7Equipment = ({ draftId, draft, onComplete, onBack }) => {
  const [equipment, setEquipment] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [armors, setArmors] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [money, setMoney] = useState({ mp: 0, mo: 0, mc: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load equipment data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [equipData, weaponData, armorData] = await Promise.all([
          getEquipment(),
          getWeapons(),
          getArmors(),
        ]);
        setEquipment(equipData);
        setWeapons(weaponData);
        setArmors(armorData);
      } catch (err) {
        console.error('Error loading equipment:', err);
        setError('No se pudo cargar el equipo');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Toggle item selection
  const toggleItem = (item, type) => {
    const itemWithType = { ...item, tipo_equipo: type };
    setSelectedItems(prev => {
      const exists = prev.find(i => i.id === item.id);
      if (exists) {
        return prev.filter(i => i.id !== item.id);
      }
      return [...prev, itemWithType];
    });
  };

  // Handle money change
  const handleMoneyChange = (type, value) => {
    const num = parseInt(value) || 0;
    setMoney(prev => ({ ...prev, [type]: Math.max(0, num) }));
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      const inventario = selectedItems.map(item => ({
        item_id: item.id,
        nombre: item.nombre,
        cantidad: 1,
        equipado: false,
      }));
      
      const updatedDraft = await updateDraftStep7(draftId, {
        inventario,
        dinero: money,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 7:', err);
      setError('No se pudo guardar el equipo');
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

  const renderItemCard = (item, type) => {
    const isSelected = selectedItems.some(i => i.id === item.id);
    
    return (
      <button
        key={item.id}
        onClick={() => toggleItem(item, type)}
        className={cn(
          'p-3 rounded-lg border text-left transition-all w-full',
          isSelected 
            ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
            : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]'
        )}
        data-testid={`item-${item.id}`}
      >
        <div className="flex justify-between items-start">
          <span className={cn(
            'font-medium text-sm',
            isSelected ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {item.nombre}
          </span>
          {item.precio && (
            <span className="text-xs text-[hsl(var(--gold))]">
              {item.precio} {item.moneda || 'mp'}
            </span>
          )}
        </div>
        {type === 'weapon' && item.dano && (
          <p className="text-xs text-muted-foreground mt-1">
            Daño: {item.dano} {item.tipo_dano}
          </p>
        )}
        {type === 'armor' && item.clase_armadura && (
          <p className="text-xs text-muted-foreground mt-1">
            CA: {item.clase_armadura}
          </p>
        )}
        {item.peso_kg && (
          <p className="text-xs text-muted-foreground">
            {item.peso_kg} kg
          </p>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-8" data-testid="step-7-equipment">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Equipa tu Personaje
        </h2>
        <p className="text-muted-foreground">
          Selecciona armas, armaduras y equipo para tu aventura
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
              <p className="text-sm text-muted-foreground">
                {draft?.vocacion_nombre} · Nivel de Vida: {draft?.nivel_vida || 'Común'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Objetos seleccionados:</p>
            <p className="font-heading text-2xl text-[hsl(var(--gold))]">
              {selectedItems.length}
            </p>
          </div>
        </div>
      </div>

      {/* Money Input */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Dinero Inicial
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="mp" className="text-sm text-muted-foreground">Monedas de Plata</Label>
            <Input
              id="mp"
              type="number"
              min="0"
              value={money.mp}
              onChange={(e) => handleMoneyChange('mp', e.target.value)}
              className="bg-input border-border"
              data-testid="money-mp"
            />
          </div>
          <div>
            <Label htmlFor="mo" className="text-sm text-muted-foreground">Monedas de Oro</Label>
            <Input
              id="mo"
              type="number"
              min="0"
              value={money.mo}
              onChange={(e) => handleMoneyChange('mo', e.target.value)}
              className="bg-input border-border"
              data-testid="money-mo"
            />
          </div>
          <div>
            <Label htmlFor="mc" className="text-sm text-muted-foreground">Monedas de Cobre</Label>
            <Input
              id="mc"
              type="number"
              min="0"
              value={money.mc}
              onChange={(e) => handleMoneyChange('mc', e.target.value)}
              className="bg-input border-border"
              data-testid="money-mc"
            />
          </div>
        </div>
      </div>

      {/* Equipment Tabs */}
      <Tabs defaultValue="weapons" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="weapons" className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20]">
            <Sword className="w-4 h-4 mr-2" />
            Armas ({weapons.length})
          </TabsTrigger>
          <TabsTrigger value="armors" className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20]">
            <Shield className="w-4 h-4 mr-2" />
            Armaduras ({armors.length})
          </TabsTrigger>
          <TabsTrigger value="equipment" className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20]">
            <Package className="w-4 h-4 mr-2" />
            Equipo ({equipment.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="weapons" className="mt-4">
          <div className="card-parchment rounded-lg p-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid md:grid-cols-2 gap-2">
                {weapons.map(item => renderItemCard(item, 'weapon'))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="armors" className="mt-4">
          <div className="card-parchment rounded-lg p-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid md:grid-cols-2 gap-2">
                {armors.map(item => renderItemCard(item, 'armor'))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="equipment" className="mt-4">
          <div className="card-parchment rounded-lg p-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid md:grid-cols-2 gap-2">
                {equipment.map(item => renderItemCard(item, 'gear'))}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      {/* Selected Items Summary */}
      {selectedItems.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3">
            Equipo Seleccionado
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map(item => (
              <span
                key={item.id}
                className="px-3 py-1 rounded-full bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-sm"
              >
                {item.nombre}
              </span>
            ))}
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
      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-7-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-7-next-btn"
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

export default Step7Equipment;
