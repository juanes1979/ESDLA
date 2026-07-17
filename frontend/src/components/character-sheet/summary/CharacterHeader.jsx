/**
 * Character Header — Name, level, culture, experience.
 *
 * Retrato del personaje:
 *  - Si NO hay retrato: cualquiera con acceso puede copiar el prompt (para
 *    crear la imagen fuera, sin gastar créditos) y subirla.
 *  - Una vez guardado el retrato, NO se puede cambiar. Solo el MAESTRO puede
 *    sustituirlo (el DJ y los jugadores no).
 */
import { useState } from 'react';
import { Loader2, Lock, Maximize2, X, Copy } from 'lucide-react';
import { LevelUpButton } from '@/components/LevelUpModal';
import { toast } from 'sonner';
import api from '@/services/api';
import { PortraitUploadButton } from '@/components/rules/PortraitUploadButton';
import { useAuth } from '@/context/AuthContext';

const CharacterHeader = ({ character, onLevelUp, onUpdate }) => {
  const { hasRole } = useAuth();
  const isMaestro = hasRole('maestro');
  const [error, setError] = useState(null);
  const [showFullView, setShowFullView] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Una vez guardado el retrato NO se puede cambiar, salvo el MAESTRO.
  const hasPortrait = !!character?.portrait_image;
  const canChange = !hasPortrait || isMaestro;
  const displayedImage = character?.portrait_image || null;

  // Copia un PROMPT en español (sin IA, sin créditos) para crear el retrato fuera.
  const copyPrompt = async () => {
    if (!character?.id) return;
    setLoadingPrompt(true);
    try {
      const res = await api.post('/portraits/prompt', {
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
      });
      const text = res.data?.prompt || '';
      setPromptText(text);
      try { await navigator.clipboard.writeText(text); toast.success('Prompt copiado al portapapeles'); }
      catch { toast.info('Prompt generado. Cópialo del recuadro.'); }
    } catch (e) {
      toast.error('No se pudo generar el prompt: ' + (e?.response?.data?.detail || e.message));
    } finally { setLoadingPrompt(false); }
  };

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
    if (!character?.id || !file) return;
    if (!canChange) {
      toast.error('El retrato no se puede cambiar una vez guardado. Solo el Maestro puede modificarlo.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const b64 = await fileToPngBase64(file);
      const patched = await api.patch(`/characters/${character.id}`, { portrait_image: b64, portrait_locked: true });
      if (onUpdate) onUpdate(patched.data);
      toast.success('Retrato guardado.');
    } catch (e) {
      const detail = e?.response?.status === 403
        ? 'El retrato no se puede cambiar una vez guardado. Solo el Maestro puede modificarlo.'
        : (e?.response?.data?.detail || 'No se pudo subir la imagen.');
      setError(detail); toast.error(detail);
    } finally { setUploading(false); }
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
                onClick={() => { if (hasPortrait) setShowFullView(true); }}
                className="w-24 h-24 rounded-full object-cover ring-1 ring-[hsl(var(--gold))/50] cursor-pointer"
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

            {hasPortrait && (
              <>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <Maximize2 className="w-6 h-6 text-white" />
                </div>
                {!isMaestro && (
                  <div
                    className="absolute -bottom-1 -right-1 bg-[hsl(var(--gold))/80] rounded-full p-1 ring-1 ring-[hsl(var(--gold))]"
                    title="Retrato definitivo: no se puede cambiar"
                    data-testid="character-portrait-locked-icon"
                  >
                    <Lock className="w-3 h-3 text-black" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Copiar prompt + subir imagen (permitido si no hay retrato o si eres Maestro) */}
          {canChange ? (
            <div className="flex flex-col items-center gap-1.5 w-full">
              <button
                onClick={copyPrompt}
                disabled={loadingPrompt}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[hsl(var(--gold))]/50 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 disabled:opacity-60"
                title="Copia un prompt en español para crear el retrato en tu herramienta favorita"
                data-testid="character-copy-prompt-btn"
              >
                {loadingPrompt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                Copiar prompt
              </button>
              <PortraitUploadButton
                onFile={uploadPortrait}
                label={uploading ? 'Subiendo…' : (hasPortrait ? 'Cambiar imagen' : 'Subir imagen')}
                testid="character-portrait-upload"
              />
              {hasPortrait && isMaestro && (
                <p className="text-[9px] text-amber-300/80 italic max-w-[160px] text-center">
                  Como Maestro puedes cambiar el retrato.
                </p>
              )}
            </div>
          ) : (
            <p
              className="text-[9px] text-muted-foreground italic max-w-[160px] text-center"
              data-testid="portrait-locked-hint"
            >
              El retrato no se puede cambiar una vez guardado. Solo el Maestro puede modificarlo.
            </p>
          )}

          {promptText && (
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              className="w-40 bg-black/40 rounded p-1.5 text-[10px] outline-none border border-border/50 resize-y"
              data-testid="character-portrait-prompt-text"
            />
          )}

          {error && (
            <div className="text-[9px] text-center text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1 max-w-[160px]">
              {error}
            </div>
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
