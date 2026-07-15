/**
 * Character Header — Name, level, culture, experience.
 *
 * Flujo del retrato:
 *  1. Si `portrait_locked` está activo, el retrato NO puede cambiarse
 *     (definitivo).
 *  2. Si NO está bloqueado, al hacer clic se genera una imagen en
 *     "borrador" (no persiste). El usuario puede:
 *       - "Guardar" → persiste y bloquea el retrato.
 *       - "Descartar" → vuelve al retrato anterior y limpia.
 *       - "Regenerar" → vuelve a llamar a la IA y reemplaza el borrador.
 */
import { useState } from 'react';
import { Loader2, RefreshCw, ImageIcon, Save, X, Lock, Maximize2 } from 'lucide-react';
import { LevelUpButton } from '@/components/LevelUpModal';
import { toast } from 'sonner';
import api from '@/services/api';
import { PortraitUploadButton } from '@/components/rules/PortraitUploadButton';

const CharacterHeader = ({ character, onLevelUp, onUpdate }) => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  // Borrador local: imagen generada que aún NO se ha guardado.
  const [draftPortrait, setDraftPortrait] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Vista ampliada del retrato definitivo (solo lectura).
  const [showFullView, setShowFullView] = useState(false);

  // El retrato es DEFINITIVO en cuanto existe uno guardado: si el personaje
  // ya tiene `portrait_image` (o el flag heredado `portrait_locked`), no se
  // puede cambiar. Solo se permite generarlo UNA vez (cuando aún no hay).
  const isLocked = !!character?.portrait_image || !!character?.portrait_locked;
  const displayedImage = draftPortrait || character?.portrait_image || null;

  const generatePortrait = async () => {
    if (!character?.id || isLocked) return;
    setError(null);
    setGenerating(true);
    setProgress(0);
    const t0 = Date.now();
    const tmr = setInterval(() => setProgress(Math.round((Date.now() - t0) / 1000)), 1000);
    try {
      const res = await api.post('/portraits/generate', {
        nombre: character.nombre || '',
        cultura: character.cultura_nombre || '',
        raza: character.raza_nombre || character.cultura_nombre || '',
        vocacion: character.vocacion_nombre || character.ocupacion_nombre || '',
        trasfondo: character.trasfondo_nombre || '',
        edad: character.edad || null,
        altura_cm: character.altura_cm || null,
        peso_kg: character.peso_kg || null,
        color_ojos: character.color_ojos || character.ojos || '',
        color_pelo: character.color_pelo || character.pelo || '',
        rasgos_fisicos: character.rasgos_fisicos || '',
        genero: character.genero || character.sexo || 'hombre',
      }, { timeout: 120000 });

      const img = res.data?.image_base64;
      if (!res.data?.success || !img || typeof img !== 'string' || img.length < 100) {
        throw new Error(res.data?.detail || 'La IA no devolvió imagen.');
      }
      // Guardar SÓLO en borrador. No persiste hasta que el usuario
      // pulse "Guardar".
      setDraftPortrait(img);
      setShowPreview(true);
      toast.info('Retrato generado en borrador. Revísalo en grande y pulsa "Guardar" para fijarlo o "Regenerar" para probar otro.');
    } catch (e) {
      const rawDetail = e.response?.data?.detail;
      let detail;
      if (Array.isArray(rawDetail)) {
        detail = rawDetail.map(d => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
      } else if (rawDetail && typeof rawDetail === 'object') {
        detail = JSON.stringify(rawDetail);
      } else {
        detail = rawDetail || e.message || 'Error desconocido';
      }
      const status = e.response?.status;
      const msg = status === 504 || e.code === 'ECONNABORTED'
        ? 'La generación tardó demasiado. Inténtalo de nuevo.'
        : `Error${status ? ` (HTTP ${status})` : ''}: ${detail}`;
      console.error('Portrait error:', { status, detail, e });
      setError(msg);
      toast.error(msg);
    } finally {
      clearInterval(tmr);
      setGenerating(false);
      setProgress(0);
    }
  };

  const saveDraft = async () => {
    if (!draftPortrait || !character?.id) return;
    setSaving(true);
    try {
      const patched = await api.patch(`/characters/${character.id}`, {
        portrait_image: draftPortrait,
        portrait_locked: true,
      });
      if (onUpdate) onUpdate(patched.data);
      setDraftPortrait(null);
      setShowPreview(false);
      toast.success('Retrato guardado en la ficha (definitivo).');
    } catch (e) {
      console.error('Save portrait error:', e);
      toast.error('No se pudo guardar el retrato. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = () => {
    setDraftPortrait(null);
    setShowPreview(false);
    setError(null);
    toast.info('Borrador descartado.');
  };

  // Sube una imagen propia (JPG/PNG), la normaliza a PNG y la fija como retrato.
  const fileToPngBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        try { resolve(canvas.toDataURL('image/png').split(',')[1]); }
        catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const uploadPortrait = async (file) => {
    if (!character?.id) return;
    const b64 = await fileToPngBase64(file);
    const patched = await api.patch(`/characters/${character.id}`, { portrait_image: b64, portrait_locked: true });
    if (onUpdate) onUpdate(patched.data);
    setDraftPortrait(null);
    setShowPreview(false);
  };

  return (
    <div className="card-parchment rounded-lg p-6 mb-6">
      <div className="flex items-center gap-6">
        {/* Portrait + acciones */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative group">
            {displayedImage ? (
              <img
                src={`data:image/png;base64,${displayedImage}`}
                alt={`Retrato de ${character.nombre}`}
                onClick={() => {
                  if (draftPortrait) setShowPreview(true);
                  else if (character?.portrait_image) setShowFullView(true);
                }}
                className={`w-24 h-24 rounded-full object-cover ring-1 cursor-pointer ${
                  draftPortrait
                    ? 'ring-2 ring-amber-400 shadow-amber-400/40 shadow-lg'
                    : 'ring-[hsl(var(--gold))/50]'
                }`}
                style={{ background: 'transparent' }}
                data-testid="character-portrait-image"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center ring-1 ring-[hsl(var(--gold))/50]">
                <span className="font-heading text-4xl text-[hsl(var(--gold))]">
                  {character.nombre?.[0]?.toUpperCase()}
                </span>
              </div>
            )}

            {/* Si ya hay retrato (definitivo) → candado; si no, botón generar. */}
            {isLocked && !draftPortrait ? (
              <>
                {/* Pista de "ampliar" al pasar el ratón (no bloquea el clic). */}
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Maximize2 className="w-6 h-6 text-white" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 bg-[hsl(var(--gold))/80] rounded-full p-1 ring-1 ring-[hsl(var(--gold))]"
                  title="Retrato definitivo: no se puede cambiar"
                  data-testid="character-portrait-locked-icon"
                >
                  <Lock className="w-3 h-3 text-black" />
                </div>
              </>
            ) : (
              <button
                onClick={generatePortrait}
                disabled={generating || saving}
                className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-100 disabled:bg-black/70"
                title={draftPortrait ? 'Regenerar retrato (borrador)' : 'Generar retrato con IA'}
                data-testid="character-regen-portrait-btn"
              >
                {generating ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : draftPortrait ? (
                  <RefreshCw className="w-6 h-6 text-white" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-white" />
                )}
              </button>
            )}
          </div>

          {/* Botón visible (no depende del hover) SOLO si aún no hay retrato. */}
          {!isLocked && !draftPortrait && !generating && (
            <button
              onClick={generatePortrait}
              disabled={saving}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 disabled:opacity-60"
              title="Generar retrato con IA (solo se puede una vez)"
              data-testid="character-change-portrait-btn"
            >
              <ImageIcon className="w-3 h-3" />
              Generar retrato
            </button>
          )}
          {isLocked && !draftPortrait && (
            <p className="text-[9px] text-muted-foreground italic max-w-[160px] text-center" data-testid="portrait-final-hint">
              Retrato definitivo
            </p>
          )}

          {/* Subir imagen propia (JPG/PNG) — sustituye o añade el retrato */}
          {!draftPortrait && !generating && (
            <PortraitUploadButton onFile={uploadPortrait} label={isLocked ? 'Sustituir por imagen' : 'Subir imagen'} testid="character-portrait-upload" />
          )}

          {/* Estado: progreso, error o acciones de borrador */}
          {generating && (
            <div className="text-[10px] text-center text-purple-300 bg-purple-500/10 border border-purple-500/30 rounded px-2 py-1 max-w-[160px]"
                 data-testid="character-portrait-progress">
              Generando con IA…<br />
              <span className="font-mono">{progress}s</span> · 15–30 s normal
            </div>
          )}
          {error && !generating && (
            <div className="text-[9px] text-center text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 max-w-[160px]">
              {error}
            </div>
          )}
          {draftPortrait && !generating && (
            <div className="flex gap-1.5">
              <button
                onClick={saveDraft}
                disabled={saving}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
                title="Guardar este retrato como definitivo (no podrá cambiarse)"
                data-testid="character-portrait-save-btn"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Guardar
              </button>
              <button
                onClick={discardDraft}
                disabled={saving}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-600/70 hover:bg-red-500 text-white disabled:opacity-60"
                title="Descartar este borrador"
                data-testid="character-portrait-discard-btn"
              >
                <X className="w-3 h-3" />
                Descartar
              </button>
            </div>
          )}
          {draftPortrait && (
            <p className="text-[9px] text-amber-300 italic max-w-[160px] text-center">
              Borrador sin guardar
            </p>
          )}
        </div>

        <div className="flex-1">
          <h1 className="font-heading text-3xl text-foreground mb-1">
            {character.nombre}
          </h1>
          <p className="text-lg text-muted-foreground">
            {character.cultura_nombre} {character.vocacion_nombre}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-muted-foreground items-center">
            <span>Nivel {character.nivel || 1}</span>
            <LevelUpButton
              character={character}
              onLevelUp={onLevelUp}
              className="text-xs py-1 h-auto"
            />
            <span>·</span>
            <span>{character.edad} años</span>
            <span>·</span>
            <span>{character.altura_cm} cm</span>
            <span>·</span>
            <span>{character.peso_kg} kg</span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-muted-foreground">Experiencia</p>
          <p className="font-heading text-2xl text-[hsl(var(--gold))]">
            {character.experiencia || 0} XP
          </p>
          {character.codigo_publico && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(character.codigo_publico).then(
                  () => toast.success(`Código copiado: ${character.codigo_publico}`),
                  () => toast.error('No se pudo copiar')
                );
              }}
              className="text-[10px] text-muted-foreground font-mono mt-2 tracking-wider hover:text-[hsl(var(--gold))] transition-colors cursor-pointer flex items-center gap-1 ml-auto"
              data-testid="codigo-publico-display"
              title="Click para copiar el código público"
            >
              {character.codigo_publico}
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Previsualización GRANDE del retrato en borrador (antes de guardar) */}
      {showPreview && draftPortrait && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
          data-testid="portrait-preview-modal"
        >
          <div
            className="bg-zinc-900 rounded-xl border border-amber-500/40 p-4 max-w-md w-full flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <h3 className="font-heading text-lg text-amber-300">Retrato en borrador</h3>
              <button onClick={() => setShowPreview(false)} className="text-muted-foreground hover:text-white" data-testid="portrait-preview-close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={`data:image/png;base64,${draftPortrait}`}
              alt={`Retrato de ${character.nombre}`}
              className="w-full max-w-sm rounded-lg ring-1 ring-amber-400/40 object-contain"
              data-testid="portrait-preview-image"
            />
            <p className="text-xs text-amber-300/80 italic text-center">
              Aún no se ha guardado. Revisa la imagen y decide.
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={saveDraft} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
                data-testid="portrait-preview-save-btn"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </button>
              <button
                onClick={generatePortrait} disabled={generating || saving}
                className="flex-1 flex items-center justify-center gap-1 text-sm px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-60"
                data-testid="portrait-preview-regen-btn"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Regenerar
              </button>
              <button
                onClick={discardDraft} disabled={saving}
                className="flex items-center justify-center gap-1 text-sm px-3 py-2 rounded bg-red-600/70 hover:bg-red-500 text-white disabled:opacity-60"
                data-testid="portrait-preview-discard-btn"
              >
                <X className="w-4 h-4" /> Descartar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vista AMPLIADA del retrato definitivo (solo lectura). */}
      {showFullView && character?.portrait_image && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setShowFullView(false)}
          data-testid="portrait-fullview-modal"
        >
          <div
            className="relative bg-zinc-900 rounded-xl border border-[hsl(var(--gold))]/40 p-3 max-w-lg w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowFullView(false)}
              className="absolute top-2 right-2 z-10 bg-black/60 rounded-full p-1.5 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
              data-testid="portrait-fullview-close"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={`data:image/png;base64,${character.portrait_image}`}
              alt={`Retrato de ${character.nombre}`}
              className="w-full rounded-lg ring-1 ring-[hsl(var(--gold))]/40 object-contain"
              data-testid="portrait-fullview-image"
            />
            <p className="font-heading text-lg text-[hsl(var(--gold))] text-center">
              {character.nombre}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterHeader;
