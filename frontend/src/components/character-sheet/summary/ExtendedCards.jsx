/**
 * ExtendedCards
 * Tarjetas adicionales de la Oleada 3 (campos extendidos de la ficha).
 * Siguiendo feedback del usuario:
 *  • Sexo / nombre del jugador / salvaciones competencia /
 *    competencias herramientas / maldición de la sombra son SOLO LECTURA
 *    (se rellenan en la creación del personaje).
 *  • Mecenas se selecciona de la lista existente (`/api/data/mecenas`).
 *  • Especiales de profesión son SOLO LECTURA (definidos por nivel).
 *  • Puntos de Sombra y Cicatrices conviven en la pestaña Sombra.
 *  • WeightEncumbranceCard: reglas LotR 5e Mod del usuario:
 *      - capacidad normal: FUE × 8 kg (ajustada por tamaño)
 *      - empujar/arrastrar/levantar: FUE × 16 kg
 *      - cargado: > FUE × 2.5 → -33 % de movimiento
 *      - muy cargado: > FUE × 5 → -66 % de movimiento + desventaja
 *      - tamaño Grande ×2, Pequeño/Hobbit ÷2
 *  • Notas privadas: lista de entradas (preparada para autor/campaña
 *    cuando llegue auth/RBAC).
 */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Skull, Heart, Shield, Wrench, BookOpen, Crown, Award,
  ScrollText, Sparkles, Save, Plus, X, Weight,
  AlertTriangle, Footprints, User as UserIcon, Eye, EyeOff,
  Lock,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);
const modString = (m) => (m >= 0 ? `+${m}` : `${m}`);

const ATTR_ES = {
  fuerza: 'Fuerza', destreza: 'Destreza', constitucion: 'Constitución',
  inteligencia: 'Inteligencia', sabiduria: 'Sabiduría', carisma: 'Carisma',
};

const proficiencyByLevel = (lvl) => Math.ceil(1 + Number(lvl || 1) / 4);

// Helper genérico de PATCH
async function persistField(characterId, payload, onUpdate) {
  try {
    const res = await api.patch(`/characters/${characterId}`, payload);
    if (onUpdate) onUpdate(res.data);
    toast.success('Guardado.');
    return res.data;
  } catch (err) {
    console.error(err);
    toast.error('No se pudo guardar.');
    return null;
  }
}

// ─── Header info: SOLO LECTURA para nombre del jugador y sexo ──────────
export const HeaderInfoCard = ({ character, onUpdate }) => {
  const [iniciativaBonus, setIniciativaBonus] = useState(character?.iniciativa_bonus || 0);
  const dexMod = modFromScore(character?.atributos?.destreza);
  const iniciativaTotal = dexMod + Number(iniciativaBonus || 0);
  const profBonus = proficiencyByLevel(character?.nivel);

  useEffect(() => setIniciativaBonus(character?.iniciativa_bonus || 0), [character?.id]);

  const saveBonus = () => persistField(character?.id, {
    iniciativa_bonus: Number(iniciativaBonus || 0),
  }, onUpdate);

  const sexoLabel = character?.sexo || character?.genero || '—';
  const playerLabel = character?.nombre_jugador || '—';

  return (
    <Card className="card-parchment" data-testid="header-info-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <UserIcon className="w-5 h-5" /> Identidad y métricas básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/20 p-2 rounded">
            <Label className="text-[10px] text-muted-foreground">Nombre del jugador</Label>
            <p className="text-sm font-medium" data-testid="player-name-display">{playerLabel}</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <Label className="text-[10px] text-muted-foreground">Sexo</Label>
            <p className="text-sm font-medium" data-testid="character-sex-display">{sexoLabel}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Estos datos se establecen en la creación del personaje y no se
          modifican aquí.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/20 p-2 rounded text-center">
            <p className="text-[10px] text-muted-foreground">Bonif. competencia</p>
            <p className="font-mono text-xl font-bold text-[hsl(var(--gold))]">+{profBonus}</p>
          </div>
          <div className="bg-black/20 p-2 rounded text-center">
            <p className="text-[10px] text-muted-foreground">Iniciativa</p>
            <p className="font-mono text-xl font-bold text-emerald-300" data-testid="initiative-total">
              {modString(iniciativaTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground">DES {modString(dexMod)}</p>
          </div>
          <div>
            <Label className="text-[10px]">Bonus iniciativa extra</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                value={iniciativaBonus}
                onChange={e => setIniciativaBonus(e.target.value)}
                className="h-8 text-center"
                data-testid="initiative-bonus-input"
              />
              <Button size="sm" onClick={saveBonus} title="Guardar bonus" data-testid="initiative-bonus-save">
                <Save className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Tiradas de salvación SOLO LECTURA ─────────────────────────────────
export const SavingThrowsCard = ({ character }) => {
  const profBonus = proficiencyByLevel(character?.nivel);
  const competencias = character?.salvaciones_competencia || [];

  return (
    <Card className="card-parchment" data-testid="saving-throws-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Shield className="w-5 h-5" /> Tiradas de salvación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(ATTR_ES).map(([key, label]) => {
            const m = modFromScore(character?.atributos?.[key]);
            const isComp = competencias.includes(key);
            const total = isComp ? m + profBonus : m;
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-2 rounded border ${isComp ? 'border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/5' : 'border-border/30 bg-black/20'}`}
                data-testid={`save-row-${key}`}
              >
                <div className="flex items-center gap-2">
                  {isComp
                    ? <span className="w-3 h-3 rounded-full bg-[hsl(var(--gold))]" title="Competencia" />
                    : <span className="w-3 h-3 rounded-full border border-muted-foreground/40" />}
                  <span className="text-sm">{label}</span>
                </div>
                <span className={`font-mono font-bold ${isComp ? 'text-[hsl(var(--gold))]' : 'text-foreground'}`}>
                  {modString(total)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2">
          Las competencias en salvaciones se definen en la creación
          del personaje y no se modifican aquí.
        </p>
      </CardContent>
    </Card>
  );
};

// ─── Salvaciones contra muerte ────────────────────────────────────────
export const DeathSavesCard = ({ character, onUpdate }) => {
  const sm = character?.salvaciones_muerte || { exitos: 0, fracasos: 0 };
  const [exitos, setExitos] = useState(sm.exitos || 0);
  const [fracasos, setFracasos] = useState(sm.fracasos || 0);

  useEffect(() => {
    const v = character?.salvaciones_muerte || { exitos: 0, fracasos: 0 };
    setExitos(v.exitos || 0); setFracasos(v.fracasos || 0);
  }, [character?.id]);

  const update = (e, f) => {
    setExitos(e); setFracasos(f);
    persistField(character?.id, { salvaciones_muerte: { exitos: e, fracasos: f } }, onUpdate);
  };
  const reset = () => update(0, 0);

  const Dot = ({ filled, color, onClick, testId }) => (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`w-6 h-6 rounded-full border-2 transition-all ${filled
        ? (color === 'green' ? 'bg-emerald-500 border-emerald-300' : 'bg-red-500 border-red-300')
        : 'bg-transparent border-muted-foreground/40 hover:border-muted-foreground'}`}
    />
  );

  return (
    <Card className="card-parchment" data-testid="death-saves-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Skull className="w-5 h-5" /> Salvaciones contra la muerte
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 rounded bg-emerald-900/20 border border-emerald-500/30">
            <span className="text-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-emerald-400" /> Éxitos
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <Dot key={n} filled={exitos >= n} color="green"
                  onClick={() => update(exitos >= n ? n - 1 : n, fracasos)}
                  testId={`death-save-success-${n}`} />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-red-900/20 border border-red-500/30">
            <span className="text-sm flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-400" /> Fracasos
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <Dot key={n} filled={fracasos >= n} color="red"
                  onClick={() => update(exitos, fracasos >= n ? n - 1 : n)}
                  testId={`death-save-fail-${n}`} />
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={reset} data-testid="death-saves-reset">
              <X className="w-3.5 h-3.5 mr-1" /> Reiniciar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Peso transportado / capacidad / estorbo (reglas LotR 5e Mod) ─────
// Cache global de pesos: nombre normalizado → kg.
let _pesoCache = null;
const normalizar = (s) => (s || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
  .replace(/\s+\(.*?\)/g, '')   // quita "(20)" de "Flecha (20)"
  .replace(/\s+x\d+$/, '')      // quita "x2" final
  .replace(/[\[\]]/g, '')       // quita corchetes
  .trim();

const cargarPesos = async () => {
  if (_pesoCache) return _pesoCache;
  const cache = {};
  try {
    const [w, a, e] = await Promise.allSettled([
      api.get('/data/weapons'),
      api.get('/data/armors'),
      api.get('/data/equipment-catalog'),
    ]);
    const collect = (r) => {
      if (r.status !== 'fulfilled' || !r.value?.data) return [];
      const d = r.value.data;
      if (Array.isArray(d)) return d;
      for (const v of Object.values(d)) if (Array.isArray(v)) return v;
      return [];
    };
    [...collect(w), ...collect(a), ...collect(e)].forEach(it => {
      const n = normalizar(it?.nombre);
      const peso = Number(it?.peso_kg ?? it?.peso ?? 0);
      if (n && peso > 0) cache[n] = peso;
    });
  } catch (err) {
    console.warn('No se pudo cargar la tabla de pesos:', err);
  }
  _pesoCache = cache;
  return cache;
};

export const WeightEncumbranceCard = ({ character, onUpdate }) => {
  const [pesoMap, setPesoMap] = useState({});
  useEffect(() => { cargarPesos().then(setPesoMap); }, []);

  const inventario = character?.inventario || [];
  const fuerza = Number(character?.atributos?.fuerza ?? 10);
  const tam = (character?.tamano || character?.cultura_tamano || '').toLowerCase();
  const isSmall = tam.includes('peque') || tam.includes('small') || tam.includes('hobbit');
  const isLarge = tam.includes('grande') || tam.includes('large');
  const sizeMul = isLarge ? 2 : isSmall ? 0.5 : 1;

  // Reglas del usuario (LotR 5e Mod)
  const cargaMaxima = +(fuerza * 8 * sizeMul).toFixed(1);
  const empujarArrastrar = +(fuerza * 16 * sizeMul).toFixed(1);
  const umbralCargado = +(fuerza * 2.5 * sizeMul).toFixed(1);
  const umbralMuyCargado = +(fuerza * 5 * sizeMul).toFixed(1);

  // Suma peso del inventario (mira en pesoMap si el item no trae peso propio)
  const pesoTotal = useMemo(() => {
    return inventario.reduce((acc, it) => {
      // Ignora items "portado_por": "montura" — los lleva el animal.
      if ((it?.portado_por || '').toLowerCase() === 'montura') return acc;
      const cant = Number(it?.cantidad || 1);
      const propio = Number(it?.peso_kg ?? it?.peso ?? 0);
      let peso = propio;
      if (!peso) peso = pesoMap[normalizar(it?.nombre)] || 0;
      return acc + peso * cant;
    }, 0);
  }, [inventario, pesoMap]);

  const monturaCarga = !!character?.montura?.transporta_equipo;
  const pesoEfectivo = monturaCarga ? 0 : pesoTotal;

  // Estado: descargado / cargado / muy cargado / sobrepeso
  let estado = 'Sin estorbo';
  let factorMov = 1;
  let estorboM = 0;
  let color = 'text-emerald-300';
  let desventajaTiradas = false;
  if (pesoEfectivo > cargaMaxima) {
    estado = 'Sobrecargado (no puedes moverte con normalidad)';
    factorMov = 0; color = 'text-red-500'; desventajaTiradas = true;
  } else if (pesoEfectivo > umbralMuyCargado) {
    estado = 'Muy cargado (-66 % movimiento, desventaja en FUE/DES/CON)';
    factorMov = 1 / 3; color = 'text-red-400'; desventajaTiradas = true;
  } else if (pesoEfectivo > umbralCargado) {
    estado = 'Cargado (-33 % movimiento)';
    factorMov = 2 / 3; color = 'text-orange-300';
  }

  const velBase = Number(character?.velocidad || character?.cultura_velocidad || 9);
  const velEfectiva = Math.max(0, Math.round(velBase * factorMov));
  estorboM = velEfectiva - velBase; // negativo o 0

  // Persiste el estorbo en metros (lo lee el sistema de viaje).
  useEffect(() => {
    if (!character?.id) return;
    const prev = Number(character?.estorbo_metros ?? 0);
    if (prev === estorboM) return;
    api.patch(`/characters/${character.id}`, { estorbo_metros: estorboM })
      .then(res => onUpdate && onUpdate(res.data))
      .catch(() => {});
  }, [character?.id, estorboM]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="card-parchment" data-testid="weight-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Weight className="w-5 h-5" /> Peso y carga
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Transportado</p>
            <p className="font-mono font-bold" data-testid="weight-transported">{pesoTotal.toFixed(1)} kg</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Carga máxima (FUE×8)</p>
            <p className="font-mono font-bold">{cargaMaxima} kg</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Empujar/arrastrar (FUE×16)</p>
            <p className="font-mono">{empujarArrastrar} kg</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Velocidad efectiva</p>
            <p className="font-mono font-bold text-amber-200" data-testid="effective-speed">{velEfectiva} m</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-orange-900/15 border border-orange-500/30 p-1.5 rounded">
            <span className="text-[10px] text-muted-foreground">Cargado a partir de </span>
            <span className="font-mono text-orange-300">{umbralCargado} kg</span>
          </div>
          <div className="bg-red-900/15 border border-red-500/30 p-1.5 rounded">
            <span className="text-[10px] text-muted-foreground">Muy cargado a partir de </span>
            <span className="font-mono text-red-300">{umbralMuyCargado} kg</span>
          </div>
        </div>
        <div className={`p-2 rounded border text-sm flex items-center gap-2 ${factorMov === 1 ? 'border-emerald-500/30 bg-emerald-900/10' : 'border-orange-500/40 bg-orange-900/10'}`}>
          {factorMov === 1
            ? <Footprints className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />}
          <span className={`font-medium ${color}`} data-testid="encumbrance-label">{estado}</span>
          {monturaCarga && (
            <Badge variant="outline" className="ml-auto text-[10px]">Montura carga el equipo</Badge>
          )}
        </div>
        {desventajaTiradas && (
          <p className="text-[10px] text-red-300 italic">
            Mientras estés muy cargado tienes <strong>desventaja</strong> en
            tiradas de ataque, pruebas y salvaciones que usen Fuerza,
            Destreza o Constitución.
          </p>
        )}
        <p className="text-[10px] text-muted-foreground italic">
          Cuando un compañero estorbado ralentiza al grupo en un viaje, los
          demás (sin estorbo) reciben +5 a las salvaciones contra cansancio.
        </p>
      </CardContent>
    </Card>
  );
};

// ─── Competencia con herramientas (SOLO LECTURA) ──────────────────────
export const ToolsProficiencyCard = ({ character }) => {
  const tools = character?.competencias_herramientas || [];
  return (
    <Card className="card-parchment" data-testid="tools-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Wrench className="w-5 h-5" /> Competencia en herramientas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {tools.length === 0 && <p className="text-xs text-muted-foreground italic">Sin competencias en herramientas (definidas en la creación).</p>}
          {tools.map((t, i) => (
            <Badge key={i} variant="outline" data-testid={`tool-${i}`}>{t}</Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Sombra extendida: puntos sombra + cicatrices + maldición ──────────
export const ShadowExtendedCard = ({ character, onUpdate }) => {
  const ps = Number(character?.puntos_sombra ?? 0);
  const cicatrices = character?.cicatrices_sombra || [];
  const [list, setList] = useState(cicatrices);
  const [draft, setDraft] = useState('');

  useEffect(() => setList(character?.cicatrices_sombra || []), [character?.id]);

  const addScar = () => {
    const v = (draft || '').trim();
    if (!v) return;
    const next = [...list, v];
    setList(next); setDraft('');
    persistField(character?.id, { cicatrices_sombra: next }, onUpdate);
  };
  const removeScar = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    persistField(character?.id, { cicatrices_sombra: next }, onUpdate);
  };

  const maldicion = character?.maldicion_sombra || '';

  return (
    <Card className="card-parchment border border-purple-500/30" data-testid="shadow-extended-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-purple-300 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Sombra: puntos · cicatrices · maldición
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-2 rounded bg-purple-950/20 border border-purple-500/30">
          <span className="text-sm">Puntos de Sombra</span>
          <span className="ml-auto font-mono text-2xl font-bold text-purple-300" data-testid="shadow-points">
            {ps}
          </span>
        </div>

        <div>
          <Label className="text-xs">Cicatrices acumuladas</Label>
          <div className="flex flex-wrap gap-1.5 my-2 min-h-[24px]">
            {list.length === 0 && <p className="text-xs text-muted-foreground italic">Sin cicatrices.</p>}
            {list.map((c, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-purple-500/40 text-purple-200" data-testid={`scar-${i}`}>
                {c}
                <button
                  type="button"
                  onClick={() => removeScar(i)}
                  className="hover:text-red-400"
                  aria-label="quitar"
                  data-testid={`scar-remove-${i}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Ej: Mirada distante"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addScar(); } }}
              data-testid="scar-input"
            />
            <Button
              type="button"
              size="sm"
              onClick={addScar}
              disabled={!draft.trim()}
              data-testid="scar-add-btn"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">Maldición de la Sombra</Label>
          <div
            className="p-2 rounded bg-black/30 border border-purple-500/20 min-h-[60px] text-sm whitespace-pre-wrap"
            data-testid="curse-display"
          >
            {maldicion || (
              <span className="italic text-muted-foreground">
                Sin maldición. Se asigna en la creación o al alcanzar puntos
                críticos de Sombra; no se edita aquí.
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Mecenas: SELECT de la lista existente ─────────────────────────────
export const PatronCard = ({ character, onUpdate }) => {
  const [lista, setLista] = useState([]);
  const [seleccion, setSeleccion] = useState(character?.mecenas?.nombre || '');

  useEffect(() => {
    api.get('/data/mecenas').then(res => {
      setLista(res.data?.mecenas || []);
    }).catch(() => setLista([]));
  }, []);

  useEffect(() => {
    setSeleccion(character?.mecenas?.nombre || '');
  }, [character?.id]);

  const elegido = lista.find(m => m.nombre === seleccion) || character?.mecenas;

  const onSelect = (nombre) => {
    setSeleccion(nombre);
    const m = lista.find(x => x.nombre === nombre);
    if (!m) return;
    persistField(character?.id, {
      mecenas: {
        nombre: m.nombre,
        ocupaciones_favorecidas: m.ocupaciones_favorecidas,
        puntos_comunidad: m.puntos_comunidad,
        ventaja_mecenas: m.ventaja_mecenas,
        descripcion_mecenas: m.descripcion_mecenas,
      },
    }, onUpdate);
  };

  return (
    <Card className="card-parchment" data-testid="patron-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Crown className="w-5 h-5" /> Mecenas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Selecciona mecenas</Label>
          <Select value={seleccion} onValueChange={onSelect}>
            <SelectTrigger data-testid="patron-select">
              <SelectValue placeholder="Elige un mecenas existente" />
            </SelectTrigger>
            <SelectContent>
              {lista.map(m => (
                <SelectItem key={m.nombre} value={m.nombre} data-testid={`patron-option-${m.nombre}`}>
                  {m.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {elegido && elegido.nombre && (
          <div className="space-y-2 p-2 rounded bg-black/20 border border-border/30" data-testid="patron-details">
            <p className="text-sm font-bold text-[hsl(var(--gold))]">{elegido.nombre}</p>
            {elegido.ocupaciones_favorecidas && (
              <p className="text-xs text-muted-foreground">
                Ocupaciones favorecidas: {elegido.ocupaciones_favorecidas}
              </p>
            )}
            {elegido.puntos_comunidad != null && (
              <p className="text-xs">
                <strong>Puntos de Comunidad:</strong> {elegido.puntos_comunidad}
              </p>
            )}
            {elegido.ventaja_mecenas && (
              <p className="text-xs italic">{elegido.ventaja_mecenas}</p>
            )}
            {elegido.descripcion_mecenas && (
              <p className="text-xs text-muted-foreground">{elegido.descripcion_mecenas}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Especiales de profesión SOLO LECTURA ──────────────────────────────
export const ProfessionSpecialsCard = ({ character }) => {
  const list = character?.especiales_profesion || [];
  return (
    <Card className="card-parchment" data-testid="profession-specials-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Award className="w-5 h-5" /> Especiales de la profesión
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {list.length === 0 && <p className="text-xs text-muted-foreground italic">Sin especiales asignados (se eligen al subir de nivel).</p>}
          {list.map((s, i) => (
            <div key={i} className="p-2 rounded bg-black/20 border border-border/30 text-sm" data-testid={`profession-special-${i}`}>
              {typeof s === 'string' ? s : (s?.nombre || s?.descripcion || JSON.stringify(s))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Historia ──────────────────────────────────────────────────────────
export const HistoryCard = ({ character, onUpdate }) => {
  const [historia, setHistoria] = useState(character?.historia || '');
  useEffect(() => setHistoria(character?.historia || ''), [character?.id]);
  const save = () => persistField(character?.id, { historia }, onUpdate);
  return (
    <Card className="card-parchment" data-testid="history-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <ScrollText className="w-5 h-5" /> Historia
        </CardTitle>
        <Button size="sm" onClick={save} disabled={historia === (character?.historia || '')} data-testid="history-save-btn">
          <Save className="w-3.5 h-3.5 mr-1" /> Guardar
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={historia}
          onChange={e => setHistoria(e.target.value)}
          rows={12}
          placeholder="Aquí irá creciendo la crónica del personaje: campañas vividas, viajes notables, encuentros memorables, juramentos hechos…"
          className="text-sm font-serif"
          data-testid="history-textarea"
        />
        <p className="text-[10px] text-muted-foreground italic mt-2">
          Este campo se irá rellenando con las crónicas de viaje y las
          notas del DJ a medida que avance la campaña.
        </p>
      </CardContent>
    </Card>
  );
};
