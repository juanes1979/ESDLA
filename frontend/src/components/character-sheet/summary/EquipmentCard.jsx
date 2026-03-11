/**
 * Equipment Card - Equipment list with manage button
 * Shows ALL equipment without truncation
 */
import { Package, Settings, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Detect mount from inventory or equipment
const detectMount = (character) => {
  const mountNames = ['caballo', 'pony', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno', 'montura'];
  
  // Check character.montura field
  if (character.montura?.nombre) {
    return character.montura.nombre;
  }
  
  // Check all equipment sources for mount
  const allItems = [
    ...(character.inventario || []),
    ...(character.equipo_nivel_vida || []),
    ...(character.equipo_trasfondo || []),
    ...(character.equipo_ocupacion || []),
  ];
  
  for (const item of allItems) {
    const nombre = (typeof item === 'string' ? item : item?.nombre || '').toLowerCase();
    if (mountNames.some(m => nombre.includes(m))) {
      return typeof item === 'string' ? item : item.nombre;
    }
  }
  
  return null;
};

const EquipmentCard = ({ character, onManageClick }) => {
  // Collect ALL equipment items for display
  const allEquipment = [];
  
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
  if (armor) {
    allEquipment.push({ category: 'Armadura', items: [typeof armor === 'string' ? armor : armor] });
  }
  
  // Tools
  const tools = (character.herramientas_elegidas_ocupacion || []).map(h => typeof h === 'string' ? h : h.nombre);
  
  // Other equipment (occupation, background, lifestyle)
  const otherEquip = [];
  (character.equipo_ocupacion || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!weapons.some(w => w.toLowerCase().includes(nombre.toLowerCase().split(' [')[0])) && !tools.includes(nombre)) {
      otherEquip.push(nombre);
    }
  });
  (character.equipo_trasfondo || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!otherEquip.includes(nombre)) otherEquip.push(nombre);
  });
  (character.equipo_nivel_vida || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!otherEquip.includes(nombre)) otherEquip.push(nombre);
  });
  (character.ropa_nivel_vida || []).forEach(item => {
    const nombre = typeof item === 'string' ? item : item?.nombre || '';
    if (!otherEquip.includes(nombre)) otherEquip.push(nombre);
  });
  
  // Inventory items
  const inventoryItems = (character.inventario || []).map(item => {
    const nombre = item.nombre || item;
    const cantidad = item.cantidad > 1 ? ` (x${item.cantidad})` : '';
    const enMontura = item.portado_por === 'montura' ? ' (M)' : '';
    return nombre + cantidad + enMontura;
  });
  
  // Mount detection
  const mountName = detectMount(character);

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
      
      {/* Mount indicator */}
      {mountName && (
        <div className="mb-3 bg-blue-900/30 rounded p-2 flex items-center gap-2 text-xs">
          <Landmark className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 font-medium">{mountName}</span>
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
      
      {/* Inventory - ALL items */}
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
