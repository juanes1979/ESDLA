/**
 * Step 7: Equipment Selection
 * El equipo inicial se asigna AUTOMÁTICAMENTE según el Nivel de Vida de la cultura
 * El jugador puede añadir equipo adicional si lo desea
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronLeft, Package, Coins, Sword, Shield, CheckCircle } from 'lucide-react';
import { getWeapons, getArmors, updateDraftStep7 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// Equipo inicial según Nivel de Vida (según las reglas del juego)
const EQUIPO_POR_NIVEL_VIDA = {
  'Frugal': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
    ],
    dinero: { mp: 15, mo: 0, mc: 0 },
    descripcion: 'Equipo básico para supervivencia. Tu cultura vive de forma austera.'
  },
  'Común': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
      { nombre: 'Antorchas (paquete de 10)', cantidad: 1 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de cáñamo (15 m)', cantidad: 1 },
    ],
    dinero: { mp: 15, mo: 0, mc: 0 },
    descripcion: 'Equipo estándar para un aventurero. Tu cultura tiene recursos moderados.'
  },
  'Próspero': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Linterna sorda', cantidad: 1 },
      { nombre: 'Aceite (frasco)', cantidad: 3 },
      { nombre: 'Raciones de cram (1 día)', cantidad: 10 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de seda (15 m)', cantidad: 1 },
      { nombre: 'Tienda para 2 personas', cantidad: 1 },
    ],
    dinero: { mp: 20, mo: 0, mc: 0 },
    descripcion: 'Equipo de alta calidad. Tu cultura goza de riqueza y comodidades.'
  }
};

const Step7Equipment = ({ draftId, draft, onComplete, onBack }) => {
  const [weapons, setWeapons] = useState([]);
  const [armors, setArmors] = useState([]);
  const [selectedWeapons, setSelectedWeapons] = useState([]);
  const [selectedArmors, setSelectedArmors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Obtener el nivel de vida del personaje
  const nivelVida = draft?.nivel_vida || 'Común';
  
  // Obtener equipo automático según nivel de vida
  const equipoAutomatico = useMemo(() => {
    return EQUIPO_POR_NIVEL_VIDA[nivelVida] || EQUIPO_POR_NIVEL_VIDA['Común'];
  }, [nivelVida]);

  // Load weapons and armors for optional selection
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [weaponData, armorData] = await Promise.all([
          getWeapons(),
          getArmors(),
        ]);
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

  // Toggle weapon selection
  const toggleWeapon = (weapon) => {
    setSelectedWeapons(prev => {
      const exists = prev.find(w => w.id === weapon.id);
      if (exists) {
        return prev.filter(w => w.id !== weapon.id);
      }
      return [...prev, weapon];
    });
  };

  // Toggle armor selection
  const toggleArmor = (armor) => {
    setSelectedArmors(prev => {
      const exists = prev.find(a => a.id === armor.id);
      if (exists) {
        return prev.filter(a => a.id !== armor.id);
      }
      return [...prev, armor];
    });
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Combinar equipo automático con armas/armaduras seleccionadas
      const inventario = [
        // Equipo automático del nivel de vida
        ...equipoAutomatico.items.map(item => ({
          item_id: `auto-${item.nombre.toLowerCase().replace(/\s/g, '-')}`,
          nombre: item.nombre,
          cantidad: item.cantidad,
          equipado: false,
          origen: 'nivel_vida'
        })),
        // Armas seleccionadas
        ...selectedWeapons.map(w => ({
          item_id: w.id,
          nombre: w.nombre,
          cantidad: 1,
          equipado: false,
          tipo: 'arma',
          dano: w.dano,
          tipo_dano: w.tipo_dano
        })),
        // Armaduras seleccionadas  
        ...selectedArmors.map(a => ({
          item_id: a.id,
          nombre: a.nombre,
          cantidad: 1,
          equipado: false,
          tipo: 'armadura',
          clase_armadura: a.clase_armadura
        }))
      ];
      
      const updatedDraft = await updateDraftStep7(draftId, {
        inventario,
        dinero: equipoAutomatico.dinero,
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

  const renderWeaponCard = (weapon) => {
    const isSelected = selectedWeapons.some(w => w.id === weapon.id);
    
    return (
      <button
        key={weapon.id}
        onClick={() => toggleWeapon(weapon)}
        className={cn(
          'p-3 rounded-lg border text-left transition-all w-full',
          isSelected 
            ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
            : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]'
        )}
        data-testid={`weapon-${weapon.id}`}
      >
        <div className="flex justify-between items-start">
          <span className={cn(
            'font-medium text-sm',
            isSelected ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {weapon.nombre}
          </span>
          {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />}
        </div>
        {weapon.dano && (
          <p className="text-xs text-muted-foreground mt-1">
            Daño: {weapon.dano} {weapon.tipo_dano}
          </p>
        )}
      </button>
    );
  };

  const renderArmorCard = (armor) => {
    const isSelected = selectedArmors.some(a => a.id === armor.id);
    
    return (
      <button
        key={armor.id}
        onClick={() => toggleArmor(armor)}
        className={cn(
          'p-3 rounded-lg border text-left transition-all w-full',
          isSelected 
            ? 'bg-[hsl(var(--gold))/15] border-[hsl(var(--gold))]' 
            : 'bg-secondary border-border hover:border-[hsl(var(--gold))/50]'
        )}
        data-testid={`armor-${armor.id}`}
      >
        <div className="flex justify-between items-start">
          <span className={cn(
            'font-medium text-sm',
            isSelected ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {armor.nombre}
          </span>
          {isSelected && <CheckCircle className="w-4 h-4 text-[hsl(var(--gold))]" />}
        </div>
        {armor.clase_armadura && (
          <p className="text-xs text-muted-foreground mt-1">
            CA: {armor.clase_armadura}
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
          Equipo Inicial
        </h2>
        <p className="text-muted-foreground">
          Tu equipo base depende del Nivel de Vida de tu cultura
        </p>
      </div>

      {/* Character & Level of Living Summary */}
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
                {draft?.cultura_nombre} · {draft?.vocacion_nombre}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Nivel de Vida</p>
            <p className="font-heading text-xl text-[hsl(var(--gold))]">
              {nivelVida}
            </p>
          </div>
        </div>
      </div>

      {/* Automatic Equipment from Level of Living */}
      <div className="card-parchment rounded-lg p-6 border-magic">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Equipo Automático ({nivelVida})
          </h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 italic">
          {equipoAutomatico.descripcion}
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {equipoAutomatico.items.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--gold))/10] border border-[hsl(var(--gold))/30]"
            >
              <span className="text-foreground">{item.nombre}</span>
              <span className="text-[hsl(var(--gold))] font-medium">x{item.cantidad}</span>
            </div>
          ))}
        </div>

        {/* Starting Money */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary">
          <Coins className="w-5 h-5 text-[hsl(var(--gold))]" />
          <div>
            <p className="text-sm text-muted-foreground">Dinero Inicial</p>
            <p className="font-heading text-lg text-[hsl(var(--gold))]">
              {equipoAutomatico.dinero.mp} Monedas de Plata
            </p>
          </div>
        </div>
      </div>

      {/* Optional: Additional Weapons & Armor Selection */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4">
          Armas y Armaduras Opcionales
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Puedes seleccionar armas y armaduras adicionales según tu ocupación y preferencias.
        </p>

        <Tabs defaultValue="weapons" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary">
            <TabsTrigger value="weapons" className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20]">
              <Sword className="w-4 h-4 mr-2" />
              Armas ({selectedWeapons.length})
            </TabsTrigger>
            <TabsTrigger value="armors" className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20]">
              <Shield className="w-4 h-4 mr-2" />
              Armaduras ({selectedArmors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weapons" className="mt-4">
            <ScrollArea className="h-[250px] pr-4">
              <div className="grid md:grid-cols-2 gap-2">
                {weapons.map(weapon => renderWeaponCard(weapon))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="armors" className="mt-4">
            <ScrollArea className="h-[250px] pr-4">
              <div className="grid md:grid-cols-2 gap-2">
                {armors.map(armor => renderArmorCard(armor))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* Selected Additional Items Summary */}
      {(selectedWeapons.length > 0 || selectedArmors.length > 0) && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3">
            Equipo Adicional Seleccionado
          </h3>
          <div className="flex flex-wrap gap-2">
            {selectedWeapons.map(w => (
              <span
                key={w.id}
                className="px-3 py-1 rounded-full bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-sm flex items-center gap-1"
              >
                <Sword className="w-3 h-3" />
                {w.nombre}
              </span>
            ))}
            {selectedArmors.map(a => (
              <span
                key={a.id}
                className="px-3 py-1 rounded-full bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-sm flex items-center gap-1"
              >
                <Shield className="w-3 h-3" />
                {a.nombre}
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
      <div className="flex justify-between pt-4 pb-16">
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
