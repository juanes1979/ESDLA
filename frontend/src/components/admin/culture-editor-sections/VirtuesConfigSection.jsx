/**
 * VirtuesConfigSection — extracted from `CultureEditor.jsx` (iter82 refactor).
 *
 * Sólo se monta cuando `formData.tiene_virtud_inicial` es true.
 */
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const VirtuesConfigSection = ({
  formData,
  handleChange,
  toggleArrayItem,
  allVirtues = [],
  allCultures = [],
  cultureId = null,
  getAvailableVirtues,
}) => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Esta cultura tiene virtud al nivel 1. Configura qué virtudes puede elegir el jugador.
    </p>

    <div className="bg-black/20 p-3 rounded">
      <Label className="mb-2 block">Copiar virtudes de otra cultura</Label>
      <Select
        value={formData.copiar_virtudes_de || 'none'}
        onValueChange={(v) => handleChange('copiar_virtudes_de', v === 'none' ? '' : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="No copiar (usar propias)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No copiar (usar propias)</SelectItem>
          {allCultures.filter(c => c.id !== cultureId).map(c => (
            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="flex items-center gap-2 bg-black/20 p-3 rounded">
      <Checkbox
        checked={formData.permite_virtudes_comunes}
        onCheckedChange={(c) => handleChange('permite_virtudes_comunes', c)}
      />
      <div>
        <Label>Permite elegir virtudes comunes</Label>
        <p className="text-xs text-muted-foreground">
          Si está activado, el jugador también puede elegir de las virtudes comunes.
        </p>
      </div>
    </div>

    <div className="bg-black/20 p-3 rounded">
      <Label className="mb-2 block">Virtudes propias de esta cultura</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Selecciona las virtudes específicas disponibles para esta cultura.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
        {allVirtues.map(v => (
          <div key={v.id} className="flex items-center gap-2">
            <Checkbox
              checked={formData.virtudes_propias?.includes(v.id)}
              onCheckedChange={() => toggleArrayItem('virtudes_propias', v.id)}
            />
            <div>
              <Label className="text-xs">{v.nombre}</Label>
              <span className="text-xs text-muted-foreground ml-2">
                ({v.tipo || (v.es_comun ? 'Común' : 'Sin tipo')})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="bg-[hsl(var(--gold))/10] p-3 rounded">
      <Label className="text-[hsl(var(--gold))] mb-2 block">Vista previa: Virtudes disponibles para el jugador</Label>
      <div className="flex flex-wrap gap-2">
        {getAvailableVirtues().length > 0 ? (
          getAvailableVirtues().map(v => (
            <span key={v.id} className="text-xs bg-black/30 px-2 py-1 rounded">
              {v.nombre}
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            Ninguna virtud seleccionada. El jugador no podrá elegir virtud inicial.
          </span>
        )}
      </div>
    </div>
  </div>
);

export default VirtuesConfigSection;
