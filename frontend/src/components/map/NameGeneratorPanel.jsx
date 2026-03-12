/**
 * Name Generator Panel
 * Generates Middle-earth settlement names based on region and race
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw, Copy, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

// Race icons
const RACE_ICONS = {
  humano: '👤',
  elfico: '🧝',
  enano: '⛏️',
  orco: '👹',
  hobbit: '🍃'
};

const NameGeneratorPanel = ({ isVisible, onClose, onSelectName }) => {
  const [regions, setRegions] = useState({});
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedRace, setSelectedRace] = useState('');
  const [cantidad, setCantidad] = useState(10);
  const [generatedNames, setGeneratedNames] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedName, setCopiedName] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load available regions
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const res = await api.get('/names/regions');
        setRegions(res.data);
        // Select first region by default
        const firstRegion = Object.keys(res.data)[0];
        if (firstRegion) {
          setSelectedRegion(firstRegion);
          const firstRace = Object.keys(res.data[firstRegion].razas)[0];
          if (firstRace) setSelectedRace(firstRace);
        }
      } catch (err) {
        console.error('Error loading regions:', err);
      }
    };
    if (isVisible) loadRegions();
  }, [isVisible]);

  // Update available races when region changes
  useEffect(() => {
    if (selectedRegion && regions[selectedRegion]) {
      const races = Object.keys(regions[selectedRegion].razas);
      if (races.length > 0 && !races.includes(selectedRace)) {
        setSelectedRace(races[0]);
      }
    }
  }, [selectedRegion, regions, selectedRace]);

  const generateNames = async () => {
    if (!selectedRegion || !selectedRace) return;
    
    setIsGenerating(true);
    try {
      const res = await api.post('/names/generate', {
        region: selectedRegion,
        raza: selectedRace,
        cantidad: cantidad
      });
      setGeneratedNames(res.data.nombres || []);
    } catch (err) {
      console.error('Error generating names:', err);
      toast.error('Error al generar nombres');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyName = (name) => {
    navigator.clipboard.writeText(name);
    setCopiedName(name);
    toast.success(`"${name}" copiado`);
    setTimeout(() => setCopiedName(null), 2000);
  };

  const selectName = (name) => {
    if (onSelectName) {
      onSelectName(name);
      toast.success(`Nombre "${name}" seleccionado`);
    }
  };

  if (!isVisible) return null;

  const availableRaces = selectedRegion && regions[selectedRegion] 
    ? regions[selectedRegion].razas 
    : {};

  return (
    <Card className="absolute top-4 right-4 w-[400px] bg-black/90 border-[hsl(var(--gold))/30] z-50 max-h-[90vh] overflow-hidden flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Generador de Nombres
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Genera nombres de poblaciones estilo Tolkien
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4 overflow-y-auto flex-1">
        {/* Region selector */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Región</label>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecciona región" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(regions).map(([key, data]) => (
                  <SelectItem key={key} value={key}>
                    {data.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Raza</label>
            <Select value={selectedRace} onValueChange={setSelectedRace}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecciona raza" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(availableRaces).map(([key, name]) => (
                  <SelectItem key={key} value={key}>
                    {RACE_ICONS[key] || '🏷️'} {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cantidad selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Cantidad:</label>
          <div className="flex gap-1">
            {[5, 10, 20, 50].map(num => (
              <Button
                key={num}
                variant={cantidad === num ? "default" : "outline"}
                size="sm"
                onClick={() => setCantidad(num)}
                className={`h-7 px-2 text-xs ${cantidad === num ? 'bg-[hsl(var(--gold))] text-black' : ''}`}
              >
                {num}
              </Button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button
          onClick={generateNames}
          disabled={isGenerating || !selectedRegion || !selectedRace}
          className="w-full bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generar {cantidad} Nombres
            </>
          )}
        </Button>

        {/* Generated names */}
        {generatedNames.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[hsl(var(--gold))]">
                Nombres Generados ({generatedNames.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="h-6 px-2 text-xs"
              >
                {showDetails ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                {showDetails ? 'Ocultar' : 'Detalles'}
              </Button>
            </div>
            
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {generatedNames.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-secondary/30 hover:bg-secondary/50 group"
                >
                  <div className="flex-1">
                    <span className="font-heading text-foreground">{item.nombre}</span>
                    {showDetails && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-blue-400">{item.prefijo}</span>
                        <span className="text-green-400"> + {item.raiz}</span>
                        <span className="text-purple-400"> + {item.sufijo}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyName(item.nombre)}
                      className="h-7 px-2"
                      title="Copiar"
                    >
                      {copiedName === item.nombre ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    {onSelectName && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectName(item.nombre)}
                        className="h-7 px-2 text-[hsl(var(--gold))]"
                        title="Usar este nombre"
                      >
                        Usar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
          <p className="mb-1">
            <strong>Estructura:</strong> Prefijo + Raíz + Sufijo
          </p>
          <p>
            Cada región tiene estilos únicos adaptados a las razas que la habitan,
            siguiendo el estilo de J.R.R. Tolkien.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NameGeneratorPanel;
