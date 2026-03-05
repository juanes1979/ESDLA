/**
 * Virtues Section Component
 * Displays and manages cultural virtues (special abilities by culture)
 */
import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const STAT_COLORS = {
  FUE: 'bg-red-500/20 text-red-400',
  DES: 'bg-green-500/20 text-green-400', 
  CON: 'bg-orange-500/20 text-orange-400',
  INT: 'bg-blue-500/20 text-blue-400',
  SAB: 'bg-purple-500/20 text-purple-400',
  CAR: 'bg-pink-500/20 text-pink-400'
};

const VirtuesSection = ({ 
  data = [], 
  isAdmin = false, 
  searchTerm = '',
  onRefresh,
  onEdit,
  onDelete 
}) => {
  const [expandedCulture, setExpandedCulture] = useState(null);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!data?.length) return [];
    if (!searchTerm) return data;
    
    const term = searchTerm.toLowerCase();
    return data.filter(v => 
      v.nombre?.toLowerCase().includes(term) ||
      v.cultura?.toLowerCase().includes(term) ||
      v.descripcion?.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  // Group virtues by culture
  const groupedVirtues = useMemo(() => {
    const grouped = {};
    filteredData.forEach(v => {
      const cult = v.cultura || 'Comunes';
      if (!grouped[cult]) grouped[cult] = [];
      grouped[cult].push(v);
    });
    // Sort cultures alphabetically, but put "Comunes" at the end
    const sorted = Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'Comunes') return 1;
      if (b === 'Comunes') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [filteredData]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar la virtud "${name}"?`)) return;
    
    try {
      await api.delete(`/data/virtues/${id}`);
      toast.success(`Virtud "${name}" eliminada`);
      onRefresh?.();
    } catch (err) {
      toast.error('Error al eliminar la virtud');
    }
  };

  if (!data?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No hay virtudes cargadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="virtues-section">
      {/* Admin button */}
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => onEdit?.(null)} className="btn-fantasy">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Virtud
          </Button>
        </div>
      )}

      {/* Stats summary */}
      <div className="bg-black/20 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
        <span className="text-muted-foreground">
          Total: <span className="text-white font-bold">{filteredData.length}</span> virtudes
        </span>
        <span className="text-muted-foreground">
          Culturas: <span className="text-white font-bold">{groupedVirtues.length}</span>
        </span>
      </div>

      {/* Grouped virtues */}
      {groupedVirtues.map(([cultura, virtudes]) => (
        <div 
          key={cultura} 
          className="card-parchment rounded-lg overflow-hidden"
        >
          {/* Culture header */}
          <button
            className="w-full flex justify-between items-center p-4 bg-black/10 hover:bg-black/20 transition-colors"
            onClick={() => setExpandedCulture(expandedCulture === cultura ? null : cultura)}
          >
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[hsl(var(--gold))]" />
              <h3 className="font-heading text-lg text-[hsl(var(--gold))]">{cultura}</h3>
              <span className="text-sm text-muted-foreground">({virtudes.length})</span>
            </div>
            {expandedCulture === cultura ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {/* Virtues list */}
          {expandedCulture === cultura && (
            <div className="p-4 space-y-4">
              {virtudes.map((v, i) => (
                <VirtueCard
                  key={v._id || i}
                  virtue={v}
                  isAdmin={isAdmin}
                  onEdit={() => onEdit?.(v)}
                  onDelete={() => handleDelete(v._id, v.nombre)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Individual virtue card component
const VirtueCard = ({ virtue: v, isAdmin, onEdit, onDelete }) => {
  const hasStatIncreases = v.aumenta_fuerza || v.aumenta_destreza || v.aumenta_constitucion || 
    v.aumenta_inteligencia || v.aumenta_sabiduria || v.aumenta_carisma;

  return (
    <div className="bg-black/10 p-4 rounded border border-border/20">
      {/* Header */}
      <div className="flex justify-between items-start">
        <p className="font-bold text-[hsl(var(--torch-orange))] text-lg">{v.nombre}</p>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Description */}
      {v.descripcion && (
        <p className="text-sm text-muted-foreground mt-2 italic">{v.descripcion}</p>
      )}
      
      {/* Traits to note on sheet */}
      {v.rasgos && (
        <div className="mt-3 p-2 bg-[hsl(var(--magic-blue))/10] rounded">
          <p className="text-xs font-bold text-[hsl(var(--magic-blue))] mb-1">Rasgos a indicar en la ficha:</p>
          <p className="text-sm">{v.rasgos}</p>
        </div>
      )}
      
      {/* Fixed stat increases */}
      {hasStatIncreases && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-[hsl(var(--gold))]">Aumenta en 1:</span>
          {v.aumenta_fuerza && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.FUE}`}>FUE</span>}
          {v.aumenta_destreza && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.DES}`}>DES</span>}
          {v.aumenta_constitucion && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.CON}`}>CON</span>}
          {v.aumenta_inteligencia && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.INT}`}>INT</span>}
          {v.aumenta_sabiduria && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.SAB}`}>SAB</span>}
          {v.aumenta_carisma && <span className={`px-2 py-1 text-xs rounded ${STAT_COLORS.CAR}`}>CAR</span>}
        </div>
      )}
      
      {/* Choose stat to increase */}
      {v.elegir_caracteristica?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-[hsl(var(--torch-orange))]">Elegir +1 en:</span>
          {v.elegir_caracteristica.map((stat, idx) => (
            <span key={idx} className="px-2 py-1 bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] text-xs rounded border border-[hsl(var(--torch-orange))/30]">
              {stat.substring(0, 3)}
            </span>
          ))}
        </div>
      )}
      
      {/* Choose saving throw proficiency */}
      {v.elegir_salvacion?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-[hsl(var(--magic-blue))]">Elegir competencia en salvación:</span>
          {v.elegir_salvacion.map((save, idx) => (
            <span key={idx} className="px-2 py-1 bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-xs rounded border border-[hsl(var(--magic-blue))/30]">
              {save.substring(0, 3)}
            </span>
          ))}
        </div>
      )}
      
      {/* Bonuses */}
      {(v.bonus_puntos_golpe || v.bonus_comunidad || v.bonus_ca) && (
        <div className="mt-3 flex flex-wrap gap-3">
          {v.bonus_puntos_golpe && (
            <span className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded flex items-center gap-1">
              <span className="font-bold">+{v.bonus_puntos_golpe}</span> PG
            </span>
          )}
          {v.bonus_comunidad && (
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
              <span className="font-bold">+{v.bonus_comunidad}</span> Comunidad
            </span>
          )}
          {v.bonus_ca && (
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded flex items-center gap-1">
              <span className="font-bold">+{v.bonus_ca}</span> CA
            </span>
          )}
        </div>
      )}
      
      {/* Choose skill proficiency */}
      {v.elegir_habilidad?.length > 0 && (
        <div className="mt-3 p-2 bg-[hsl(var(--gold))/10] rounded">
          <p className="text-xs font-bold text-[hsl(var(--gold))] mb-1">Elegir competencia en habilidad:</p>
          <div className="flex flex-wrap gap-1">
            {v.elegir_habilidad.map((skill, idx) => (
              <span key={idx} className="px-2 py-1 bg-black/20 text-xs rounded">{skill}</span>
            ))}
          </div>
        </div>
      )}
      
      {/* Choose tool proficiency */}
      {v.elegir_herramienta?.length > 0 && (
        <div className="mt-3 p-2 bg-[hsl(var(--torch-orange))/10] rounded">
          <p className="text-xs font-bold text-[hsl(var(--torch-orange))] mb-1">Elegir competencia en herramienta:</p>
          <div className="flex flex-wrap gap-1">
            {v.elegir_herramienta.map((tool, idx) => (
              <span key={idx} className="px-2 py-1 bg-black/20 text-xs rounded">{tool}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtuesSection;
