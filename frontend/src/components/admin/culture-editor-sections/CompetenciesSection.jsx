/**
 * CompetenciesSection — extracted from `CultureEditor.jsx` (iter82 refactor).
 *
 * Engloba: competencias de habilidad automáticas, habilidades a elegir,
 * herramientas (Opción 1 / 2) y la competencia adicional por categoría.
 */
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ALL_SKILLS, ALL_TOOLS, COMPETENCIA_ADICIONAL_CATEGORIAS } from './cultureEditorConstants';

export const CompetenciesSection = ({ formData, handleChange, toggleArrayItem }) => (
  <div className="space-y-4">
    <div>
      <Label className="mb-2 block">Competencias en Habilidades (automáticas)</Label>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {ALL_SKILLS.map(skill => (
          <div key={skill} className="flex items-center gap-2">
            <Checkbox
              checked={formData.competencias_habilidades?.includes(skill)}
              onCheckedChange={() => toggleArrayItem('competencias_habilidades', skill)}
            />
            <Label className="text-xs">{skill}</Label>
          </div>
        ))}
      </div>
    </div>

    <div>
      <Label className="mb-2 block">Habilidades a Elegir</Label>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {ALL_SKILLS.map(skill => (
          <div key={`choose-${skill}`} className="flex items-center gap-2">
            <Checkbox
              checked={formData.competencia_habilidad_elegir?.includes(skill)}
              onCheckedChange={() => toggleArrayItem('competencia_habilidad_elegir', skill)}
            />
            <Label className="text-xs">{skill}</Label>
          </div>
        ))}
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Label className="text-sm mb-2 block">Herramientas (Opción 1)</Label>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {ALL_TOOLS.map(tool => (
            <div key={`t1-${tool}`} className="flex items-center gap-1">
              <Checkbox
                checked={formData.competencia_herramienta_elegir_1?.includes(tool)}
                onCheckedChange={() => toggleArrayItem('competencia_herramienta_elegir_1', tool)}
              />
              <Label className="text-xs">{tool}</Label>
            </div>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-sm mb-2 block">Herramientas (Opción 2)</Label>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {ALL_TOOLS.map(tool => (
            <div key={`t2-${tool}`} className="flex items-center gap-1">
              <Checkbox
                checked={formData.competencia_herramienta_elegir_2?.includes(tool)}
                onCheckedChange={() => toggleArrayItem('competencia_herramienta_elegir_2', tool)}
              />
              <Label className="text-xs">{tool}</Label>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="border border-border/30 rounded-lg p-3">
      <Label className="mb-2 block">Competencia Adicional (Herramientas/Juegos/Instrumentos/Pipa)</Label>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Categoría</Label>
          <Select
            value={formData.competencia_adicional_categoria || 'none'}
            onValueChange={(v) => {
              handleChange('competencia_adicional_categoria', v === 'none' ? '' : v);
              handleChange('competencia_adicional', '');
            }}
          >
            <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin competencia adicional</SelectItem>
              {COMPETENCIA_ADICIONAL_CATEGORIAS.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {formData.competencia_adicional_categoria && formData.competencia_adicional_categoria !== 'pipa' && (
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Elemento específico</Label>
            <Select
              value={formData.competencia_adicional || 'none'}
              onValueChange={(v) => handleChange('competencia_adicional', v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">A elegir por el jugador</SelectItem>
                {COMPETENCIA_ADICIONAL_CATEGORIAS
                  .find(c => c.value === formData.competencia_adicional_categoria)?.items
                  .map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        )}
        {formData.competencia_adicional_categoria === 'pipa' && (
          <div className="flex items-center">
            <span className="text-sm text-[hsl(var(--gold))]">✓ Competencia en Pipa</span>
          </div>
        )}
      </div>
      {formData.competencia_adicional_categoria && (
        <p className="text-xs text-muted-foreground mt-2">
          Competencia seleccionada: <span className="text-[hsl(var(--gold))]">
            {formData.competencia_adicional_categoria === 'pipa'
              ? 'Pipa'
              : formData.competencia_adicional || `${COMPETENCIA_ADICIONAL_CATEGORIAS.find(c => c.value === formData.competencia_adicional_categoria)?.label} (a elegir)`}
          </span>
        </p>
      )}
    </div>
  </div>
);

export default CompetenciesSection;
