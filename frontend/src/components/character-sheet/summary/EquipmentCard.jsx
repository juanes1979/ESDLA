/**
 * Equipment Card - Equipment list with manage button
 * Shows ALL equipment without truncation
 * Separates mount and mount accessories into their own section
 */
import { Package, Settings, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Mount names for detection
const MOUNT_NAMES = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno'];
// Mount accessory names
const MOUNT_ACCESSORY_NAMES = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 'herradura', 'manta de montar'];

// Check if an item is a mount
const isMount = (nombre) => {
  const lower = nombre.toLowerCase();
  return MOUNT_NAMES.some(m => lower.includes(m));
};

// Check if an item is a mount accessory
const isMountAccessory = (nombre) => {
  const lower = nombre.toLowerCase();
  return MOUNT_ACCESSORY_NAMES.some(m => lower.includes(m));
};

// Check if item is mount-related (mount or accessory)
const isMountRelated = (nombre) => isMount(nombre) || isMountAccessory(nombre);

const EquipmentCard = ({ character, onManageClick }) => {
  // Weapons
  const weapons = [];
  (character.armas_elegidas || []).forEach(arma => {
    const nombre = typeof arma === 'string' ? arma : arma.nombre;
    const mejoras = typeof arma === 'object' && arma.mejoras ? ` [${arma.mejoras.join(', ')}]` : '';
    weapons.push(nombre + mejoras);
  });
  (character.equipo_ocupacion || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    const mejoras = typeof item === 'object' && item.mejoras ? ` [${item.mejoras.join(', ')}]` : '';
    if (['daga', 'espada', 'arco', 'hacha', 'lanza', 'bastón', 'maza', 'flecha', 'carcaj'].some(w => nombre.toLowerCase().includes(w))) {
      if (!weapons.includes(nombre + mejoras)) {
        weapons.push(nombre + mejoras);
      }
    }
  });
  
  // Armor
  const armor = character.armadura_elegida || character.armadura?.nombre;
  
  // Tools (excluding mount-related)
  const tools = (character.herramientas_elegidas_ocupacion || [])
    .map(h => typeof h === 'string' ? h : h.nombre)
    .filter(t => !isMountRelated(t));
  
  // Other equipment (occupation, background, lifestyle) - excluding mount-related
  const otherEquip = [];
  const addIfNotMountRelated = (item) => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!isMountRelated(nombre) && !otherEquip.includes(nombre)) {
      otherEquip.push(nombre);
    }
  };
  
  (character.equipo_ocupacion || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!weapons.some(w => w.toLowerCase().includes(nombre.toLowerCase().split(' [')[0])) && !tools.includes(nombre)) {
      addIfNotMountRelated(item);
    }
  });
  (character.equipo_trasfondo || []).forEach(addIfNotMountRelated);
  (character.equipo_nivel_vida || []).forEach(addIfNotMountRelated);
  (character.ropa_nivel_vida || []).forEach(addIfNotMountRelated);
  
  // Collect mount and mount accessories from ALL sources
  const mountItems = [];
  const mountAccessories = [];
  
  const collectMountItems = (items) => {
    (items || []).forEach(item => {
      const nombre = typeof item === 'string' ? item : item?.nombre || '';
      const cantidad = typeof item === 'object' && item.cantidad > 1 ? ` (x${item.cantidad})` : '';
      if (isMount(nombre)) {
        if (!mountItems.includes(nombre)) mountItems.push(nombre);
      } else if (isMountAccessory(nombre)) {
        const full = nombre + cantidad;
        if (!mountAccessories.includes(full)) mountAccessories.push(full);
      }
    });
  };
  
  // Check character.montura field first
  if (character.montura?.nombre) {
    mountItems.push(character.montura.nombre);
  }
  
  // Collect from all sources
  collectMountItems(character.inventario);
  collectMountItems(character.equipo_nivel_vida);
  collectMountItems(character.equipo_trasfondo);
  collectMountItems(character.equipo_ocupacion);
  
  const hasMount = mountItems.length > 0 || mountAccessories.length > 0;
  
  // Inventory items - excluding mount-related
  const inventoryItems = (character.inventario || [])
    .filter(item => {
      const nombre = item.nombre || item;
      return !isMountRelated(nombre);
    })
    .map(item => {
      const nombre = item.nombre || item;
      const cantidad = item.cantidad > 1 ? ` (x${item.cantidad})` : '';
      const enMontura = item.portado_por === 'montura' ? ' (M)' : '';
      return nombre + cantidad + enMontura;
    });

  return (
    <div className="card-parchment rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-md text-[hsl(var(--gold))] flex items-center gap-2">
          <Package className="w-4 h-4" />
          Equipo
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onManageClick}
          className="text-xs border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
          data-testid="manage-equipment-btn"
        >
          <Settings className="w-3 h-3 mr-1" />
          Gestionar
        </Button>
      </div>
      
      {/* Mount & Accessories Section */}
      {hasMount && (
        <div className="mb-3 bg-blue-900/20 rounded p-3 border border-blue-500/30">
          <p className="text-xs text-blue-400 font-medium mb-2 flex items-center gap-1">
            <Landmark className="w-3 h-3" />
            Montura y Accesorios
          </p>
          <div className="space-y-0.5 text-xs text-blue-300">
            {mountItems.map((item, i) => (
              <div key={`mount-${i}`} className="font-medium">• {item}</div>
            ))}
            {mountAccessories.map((item, i) => (
              <div key={`acc-${i}`} className="text-blue-300/80">• {item}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Weapons */}
      {weapons.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-red-400 font-medium mb-1">Armas</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {weapons.map((arma, i) => (
              <div key={`arma-${i}`}>• {arma}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Armor */}
      {armor && (
        <div className="mb-2">
          <p className="text-xs text-purple-400 font-medium mb-1">Armadura</p>
          <div className="text-xs text-muted-foreground">• {armor}</div>
        </div>
      )}
      
      {/* Tools */}
      {tools.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-amber-400 font-medium mb-1">Herramientas</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {tools.map((tool, i) => (
              <div key={`tool-${i}`}>• {tool}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Other equipment */}
      {otherEquip.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-emerald-400 font-medium mb-1">Equipo</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {otherEquip.map((item, i) => (
              <div key={`equip-${i}`}>• {item}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Inventory - excluding mount items */}
      {inventoryItems.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-[hsl(var(--magic-blue))] font-medium mb-1">Inventario</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {inventoryItems.map((item, i) => (
              <div key={`inv-${i}`}>• {item}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Money - compact */}
      <div className="mt-3 pt-2 border-t border-border/30 flex flex-wrap gap-2 text-xs">
        <span className="text-yellow-500">{character.dinero?.mo || 0} mo</span>
        <span className="text-gray-300">{character.dinero?.mp || 0} mp</span>
        <span className="text-slate-400">{character.dinero?.me || 0} me</span>
        <span className="text-amber-700">{character.dinero?.mc || 0} mc</span>
      </div>
    </div>
  );
};

export default EquipmentCard;
