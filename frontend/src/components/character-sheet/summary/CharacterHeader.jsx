/**
 * Character Header - Name, level, culture, experience
 *
 * Permite también generar / regenerar el retrato con IA después de la
 * creación. Esto sirve de red de seguridad: si el flujo del wizard falló,
 * el jugador o el DJ pueden volver a generarlo desde la ficha.
 */
import { useState } from 'react';
import { Loader2, RefreshCw, ImageIcon } from 'lucide-react';
import { LevelUpButton } from '@/components/LevelUpModal';
import { toast } from 'sonner';
import api from '@/services/api';

const CharacterHeader = ({ character, onLevelUp, onUpdate }) => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const generatePortrait = async () => {
    if (!character?.id) return;
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
      // Persistir en la ficha del personaje (no en el draft).
      const patched = await api.patch(`/characters/${character.id}`, { portrait_image: img });
      if (onUpdate) onUpdate(patched.data);
      toast.success('Retrato generado y guardado en la ficha.');
    } catch (e) {
      const detail = e.response?.data?.detail || e.message || 'Error desconocido';
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

  return (
    <div className="card-parchment rounded-lg p-6 mb-6">
      <div className="flex items-center gap-6">
        {/* Portrait + botón generar/regenerar */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative group">
            {character.portrait_image ? (
              <img
                src={`data:image/png;base64,${character.portrait_image}`}
                alt={`Retrato de ${character.nombre}`}
                className="w-24 h-24 rounded-full object-cover ring-1 ring-[hsl(var(--gold))/50]"
                style={{ background: 'transparent' }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center ring-1 ring-[hsl(var(--gold))/50]">
                <span className="font-heading text-4xl text-[hsl(var(--gold))]">
                  {character.nombre?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <button
              onClick={generatePortrait}
              disabled={generating}
              className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-100 disabled:bg-black/70"
              title={character.portrait_image ? 'Regenerar retrato con IA' : 'Generar retrato con IA'}
              data-testid="character-regen-portrait-btn"
            >
              {generating ? (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              ) : character.portrait_image ? (
                <RefreshCw className="w-6 h-6 text-white" />
              ) : (
                <ImageIcon className="w-6 h-6 text-white" />
              )}
            </button>
          </div>
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
    </div>
  );
};

export default CharacterHeader;
