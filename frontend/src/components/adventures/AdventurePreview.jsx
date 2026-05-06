/**
 * Modal de previsualización de la aventura completa.
 * Muestra todo lo añadido hasta el momento (read-only).
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Globe2, Lock } from 'lucide-react';

const SEASONS = {
  primavera: 'Primavera',
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
};

const Section = ({ title, children }) => (
  <div className="mb-5">
    <h3 className="font-heading text-lg text-amber-300 mb-2 border-b border-amber-700/30 pb-1">
      {title}
    </h3>
    <div className="text-sm text-gray-200">{children}</div>
  </div>
);

const formatDate = (adv) => {
  const parts = [];
  if (adv.day) parts.push(adv.day);
  if (adv.month) parts.push(`mes ${adv.month}`);
  if (adv.year) parts.push(`${adv.year} T.E.`);
  if (adv.season) parts.push(SEASONS[adv.season]);
  return parts.join(' · ') || '—';
};

const AdventurePreview = ({ adv, open, onClose, backendUrl }) => {
  if (!adv) return null;

  const coverUrl = adv.image_file_id
    ? `${backendUrl}/api/storage/download/${adv.image_file_id}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[88vh] overflow-y-auto bg-black/95 border-amber-700/50"
        data-testid="adventure-preview-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-3xl text-amber-300 flex items-center gap-2">
            {adv.is_public ? (
              <Globe2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Lock className="w-5 h-5 text-amber-300/80" />
            )}
            {adv.name || '(sin nombre)'}
          </DialogTitle>
        </DialogHeader>

        {coverUrl && (
          
          <img
            src={coverUrl}
            alt={adv.name}
            className="w-full max-h-72 object-cover rounded-lg border border-amber-800/40"
          />
        )}

        <div className="text-xs text-amber-300/60 mt-2">
          DJ: {adv.creator_name || '—'} · Cuándo: {formatDate(adv)} · Dónde:{' '}
          {adv.location_name || adv.region || '—'}
        </div>

        <Section title="Configuración">
          Jugadores: máx. {adv.max_players}
          {adv.allow_multi_characters
            ? ` · multi-personaje (hasta ${adv.max_characters_per_player ?? '?'})`
            : ' · 1 personaje por jugador'}
          {(adv.recommended_level_min || adv.recommended_level_max) && (
            <> · Nivel sugerido: {adv.recommended_level_min ?? '?'}–{adv.recommended_level_max ?? '?'}</>
          )}
          {' · '}
          {adv.is_public ? 'Pública' : 'Privada'}
        </Section>

        {adv.description && <Section title="¿Qué? (gancho)">{adv.description}</Section>}
        {adv.motivation_text && <Section title="¿Por qué? (motivación)">{adv.motivation_text}</Section>}
        {(adv.patron_name || adv.presenter_text) && (
          <Section title="¿Quién?">
            {adv.patron_name ? `Mecenas: ${adv.patron_name}` : `Presentador: ${adv.presenter_text}`}
          </Section>
        )}
        {adv.rumor && <Section title="Rumor">{adv.rumor}</Section>}
        {(adv.ancient_lore_difficulty || adv.ancient_lore_text) && (
          <Section title="Saber Antiguo">
            CD {adv.ancient_lore_difficulty ?? '?'}.{' '}
            {adv.ancient_lore_text || '(sin texto)'}
          </Section>
        )}
        {adv.background && <Section title="Trasfondo (DJ)">{adv.background}</Section>}
        {adv.travel_events_text && (
          <Section title="Acontecimientos de viaje">{adv.travel_events_text}</Section>
        )}

        {adv.environments?.length > 0 && (
          <Section title={`Entornos (${adv.environments.length})`}>
            <ol className="list-decimal pl-5 space-y-2">
              {adv.environments.map((e, i) => (
                <li key={e.id || i}>
                  <span className="text-amber-200 font-medium">{e.title}</span>
                  {e.description && <p className="text-gray-300/90">{e.description}</p>}
                </li>
              ))}
            </ol>
          </Section>
        )}

        {adv.intrigues?.length > 0 && (
          <Section title={`Intrigas y problemas (${adv.intrigues.length})`}>
            <ul className="list-disc pl-5 space-y-1">
              {adv.intrigues.map((p, i) => (
                <li key={p.id || i}>
                  {p.description}
                  {p.linked_plot && (
                    <span className="text-amber-300/60"> — {p.linked_plot}</span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {adv.npcs?.length > 0 && (
          <Section title={`PNJs (${adv.npcs.length})`}>
            <ul className="space-y-2">
              {adv.npcs.map((n, i) => (
                <li key={n.id || i}>
                  <span className="text-amber-200 font-medium">{n.name}</span>
                  {n.bestiary_categoria && (
                    <span className="text-amber-300/50"> · {n.bestiary_categoria}</span>
                  )}
                  {n.history && <p className="text-gray-300/90">{n.history}</p>}
                  {n.special && (
                    <p className="text-amber-300/70 italic">⚡ {n.special}</p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {adv.maps?.length > 0 && (
          <Section title={`Mapas (${adv.maps.length})`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {adv.maps.map((m, i) => (
                <div
                  key={m.id || i}
                  className="rounded border border-amber-800/40 overflow-hidden"
                >
                  
                  <img
                    src={`${backendUrl}/api/storage/download/${m.file_id}`}
                    alt={m.description || `mapa-${i}`}
                    className="w-full h-32 object-cover"
                  />
                  {m.description && (
                    <div className="text-xs p-1 text-amber-300/80">{m.description}</div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdventurePreview;
