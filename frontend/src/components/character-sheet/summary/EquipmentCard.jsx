/**
 * Equipment Card - Equipment list with manage button
 */
import { Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EquipmentCard = ({ character, onManageClick }) => {
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
      
      {/* Weapons */}
      {(character.armas_elegidas?.length > 0 || character.equipo_ocupacion?.some(e => 
        ['daga', 'espada', 'arco', 'hacha', 'lanza', 'bastón', 'maza'].some(w => 
          (typeof e === 'string' ? e : e?.nombre || '').toLowerCase().includes(w)
        )
      )) && (
        <div className="mb-2">
          <p className="text-xs text-red-400 font-medium mb-1">Armas</p>
          <div className="space-y-0.5 text-xs">
            {(character.armas_elegidas || []).map((arma, i) => (
              <div key={`arma-${i}`} className="text-muted-foreground">
                • {typeof arma === 'string' ? arma : arma.nombre}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Tools & Other Equipment - condensed */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        {character.herramientas_elegidas_ocupacion?.map((herr, i) => (
          <div key={`herr-${i}`}>• {typeof herr === 'string' ? herr : herr.nombre}</div>
        ))}
        {character.inventario?.slice(0, 5).map((item, i) => (
          <div key={`inv-${i}`}>• {item.nombre} {item.cantidad > 1 && `(x${item.cantidad})`}</div>
        ))}
        {character.inventario?.length > 5 && (
          <div className="text-[hsl(var(--gold))]">... y {character.inventario.length - 5} más</div>
        )}
      </div>
      
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
