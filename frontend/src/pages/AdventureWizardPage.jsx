/**
 * Adventure Wizard Page — Fase 1.
 *
 * Edita una aventura paso por paso. Cabecera persistente arriba con:
 *   Nombre · DJ · Cuándo · Dónde + botón "Previsualizar".
 *
 * Cada paso es una pestaña que llama a PATCH /api/adventures/:id al pulsar
 * "Guardar paso". El usuario puede saltar entre pasos sin perder lo
 * previamente guardado. Sólo se requieren `name` y `max_players` para que
 * la API acepte la creación; el resto se va completando.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Eye,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  GripVertical,
  Search,
  X,
  Globe2,
  Lock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  getAdventure,
  updateAdventure,
  uploadAdventureImage,
  getBestiary,
  getNpcDetail,
  getLocations,
  getPatrons,
  getCultures,
  generateCampaignRun,
} from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Field, TextInput, TextArea, Select, StepCard } from '@/components/adventures/WizardFields';
import AdventurePreview from '@/components/adventures/AdventurePreview';
import CampaignActivatedDialog from '@/components/adventures/CampaignActivatedDialog';
import AuthenticatedImage from '@/components/AuthenticatedImage';
import LocationPickerField from '@/components/adventures/LocationPickerField';
import LocationMiniPreview from '@/components/adventures/LocationMiniPreview';
import NPCStatBlockEditor from '@/components/adventures/NPCStatBlockEditor';
import NPCStatBlockPreview from '@/components/adventures/NPCStatBlockPreview';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_MAPS = 20;

const STEPS = [
  { id: 'basic', label: 'Datos básicos' },
  { id: 'background', label: 'Trasfondo' },
  { id: 'environments', label: 'Entornos' },
  { id: 'intrigues', label: 'Intrigas' },
  { id: 'npcs', label: 'PNJ' },
  { id: 'images', label: 'Imágenes' },
];

const SEASONS = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verano', label: 'Verano' },
  { value: 'otono', label: 'Otoño' },
  { value: 'invierno', label: 'Invierno' },
];

const SEASON_LABEL = {
  primavera: 'Primavera',
  verano: 'Verano',
  otono: 'Otoño',
  invierno: 'Invierno',
};

const deriveSeason = (month) => {
  const m = Number(month);
  if (!m) return null;
  if (m >= 3 && m <= 5) return 'primavera';
  if (m >= 6 && m <= 8) return 'verano';
  if (m >= 9 && m <= 11) return 'otono';
  return 'invierno';
};

// ============================================================================
// Step components
// ============================================================================
const Step1BasicAndConfig = ({ adv, setField, locations, cultures, onUploadCover, uploadingCover }) => {
  const derivedSeason = deriveSeason(adv.month);
  const seasonHint = derivedSeason
    ? `Estación auto: ${SEASON_LABEL[derivedSeason]} (puedes cambiarla al activar la campaña).`
    : 'Si dejas mes vacío, la estación se elegirá al activar la campaña.';

  // Configuration helpers (merged from old Step8Config)
  const cultureList = cultures || [];
  const allowedCulIds = adv.allowed_culture_ids || [];
  const allowedSubs = adv.allowed_subcultures || [];
  const subcultureOptions = [];
  for (const c of cultureList) {
    for (const sub of c.subculturas || c.subcultures || []) {
      subcultureOptions.push({
        value: `${c.id || c._id}::${sub.nombre || sub.name || sub}`,
        label: `${c.nombre || c.name} — ${sub.nombre || sub.name || sub}`,
      });
    }
  }
  const toggleCulture = (cid) => {
    const next = allowedCulIds.includes(cid)
      ? allowedCulIds.filter((x) => x !== cid)
      : [...allowedCulIds, cid];
    setField('allowed_culture_ids', next);
  };
  const toggleSubculture = (key) => {
    const next = allowedSubs.includes(key)
      ? allowedSubs.filter((x) => x !== key)
      : [...allowedSubs, key];
    setField('allowed_subcultures', next);
  };

  const locationValue = adv.location_id || adv.location_name
    ? {
        location_id: adv.location_id,
        location_name: adv.location_name,
        region: adv.region,
        map_x: adv.map_x,
        map_y: adv.map_y,
      }
    : null;

  return (
  <StepCard
    title="Datos básicos y configuración"
    description="Nombre, imagen, año T.E., ubicación y reglas de la campaña."
  >
    <Field label="Nombre" required testid="name">
      <TextInput
        value={adv.name}
        onChange={(v) => setField('name', v)}
        placeholder="p. ej. Muro de los Muertos"
        testid="adv-name-input"
        maxLength={80}
      />
    </Field>

    <Field label="Imagen de carátula (≤ 5 MB)" hint="Formatos: PNG, JPG, WEBP">
      <div className="flex items-center gap-3">
        {adv.image_file_id ? (
          <AuthenticatedImage
            fileId={adv.image_file_id}
            alt="cover"
            className="w-24 h-24 object-cover rounded border border-amber-800/40"
          />
        ) : (
          <div className="w-24 h-24 rounded bg-black/40 border border-amber-800/40 flex items-center justify-center text-amber-300/50">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={onUploadCover}
            data-testid="cover-upload-input"
            className="text-xs text-amber-300/80"
            disabled={uploadingCover}
          />
          {uploadingCover && (
            <p className="text-xs text-amber-300/60 mt-1">
              <Loader2 className="w-3 h-3 inline animate-spin" /> Subiendo…
            </p>
          )}
        </div>
      </div>
    </Field>

    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <Field label="Año T.E." testid="year">
        <TextInput
          type="number"
          value={adv.year}
          onChange={(v) => setField('year', v)}
          placeholder="2950"
          testid="adv-year-input"
          min={1}
          max={3500}
        />
      </Field>
      <Field label="Mes (1-12)" testid="month" hint={seasonHint}>
        <TextInput
          type="number"
          value={adv.month}
          onChange={(v) => setField('month', v)}
          min={1}
          max={12}
          testid="adv-month-input"
        />
      </Field>
      <Field label="Día (1-31)" testid="day">
        <TextInput
          type="number"
          value={adv.day}
          onChange={(v) => setField('day', v)}
          min={1}
          max={31}
          testid="adv-day-input"
        />
      </Field>
    </div>

    <Field
      label="Ubicación principal"
      hint="Busca por nombre o región, o pulsa Mapa para marcar un punto. Aparecerá una previsualización debajo."
    >
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="flex-1 w-full">
          <LocationPickerField
            locations={locations}
            value={locationValue}
            onChange={(picked) => {
              setField('location_id', picked?.location_id || null);
              setField('location_name', picked?.location_name || null);
              setField('region', picked?.region || null);
              setField('map_x', picked?.map_x ?? null);
              setField('map_y', picked?.map_y ?? null);
            }}
            placeholder="Buscar ubicación o marcar en el mapa…"
            testidPrefix="adv-location"
          />
        </div>
        <LocationMiniPreview value={locationValue} locations={locations} height={140} />
      </div>
    </Field>

    {/* ============== CONFIGURACIÓN (antes Step8) ============== */}
    <div className="mt-6 pt-4 border-t border-amber-800/30">
      <h3 className="text-sm font-bold text-amber-300 mb-3 uppercase tracking-wide">
        Configuración de la campaña
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Jugadores máximos" required>
          <TextInput
            type="number"
            value={adv.max_players}
            onChange={(v) => setField('max_players', v)}
            min={1}
            max={20}
            testid="adv-max-players"
          />
        </Field>
        <Field label="¿Multi-personaje por jugador?">
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={!!adv.allow_multi_characters}
              onChange={(e) => {
                setField('allow_multi_characters', e.target.checked);
                if (!e.target.checked) setField('max_characters_per_player', null);
              }}
              data-testid="adv-allow-multi"
              className="w-4 h-4"
            />
            <span className="text-sm text-amber-200/90">Permitir varios personajes</span>
          </label>
        </Field>
        {adv.allow_multi_characters && (
          <Field label="Máx. personajes por jugador" required>
            <TextInput
              type="number"
              value={adv.max_characters_per_player}
              onChange={(v) => setField('max_characters_per_player', v)}
              min={2}
              max={20}
              testid="adv-max-chars-per-player"
            />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
        <Field label="Nivel mínimo recomendado">
          <TextInput
            type="number"
            value={adv.recommended_level_min}
            onChange={(v) => setField('recommended_level_min', v)}
            min={1}
            max={20}
            testid="adv-level-min"
          />
        </Field>
        <Field label="Nivel máximo recomendado">
          <TextInput
            type="number"
            value={adv.recommended_level_max}
            onChange={(v) => setField('recommended_level_max', v)}
            min={1}
            max={20}
            testid="adv-level-max"
          />
        </Field>
      </div>

      <Field
        label="Puntos de experiencia a repartir"
        hint="Bote total de PX que el DJ podrá distribuir entre los personajes durante la campaña. Vacío = sin presupuesto cerrado."
      >
        <TextInput
          type="number"
          value={adv.xp_pool}
          onChange={(v) => setField('xp_pool', v)}
          min={0}
          max={1000000}
          testid="adv-xp-pool"
          placeholder="p. ej. 1500"
        />
      </Field>

      <div className="mt-4 p-3 rounded border border-amber-800/30 bg-black/30">
        <h4 className="text-sm font-medium text-amber-200 mb-2">
          Restricciones de raza/cultura (opcional)
        </h4>
        <p className="text-xs text-amber-300/60 mb-3">
          Si dejas vacío, cualquier personaje puede unirse. Selecciona culturas concretas para
          limitar (p. ej. sólo Hobbits) o subculturas específicas (p. ej. sólo Hobbits de los
          Pies Peludos).
        </p>

        <div className="mb-3">
          <div className="text-xs text-amber-300/80 mb-1">Culturas permitidas:</div>
          <div className="flex flex-wrap gap-2">
            {cultureList.map((c) => {
              const cid = c.id || c._id;
              const checked = allowedCulIds.includes(cid);
              return (
                <button
                  type="button"
                  key={cid}
                  onClick={() => toggleCulture(cid)}
                  data-testid={`adv-allowed-cul-${cid}`}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    checked
                      ? 'bg-amber-700/60 border-amber-500 text-amber-50'
                      : 'bg-black/40 border-amber-800/40 text-amber-300/80 hover:border-amber-600'
                  }`}
                >
                  {checked && '✓ '}
                  {c.nombre || c.name}
                </button>
              );
            })}
            {cultureList.length === 0 && (
              <p className="text-xs italic text-amber-300/40">(Cargando culturas…)</p>
            )}
          </div>
          {allowedCulIds.length > 0 && (
            <button
              type="button"
              onClick={() => setField('allowed_culture_ids', [])}
              className="mt-1 text-xs text-amber-300/70 underline"
              data-testid="adv-clear-cultures"
            >
              Limpiar selección
            </button>
          )}
        </div>

        {subcultureOptions.length > 0 && (
          <div>
            <div className="text-xs text-amber-300/80 mb-1">
              Subculturas permitidas (opcional, además de o en lugar de la cultura):
            </div>
            <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
              {subcultureOptions.map((opt) => {
                const checked = allowedSubs.includes(opt.value);
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => toggleSubculture(opt.value)}
                    data-testid={`adv-allowed-sub-${opt.value}`}
                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                      checked
                        ? 'bg-emerald-700/60 border-emerald-500 text-emerald-50'
                        : 'bg-black/40 border-emerald-800/40 text-emerald-300/80 hover:border-emerald-600'
                    }`}
                  >
                    {checked && '✓ '}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {allowedSubs.length > 0 && (
              <button
                type="button"
                onClick={() => setField('allowed_subcultures', [])}
                className="mt-1 text-xs text-emerald-300/70 underline"
                data-testid="adv-clear-subs"
              >
                Limpiar subculturas
              </button>
            )}
          </div>
        )}
      </div>

      <Field label="Visibilidad" hint="Pública: otros DJs pueden verla y clonarla. Privada: sólo tú y el Maestro Supremo.">
        <label className="flex items-center gap-3 mt-2">
          <input
            type="checkbox"
            checked={!!adv.is_public}
            onChange={(e) => setField('is_public', e.target.checked)}
            data-testid="adv-is-public"
            className="w-4 h-4"
          />
          <span className="flex items-center gap-1 text-amber-200/90">
            {adv.is_public ? (
              <>
                <Globe2 className="w-4 h-4 text-emerald-400" /> Pública
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-300/80" /> Privada
              </>
            )}
          </span>
        </label>
      </Field>
    </div>
  </StepCard>
  );
};

const Step2BackgroundAndPremise = ({ adv, setField, patrons }) => {
  const patronOptions = (patrons || [])
    .filter((p) => p.display_name || p.nombre)
    .map((p) => ({
      value: p.id,
      label: `${p.display_name || p.nombre}${p.entity_type ? ` · ${p.entity_type}` : ''}`,
    }));
  return (
  <StepCard title="Trasfondo" description="Trasfondo del lugar, premisa, mecenas, rumores y saber antiguo.">
    <Field label="Trasfondo del lugar" hint="Por qué es interesante o peligroso (notas para el DJ).">
      <TextArea
        value={adv.background}
        onChange={(v) => setField('background', v)}
        rows={6}
        testid="adv-background"
        placeholder="Hace siglos un señor oscuro fue derrotado en estas tierras. Sus hechizos perduran…"
      />
    </Field>

    <div className="mt-4 pt-4 border-t border-amber-800/30">
      <h3 className="text-sm font-bold text-amber-300 mb-3 uppercase tracking-wide">
        Premisa de la aventura
      </h3>
    </div>

    <Field label="¿Qué? — Gancho / estado del mundo" required>
      <TextArea
        value={adv.description}
        onChange={(v) => setField('description', v)}
        placeholder="Una sombra crece en las Tierras Brunas…"
        rows={4}
        testid="adv-description"
      />
    </Field>
    <Field label="¿Por qué? — Motivación de los héroes" required>
      <TextArea
        value={adv.motivation_text}
        onChange={(v) => setField('motivation_text', v)}
        placeholder="Si nadie actúa, las aldeas vecinas caerán antes del invierno."
        rows={3}
        testid="adv-motivation"
      />
    </Field>
    <Field
      label="Mecenas (del catálogo de Reglas → Mecenas)"
      hint="Si lo eliges, se creará automáticamente una relación mecenas↔personaje cuando aceptes jugadores en una campaña activa."
    >
      <Select
        value={adv.patron_id || ''}
        onChange={(v) => {
          if (!v) {
            setField('patron_id', null);
            setField('patron_name', null);
          } else {
            const p = (patrons || []).find((x) => x.id === v);
            setField('patron_id', v);
            setField('patron_name', p?.display_name || p?.nombre || null);
          }
        }}
        options={patronOptions}
        placeholder="Sin mecenas"
        testid="adv-patron-select"
      />
    </Field>
    {!adv.patron_id && (
      <Field label="¿Quién presenta la aventura? (si no hay mecenas)">
        <TextArea
          value={adv.presenter_text}
          onChange={(v) => setField('presenter_text', v)}
          rows={2}
          testid="adv-presenter"
          placeholder="Un mensajero, un sueño profético, un rumor en la posada…"
        />
      </Field>
    )}
    <Field label="Rumor (opcional)" hint="Mezcla de verdad y mentira que oirán los héroes.">
      <TextArea
        value={adv.rumor}
        onChange={(v) => setField('rumor', v)}
        rows={2}
        testid="adv-rumor"
      />
    </Field>
    <Field
      label="Texto para presentar a los personajes"
      hint="Si lo rellenas, podrás mostrarlo a los jugadores al inicio de la historia (lectura en voz alta o pasaje impreso)."
    >
      <TextArea
        value={adv.presentation_text}
        onChange={(v) => setField('presentation_text', v)}
        placeholder="«Hace ya cinco generaciones que las gentes del valle hablan de la luz azul que brilla sobre las nieblas del Sarn…»"
        rows={5}
        testid="adv-presentation-text"
      />
    </Field>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Field label="Saber Antiguo — CD INT" hint="Prueba (no TS)">
        <TextInput
          type="number"
          value={adv.ancient_lore_difficulty}
          onChange={(v) => setField('ancient_lore_difficulty', v)}
          min={5}
          max={30}
          testid="adv-lore-cd"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Texto revelado al superar la prueba">
          <TextArea
            value={adv.ancient_lore_text}
            onChange={(v) => setField('ancient_lore_text', v)}
            rows={2}
            testid="adv-lore-text"
          />
        </Field>
      </div>
    </div>
  </StepCard>
  );
};

const Step6Images = ({ adv, setField, onUploadMap, uploadingMap }) => {
  const handleAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    for (const f of files) {
      if ((adv.maps?.length || 0) >= MAX_MAPS) {
        toast.error(`Máximo ${MAX_MAPS} mapas`);
        break;
      }
      await onUploadMap(f);
    }
  };

  return (
    <StepCard
      title={`Imágenes (${adv.maps?.length || 0}/${MAX_MAPS})`}
      description="Galería general: mapas, retratos, dibujos, esbozos. Hasta 20 imágenes. Cada una ≤ 5 MB."
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleAdd}
        data-testid="map-upload-input"
        disabled={uploadingMap}
        className="text-xs text-amber-300/80 mb-3"
      />
      {uploadingMap && (
        <p className="text-xs text-amber-300/60 mb-3">
          <Loader2 className="w-3 h-3 inline animate-spin" /> Subiendo…
        </p>
      )}
      {adv.maps?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {adv.maps.map((m, idx) => (
            <div
              key={m.id || idx}
              className="relative rounded border border-amber-800/40 overflow-hidden bg-black/40"
              data-testid={`map-tile-${idx}`}
            >
              <AuthenticatedImage
                fileId={m.file_id}
                alt={m.description || `mapa-${idx}`}
                className="w-full h-32 object-cover"
              />
              <input
                type="text"
                value={m.description || ''}
                onChange={(e) => {
                  const newMaps = [...adv.maps];
                  newMaps[idx] = { ...m, description: e.target.value };
                  setField('maps', newMaps);
                }}
                placeholder="Descripción"
                className="w-full px-2 py-1 text-xs bg-black/60 text-amber-200 border-t border-amber-800/40 focus:outline-none"
                data-testid={`map-desc-${idx}`}
              />
              <button
                onClick={() => setField('maps', adv.maps.filter((_, i) => i !== idx))}
                className="absolute top-1 right-1 p-1 rounded bg-rose-900/80 text-rose-100 hover:bg-rose-700"
                data-testid={`remove-map-${idx}`}
                aria-label="Eliminar mapa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </StepCard>
  );
};

const MAX_ENV_IMAGES = 5;

const Step3EnvironmentsAndEvents = ({ adv, setField, locations, onUploadEnvImage, uploadingEnvIdx }) => {
  const envs = adv.environments || [];
  const looseEvents = adv.travel_events || [];

  const update = (idx, key, value) => {
    const next = [...envs];
    next[idx] = { ...next[idx], [key]: value };
    setField('environments', next);
  };
  const addEnv = () => {
    setField('environments', [
      ...envs,
      { title: '', description: '', order_index: envs.length, images: [], travel_events: [] },
    ]);
  };
  const remove = (idx) => setField('environments', envs.filter((_, i) => i !== idx));
  const removeImg = (envIdx, imgIdx) => {
    const next = [...envs];
    next[envIdx] = {
      ...next[envIdx],
      images: (next[envIdx].images || []).filter((_, i) => i !== imgIdx),
    };
    setField('environments', next);
  };

  // Helpers for nested travel events per environment
  const updateEnvEvent = (envIdx, evIdx, key, val) => {
    const events = (envs[envIdx].travel_events || []).slice();
    events[evIdx] = { ...events[evIdx], [key]: val };
    update(envIdx, 'travel_events', events);
  };
  const addEnvEvent = (envIdx) => {
    const events = (envs[envIdx].travel_events || []).slice();
    events.push({ title: '', description: '', player_notes: '' });
    update(envIdx, 'travel_events', events);
  };
  const removeEnvEvent = (envIdx, evIdx) => {
    const events = (envs[envIdx].travel_events || []).filter((_, i) => i !== evIdx);
    update(envIdx, 'travel_events', events);
  };

  // Helpers for "loose" travel events (not linked to any environment)
  const updateLoose = (idx, key, val) => {
    const next = [...looseEvents];
    next[idx] = { ...next[idx], [key]: val };
    setField('travel_events', next);
  };
  const addLoose = () =>
    setField('travel_events', [...looseEvents, { title: '', description: '', player_notes: '' }]);
  const removeLoose = (idx) =>
    setField('travel_events', looseEvents.filter((_, i) => i !== idx));

  return (
    <StepCard
      title={`Entornos (${envs.length})`}
      description="Cada entorno puede anclarse a una ubicación del mapa, llevar imágenes y agrupar sus propios acontecimientos de viaje. Al final añade los acontecimientos sueltos."
    >
      {envs.map((e, idx) => {
        const envLocVal = e.location_id || e.location_name
          ? {
              location_id: e.location_id,
              location_name: e.location_name,
              region: e.region,
              map_x: e.map_x,
              map_y: e.map_y,
            }
          : null;
        const envEvents = e.travel_events || [];
        return (
        <div
          key={e.id || idx}
          className="mb-4 p-3 rounded border border-amber-800/30 bg-black/40"
          data-testid={`env-${idx}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <GripVertical className="w-4 h-4 text-amber-700" />
            <span className="text-amber-300/70 text-sm">#{idx + 1}</span>
            <input
              value={e.title || ''}
              onChange={(ev) => update(idx, 'title', ev.target.value)}
              placeholder="Título del entorno"
              className="flex-1 px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100"
              data-testid={`env-title-${idx}`}
            />
            <button
              onClick={() => remove(idx)}
              className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700"
              data-testid={`env-remove-${idx}`}
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={e.description || ''}
            onChange={(ev) => update(idx, 'description', ev.target.value)}
            placeholder="Descripción"
            rows={3}
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 resize-y mb-2"
            data-testid={`env-desc-${idx}`}
          />

          {/* Per-env location (optional) */}
          <div className="mt-2 mb-3">
            <p className="text-xs text-amber-300/70 mb-1">
              Ubicación concreta del mapa (opcional)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <LocationPickerField
                  locations={locations}
                  value={envLocVal}
                  onChange={(picked) => {
                    update(idx, 'location_id', picked?.location_id || null);
                    update(idx, 'location_name', picked?.location_name || null);
                    update(idx, 'region', picked?.region || null);
                    update(idx, 'map_x', picked?.map_x ?? null);
                    update(idx, 'map_y', picked?.map_y ?? null);
                  }}
                  placeholder="Vincular este entorno a un punto del mapa…"
                  testidPrefix={`env-loc-${idx}`}
                />
              </div>
              <LocationMiniPreview value={envLocVal} locations={locations} height={120} />
            </div>
          </div>

          {/* Imágenes del entorno */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-amber-300/70">
                Imágenes ({(e.images || []).length}/{MAX_ENV_IMAGES})
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(ev) => {
                  const files = Array.from(ev.target.files || []);
                  ev.target.value = '';
                  onUploadEnvImage(idx, files);
                }}
                disabled={uploadingEnvIdx === idx || (e.images || []).length >= MAX_ENV_IMAGES}
                data-testid={`env-img-upload-${idx}`}
                className="text-xs text-amber-300/80"
              />
            </div>
            {uploadingEnvIdx === idx && (
              <p className="text-xs text-amber-300/60 mb-1">
                <Loader2 className="w-3 h-3 inline animate-spin" /> Subiendo…
              </p>
            )}
            {(e.images || []).length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(e.images || []).map((img, j) => (
                  <div
                    key={img.id || j}
                    className="relative rounded overflow-hidden border border-amber-800/40"
                    data-testid={`env-img-${idx}-${j}`}
                  >
                    <AuthenticatedImage
                      fileId={img.file_id}
                      alt={img.description || `entorno-${idx}-${j}`}
                      className="w-full h-20 object-cover"
                    />
                    <button
                      onClick={() => removeImg(idx, j)}
                      className="absolute top-1 right-1 p-1 rounded bg-rose-900/80 text-rose-100 hover:bg-rose-700"
                      data-testid={`env-img-remove-${idx}-${j}`}
                      aria-label="Eliminar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-env travel events */}
          <div className="mt-3 p-2 rounded border border-amber-900/40 bg-black/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-amber-200">
                Acontecimientos de viaje ligados a este entorno ({envEvents.length})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addEnvEvent(idx)}
                data-testid={`env-event-add-${idx}`}
                className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-7 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Añadir
              </Button>
            </div>
            {envEvents.map((ev, eIdx) => (
              <div
                key={ev.id || eIdx}
                className="mb-2 p-2 rounded bg-black/40 border border-amber-900/30 flex gap-2 items-start"
                data-testid={`env-event-${idx}-${eIdx}`}
              >
                <div className="flex-1 space-y-1">
                  <input
                    value={ev.title || ''}
                    onChange={(t) => updateEnvEvent(idx, eIdx, 'title', t.target.value)}
                    placeholder="Título"
                    data-testid={`env-event-title-${idx}-${eIdx}`}
                    className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
                  />
                  <textarea
                    value={ev.description || ''}
                    onChange={(t) => updateEnvEvent(idx, eIdx, 'description', t.target.value)}
                    placeholder="Descripción para el DJ"
                    rows={2}
                    data-testid={`env-event-desc-${idx}-${eIdx}`}
                    className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm resize-y"
                  />
                  <textarea
                    value={ev.player_notes || ''}
                    onChange={(t) => updateEnvEvent(idx, eIdx, 'player_notes', t.target.value)}
                    placeholder="Notas para los personajes (mostrables a discreción del DJ)"
                    rows={2}
                    data-testid={`env-event-pnotes-${idx}-${eIdx}`}
                    className="w-full px-2 py-1 bg-emerald-950/30 border border-emerald-800/40 rounded text-emerald-100 text-sm resize-y"
                  />
                </div>
                <button
                  onClick={() => removeEnvEvent(idx, eIdx)}
                  className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700"
                  data-testid={`env-event-remove-${idx}-${eIdx}`}
                  aria-label="Eliminar acontecimiento"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      );
      })}
      <Button
        onClick={addEnv}
        variant="outline"
        size="sm"
        className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        data-testid="env-add-btn"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir entorno
      </Button>

      {/* ============== Acontecimientos sueltos ============== */}
      <div className="mt-6 pt-4 border-t border-amber-800/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wide">
            Acontecimientos de viaje sueltos ({looseEvents.length})
          </h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLoose}
            data-testid="travel-event-add"
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir suelto
          </Button>
        </div>
        <p className="text-xs text-amber-300/60 mb-3 italic">
          Acontecimientos que pueden ocurrir en cualquier momento del viaje, sin estar atados a un entorno concreto.
        </p>
        {looseEvents.length === 0 && (
          <p className="text-xs italic text-amber-300/40 mb-2">
            Sin acontecimientos sueltos.
          </p>
        )}
        {looseEvents.map((ev, idx) => (
          <div
            key={ev.id || idx}
            className="mb-2 p-2 rounded border border-amber-800/30 bg-black/40 flex gap-2 items-start"
            data-testid={`travel-event-${idx}`}
          >
            <span className="text-amber-300/70 text-sm pt-1 w-8 text-right">#{idx + 1}</span>
            <div className="flex-1 space-y-1">
              <input
                value={ev.title || ''}
                onChange={(e) => updateLoose(idx, 'title', e.target.value)}
                placeholder="Título (p. ej. Emboscada en el vado)"
                data-testid={`travel-event-title-${idx}`}
                className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100"
              />
              <textarea
                value={ev.description || ''}
                onChange={(e) => updateLoose(idx, 'description', e.target.value)}
                placeholder="Descripción para el DJ"
                rows={3}
                data-testid={`travel-event-desc-${idx}`}
                className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm resize-y"
              />
              <textarea
                value={ev.player_notes || ''}
                onChange={(e) => updateLoose(idx, 'player_notes', e.target.value)}
                placeholder="Notas para los personajes (mostrables a discreción del DJ)"
                rows={2}
                data-testid={`travel-event-player-notes-${idx}`}
                className="w-full px-2 py-1 bg-emerald-950/30 border border-emerald-800/40 rounded text-emerald-100 text-sm resize-y"
              />
            </div>
            <button
              onClick={() => removeLoose(idx)}
              className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700"
              data-testid={`travel-event-remove-${idx}`}
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </StepCard>
  );
};

const Step6Intrigues = ({ adv, setField }) => {
  const items = adv.intrigues || [];
  const update = (idx, key, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value };
    setField('intrigues', next);
  };
  const add = () => setField('intrigues', [...items, { description: '', linked_plot: '' }]);
  const remove = (idx) => setField('intrigues', items.filter((_, i) => i !== idx));

  return (
    <StepCard
      title={`Intrigas y problemas (${items.length})`}
      description="Fuerzas externas, sucesos fortuitos, hilos de tramas mayores."
    >
      {items.map((p, idx) => (
        <div
          key={p.id || idx}
          className="mb-3 p-3 rounded border border-amber-800/30 bg-black/40 flex items-start gap-2"
          data-testid={`intrigue-${idx}`}
        >
          <div className="flex-1 space-y-2">
            <textarea
              value={p.description || ''}
              onChange={(ev) => update(idx, 'description', ev.target.value)}
              placeholder="Intriga o problema"
              rows={2}
              className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 resize-y"
              data-testid={`intrigue-desc-${idx}`}
            />
            <input
              value={p.linked_plot || ''}
              onChange={(ev) => update(idx, 'linked_plot', ev.target.value)}
              placeholder="Conexión con tramas mayores (opcional)"
              className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-xs"
              data-testid={`intrigue-plot-${idx}`}
            />
          </div>
          <button
            onClick={() => remove(idx)}
            className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700 self-start"
            data-testid={`intrigue-remove-${idx}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button
        onClick={add}
        variant="outline"
        size="sm"
        className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        data-testid="intrigue-add-btn"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir intriga
      </Button>
    </StepCard>
  );
};

const Step7NPCs = ({ adv, setField, bestiary }) => {
  const items = adv.npcs || [];
  const [search, setSearch] = useState('');
  const [openCustomIdx, setOpenCustomIdx] = useState(null);
  const [previewIdx, setPreviewIdx] = useState(null);
  const [loadingBestiaryIdx, setLoadingBestiaryIdx] = useState(null);
  const filtered = useMemo(() => {
    if (!search) return bestiary;
    const q = search.toLowerCase();
    return bestiary.filter(
      (b) => b.nombre?.toLowerCase().includes(q) || b.tipo?.toLowerCase().includes(q),
    );
  }, [bestiary, search]);

  const update = (idx, key, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value };
    setField('npcs', next);
  };
  const add = (fromBestiary = null) =>
    setField('npcs', [
      ...items,
      fromBestiary
        ? {
            name: fromBestiary.nombre,
            bestiary_id: fromBestiary.id,
            bestiary_categoria: fromBestiary.categoria,
            history: '',
            special: '',
          }
        : { name: '', bestiary_id: null, bestiary_categoria: null, history: '', special: '' },
    ]);
  const addCustom = () => {
    setField('npcs', [
      ...items,
      {
        name: '',
        bestiary_id: null,
        bestiary_categoria: null,
        history: '',
        special: '',
        custom_stats: {
          tipo: '',
          tamanio: 'Mediano',
          alineamiento: '',
          clase_armadura: 10,
          puntos_golpe: 1,
          velocidad: 9,
          atributos: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
          desafio: '',
          especiales: [],
          armas: [],
          reacciones: [],
        },
      },
    ]);
    setOpenCustomIdx(items.length);
  };
  const remove = (idx) => setField('npcs', items.filter((_, i) => i !== idx));

  /**
   * Toma un PNJ del bestiario que se haya añadido como referencia y clona
   * sus stats reales en `custom_stats`, marcándolo como PNJ "especial":
   * a partir de aquí el DJ puede modificar lo que quiera sin afectar al
   * bestiario original. Útil para versionar variantes de un mismo monstruo.
   */
  const buildSpecialFromBestiary = async (idx) => {
    const target = items[idx];
    if (!target?.bestiary_id) return;
    setLoadingBestiaryIdx(idx);
    try {
      const detail = await getNpcDetail(target.bestiary_id);
      const cs = {
        tipo: detail.tipo || '',
        tamanio: detail.tamanio || '',
        alineamiento: detail.alineamiento || '',
        descripcion: detail.descripcion || '',
        clase_armadura: detail.clase_armadura ?? 10,
        descripcion_armadura: detail.descripcion_armadura || '',
        puntos_golpe: detail.puntos_golpe ?? 1,
        dados_golpe: detail.dados_golpe || '',
        velocidad: detail.velocidad ?? 9,
        atributos: detail.atributos || {
          fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10,
        },
        sentidos: detail.sentidos || [],
        idiomas: detail.idiomas || [],
        resistencias: detail.resistencias || [],
        inmunidades_dano: detail.inmunidades_dano || [],
        inmunidades_estados: detail.inmunidades_estados || [],
        vulnerabilidades: detail.vulnerabilidades || [],
        desafio: detail.desafio || '',
        especiales: detail.especiales || [],
        armas: (detail.armas || []).map((a) => ({ ...a, special_text: a.special_text || '' })),
        reacciones: detail.reacciones || [],
        ataque_multiple: detail.ataque_multiple || '',
      };
      const next = [...items];
      next[idx] = {
        ...next[idx],
        // El PNJ ya no es "del bestiario puro" — pasa a ser una variante a medida
        bestiary_id: null,
        bestiary_categoria: target.bestiary_categoria,
        custom_stats: cs,
      };
      setField('npcs', next);
      setOpenCustomIdx(idx);
      toast.success('Base copiada — modifica lo que quieras');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo cargar la base del bestiario');
    } finally {
      setLoadingBestiaryIdx(null);
    }
  };

  return (
    <StepCard
      title={`PNJs (${items.length})`}
      description="Selecciona del bestiario, añade uno libre, o crea uno completo desde cero."
    >
      <div className="mb-4 p-3 rounded border border-amber-800/30 bg-black/30">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-amber-300/60" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en bestiario…"
            className="flex-1 px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 text-sm"
            data-testid="npc-search-input"
          />
        </div>
        <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
          {filtered.slice(0, 50).map((b) => (
            <button
              key={b.id}
              onClick={() => add(b)}
              className="text-left px-2 py-1 text-xs rounded hover:bg-amber-900/30 text-amber-200 border border-amber-800/20"
              data-testid={`bestiary-pick-${b.id}`}
            >
              <span className="text-amber-300">{b.nombre}</span>
              <span className="text-amber-400/50"> · {b.categoria}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            onClick={() => add()}
            variant="outline"
            size="sm"
            className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
            data-testid="npc-add-blank-btn"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Añadir PNJ libre
          </Button>
          <Button
            onClick={addCustom}
            variant="outline"
            size="sm"
            className="border-emerald-700/50 text-emerald-200 hover:bg-emerald-900/30"
            data-testid="npc-add-custom-btn"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Crear PNJ desde 0 (combate)
          </Button>
        </div>
      </div>

      {items.map((n, idx) => (
        <div
          key={n.id || idx}
          className="mb-3 p-3 rounded border border-amber-800/30 bg-black/40"
          data-testid={`npc-${idx}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <input
              value={n.name}
              onChange={(ev) => update(idx, 'name', ev.target.value)}
              placeholder="Nombre"
              className="flex-1 px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100"
              data-testid={`npc-name-${idx}`}
            />
            {n.bestiary_categoria && (
              <span className="text-xs text-amber-400/70 px-2 py-0.5 rounded bg-amber-900/30">
                {n.bestiary_categoria}
              </span>
            )}
            {n.custom_stats && (
              <span className="text-xs text-emerald-300 px-2 py-0.5 rounded bg-emerald-900/30">
                A medida
              </span>
            )}
            <button
              onClick={() => remove(idx)}
              className="p-1.5 rounded bg-rose-900/60 text-rose-100 hover:bg-rose-700"
              data-testid={`npc-remove-${idx}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <textarea
            value={n.history || ''}
            onChange={(ev) => update(idx, 'history', ev.target.value)}
            placeholder="Historia (opcional)"
            rows={2}
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 mb-2"
            data-testid={`npc-history-${idx}`}
          />
          <textarea
            value={n.special || ''}
            onChange={(ev) => update(idx, 'special', ev.target.value)}
            placeholder="Especiales (opcional)"
            rows={2}
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100"
            data-testid={`npc-special-${idx}`}
          />

          {/* Bloque a medida */}
          {n.custom_stats !== undefined && n.custom_stats !== null ? (
            <div className="mt-2">
              <div className="flex gap-3 mb-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOpenCustomIdx(openCustomIdx === idx ? null : idx)}
                  className="text-xs text-emerald-300 underline"
                  data-testid={`npc-toggle-custom-${idx}`}
                >
                  {openCustomIdx === idx ? '▼ Ocultar bloque de combate' : '▶ Editar bloque de combate'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewIdx(previewIdx === idx ? null : idx)}
                  className="text-xs text-amber-300 underline"
                  data-testid={`npc-toggle-preview-${idx}`}
                >
                  {previewIdx === idx ? '▼ Ocultar previsualización' : '👁 Ver ficha de combate'}
                </button>
              </div>
              {openCustomIdx === idx && (
                <NPCStatBlockEditor
                  value={n.custom_stats || {}}
                  onChange={(val) => update(idx, 'custom_stats', val)}
                  idPrefix={`npc-block-${idx}`}
                />
              )}
              {previewIdx === idx && (
                <div className="mt-3">
                  <NPCStatBlockPreview name={n.name} npc={n.custom_stats || {}} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap mt-2">
              <button
                type="button"
                onClick={() => {
                  update(idx, 'custom_stats', {
                    tipo: '',
                    tamanio: 'Mediano',
                    clase_armadura: 10,
                    puntos_golpe: 1,
                    velocidad: 9,
                    atributos: { fuerza: 10, destreza: 10, constitucion: 10, inteligencia: 10, sabiduria: 10, carisma: 10 },
                    especiales: [],
                    armas: [],
                  });
                  setOpenCustomIdx(idx);
                }}
                className="text-xs text-emerald-300 underline"
                data-testid={`npc-promote-custom-${idx}`}
              >
                + Convertir en PNJ con bloque de combate
              </button>
              {n.bestiary_id && (
                <button
                  type="button"
                  onClick={() => buildSpecialFromBestiary(idx)}
                  disabled={loadingBestiaryIdx === idx}
                  className="text-xs text-amber-300 underline disabled:opacity-50"
                  data-testid={`npc-make-special-${idx}`}
                >
                  {loadingBestiaryIdx === idx
                    ? 'Cargando base…'
                    : '✦ Crear PNJ especial sobre esta base'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </StepCard>
  );
};

// ============================================================================
// Main page
// ============================================================================
const AdventureWizardPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [adv, setAdv] = useState(null);
  const [activeStep, setActiveStep] = useState('basic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [bestiary, setBestiary] = useState([]);
  const [patrons, setPatrons] = useState([]);
  const [cultures, setCultures] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [locationsRaw, setLocationsRaw] = useState([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [uploadingEnvIdx, setUploadingEnvIdx] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [activatedRun, setActivatedRun] = useState(null);

  // Initial load
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        const [a, locs, beasts, pats, culs] = await Promise.all([
          getAdventure(id),
          getLocations().catch(() => []),
          getBestiary().catch(() => ({})),
          getPatrons().catch(() => []),
          getCultures().catch(() => []),
        ]);
        if (!alive) return;
        setAdv(a);
        setLocationsRaw(locs || []);
        setPatrons(pats || []);
        setCultures(Array.isArray(culs) ? culs : (culs?.cultures || []));
        setLocationOptions(
          (locs || []).map((l) => ({
            value: l.id,
            label: `${l.nombre}${l.region ? ` · ${l.region}` : ''}`,
            locationName: l.nombre,
            region: l.region,
          })),
        );
        // bestiary endpoint returns { malignos:[], pnj:[], animales:[], especiales:[] }
        const flat = [];
        if (beasts && typeof beasts === 'object') {
          for (const cat of ['malignos', 'pnj', 'animales', 'especiales']) {
            for (const b of beasts[cat] || []) {
              flat.push({ ...b, categoria: cat });
            }
          }
        }
        setBestiary(flat);
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'No se pudo cargar la aventura');
        navigate('/aventuras');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  const setField = (key, value) => {
    setDirty(true);
    setAdv((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveStep = async () => {
    if (!adv || !dirty) {
      toast.message('Sin cambios');
      return;
    }
    setSaving(true);
    try {
      // Build a partial update with all the editable fields. The backend
      // is permissive — sending the whole doc is fine and avoids drift.
      const payload = {
        name: adv.name,
        image_file_id: adv.image_file_id,
        image_path: adv.image_path,
        year: adv.year,
        season: adv.season,
        month: adv.month,
        day: adv.day,
        location_id: adv.location_id,
        location_name: adv.location_name,
        region: adv.region,
        description: adv.description,
        motivation_text: adv.motivation_text,
        patron_id: adv.patron_id,
        patron_name: adv.patron_name,
        presenter_text: adv.presenter_text,
        rumor: adv.rumor,
        presentation_text: adv.presentation_text,
        ancient_lore_difficulty: adv.ancient_lore_difficulty,
        ancient_lore_text: adv.ancient_lore_text,
        background: adv.background,
        travel_events_text: adv.travel_events_text,
        travel_events: adv.travel_events || [],
        travel_route: adv.travel_route || [],
        environments: adv.environments || [],
        intrigues: adv.intrigues || [],
        npcs: adv.npcs || [],
        maps: adv.maps || [],
        max_players: adv.max_players,
        allow_multi_characters: adv.allow_multi_characters,
        max_characters_per_player: adv.max_characters_per_player,
        recommended_level_min: adv.recommended_level_min,
        recommended_level_max: adv.recommended_level_max,
        allowed_culture_ids: adv.allowed_culture_ids || [],
        allowed_subcultures: adv.allowed_subcultures || [],
        xp_pool: adv.xp_pool === '' || adv.xp_pool === undefined || adv.xp_pool === null
          ? null
          : Number(adv.xp_pool),
        is_public: adv.is_public,
      };
      const updated = await updateAdventure(id, payload);
      setAdv(updated);
      setDirty(false);
      toast.success('Cambios guardados');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadCover = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) {
      toast.error(`La imagen supera 5 MB (${(f.size / (1024 * 1024)).toFixed(2)} MB)`);
      e.target.value = '';
      return;
    }
    setUploadingCover(true);
    try {
      const res = await uploadAdventureImage(f, { description: `cover-${id}` });
      setField('image_file_id', res.file_id);
      setField('image_path', res.path);
      toast.success('Imagen subida');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error subiendo imagen');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleUploadMap = async (file) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`"${file.name}" supera 5 MB`);
      return;
    }
    setUploadingMap(true);
    try {
      const res = await uploadAdventureImage(file, { description: `map-${id}` });
      setField('maps', [
        ...(adv.maps || []),
        { file_id: res.file_id, path: res.path, description: '' },
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error subiendo mapa');
    } finally {
      setUploadingMap(false);
    }
  };

  const handleUploadEnvImage = async (envIdx, files) => {
    if (!files?.length) return;
    setUploadingEnvIdx(envIdx);
    try {
      const current = adv.environments || [];
      const env = current[envIdx];
      const newImgs = [...(env.images || [])];
      for (const f of files) {
        if (newImgs.length >= 5) {
          toast.error('Máximo 5 imágenes por entorno');
          break;
        }
        if (f.size > MAX_IMAGE_BYTES) {
          toast.error(`"${f.name}" supera 5 MB`);
          continue;
        }
        const res = await uploadAdventureImage(f, { description: `env-${id}-${envIdx}` });
        newImgs.push({ file_id: res.file_id, path: res.path, description: '' });
      }
      const next = [...current];
      next[envIdx] = { ...env, images: newImgs };
      setField('environments', next);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Error subiendo imagen de entorno');
    } finally {
      setUploadingEnvIdx(null);
    }
  };

  const handleGenerateRun = async () => {
    if (dirty) {
      toast.error('Guarda los cambios antes de generar la campaña');
      return;
    }
    setGenerating(true);
    try {
      const run = await generateCampaignRun(id);
      setActivatedRun(run);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo generar la campaña');
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !adv) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  const canEdit = user?.role === 'maestro' || adv.creator_dm_id === user?.id;

  return (
    <div
      className="min-h-screen relative"
      data-testid="adventure-wizard-page"
      style={{
        backgroundImage:
          'url(https://customer-assets.emergentagent.com/job_fab028bf-4de6-413f-8616-34827bc574a6/artifacts/j31eritq_Fondo.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/75" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        {/* ========== Persistent header ========== */}
        <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-amber-700/40 -mx-4 px-4 py-3 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/aventuras')}
                className="text-amber-200 hover:bg-amber-900/30 shrink-0"
                data-testid="back-to-list-btn"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Aventuras
              </Button>
              <div className="min-w-0">
                <h1
                  className="font-heading text-xl sm:text-2xl text-amber-300 truncate"
                  data-testid="header-name"
                  title={adv.name}
                >
                  {adv.name || '(sin nombre)'}
                </h1>
                <div className="text-xs text-amber-300/60 truncate">
                  DJ: {adv.creator_name || '—'} · Cuándo:{' '}
                  {adv.year ? `${adv.year} T.E.` : '—'}
                  {adv.season ? ` · ${adv.season}` : ''} · Dónde:{' '}
                  {adv.location_name || adv.region || '—'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
                data-testid="preview-btn"
              >
                <Eye className="w-4 h-4 mr-1" /> Previsualizar
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={handleSaveStep}
                  disabled={saving}
                  className="bg-amber-700 hover:bg-amber-600 text-amber-50 border border-amber-500/40"
                  data-testid="save-step-btn"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Guardar
                </Button>
              )}
              {canEdit && (
                <Button
                  size="sm"
                  onClick={handleGenerateRun}
                  disabled={generating || dirty}
                  className="bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 text-amber-50 border border-amber-400/50 shadow-lg shadow-amber-700/30"
                  data-testid="generate-run-btn"
                  title={dirty ? 'Guarda primero' : 'Crear instancia jugable'}
                >
                  {generating ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  Generar Campaña
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ========== Step tabs ========== */}
        <div className="flex flex-wrap gap-1 mb-4">
          {STEPS.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(s.id)}
              data-testid={`step-tab-${s.id}`}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                activeStep === s.id
                  ? 'bg-amber-700 text-amber-50'
                  : 'bg-black/40 text-amber-300/70 hover:bg-amber-900/30'
              }`}
            >
              <span className="text-amber-400/60 mr-1">{idx + 1}.</span>
              {s.label}
            </button>
          ))}
        </div>

        {!canEdit && (
          <div className="rounded border border-amber-700/40 bg-amber-900/20 px-3 py-2 mb-3 text-xs text-amber-200/90">
            Estás viendo esta aventura en modo lectura. Para modificarla, clónala desde el
            listado.
          </div>
        )}

        {/* ========== Active step ========== */}
        <div className={canEdit ? '' : 'opacity-70 pointer-events-none'}>
          {activeStep === 'basic' && (
            <Step1BasicAndConfig
              adv={adv}
              setField={setField}
              locations={locationsRaw}
              cultures={cultures}
              onUploadCover={handleUploadCover}
              uploadingCover={uploadingCover}
            />
          )}
          {activeStep === 'background' && (
            <Step2BackgroundAndPremise adv={adv} setField={setField} patrons={patrons} />
          )}
          {activeStep === 'environments' && (
            <Step3EnvironmentsAndEvents
              adv={adv}
              setField={setField}
              locations={locationsRaw}
              onUploadEnvImage={handleUploadEnvImage}
              uploadingEnvIdx={uploadingEnvIdx}
            />
          )}
          {activeStep === 'intrigues' && <Step6Intrigues adv={adv} setField={setField} />}
          {activeStep === 'npcs' && (
            <Step7NPCs adv={adv} setField={setField} bestiary={bestiary} />
          )}
          {activeStep === 'images' && (
            <Step6Images
              adv={adv}
              setField={setField}
              onUploadMap={handleUploadMap}
              uploadingMap={uploadingMap}
            />
          )}
        </div>

        {/* Footer save reminder */}
        {canEdit && dirty && (
          <div className="text-xs text-amber-300/60 text-center my-4">
            Tienes cambios sin guardar — pulsa <strong>Guardar</strong> arriba.
          </div>
        )}
      </div>

      <AdventurePreview
        adv={adv}
        open={showPreview}
        onClose={() => setShowPreview(false)}
        backendUrl={BACKEND_URL}
      />

      <CampaignActivatedDialog
        run={activatedRun}
        open={!!activatedRun}
        onClose={() => setActivatedRun(null)}
      />
    </div>
  );
};

export default AdventureWizardPage;
