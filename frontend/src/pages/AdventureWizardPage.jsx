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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  getAdventure,
  updateAdventure,
  uploadAdventureImage,
  getBestiary,
  getLocations,
} from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Field, TextInput, TextArea, Select, StepCard } from '@/components/adventures/WizardFields';
import AdventurePreview from '@/components/adventures/AdventurePreview';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const MAX_IMAGE_BYTES = 0.5 * 1024 * 1024; // 0.5 MB
const MAX_MAPS = 20;

const STEPS = [
  { id: 'basic', label: 'Datos básicos' },
  { id: 'premise', label: 'Premisa' },
  { id: 'background', label: 'Trasfondo' },
  { id: 'maps', label: 'Mapas' },
  { id: 'environments', label: 'Entornos' },
  { id: 'intrigues', label: 'Intrigas' },
  { id: 'npcs', label: 'PNJs' },
  { id: 'config', label: 'Configuración' },
];

const SEASONS = [
  { value: 'primavera', label: 'Primavera' },
  { value: 'verano', label: 'Verano' },
  { value: 'otono', label: 'Otoño' },
  { value: 'invierno', label: 'Invierno' },
];

// ============================================================================
// Step components
// ============================================================================
const Step1Basic = ({ adv, setField, locationOptions, onUploadCover, uploadingCover }) => (
  <StepCard
    title="Datos básicos"
    description="Nombre, imagen de carátula, año T.E. y ubicación principal."
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

    <Field label="Imagen de carátula (≤ 0.5 MB)" hint="Formatos: PNG, JPG, WEBP">
      <div className="flex items-center gap-3">
        {adv.image_file_id ? (
          
          <img
            src={`${BACKEND_URL}/api/storage/download/${adv.image_file_id}`}
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

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <Field label="Estación" testid="season">
        <Select
          value={adv.season}
          onChange={(v) => setField('season', v)}
          options={SEASONS}
          testid="adv-season-select"
        />
      </Field>
      <Field label="Mes (1-12)" testid="month">
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

    <Field label="Ubicación principal" hint="Opcional. Selecciona del listado.">
      <Select
        value={adv.location_id}
        onChange={(v) => {
          const loc = locationOptions.find((l) => l.value === v);
          setField('location_id', v);
          setField('location_name', loc?.locationName || null);
          setField('region', loc?.region || null);
        }}
        options={locationOptions}
        testid="adv-location-select"
        placeholder="Sin ubicación específica"
      />
    </Field>
  </StepCard>
);

const Step2Premise = ({ adv, setField }) => (
  <StepCard title="Premisa" description="¿Qué pasa, por qué les importa, quién lo cuenta?">
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
    <Field label="Mecenas (opcional, nombre)">
      <TextInput
        value={adv.patron_name}
        onChange={(v) => setField('patron_name', v)}
        placeholder="Aragorn, Gandalf, Lord Elrond…"
        testid="adv-patron-name"
      />
    </Field>
    {!adv.patron_name && (
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

const Step3Background = ({ adv, setField }) => (
  <StepCard title="Trasfondo y viaje" description="Notas para el DJ.">
    <Field label="Trasfondo del lugar" hint="Por qué es interesante o peligroso.">
      <TextArea
        value={adv.background}
        onChange={(v) => setField('background', v)}
        rows={6}
        testid="adv-background"
      />
    </Field>
    <Field label="Acontecimientos de viaje" hint="Encuentros / accidentes posibles durante el viaje.">
      <TextArea
        value={adv.travel_events_text}
        onChange={(v) => setField('travel_events_text', v)}
        rows={5}
        testid="adv-travel-events"
      />
    </Field>
  </StepCard>
);

const Step4Maps = ({ adv, setField, onUploadMap, uploadingMap }) => {
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
      title={`Mapas (${adv.maps?.length || 0}/${MAX_MAPS})`}
      description="Hasta 20 imágenes. Cada una ≤ 0.5 MB."
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
              
              <img
                src={`${BACKEND_URL}/api/storage/download/${m.file_id}`}
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

const Step5Environments = ({ adv, setField }) => {
  const envs = adv.environments || [];
  const update = (idx, key, value) => {
    const next = [...envs];
    next[idx] = { ...next[idx], [key]: value };
    setField('environments', next);
  };
  const addEnv = () => {
    setField('environments', [
      ...envs,
      { title: '', description: '', order_index: envs.length },
    ]);
  };
  const remove = (idx) => setField('environments', envs.filter((_, i) => i !== idx));

  return (
    <StepCard
      title={`Entornos (${envs.length})`}
      description="Lista numerada de entornos clave del módulo."
    >
      {envs.map((e, idx) => (
        <div
          key={e.id || idx}
          className="mb-3 p-3 rounded border border-amber-800/30 bg-black/40"
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
            className="w-full px-2 py-1 bg-black/60 border border-amber-800/40 rounded text-amber-100 resize-y"
            data-testid={`env-desc-${idx}`}
          />
        </div>
      ))}
      <Button
        onClick={addEnv}
        variant="outline"
        size="sm"
        className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30"
        data-testid="env-add-btn"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Añadir entorno
      </Button>
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
  const remove = (idx) => setField('npcs', items.filter((_, i) => i !== idx));

  return (
    <StepCard
      title={`PNJs (${items.length})`}
      description="Selecciona del bestiario o añade uno libremente."
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
        <Button
          onClick={() => add()}
          variant="outline"
          size="sm"
          className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 mt-2"
          data-testid="npc-add-blank-btn"
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir PNJ libre
        </Button>
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
        </div>
      ))}
    </StepCard>
  );
};

const Step8Config = ({ adv, setField }) => (
  <StepCard
    title="Configuración"
    description="Jugadores, niveles, visibilidad. Esto se aplicará al generar Campaña."
  >
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
  </StepCard>
);

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
  const [locationOptions, setLocationOptions] = useState([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Initial load
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        const [a, locs, beasts] = await Promise.all([
          getAdventure(id),
          getLocations().catch(() => []),
          getBestiary().catch(() => ({})),
        ]);
        if (!alive) return;
        setAdv(a);
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
        ancient_lore_difficulty: adv.ancient_lore_difficulty,
        ancient_lore_text: adv.ancient_lore_text,
        background: adv.background,
        travel_events_text: adv.travel_events_text,
        environments: adv.environments || [],
        intrigues: adv.intrigues || [],
        npcs: adv.npcs || [],
        maps: adv.maps || [],
        max_players: adv.max_players,
        allow_multi_characters: adv.allow_multi_characters,
        max_characters_per_player: adv.max_characters_per_player,
        recommended_level_min: adv.recommended_level_min,
        recommended_level_max: adv.recommended_level_max,
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
      toast.error(`La imagen supera 0.5 MB (${(f.size / 1024).toFixed(0)} KB)`);
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
      toast.error(`"${file.name}" supera 0.5 MB`);
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
            <Step1Basic
              adv={adv}
              setField={setField}
              locationOptions={locationOptions}
              onUploadCover={handleUploadCover}
              uploadingCover={uploadingCover}
            />
          )}
          {activeStep === 'premise' && <Step2Premise adv={adv} setField={setField} />}
          {activeStep === 'background' && <Step3Background adv={adv} setField={setField} />}
          {activeStep === 'maps' && (
            <Step4Maps
              adv={adv}
              setField={setField}
              onUploadMap={handleUploadMap}
              uploadingMap={uploadingMap}
            />
          )}
          {activeStep === 'environments' && <Step5Environments adv={adv} setField={setField} />}
          {activeStep === 'intrigues' && <Step6Intrigues adv={adv} setField={setField} />}
          {activeStep === 'npcs' && (
            <Step7NPCs adv={adv} setField={setField} bestiary={bestiary} />
          )}
          {activeStep === 'config' && <Step8Config adv={adv} setField={setField} />}
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
    </div>
  );
};

export default AdventureWizardPage;
