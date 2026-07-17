/**
 * Character Summary - Final review before creation
 */
import { useState } from 'react';
import { Loader2, Edit2, Check, User, Sword, Shield, Heart, Star, Crown, ImageIcon, RefreshCw, Dices, X, Plus, Copy, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import api from '@/services/api';
import { pickRandomFacialTraits } from '@/data/facialTraits';

const getModifier = (score) => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const CharacterSummary = ({ draft, onFinalize, onEdit, loading, draftId }) => {
  const [portraitImage, setPortraitImage] = useState(draft?.portrait_image || null);
  const [portraitError, setPortraitError] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [uploadingPortrait, setUploadingPortrait] = useState(false);
  // Rasgos faciales aleatorios (uno por zona) para dar variedad a la imagen.
  const [facialTraits, setFacialTraits] = useState(() => pickRandomFacialTraits());
  const updateTrait = (idx, value) =>
    setFacialTraits((prev) => prev.map((t, i) => (i === idx ? { ...t, value } : t)));
  const removeTrait = (idx) => setFacialTraits((prev) => prev.filter((_, i) => i !== idx));
  const rerollTraits = () => setFacialTraits(pickRandomFacialTraits());
  const addTrait = () =>
    setFacialTraits((prev) => [
      ...prev,
      { id: `extra-${Date.now()}-${Math.floor(Math.random() * 1000)}`, label: 'Rasgo adicional', value: '' },
    ]);

  const portraitPayload = () => ({
    nombre: draft.nombre || '',
    cultura: draft.cultura_nombre || '',
    raza: draft.raza_nombre || draft.cultura_nombre || '',
    vocacion: draft.vocacion_nombre || draft.ocupacion_nombre || '',
    trasfondo: draft.trasfondo_nombre || '',
    edad: draft.edad || null,
    altura_cm: draft.altura_cm || null,
    peso_kg: draft.peso_kg || null,
    color_ojos: draft.color_ojos || draft.ojos || '',
    color_pelo: draft.color_pelo || draft.pelo || '',
    rasgos_fisicos: draft.rasgos_fisicos || '',
    rasgos_faciales: facialTraits.map((t) => t.value).filter(Boolean).join('; '),
    genero: draft.genero || draft.sexo || 'hombre',
  });

  // Genera el PROMPT en español (sin IA, sin créditos) y lo copia al portapapeles.
  const copyPrompt = async () => {
    if (!draft || !draft.nombre) {
      toast.error('Faltan datos del personaje para generar el prompt.');
      return;
    }
    setLoadingPrompt(true);
    try {
      const response = await api.post('/portraits/prompt', portraitPayload());
      const text = response.data?.prompt || '';
      setPromptText(text);
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Prompt copiado al portapapeles');
      } catch {
        toast.info('Prompt generado. Cópialo del recuadro de abajo.');
      }
    } catch (error) {
      toast.error('No se pudo generar el prompt: ' + (error?.response?.data?.detail || error.message));
    } finally {
      setLoadingPrompt(false);
    }
  };

  // Sube un retrato propio (JPG/PNG) y lo asocia al personaje (base64, sin IA).
  const uploadPortrait = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('El archivo debe ser una imagen (JPG o PNG)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen supera el máximo de 10 MB');
      return;
    }
    setPortraitError(null);
    setUploadingPortrait(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPortraitImage(base64);
      if (draftId) {
        try {
          await api.patch(`/characters/draft/${draftId}/portrait`, { portrait_image: base64 });
        } catch (saveError) {
          console.warn('No se pudo guardar el retrato en el draft:', saveError?.response?.status);
        }
      }
      if (draft) draft.portrait_image = base64;
      toast.success('Retrato subido');
    } catch (e) {
      setPortraitError('No se pudo subir la imagen.');
      toast.error('No se pudo subir la imagen.');
    } finally {
      setUploadingPortrait(false);
    }
  };

  if (!draft) return null;

  // Use 'caracteristicas' or 'atributos_finales' (whichever exists)
  const attributes = draft.caracteristicas || draft.atributos_finales || {};

  return (
    <div className="space-y-8" data-testid="character-summary">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Resumen del Personaje
        </h2>
        <p className="text-muted-foreground">
          Revisa los detalles antes de finalizar la creación
        </p>
      </div>

      {/* Main Card */}
      <div className="card-parchment rounded-lg p-6">
        {/* Character Header */}
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-border">
          {/* Portrait Section */}
          <div className="flex flex-col items-center gap-2">
            {portraitImage ? (
              <img 
                src={`data:image/png;base64,${portraitImage}`}
                alt={`Retrato de ${draft.nombre}`}
                className="w-24 h-24 rounded-full object-cover border-2 border-[hsl(var(--gold))]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center border-2 border-[hsl(var(--gold))]">
                <span className="font-heading text-4xl text-[hsl(var(--gold))]">
                  {draft.nombre?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <label className="cursor-pointer" data-testid="summary-portrait-upload-label">
              <input
                type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { uploadPortrait(e.target.files?.[0]); e.target.value = ''; }}
                data-testid="summary-portrait-upload-input"
              />
              <span className="inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 transition-colors">
                {uploadingPortrait ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                {portraitImage ? 'Cambiar' : 'Subir retrato'}
              </span>
            </label>
            {portraitError && (
              <div
                className="text-[10px] text-center text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 max-w-[180px]"
                data-testid="portrait-error"
              >
                {portraitError}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-heading text-3xl text-foreground mb-1">
              {draft.nombre}
            </h1>
            <p className="text-lg text-muted-foreground">
              {draft.cultura_nombre} {draft.vocacion_nombre}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{draft.edad} años</span>
              <span>{draft.altura_cm} cm</span>
              <span>{draft.peso_kg} kg</span>
            </div>
          </div>
        </div>

        {/* Portrait Large View - Only shown when portrait exists */}
        {portraitImage && (
          <div className="mb-6 pb-6 border-b border-border">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Retrato del Personaje
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <img 
                src={`data:image/png;base64,${portraitImage}`}
                alt={`Retrato de ${draft.nombre}`}
                className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-lg border-2 border-[hsl(var(--gold))] shadow-lg"
              />
              <div className="flex flex-col gap-3 text-center md:text-left">
                <p className="text-sm text-muted-foreground italic">
                  Retrato del personaje (imagen propia subida).
                </p>
                <label className="cursor-pointer" data-testid="summary-portrait-change-label">
                  <input
                    type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { uploadPortrait(e.target.files?.[0]); e.target.value = ''; }}
                  />
                  <span className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 transition-colors">
                    {uploadingPortrait ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    Cambiar imagen
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Portrait Section - Copy prompt + upload (sin IA, sin créditos) */}
        <div className="mb-6 pb-6 border-b border-border" data-testid="portrait-prompt-section">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            {portraitImage ? 'Regenerar el retrato' : 'Retrato del Personaje'}
          </h3>
          <div className="bg-black/20 border border-[hsl(var(--gold))]/20 rounded-lg p-6">
            <p className="text-muted-foreground mb-4 text-sm">
              Copia el prompt (reúne cultura, edad, oficio, arma, rasgos faciales…), crea la imagen en
              tu herramienta favorita y súbela. Así no se gastan créditos de IA. Puedes hacerlo ahora o
              más tarde desde la ficha del personaje.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={copyPrompt}
                disabled={loadingPrompt}
                variant="outline"
                className="border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10"
                data-testid="copy-prompt-btn"
              >
                {loadingPrompt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                Copiar prompt para retrato
              </Button>
              <label className="cursor-pointer" data-testid="summary-portrait-upload2-label">
                <input
                  type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { uploadPortrait(e.target.files?.[0]); e.target.value = ''; }}
                />
                <span className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-[hsl(var(--gold))] text-black hover:opacity-90 transition-opacity">
                  {uploadingPortrait ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  Subir retrato (JPG/PNG)
                </span>
              </label>
            </div>
            {promptText && (
              <div className="mt-4">
                <label className="text-xs text-[hsl(var(--gold))]/80">Prompt (edítalo si quieres antes de copiarlo)</label>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={5}
                  className="w-full mt-1 p-3 rounded bg-black/40 border border-border/50 text-sm resize-y"
                  data-testid="portrait-prompt-text"
                />
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { navigator.clipboard?.writeText(promptText); toast.success('Prompt copiado'); }}
                  className="mt-1 text-xs text-[hsl(var(--gold))]"
                  data-testid="copy-prompt-again-btn"
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar de nuevo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Rasgos faciales aleatorios para la IA (editables) */}
        <div className="mb-6 pb-6 border-b border-border" data-testid="facial-traits-box">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-base text-[hsl(var(--gold))] flex items-center gap-2">
              <User className="w-4 h-4" />
              Rasgos faciales para la imagen
            </h3>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline" onClick={addTrait}
                className="text-xs border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10"
                data-testid="facial-traits-add-btn"
              >
                <Plus className="w-3 h-3 mr-1" /> Añadir
              </Button>
              <Button
                size="sm" variant="outline" onClick={rerollTraits}
                className="text-xs border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                data-testid="facial-traits-reroll-btn"
              >
                <Dices className="w-3 h-3 mr-1" /> Aleatorizar
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Se incorporan al prompt del retrato (junto con edad, subcultura, ojos, pelo…) para que los
            personajes no se parezcan. Puedes editar o quitar cualquiera.
          </p>
          <div className="space-y-2">
            {facialTraits.map((t, idx) => (
              <div key={t.id} className="flex items-start gap-2" data-testid={`facial-trait-${t.id}`}>
                <div className="flex-1">
                  <label className="text-[11px] text-[hsl(var(--gold))]/80">{t.label}</label>
                  <input
                    type="text" value={t.value}
                    onChange={(e) => updateTrait(idx, e.target.value)}
                    placeholder="Describe el rasgo (p. ej. cicatriz en la ceja izquierda)"
                    className="w-full p-2 rounded bg-black/30 border border-border/50 text-sm"
                    data-testid={`facial-trait-input-${t.id}`}
                  />
                </div>
                <button
                  onClick={() => removeTrait(idx)}
                  className="mt-5 text-muted-foreground hover:text-red-400"
                  title="Quitar este rasgo"
                  data-testid={`facial-trait-remove-${t.id}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {facialTraits.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Sin rasgos faciales. Pulsa «Aleatorizar» para generar nuevos.
              </p>
            )}
          </div>
        </div>

        {/* Attributes */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Atributos
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'fuerza', name: 'FUE' },
              { key: 'destreza', name: 'DES' },
              { key: 'constitucion', name: 'CON' },
              { key: 'inteligencia', name: 'INT' },
              { key: 'sabiduria', name: 'SAB' },
              { key: 'carisma', name: 'CAR' },
            ].map(attr => (
              <div key={attr.key} className="stat-box p-3 text-center">
                <p className="text-xs text-muted-foreground">{attr.name}</p>
                <p className="stat-value text-xl">{attributes[attr.key] || 10}</p>
                <p className="text-xs text-muted-foreground">
                  ({getModifier(attributes[attr.key] || 10)})
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Combat Stats */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5" />
            Combate
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-box p-3 text-center">
              <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
              <p className="text-xs text-muted-foreground">Puntos de Golpe</p>
              <p className="stat-value">{draft.puntos_golpe_max || 8}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <Shield className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--magic-blue))]" />
              <p className="text-xs text-muted-foreground">Clase de Armadura</p>
              <p className="stat-value">
                {10 + Math.floor(((attributes.destreza || 10) - 10) / 2)}
              </p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Dado de Golpe</p>
              <p className="stat-value text-lg">{draft.dado_golpe || '1d8'}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Velocidad</p>
              <p className="stat-value text-lg">{draft.velocidad || 9}m</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Background & Virtue */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Trasfondo y Virtud
            </h3>
            <div className="space-y-3">
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Trasfondo</p>
                <p className="text-foreground">{draft.trasfondo_nombre}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Virtud</p>
                <p className="text-foreground">{draft.virtud_nombre}</p>
                {draft.rasgos_virtud && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {typeof draft.rasgos_virtud === 'string' 
                      ? draft.rasgos_virtud.substring(0, 100) 
                      : JSON.stringify(draft.rasgos_virtud).substring(0, 100)}...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Skills - Show ALL 19 skills with scores */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Habilidades
            </h3>
            {(() => {
              // All 19 skills in the game with their attribute
              const ALL_SKILLS = [
                { nombre: 'Acertijos', atributo: 'inteligencia' },
                { nombre: 'Acrobacias', atributo: 'destreza' },
                { nombre: 'Atletismo', atributo: 'fuerza' },
                { nombre: 'Cazar', atributo: 'sabiduria' },
                { nombre: 'Engaño', atributo: 'carisma' },
                { nombre: 'Explorar', atributo: 'sabiduria' },
                { nombre: 'Intimidación', atributo: 'carisma' },
                { nombre: 'Investigación', atributo: 'inteligencia' },
                { nombre: 'Juego de manos', atributo: 'destreza' },
                { nombre: 'Percepción', atributo: 'sabiduria' },
                { nombre: 'Perspicacia', atributo: 'sabiduria' },
                { nombre: 'Persuasión', atributo: 'carisma' },
                { nombre: 'Saber antiguo', atributo: 'inteligencia' },
                { nombre: 'Saber de la naturaleza', atributo: 'inteligencia' },
                { nombre: 'Sanación', atributo: 'sabiduria' },
                { nombre: 'Sigilo', atributo: 'destreza' },
                { nombre: 'Supervivencia', atributo: 'sabiduria' },
                { nombre: 'Tradiciones', atributo: 'inteligencia' },
                { nombre: 'Viajar', atributo: 'sabiduria' },
              ];
              
              // Collect all competent skills
              const competentSkillsRaw = [
                ...(draft.competencias_habilidades_cultura || []),
                ...(draft.competencia_habilidad_cultura ? [draft.competencia_habilidad_cultura] : []),
                ...(draft.competencias_herramientas_2 || []),
                ...(draft.competencias_trasfondo?.habilidades || []),
                ...(draft.competencias_habilidades_trasfondo || []),
                ...(draft.habilidades_elegidas_ocupacion || []),
                ...(draft.habilidades_competencia || []),
              ];
              const cleanSkill = (s) => s?.split(' (')[0]?.trim()?.toLowerCase();
              const competentSkills = new Set(competentSkillsRaw.map(cleanSkill).filter(Boolean));
              
              // Expertise skills
              const expertiseSkillsRaw = draft.pericia_elegida || [];
              const expertiseSkills = new Set(expertiseSkillsRaw.map(cleanSkill).filter(Boolean));
              
              // Get attributes and level
              const attrs = draft.caracteristicas || draft.atributos_finales || {};
              const nivel = draft.nivel || 1;
              // Proficiency bonus by level: 1-4 = +2, 5-8 = +3, 9-12 = +4, 13-16 = +5, 17-20 = +6
              const profBonus = Math.ceil(nivel / 4) + 1;
              
              return (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="text-xs text-muted-foreground text-center mb-2">
                    Nivel {nivel} · Bonificador de Competencia: +{profBonus}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ALL_SKILLS.map((skill) => {
                      const attrValue = attrs[skill.atributo] || 10;
                      const attrMod = Math.floor((attrValue - 10) / 2);
                      const isCompetent = competentSkills.has(skill.nombre.toLowerCase());
                      const hasExpertise = expertiseSkills.has(skill.nombre.toLowerCase());
                      
                      let totalMod = attrMod;
                      if (isCompetent) totalMod += profBonus;
                      if (hasExpertise) totalMod += profBonus; // Double proficiency
                      
                      return (
                        <div 
                          key={skill.nombre}
                          className={`p-2 rounded flex justify-between items-center ${
                            hasExpertise 
                              ? 'bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))]'
                              : isCompetent 
                                ? 'bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))]'
                                : 'bg-black/10'
                          }`}
                        >
                          <span className={`text-sm ${isCompetent ? 'font-medium' : 'text-muted-foreground'}`}>
                            {hasExpertise && <Star className="w-3 h-3 inline mr-1 text-[hsl(var(--magic-blue))]" />}
                            {skill.nombre}
                          </span>
                          <span className={`font-heading ${
                            hasExpertise 
                              ? 'text-[hsl(var(--magic-blue))]'
                              : isCompetent 
                                ? 'text-[hsl(var(--gold))]'
                                : 'text-muted-foreground'
                          }`}>
                            {totalMod >= 0 ? '+' : ''}{totalMod}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-muted-foreground justify-center">
                    <span><span className="inline-block w-3 h-3 rounded bg-[hsl(var(--gold))/20] border border-[hsl(var(--gold))] mr-1"></span> Competencia (+{profBonus})</span>
                    <span><span className="inline-block w-3 h-3 rounded bg-[hsl(var(--magic-blue))/20] border border-[hsl(var(--magic-blue))] mr-1"></span> Pericia (+{profBonus * 2})</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Patron */}
        {draft.patron_nombre && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Mecenas
            </h3>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-foreground">{draft.patron_nombre}</p>
              <p className="text-sm text-muted-foreground">
                Puntos de Comunidad: {draft.puntos_comunidad || 0}
              </p>
            </div>
          </div>
        )}

        {/* Personal Details - TWO Distinctive Traits with Descriptions */}
        {(draft.rasgo_distintivo || draft.rasgo_distintivo_2 || draft.motivacion) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Rasgos de Personalidad
            </h3>
            <div className="space-y-3">
              {draft.rasgo_distintivo && (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-[hsl(var(--gold))] mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-heading text-[hsl(var(--gold))]">
                        {typeof draft.rasgo_distintivo === 'object' 
                          ? draft.rasgo_distintivo.nombre 
                          : draft.rasgo_distintivo}
                      </p>
                      {typeof draft.rasgo_distintivo === 'object' && draft.rasgo_distintivo.descripcion && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {draft.rasgo_distintivo.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {(draft.rasgo_distintivo_2 || draft.defecto) && (
                <div className="bg-secondary rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Star className="w-4 h-4 text-[hsl(var(--gold))] mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-heading text-[hsl(var(--gold))]">
                        {typeof (draft.rasgo_distintivo_2 || draft.defecto) === 'object' 
                          ? (draft.rasgo_distintivo_2 || draft.defecto).nombre 
                          : (draft.rasgo_distintivo_2 || draft.defecto)}
                      </p>
                      {typeof (draft.rasgo_distintivo_2 || draft.defecto) === 'object' && (draft.rasgo_distintivo_2 || draft.defecto).descripcion && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          {(draft.rasgo_distintivo_2 || draft.defecto).descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {draft.motivacion && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Motivación</p>
                  <p className="text-sm text-foreground">{draft.motivacion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Complete Equipment Summary with Weight and Encumbrance */}
        <div className="mt-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
            Equipo Completo
          </h3>
          
          {(() => {
            // CORRECT Weight data from Excel (in kg)
            const ITEM_WEIGHTS = {
              // Weapons (from Excel Equipo sheet)
              'daga': 0.45,
              'espada corta': 0.9, 'espada': 0.9,
              'espada larga': 1.35, 'espada ancha': 1.35,
              'hacha de mano': 0.9, 'hacha': 0.9,
              'hacha de guerra': 1.8, 'hacha a dos manos': 3.5, 'gran hacha': 3.15,
              'maza': 1.8, 'martillo': 1.35, 'martillo pesado': 1.8,
              'lanza': 1.35, 'lanza corta': 0.9, 'lanza pesada': 2.7,
              'arco': 0.9, 'arco corto': 0.9, 'arco largo': 1.35,
              'ballesta': 4.5, 'honda': 0,
              'cimitarra': 1.2, 'estoque': 1, 'flajelo': 1.5, 'látigo': 1,
              'piqueta': 4.5,
              // Armor (from Excel)
              'coleto de cuero': 3.6, 'armadura de cuero': 3.6,
              'jubón reforzado': 4.5, 'pieles': 5.4,
              'camisote de mallas': 9,
              'armadura de escamas': 18,
              'cota de anillas': 22.5,
              'cota de mallas': 24.75,
              'loriga de mallas': 27,
              'escudo': 2.7, 'escudo grande': 2.7, 'escudo pequeño': 1.8,
              // General equipment (kg)
              'mochila': 2.25, 'petate': 3.15, 'utensilios de cocina': 3.6, 'útiles de cocina': 3.6,
              'lata de yesca': 0.45,
              'raciones': 0.6, 'raciones (1 día)': 0.6, // Updated as requested
              'antorchas': 0.45, 'odre': 2.25, 
              'cuerda de cáñamo': 4.5, 'cuerda de seda': 2.25, 'cuerda': 4.5,
              'tienda': 9, 'tienda para 2 personas': 9,
              'linterna': 0.9, 'linterna sorda': 0.9, 'aceite': 0.45,
              // Clothing
              'botas de viaje': 1, 'botas de buena piel': 1.2, 'botas de cuero': 1,
              'capa de viaje': 1, 'muda común': 1.5, 'muda de viajero': 2, 'muda fina': 1.8,
              // Tools (kg)
              'herramientas de ladrón': 0.45, 'herramientas de herrero': 3.6, 
              'herramientas de carpintero': 2.7, 'herramientas de curtidor': 2.25,
              'herramientas de alfarero': 1.35, 'herramientas de joyero': 0.9,
              'instrumentos musicales': 1.35,
            };
            
            // Size multiplier for weight (Small = half, Large = double)
            const tamanio = draft.tamanio || 'Mediano';
            const sizeMultiplier = tamanio === 'Pequeño' ? 0.5 : (tamanio === 'Grande' ? 2 : 1);
            
            // Helper to get weight with size adjustment for armor/clothing
            const getItemWeight = (name, isArmorOrClothing = false) => {
              if (!name) return 0;
              const lowerName = name.toLowerCase();
              for (const [key, weight] of Object.entries(ITEM_WEIGHTS)) {
                if (lowerName.includes(key)) {
                  // Apply size multiplier only for armor and clothing
                  return isArmorOrClothing ? weight * sizeMultiplier : weight;
                }
              }
              return 0.25; // Default weight
            };
            
            // Check if item is armor or clothing
            const isArmorOrClothing = (name) => {
              if (!name) return false;
              const lower = name.toLowerCase();
              return lower.includes('armadura') || lower.includes('coleto') || lower.includes('cota') ||
                     lower.includes('escudo') || lower.includes('pieles') || lower.includes('camisote') ||
                     lower.includes('botas') || lower.includes('capa') || lower.includes('muda') ||
                     lower.includes('jubón') || lower.includes('loriga');
            };
            
            // Collect all equipment
            const allEquipment = [];
            let totalWeight = 0;
            
            // Armor/Weapons from occupation selection
            const occupationItems = draft.equipo_ocupacion || [];
            occupationItems.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const weight = getItemWeight(name, isArmorOrClothing(name));
              if (name) {
                allEquipment.push({ name, type: 'ocupacion', weight });
                totalWeight += weight;
              }
            });
            
            // Tools from occupation
            const tools = draft.herramientas_elegidas_ocupacion || [];
            tools.forEach(tool => {
              const name = typeof tool === 'string' ? tool : '';
              const weight = getItemWeight(name, false);
              if (name) {
                allEquipment.push({ name, type: 'herramienta', weight });
                totalWeight += weight;
              }
            });
            
            // Inventory from lifestyle
            const inventory = draft.inventario || [];
            inventory.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const qty = item?.cantidad || 1;
              const weight = getItemWeight(name, isArmorOrClothing(name)) * qty;
              if (name) {
                allEquipment.push({ name: `${name}${qty > 1 ? ` (x${qty})` : ''}`, type: 'general', weight });
                totalWeight += weight;
              }
            });
            
            // Background equipment
            const bgEquip = draft.equipo_trasfondo || [];
            bgEquip.forEach(item => {
              const name = typeof item === 'string' ? item : (item?.nombre || '');
              const weight = getItemWeight(name, isArmorOrClothing(name));
              if (name) {
                allEquipment.push({ name, type: 'trasfondo', weight });
                totalWeight += weight;
              }
            });
            
            // Calculate coin weight (0.9 grams = 0.0009 kg per coin)
            const COIN_WEIGHT_KG = 0.0009;
            const totalCoins = (draft.dinero?.mp || 0) + (draft.dinero?.mo || 0) + 
                              (draft.dinero?.mc || 0) + (draft.dinero?.me || 0);
            const coinWeight = totalCoins * COIN_WEIGHT_KG;
            totalWeight += coinWeight;
            
            // ENCUMBRANCE RULES (metric system) - Official rules
            const attrs = draft.caracteristicas || draft.atributos_finales || {};
            const fuerza = attrs.fuerza || 10;
            
            // Base values for Medium creatures
            let capacidadCarga = fuerza * 6.8;        // Max carrying capacity: FUE × 6.8 kg
            let capacidadEmpujar = fuerza * 13.6;     // Push/drag/lift capacity: FUE × 13.6 kg
            let pesoCargado = fuerza * 2.3;           // Encumbered threshold: > FUE × 2.3 kg
            let pesoMuyCargado = fuerza * 4.5;        // Heavily encumbered threshold: > FUE × 4.5 kg
            
            // Size adjustments (×2 for Large, ÷2 for Small)
            if (tamanio === 'Grande') {
              capacidadCarga *= 2;
              capacidadEmpujar *= 2;
              pesoCargado *= 2;
              pesoMuyCargado *= 2;
            } else if (tamanio === 'Pequeño') {
              capacidadCarga /= 2;
              capacidadEmpujar /= 2;
              pesoCargado /= 2;
              pesoMuyCargado /= 2;
            }
            
            // Double capacity if culture has it (e.g., Hobbits)
            if (draft.capacidad_carga_x2) {
              capacidadCarga *= 2;
              capacidadEmpujar *= 2;
            }
            
            let estorboStatus = '';
            let estorboColor = 'text-green-500';
            let estorboPenalties = [];
            
            if (totalWeight > pesoMuyCargado) {
              estorboStatus = 'Muy Cargado';
              estorboColor = 'text-red-500';
              estorboPenalties = [
                '−6 m velocidad',
                'Desventaja en pruebas de característica (FUE/DES/CON)',
                'Desventaja en tiradas de ataque',
                'Desventaja en tiradas de salvación (FUE/DES/CON)'
              ];
            } else if (totalWeight > pesoCargado) {
              estorboStatus = 'Cargado';
              estorboColor = 'text-yellow-500';
              estorboPenalties = [
                '−3 m velocidad',
                'Desventaja en Atletismo (Fue)',
                'Desventaja en Acrobacias (Des)',
                'Desventaja en salvaciones vs fatiga'
              ];
            } else {
              estorboStatus = 'Sin estorbo';
            }
            
            return (
              <div className="space-y-3">
                {/* Weapons and Armor from Occupation */}
                {allEquipment.filter(e => e.type === 'ocupacion').length > 0 && (
                  <div className="bg-[hsl(var(--destructive))/10] rounded-lg p-3 border border-[hsl(var(--destructive))/30]">
                    <p className="text-xs text-[hsl(var(--destructive))] font-heading mb-2">⚔️ Armas y Armaduras</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'ocupacion').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Tools */}
                {allEquipment.filter(e => e.type === 'herramienta').length > 0 && (
                  <div className="bg-[hsl(var(--torch-orange))/10] rounded-lg p-3 border border-[hsl(var(--torch-orange))/30]">
                    <p className="text-xs text-[hsl(var(--torch-orange))] font-heading mb-2">🔧 Herramientas</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'herramienta').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* General Equipment */}
                {allEquipment.filter(e => e.type === 'general' || e.type === 'trasfondo').length > 0 && (
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-heading mb-2">📦 Equipo General</p>
                    <div className="grid grid-cols-2 gap-2">
                      {allEquipment.filter(e => e.type === 'general' || e.type === 'trasfondo').map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="text-muted-foreground">{item.weight.toFixed(2)} kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Mount obtained via virtue (e.g. Poni de Bree) */}
                {draft.montura && draft.montura.nombre && (
                  <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/40" data-testid="summary-mount-card">
                    <p className="text-xs text-blue-400 font-heading mb-2">🐎 Montura (vía virtud)</p>
                    <div className="flex justify-between items-start text-sm">
                      <div>
                        <p className="text-foreground font-medium">{draft.montura.nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {draft.montura.tipo ? `${draft.montura.tipo} · ` : ''}
                          {draft.montura.tamano || ''}
                          {draft.montura.velocidad ? ` · ${draft.montura.velocidad} m vel.` : ''}
                        </p>
                        {draft.montura.transporta_equipo && (
                          <p className="text-xs text-blue-300 mt-1 italic">
                            Puede cargar hasta {draft.montura.carga_kg || 0} kg de equipo (alivia el estorbo del jinete).
                          </p>
                        )}
                      </div>
                      <div className="text-right text-xs text-blue-300">
                        <p>Cap: {draft.montura.carga_kg || 0} kg</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Money */}
                <div className="bg-[hsl(var(--gold))/10] rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--gold))]">💰 Dinero</span>
                    <span className="font-heading text-[hsl(var(--gold))]">
                      {draft.dinero?.mp || 0} mp · {draft.dinero?.mo || 0} mo · {draft.dinero?.me || 0} me · {draft.dinero?.mc || 0} mc
                    </span>
                  </div>
                  {totalCoins > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Peso monedas: {(coinWeight * 1000).toFixed(1)} g ({coinWeight.toFixed(3)} kg)
                    </p>
                  )}
                </div>
                
                {/* Weight and Encumbrance */}
                <div className="bg-black/20 rounded-lg p-4 border border-border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-foreground font-heading">Peso Total</span>
                    <span className="text-lg font-heading text-[hsl(var(--gold))]">{totalWeight.toFixed(2)} kg</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-secondary rounded-full h-3 mb-2 relative">
                    {/* Cargado marker */}
                    <div 
                      className="absolute h-3 w-0.5 bg-yellow-500 z-10"
                      style={{ left: `${Math.min((pesoCargado / capacidadCarga) * 100, 100)}%` }}
                    />
                    {/* Muy Cargado marker */}
                    <div 
                      className="absolute h-3 w-0.5 bg-red-500 z-10"
                      style={{ left: `${Math.min((pesoMuyCargado / capacidadCarga) * 100, 100)}%` }}
                    />
                    {/* Current weight */}
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        totalWeight > pesoMuyCargado ? 'bg-red-500' :
                        totalWeight > pesoCargado ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min((totalWeight / capacidadCarga) * 100, 100)}%` }}
                    />
                  </div>
                  
                  {/* Thresholds */}
                  <div className="grid grid-cols-3 text-xs text-muted-foreground mb-2">
                    <span>Cargado: &gt;{pesoCargado.toFixed(0)} kg</span>
                    <span className="text-center">Muy Cargado: &gt;{pesoMuyCargado.toFixed(0)} kg</span>
                    <span className="text-right">Máx: {capacidadCarga.toFixed(0)} kg</span>
                  </div>
                  
                  {/* Push/Drag capacity */}
                  <div className="text-xs text-muted-foreground text-center mb-2">
                    Empujar/Arrastrar/Levantar: {capacidadEmpujar.toFixed(0)} kg
                  </div>
                  
                  {/* Status */}
                  <div className={`text-center p-2 rounded ${estorboColor} bg-black/30`}>
                    <p className="font-heading">{estorboStatus}</p>
                    {estorboPenalties.length > 0 && (
                      <div className="text-xs mt-1 space-y-0.5">
                        {estorboPenalties.map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Size note */}
                  {tamanio !== 'Mediano' && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Tamaño {tamanio}: capacidades {tamanio === 'Pequeño' ? '÷2' : '×2'}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 flex-wrap">
        <Button
          variant="outline"
          onClick={onEdit}
          className="border-border hover:bg-secondary"
          data-testid="edit-character-btn"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
        <Button
          onClick={onFinalize}
          disabled={loading}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="finalize-character-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Crear Personaje
        </Button>
      </div>
    </div>
  );
};

export default CharacterSummary;
