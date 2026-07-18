/**
 * Step 5: Virtue Selection
 * Disponible para culturas con tiene_virtud_inicial=true
 * Usa el endpoint /api/data/cultures/{id}/virtues para obtener virtudes disponibles
 * según la configuración de la cultura (propias, copiadas, comunes)
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, ChevronLeft, Star, Sparkles, AlertCircle, Shield, Heart, Swords, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import api from '@/services/api';

const Step5Virtue = ({ draftId, draft, onComplete, onBack }) => {
  const [virtues, setVirtues] = useState([]);
  const [selectedVirtue, setSelectedVirtue] = useState(null);
  const [chosenChar, setChosenChar] = useState('');
  const [chosenSkill, setChosenSkill] = useState('');
  const [chosenSave, setChosenSave] = useState('');
  const [chosenTool, setChosenTool] = useState('');
  // MAESTRÍA: pericia (doble competencia) en una habilidad/herramienta existente
  const [chosenPericia, setChosenPericia] = useState('');
  // PERFECCIONAMIENTO: modo (+2 a una | +1 a dos) y características elegidas
  const [perfMode, setPerfMode] = useState('one'); // 'one' = +2 a una, 'two' = +1 a dos
  const [perfStats, setPerfStats] = useState([]); // p.ej. ['inteligencia'] o ['fuerza','destreza']

  // Habilidades y herramientas que el personaje YA domina (para la Pericia de Maestría).
  const existingProficiencies = useMemo(() => {
    const skills = (draft?.habilidades_competencia || [])
      .concat(draft?.habilidades_elegidas_ocupacion || [])
      .concat(draft?.competencias_habilidades_trasfondo || []);
    const tools = (draft?.herramientas_elegidas_ocupacion || [])
      .concat(draft?.competencias_trasfondo?.herramientas || []);
    const all = [...skills, ...tools].filter(Boolean);
    // Únicos preservando orden
    const seen = new Set();
    return all.filter((s) => {
      const k = String(s).toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [draft]);

  const STAT_LABELS = [
    { key: 'fuerza', label: 'FUERZA' },
    { key: 'destreza', label: 'DESTREZA' },
    { key: 'constitucion', label: 'CONSTITUCIÓN' },
    { key: 'inteligencia', label: 'INTELIGENCIA' },
    { key: 'sabiduria', label: 'SABIDURÍA' },
    { key: 'carisma', label: 'CARISMA' },
  ];
  const baseAttrs = draft?.caracteristicas || draft?.atributos_finales || {};

  const togglePerfStat = (key) => {
    setPerfStats((prev) => {
      if (perfMode === 'one') return prev[0] === key ? [] : [key];
      // modo dos: máximo 2, sin repetir
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return prev;
      return [...prev, key];
    });
  };

  // Al elegir una virtud: reinicia elecciones y auto-selecciona las que solo
  // tienen una opción (no hay nada que elegir).
  const selectVirtue = (v) => {
    setSelectedVirtue(v);
    const chars = v.caracteristicas_elegir || [];
    const skills = v.competencias_habilidades_elegir || [];
    const saves = v.salvaciones_elegir || [];
    const tools = v.competencias_herramientas_elegir || [];
    setChosenChar(chars.length === 1 ? chars[0] : '');
    setChosenSkill(skills.length === 1 ? skills[0] : '');
    setChosenSave(saves.length === 1 ? saves[0] : '');
    setChosenTool(tools.length === 1 ? tools[0] : '');
    setChosenPericia('');
    setPerfMode('one');
    setPerfStats([]);
  };
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [cultureVirtueConfig, setCultureVirtueConfig] = useState(null);

  // Verificar si la cultura tiene derecho a virtud usando el campo de la BD
  const cultureHasVirtue = draft?.tiene_virtud_inicial === true;

  // Load virtues for culture using the new endpoint
  useEffect(() => {
    const loadVirtues = async () => {
      if (!draft?.cultura_id || !cultureHasVirtue) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Use the new endpoint that returns virtues based on culture configuration
        const response = await api.get(`/data/cultures/${draft.cultura_id}/virtues`);
        setVirtues(response.data.virtues || []);
        setCultureVirtueConfig({
          permite_comunes: response.data.permite_virtudes_comunes,
          culture_name: response.data.culture_name
        });
      } catch (err) {
        console.error('Error loading virtues:', err);
        setError('No se pudieron cargar las virtudes');
      } finally {
        setLoading(false);
      }
    };
    loadVirtues();
  }, [draft?.cultura_id, cultureHasVirtue]);

  // Handle submit - save all virtue data
  const handleSubmit = async () => {
    if (!selectedVirtue) return;

    // Definido FUERA del try para que el catch pueda referenciarlo en logs.
    const virtueData = {
      virtud_id: selectedVirtue.id,
      virtud_nombre: selectedVirtue.nombre,
      virtud_descripcion: selectedVirtue.descripcion,
      virtud_rasgos: selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto,
      virtud_caracteristicas_fijas: selectedVirtue.caracteristicas_fijas || {},
      // Enviamos la ELECCIÓN concreta del jugador (no todas las opciones).
      virtud_caracteristicas_elegir: chosenChar ? [chosenChar] : [],
      virtud_salvaciones_elegir: chosenSave ? [chosenSave] : [],
      virtud_pg_extra: selectedVirtue.puntos_golpe_extra || 0,
      virtud_comunidad_extra: selectedVirtue.puntos_comunidad_extra || 0,
      virtud_ca_extra: selectedVirtue.clase_armadura_extra || 0,
      virtud_habilidades_elegir: chosenSkill ? [chosenSkill] : [],
      virtud_herramientas_elegir: chosenTool ? [chosenTool] : [],
      // MAESTRÍA: pericia elegida (habilidad/herramienta existente)
      virtud_pericia_elegida: selectedVirtue.otorga_pericia && chosenPericia ? chosenPericia : null,
      // PERFECCIONAMIENTO: {atributo: +N}
      virtud_perfeccionamiento: selectedVirtue.perfeccionamiento
        ? perfStats.reduce((acc, k) => { acc[k] = perfMode === 'one' ? 2 : 1; return acc; }, {})
        : {},
    };

    try {
      setSaving(true);
      // URL correcta: /api/characters/draft/{id}/step5 (no /api/draft/...)
      const response = await api.patch(`/characters/draft/${draftId}/step5`, virtueData);
      onComplete(response.data);
    } catch (err) {
      // Extraer detalle del backend para depurar (404 virtud / 404 draft / 422 validación)
      const detail = err?.response?.data?.detail || err?.response?.data?.message || err?.message || '';
      const status = err?.response?.status;
      console.error('Error saving step 5:', { status, detail, payload: virtueData });
      const friendly = status === 404
        ? `No se encontró ${detail.toLowerCase().includes('draft') ? 'el borrador' : 'la virtud'} en la BD. Recarga la página.`
        : status === 422
        ? `Datos inválidos: ${detail}`
        : `No se pudo guardar la virtud${detail ? ': ' + detail : ''}`;
      setError(friendly);
    } finally {
      setSaving(false);
    }
  };

  // Si la cultura no tiene virtud, mostrar mensaje y permitir continuar
  if (!cultureHasVirtue) {
    return (
      <div className="space-y-8" data-testid="step-5-virtue-skip">
        <div className="text-center">
          <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
            Virtudes
          </h2>
        </div>

        <div className="card-parchment rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-[hsl(var(--gold))] mx-auto mb-4" />
          <h3 className="font-heading text-xl text-foreground mb-2">
            Tu cultura no obtiene virtud inicial
          </h3>
          <p className="text-muted-foreground mb-4">
            La cultura <span className="text-[hsl(var(--gold))]">{draft?.cultura_nombre}</span> no 
            tiene acceso a virtudes al nivel 1 según su configuración.
          </p>
          <p className="text-sm text-muted-foreground">
            Podrás obtener virtudes más adelante al subir de nivel.
          </p>
        </div>

        <div className="flex justify-between pt-4 pb-16">
          <Button
            variant="ghost"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Atrás
          </Button>
          <Button
            onClick={() => onComplete({ ...draft, paso_actual: 6 })}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          >
            Continuar sin Virtud
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card-parchment rounded-lg p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  // Render a virtue card with all its bonuses
  const renderVirtueCard = (virtue) => {
    const isSelected = selectedVirtue?.id === virtue.id;
    
    // Check for various bonuses
    const hasCharBonus = virtue.caracteristicas_fijas && 
      Object.values(virtue.caracteristicas_fijas).some(v => v !== 0);
    const hasCharChoice = virtue.caracteristicas_elegir?.length > 0;
    const hasPgBonus = virtue.puntos_golpe_extra > 0;
    const hasCaBonus = virtue.clase_armadura_extra > 0;
    const hasCommunityBonus = virtue.puntos_comunidad_extra > 0;
    const hasSkillChoice = virtue.competencias_habilidades_elegir?.length > 0;
    const hasSaveChoice = virtue.salvaciones_elegir?.length > 0;

    return (
      <button
        key={virtue.id}
        onClick={() => selectVirtue(virtue)}
        className={cn(
          'selection-card rounded-lg p-4 text-left h-full transition-all',
          isSelected && 'selected ring-2 ring-[hsl(var(--gold))]'
        )}
        data-testid={`virtue-${virtue.id}`}
      >
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-heading text-lg text-foreground flex items-center gap-2">
            {virtue.es_comun || virtue.tipo === 'COMUNES' ? (
              <Star className="w-4 h-4 text-[hsl(var(--gold))]" />
            ) : (
              <Sparkles className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
            )}
            {virtue.nombre}
          </h4>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {virtue.descripcion?.substring(0, 100)}...
        </p>

        {/* Bonus indicators */}
        <div className="flex flex-wrap gap-1">
          {hasCharBonus && (
            <span className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded flex items-center gap-1">
              <Brain className="w-3 h-3" /> Características
            </span>
          )}
          {hasPgBonus && (
            <span className="text-xs bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] px-2 py-0.5 rounded flex items-center gap-1">
              <Heart className="w-3 h-3" /> +{virtue.puntos_golpe_extra} PG
            </span>
          )}
          {hasCaBonus && (
            <span className="text-xs bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] px-2 py-0.5 rounded flex items-center gap-1">
              <Shield className="w-3 h-3" /> +{virtue.clase_armadura_extra} CA
            </span>
          )}
          {hasSkillChoice && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded flex items-center gap-1">
              <Swords className="w-3 h-3" /> Competencias
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-8" data-testid="step-5-virtue">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Elige tu Virtud
        </h2>
        <p className="text-muted-foreground">
          Como <span className="text-[hsl(var(--gold))]">{draft?.cultura_nombre}</span>, obtienes una virtud al nivel 1
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
            <span className="font-heading text-xl text-[hsl(var(--gold))]">
              {draft?.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
            <p className="text-sm text-muted-foreground">
              {draft?.cultura_nombre} · {draft?.vocacion_nombre || draft?.ocupacion_nombre} · {draft?.trasfondo_nombre}
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[hsl(var(--magic-blue))/10] border border-[hsl(var(--magic-blue))/30] rounded-lg p-4">
        <p className="text-sm text-[hsl(var(--magic-blue))]">
          <Sparkles className="w-4 h-4 inline mr-2" />
          Tienes <span className="font-bold">{virtues.length}</span> virtudes disponibles según la configuración de tu cultura.
          {cultureVirtueConfig?.permite_comunes && (
            <span className="ml-1">(incluye virtudes comunes)</span>
          )}
        </p>
      </div>

      {/* Virtues Grid */}
      <div className="card-parchment rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Selecciona una virtud para tu personaje:
        </p>
        <ScrollArea className="h-[350px] pr-4">
          <div className="grid md:grid-cols-2 gap-4">
            {virtues.map(renderVirtueCard)}
          </div>
          {virtues.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay virtudes disponibles para esta cultura.
              Contacta al administrador para configurar las virtudes.
            </p>
          )}
        </ScrollArea>
      </div>

      {/* Selected Virtue Detail */}
      {selectedVirtue && (
        <div className="card-parchment rounded-lg p-6 border-2 border-[hsl(var(--gold))/50] animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            {selectedVirtue.es_comun || selectedVirtue.tipo === 'COMUNES' ? (
              <Star className="w-6 h-6 text-[hsl(var(--gold))]" />
            ) : (
              <Sparkles className="w-6 h-6 text-[hsl(var(--magic-blue))]" />
            )}
            <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
              {selectedVirtue.nombre}
            </h3>
          </div>
          
          <p className="text-muted-foreground mb-4">
            {selectedVirtue.descripcion}
          </p>

          {/* Rasgos de la virtud */}
          {(selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto) && (
            <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-4">
              <h4 className="text-sm font-heading text-[hsl(var(--gold))] mb-2">
                Efectos y Rasgos
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {selectedVirtue.rasgos_virtud || selectedVirtue.competencias_texto}
              </p>
            </div>
          )}

          {/* Bonuses Grid */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Fixed Characteristics */}
            {selectedVirtue.caracteristicas_fijas && 
             Object.values(selectedVirtue.caracteristicas_fijas).some(v => v !== 0) && (
              <div className="bg-[hsl(var(--magic-blue))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--magic-blue))] mb-2">
                  Bonificadores Fijos
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedVirtue.caracteristicas_fijas)
                    .filter(([, val]) => val !== 0)
                    .map(([attr, val]) => (
                      <span
                        key={attr}
                        className="text-sm bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-1 rounded"
                      >
                        {attr.charAt(0).toUpperCase() + attr.slice(1)}: +{val}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Characteristics to Choose (selector) */}
            {selectedVirtue.caracteristicas_elegir?.length > 0 && (
              <div className="bg-[hsl(var(--torch-orange))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--torch-orange))] mb-2">
                  Característica a Elegir (+1){selectedVirtue.caracteristicas_elegir.length > 1 ? ' — elige una' : ''}
                </h4>
                <div className="flex flex-wrap gap-2" data-testid="virtue-char-choices">
                  {selectedVirtue.caracteristicas_elegir.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setChosenChar(opt)}
                      className={cn(
                        'text-sm px-3 py-1.5 rounded border transition-colors',
                        chosenChar === opt
                          ? 'bg-[hsl(var(--torch-orange))] text-black border-[hsl(var(--torch-orange))] font-bold'
                          : 'border-[hsl(var(--torch-orange))/40] text-[hsl(var(--torch-orange))] hover:bg-[hsl(var(--torch-orange))/20]'
                      )}
                      data-testid={`virtue-char-${opt}`}
                    >
                      +1 {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Extra HP */}
            {selectedVirtue.puntos_golpe_extra > 0 && (
              <div className="bg-red-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-red-400 mb-2">
                  Puntos de Golpe Extra
                </h4>
                <p className="text-lg font-bold text-red-400">
                  +{selectedVirtue.puntos_golpe_extra} PG
                </p>
              </div>
            )}

            {/* Extra AC */}
            {selectedVirtue.clase_armadura_extra > 0 && (
              <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3">
                <h4 className="text-xs font-heading text-[hsl(var(--gold))] mb-2">
                  Clase de Armadura Extra
                </h4>
                <p className="text-lg font-bold text-[hsl(var(--gold))]">
                  +{selectedVirtue.clase_armadura_extra} CA
                </p>
              </div>
            )}

            {/* Community Points */}
            {selectedVirtue.puntos_comunidad_extra > 0 && (
              <div className="bg-green-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-green-400 mb-2">
                  Puntos de Comunidad Extra
                </h4>
                <p className="text-lg font-bold text-green-400">
                  +{selectedVirtue.puntos_comunidad_extra}
                </p>
              </div>
            )}

            {/* Saving Throws to Choose (selector) */}
            {selectedVirtue.salvaciones_elegir?.length > 0 && (
              <div className="bg-purple-500/10 rounded-lg p-3">
                <h4 className="text-xs font-heading text-purple-400 mb-2">
                  Competencia en Salvación{selectedVirtue.salvaciones_elegir.length > 1 ? ' — elige una' : ''}
                </h4>
                <div className="flex flex-wrap gap-2" data-testid="virtue-save-choices">
                  {selectedVirtue.salvaciones_elegir.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setChosenSave(opt)}
                      className={cn(
                        'text-sm px-3 py-1.5 rounded border transition-colors',
                        chosenSave === opt
                          ? 'bg-purple-500 text-white border-purple-500 font-bold'
                          : 'border-purple-400/40 text-purple-300 hover:bg-purple-500/20'
                      )}
                      data-testid={`virtue-save-${opt}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skills to Choose (selector) */}
            {selectedVirtue.competencias_habilidades_elegir?.length > 0 && (
              <div className="bg-cyan-500/10 rounded-lg p-3 md:col-span-2">
                <h4 className="text-xs font-heading text-cyan-400 mb-2">
                  Competencia en Habilidad{selectedVirtue.competencias_habilidades_elegir.length > 1 ? ' — elige una' : ''}
                </h4>
                <div className="flex flex-wrap gap-2" data-testid="virtue-skill-choices">
                  {selectedVirtue.competencias_habilidades_elegir.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setChosenSkill(opt)}
                      className={cn(
                        'text-sm px-3 py-1.5 rounded border transition-colors',
                        chosenSkill === opt
                          ? 'bg-cyan-500 text-white border-cyan-500 font-bold'
                          : 'border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20'
                      )}
                      data-testid={`virtue-skill-${opt}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tools to Choose (selector) */}
            {selectedVirtue.competencias_herramientas_elegir?.length > 0 && (
              <div className="bg-amber-500/10 rounded-lg p-3 md:col-span-2">
                <h4 className="text-xs font-heading text-amber-400 mb-2">
                  Competencia en Herramienta{selectedVirtue.competencias_herramientas_elegir.length > 1 ? ' — elige una' : ''}
                </h4>
                <div className="flex flex-wrap gap-2" data-testid="virtue-tool-choices">
                  {selectedVirtue.competencias_herramientas_elegir.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setChosenTool(opt)}
                      className={cn(
                        'text-sm px-3 py-1.5 rounded border transition-colors',
                        chosenTool === opt
                          ? 'bg-amber-500 text-black border-amber-500 font-bold'
                          : 'border-amber-400/40 text-amber-300 hover:bg-amber-500/20'
                      )}
                      data-testid={`virtue-tool-${opt}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* MAESTRÍA — Pericia en habilidad/herramienta existente */}
            {selectedVirtue.otorga_pericia && (
              <div className="bg-blue-500/10 rounded-lg p-3 md:col-span-2 border border-blue-500/30">
                <h4 className="text-xs font-heading text-blue-300 mb-2 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Pericia — elige una habilidad o herramienta que ya domines (doble competencia)
                </h4>
                {existingProficiencies.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aún no tienes habilidades/herramientas registradas. Podrás asignar la Pericia más adelante.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2" data-testid="virtue-pericia-choices">
                    {existingProficiencies.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setChosenPericia(opt)}
                        className={cn(
                          'text-sm px-3 py-1.5 rounded border transition-colors',
                          chosenPericia === opt
                            ? 'bg-blue-500 text-white border-blue-500 font-bold'
                            : 'border-blue-400/40 text-blue-300 hover:bg-blue-500/20'
                        )}
                        data-testid={`virtue-pericia-${opt}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PERFECCIONAMIENTO — +2 a una o +1 a dos (máx 20) */}
            {selectedVirtue.perfeccionamiento && (
              <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3 md:col-span-2 border border-[hsl(var(--gold))/30]">
                <h4 className="text-xs font-heading text-[hsl(var(--gold))] mb-2">
                  Perfeccionamiento — mejora tus características (máx 20)
                </h4>
                <div className="flex gap-2 mb-3" data-testid="virtue-perf-mode">
                  <button
                    onClick={() => { setPerfMode('one'); setPerfStats([]); }}
                    className={cn('text-xs px-3 py-1.5 rounded border transition-colors',
                      perfMode === 'one' ? 'bg-[hsl(var(--gold))] text-black border-[hsl(var(--gold))] font-bold'
                        : 'border-[hsl(var(--gold))/40] text-[hsl(var(--gold))]')}
                    data-testid="virtue-perf-mode-one"
                  >
                    +2 a una característica
                  </button>
                  <button
                    onClick={() => { setPerfMode('two'); setPerfStats([]); }}
                    className={cn('text-xs px-3 py-1.5 rounded border transition-colors',
                      perfMode === 'two' ? 'bg-[hsl(var(--gold))] text-black border-[hsl(var(--gold))] font-bold'
                        : 'border-[hsl(var(--gold))/40] text-[hsl(var(--gold))]')}
                    data-testid="virtue-perf-mode-two"
                  >
                    +1 a dos características
                  </button>
                </div>
                <div className="flex flex-wrap gap-2" data-testid="virtue-perf-stats">
                  {STAT_LABELS.map(({ key, label }) => {
                    const cur = baseAttrs[key] ?? 10;
                    const inc = perfMode === 'one' ? 2 : 1;
                    const selected = perfStats.includes(key);
                    const wouldExceed = cur + inc > 20;
                    const disabled = (!selected && wouldExceed) ||
                      (!selected && perfMode === 'two' && perfStats.length >= 2);
                    return (
                      <button
                        key={key}
                        disabled={disabled}
                        onClick={() => togglePerfStat(key)}
                        className={cn('text-sm px-3 py-1.5 rounded border transition-colors',
                          selected ? 'bg-[hsl(var(--gold))] text-black border-[hsl(var(--gold))] font-bold'
                            : 'border-[hsl(var(--gold))/40] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))/20]',
                          disabled && 'opacity-40 cursor-not-allowed')}
                        data-testid={`virtue-perf-${key}`}
                      >
                        +{inc} {label} <span className="opacity-60">({cur}→{Math.min(20, cur + inc)})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
          data-testid="step-5-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedVirtue || saving || (selectedVirtue && (
            ((selectedVirtue.caracteristicas_elegir?.length || 0) > 1 && !chosenChar) ||
            ((selectedVirtue.salvaciones_elegir?.length || 0) > 1 && !chosenSave) ||
            ((selectedVirtue.competencias_habilidades_elegir?.length || 0) > 1 && !chosenSkill) ||
            ((selectedVirtue.competencias_herramientas_elegir?.length || 0) > 1 && !chosenTool) ||
            (selectedVirtue.otorga_pericia && existingProficiencies.length > 0 && !chosenPericia) ||
            (selectedVirtue.perfeccionamiento && (perfMode === 'one' ? perfStats.length !== 1 : perfStats.length !== 2))
          ))}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-5-next-btn"
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

export default Step5Virtue;
