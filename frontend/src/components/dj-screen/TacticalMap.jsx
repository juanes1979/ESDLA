/**
 * Mapa táctico — Nivel A: imagen de mapa + fichas/tokens arrastrables sobre
 * una rejilla decorativa. El DJ arrastra; los jugadores lo ven en vivo (WS).
 */
import { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Users, Skull, MapPin } from 'lucide-react';
import AuthenticatedImage from '@/components/AuthenticatedImage';

const TOKEN_STYLE = {
  hero: { bg: 'bg-emerald-600/90', ring: 'ring-emerald-300', Icon: Users },
  enemy: { bg: 'bg-rose-700/90', ring: 'ring-rose-300', Icon: Skull },
  marker: { bg: 'bg-amber-600/90', ring: 'ring-amber-300', Icon: MapPin },
};

const TacticalMap = ({ fileId, tokens = [], canEdit, onMove, onUpload }) => {
  const boxRef = useRef(null);
  const [local, setLocal] = useState(tokens);
  const dragId = useRef(null);

  useEffect(() => { if (!dragId.current) setLocal(tokens); }, [tokens]);

  const pointFrac = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return { x, y };
  };

  const onDown = (e, id) => {
    if (!canEdit) return;
    e.preventDefault();
    dragId.current = id;
    try { e.target.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onMovePtr = (e) => {
    if (!dragId.current) return;
    const { x, y } = pointFrac(e);
    setLocal((ts) => ts.map((t) => (t.id === dragId.current ? { ...t, x, y } : t)));
  };
  const onUp = () => {
    if (!dragId.current) return;
    const t = local.find((x) => x.id === dragId.current);
    dragId.current = null;
    if (t && onMove) onMove(t.id, t.x, t.y);
  };

  return (
    <div className="relative select-none" data-testid="tactical-map">
      <div
        ref={boxRef}
        className="relative w-full bg-black overflow-hidden"
        style={{ aspectRatio: '16 / 9' }}
        onPointerMove={onMovePtr}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      >
        {fileId ? (
          <AuthenticatedImage fileId={fileId} alt="Mapa táctico" className="absolute inset-0 w-full h-full object-contain" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-300/40">
            <ImageIcon className="w-10 h-10 mb-2" />
            <span className="text-sm">Sin mapa — sube una imagen</span>
          </div>
        )}

        {/* Rejilla decorativa */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(217,164,65,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(217,164,65,0.4) 1px, transparent 1px)',
            backgroundSize: '6.25% 6.25%',
          }}
        />

        {/* Fichas */}
        {local.map((t) => {
          const st = TOKEN_STYLE[t.kind] || TOKEN_STYLE.marker;
          const Icon = st.Icon;
          return (
            <div
              key={t.id}
              onPointerDown={(e) => onDown(e, t.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ left: `${(t.x ?? 0.5) * 100}%`, top: `${(t.y ?? 0.5) * 100}%` }}
              data-testid={`map-token-${t.id}`}
            >
              <div className={`w-7 h-7 rounded-full ${st.bg} ring-2 ${st.ring} shadow-lg flex items-center justify-center text-white`}>
                <Icon className="w-4 h-4" />
              </div>
              {t.label && (
                <span className="mt-0.5 max-w-[80px] truncate text-[9px] px-1 rounded bg-black/70 text-amber-100 border border-amber-800/40">{t.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <label className="absolute bottom-2 right-2 cursor-pointer bg-amber-700 hover:bg-amber-600 text-amber-50 text-xs px-3 py-1.5 rounded flex items-center gap-1" data-testid="map-upload-label">
          <ImageIcon className="w-3.5 h-3.5" /> Cambiar mapa
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} data-testid="map-upload-input" />
        </label>
      )}
    </div>
  );
};

export default TacticalMap;
