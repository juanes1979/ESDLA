/**
 * Copy Backgrounds Modal - Copy backgrounds between cultures
 */
import { useState, useEffect } from 'react';
import { X, Copy, Loader2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/services/api';

const CopyBackgroundsModal = ({ onClose, onSuccess, groupedData }) => {
  const [cultures, setCultures] = useState([]);
  const [loadingCultures, setLoadingCultures] = useState(true);
  const [copying, setCopying] = useState(false);
  
  // Selection state
  const [selectedBackgrounds, setSelectedBackgrounds] = useState(new Set());
  const [targetCulture, setTargetCulture] = useState('');
  const [sourceCulture, setSourceCulture] = useState('');
  const [copyMode, setCopyMode] = useState('individual'); // 'individual' or 'all'
  
  // UI state
  const [expandedRaces, setExpandedRaces] = useState({});
  const [expandedCultures, setExpandedCultures] = useState({});

  // Load cultures on mount
  useEffect(() => {
    const loadCultures = async () => {
      try {
        const res = await api.get('/data/cultures');
        setCultures(res.data.cultures || []);
      } catch (err) {
        console.error('Error loading cultures:', err);
      } finally {
        setLoadingCultures(false);
      }
    };
    loadCultures();
  }, []);

  const toggleRace = (race) => {
    setExpandedRaces(prev => ({ ...prev, [race]: !prev[race] }));
  };

  const toggleCulture = (culture) => {
    setExpandedCultures(prev => ({ ...prev, [culture]: !prev[culture] }));
  };

  const toggleBackground = (bgId) => {
    setSelectedBackgrounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bgId)) {
        newSet.delete(bgId);
      } else {
        newSet.add(bgId);
      }
      return newSet;
    });
  };

  const selectAllFromCulture = (cultureName, backgrounds) => {
    setSelectedBackgrounds(prev => {
      const newSet = new Set(prev);
      backgrounds.forEach(bg => newSet.add(bg.id));
      return newSet;
    });
  };

  const handleCopy = async () => {
    if (!targetCulture) {
      toast.error('Selecciona una cultura destino');
      return;
    }

    if (copyMode === 'individual' && selectedBackgrounds.size === 0) {
      toast.error('Selecciona al menos un trasfondo');
      return;
    }

    if (copyMode === 'all' && !sourceCulture) {
      toast.error('Selecciona una cultura origen');
      return;
    }

    setCopying(true);
    try {
      const payload = {
        background_ids: copyMode === 'individual' ? Array.from(selectedBackgrounds) : [],
        target_cultura: targetCulture,
        source_cultura: copyMode === 'all' ? sourceCulture : null
      };

      const res = await api.post('/data/backgrounds/copy-to-culture', payload);
      toast.success(res.data.message);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al copiar trasfondos');
    } finally {
      setCopying(false);
    }
  };

  // Get all culture names for the selectors
  const allCultureNames = [];
  Object.values(groupedData).forEach(cultures => {
    Object.keys(cultures).forEach(cultureName => {
      if (!allCultureNames.includes(cultureName)) {
        allCultureNames.push(cultureName);
      }
    });
  });

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-border/50 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">
            Copiar Trasfondos a Otra Cultura
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Mode Selection */}
          <div className="mb-6 p-4 bg-black/20 rounded-lg">
            <Label className="mb-3 block font-heading text-[hsl(var(--gold))]">Modo de Copia</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={copyMode === 'individual'} 
                  onChange={() => setCopyMode('individual')}
                  className="accent-[hsl(var(--gold))]"
                />
                <span>Seleccionar trasfondos individuales</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  checked={copyMode === 'all'} 
                  onChange={() => setCopyMode('all')}
                  className="accent-[hsl(var(--gold))]"
                />
                <span>Copiar todos de una cultura</span>
              </label>
            </div>
          </div>

          {/* Target Culture Selection */}
          <div className="mb-6 p-4 bg-[hsl(var(--gold))/5] border border-[hsl(var(--gold))/30] rounded-lg">
            <Label className="mb-3 block font-heading text-[hsl(var(--gold))]">
              Cultura Destino *
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Los trasfondos se copiarán a esta cultura (no se sobrescribirán los existentes)
            </p>
            {loadingCultures ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Cargando culturas...
              </div>
            ) : (
              <Select value={targetCulture} onValueChange={setTargetCulture}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona cultura destino" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {cultures.map(culture => (
                    <SelectItem key={culture.id} value={culture.nombre}>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{culture.categoria || '?'}</span>
                        <span>→</span>
                        <span>{culture.nombre}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Source Culture (for copy all mode) */}
          {copyMode === 'all' && (
            <div className="mb-6 p-4 bg-blue-500/5 border border-blue-500/30 rounded-lg">
              <Label className="mb-3 block font-heading text-blue-400">
                Cultura Origen *
              </Label>
              <p className="text-xs text-muted-foreground mb-3">
                Se copiarán TODOS los trasfondos de esta cultura
              </p>
              <Select value={sourceCulture} onValueChange={setSourceCulture}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona cultura origen" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {allCultureNames.map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Individual Background Selection */}
          {copyMode === 'individual' && (
            <div className="space-y-3">
              <Label className="block font-heading text-[hsl(var(--gold))]">
                Selecciona Trasfondos ({selectedBackgrounds.size} seleccionados)
              </Label>
              
              {Object.entries(groupedData).map(([race, cultures]) => (
                <div key={race} className="border border-border/30 rounded-lg overflow-hidden">
                  {/* Race Header */}
                  <div 
                    className="flex items-center justify-between p-3 bg-black/20 cursor-pointer"
                    onClick={() => toggleRace(race)}
                  >
                    <span className="font-heading text-[hsl(var(--gold))]">{race}</span>
                    {expandedRaces[race] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  
                  {expandedRaces[race] && (
                    <div className="p-2 space-y-2">
                      {Object.entries(cultures).map(([cultureName, backgrounds]) => (
                        <div key={cultureName} className="bg-black/10 rounded">
                          {/* Culture Header */}
                          <div 
                            className="flex items-center justify-between p-2 cursor-pointer"
                            onClick={() => toggleCulture(cultureName)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedCultures[cultureName] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              <span className="text-sm">{cultureName}</span>
                              <span className="text-xs text-muted-foreground">({backgrounds.length})</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllFromCulture(cultureName, backgrounds);
                              }}
                            >
                              Seleccionar todos
                            </Button>
                          </div>
                          
                          {expandedCultures[cultureName] && (
                            <div className="px-4 pb-2 space-y-1">
                              {backgrounds.map(bg => (
                                <label key={bg.id} className="flex items-center gap-2 cursor-pointer text-sm">
                                  <Checkbox 
                                    checked={selectedBackgrounds.has(bg.id)}
                                    onCheckedChange={() => toggleBackground(bg.id)}
                                  />
                                  <span className={selectedBackgrounds.has(bg.id) ? 'text-[hsl(var(--gold))]' : ''}>
                                    {bg.nombre}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-border/30">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleCopy} 
            disabled={copying || !targetCulture || (copyMode === 'individual' && selectedBackgrounds.size === 0) || (copyMode === 'all' && !sourceCulture)}
            className="bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
          >
            {copying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Copiando...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Trasfondos
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CopyBackgroundsModal;
