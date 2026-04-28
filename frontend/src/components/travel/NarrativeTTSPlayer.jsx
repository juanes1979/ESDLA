/**
 * NarrativeTTSPlayer
 * Botón "Escuchar crónica" + reproductor <audio>. Llama al endpoint
 * `/travel/tts/narrative` para generar el MP3 (base64) usando OpenAI TTS
 * (modelo tts-1-hd, voz onyx — narrador clásico). Cachea el audio
 * mientras no cambie el texto.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const NarrativeTTSPlayer = ({ text, voice = 'onyx', speed = 0.95 }) => {
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [generatedFor, setGeneratedFor] = useState(''); // texto del que viene el audio
  const audioRef = useRef(null);

  // Si el texto cambia, invalida el audio cacheado.
  useEffect(() => {
    if (audioUrl && generatedFor !== text) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setGeneratedFor('');
    }
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpieza al desmontar.
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const generate = async () => {
    if (!text?.trim()) {
      toast.error('No hay texto para narrar.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/travel/tts/narrative', { text, voice, speed });
      if (!res.data?.success || !res.data?.audio_base64) {
        throw new Error(res.data?.error || 'Sin audio en la respuesta');
      }
      // base64 → blob → object URL
      const byteString = atob(res.data.audio_base64);
      const arr = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) arr[i] = byteString.charCodeAt(i);
      const blob = new Blob([arr], { type: res.data.mime || 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setGeneratedFor(text);
      // Auto-play tras pequeña espera para que el <audio> monte el src.
      setTimeout(() => {
        audioRef.current?.play().catch(() => { /* el navegador puede bloquear; el user le da play */ });
      }, 100);
    } catch (err) {
      console.error('TTS error:', err);
      toast.error('No se pudo generar el audio. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="narrative-tts-player">
      {!audioUrl && (
        <Button
          onClick={generate}
          disabled={loading || !text}
          variant="outline"
          className="border-[hsl(var(--gold))]/30 hover:bg-[hsl(var(--gold))]/10"
          data-testid="tts-generate-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generando audio…
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 mr-2" />
              Escuchar crónica (narrador)
            </>
          )}
        </Button>
      )}

      {audioUrl && (
        <div className="flex items-center gap-2 p-2 rounded bg-black/30 border border-[hsl(var(--gold))]/30">
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="flex-1"
            data-testid="tts-audio-element"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              URL.revokeObjectURL(audioUrl);
              setAudioUrl(null);
              setGeneratedFor('');
            }}
            title="Cerrar reproductor"
            data-testid="tts-close-btn"
          >
            <VolumeX className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default NarrativeTTSPlayer;
