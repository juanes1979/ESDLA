/**
 * Name Generator Panel
 * Generates Middle-earth settlement names one at a time with optional AI history
 */
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, RefreshCw, Copy, Check, BookOpen, X, Loader2 } from 'lucide-react';
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

const NameGeneratorPanel = ({ isVisible, onClose, onSelectName, onSelectHistory }) => {
  const [regions, setRegions] = useState({});
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedRace, setSelectedRace] = useState('');
  const [generatedName, setGeneratedName] = useState(null);
  const [generatedHistory, setGeneratedHistory] = useState(null);
  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingHistory, setIsGeneratingHistory] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

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

  // Reset history when name changes
  useEffect(() => {
    setGeneratedHistory(null);
  }, [generatedName]);

  const generateName = async () => {
    if (!selectedRegion || !selectedRace) return;
    
    setIsGeneratingName(true);
    setGeneratedHistory(null);
    try {
      const res = await api.get(`/names/generate-single/${selectedRegion}/${selectedRace}`);
      if (res.data.nombre) {
        setGeneratedName(res.data);
      } else {
        toast.error(res.data.error || 'Error al generar nombre');
      }
    } catch (err) {
      console.error('Error generating name:', err);
      toast.error('Error al generar nombre');
    } finally {
      setIsGeneratingName(false);
    }
  };

  const generateHistory = async () => {
    if (!generatedName?.nombre) return;
    
    setIsGeneratingHistory(true);
    try {
      const res = await api.post('/names/generate-history', {
        nombre: generatedName.nombre,
        region: selectedRegion,
        raza: selectedRace
      });
      if (res.data.historia) {
        setGeneratedHistory(res.data.historia);
      } else {
        toast.error(res.data.error || 'Error al generar historia');
      }
    } catch (err) {
      console.error('Error generating history:', err);
      toast.error('Error al generar historia');
    } finally {
      setIsGeneratingHistory(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`${field === 'nombre' ? 'Nombre' : 'Historia'} copiado`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const useNameAndHistory = () => {
    if (onSelectName && generatedName?.nombre) {
      onSelectName(generatedName.nombre);
    }
    if (onSelectHistory && generatedHistory) {
      onSelectHistory(generatedHistory);
    }
    toast.success('Datos aplicados a la ubicación');
  };

  if (!isVisible) return null;

  const availableRaces = selectedRegion && regions[selectedRegion] 
    ? regions[selectedRegion].razas 
    : {};

  return (
    <Card className="absolute top-4 right-4 w-[420px] bg-black/95 border-[hsl(var(--gold))/30] z-50 max-h-[calc(100%-2rem)] overflow-hidden flex flex-col">
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
          Genera nombres de poblaciones estilo Tolkien con historia opcional
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4 overflow-y-auto flex-1 min-h-0">
        {/* Region and Race selectors */}
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

        {/* Generate Name button */}
        <Button
          onClick={generateName}
          disabled={isGeneratingName || !selectedRegion || !selectedRace}
          className="w-full bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80"
        >
          {isGeneratingName ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {generatedName ? 'Generar Otro Nombre' : 'Generar Nombre'}
            </>
          )}
        </Button>

        {/* Generated Name Display */}
        {generatedName && (
          <div className="space-y-3">
            {/* Name Card */}
            <div className="bg-gradient-to-r from-[hsl(var(--gold))/20] to-transparent rounded-lg p-4 border border-[hsl(var(--gold))/30]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Nombre Generado</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedName.nombre, 'nombre')}
                  className="h-7 px-2"
                >
                  {copiedField === 'nombre' ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
              <h3 className="font-heading text-2xl text-[hsl(var(--gold))] mb-2">
                {generatedName.nombre}
              </h3>
              <div className="text-xs text-muted-foreground">
                <span className="text-blue-400">{generatedName.prefijo}</span>
                <span className="text-white"> + </span>
                <span className="text-green-400">{generatedName.raiz}</span>
                <span className="text-white"> + </span>
                <span className="text-purple-400">{generatedName.sufijo}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {generatedName.region} · {generatedName.raza}
              </div>
            </div>

            {/* Generate History Button */}
            {!generatedHistory && (
              <Button
                onClick={generateHistory}
                disabled={isGeneratingHistory}
                variant="outline"
                className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
              >
                {isGeneratingHistory ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generando historia...
                  </>
                ) : (
                  <>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Generar Historia con IA
                  </>
                )}
              </Button>
            )}

            {/* History Card */}
            {generatedHistory && (
              <div className="bg-gradient-to-r from-purple-500/20 to-transparent rounded-lg p-4 border border-purple-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-purple-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    Historia
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(generatedHistory, 'historia')}
                      className="h-7 px-2"
                    >
                      {copiedField === 'historia' ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={generateHistory}
                      disabled={isGeneratingHistory}
                      className="h-7 px-2"
                      title="Regenerar historia"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingHistory ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground/90 italic leading-relaxed">
                  "{generatedHistory}"
                </p>
              </div>
            )}

            {/* Use Button */}
            {(onSelectName || onSelectHistory) && (
              <Button
                onClick={useNameAndHistory}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Usar {generatedName ? 'Nombre' : ''}{generatedName && generatedHistory ? ' e ' : ''}{generatedHistory ? 'Historia' : ''}
              </Button>
            )}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
          <p className="mb-1">
            <strong>Estructura:</strong> Prefijo + Raíz + Sufijo
          </p>
          <p>
            Genera nombres uno a uno. Puedes añadir una historia breve
            generada por IA para dar contexto a la ubicación.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default NameGeneratorPanel;
