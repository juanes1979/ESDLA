/**
 * ExtendedCards
 * Tarjetas adicionales de la Oleada 3 (campos extendidos de la ficha).
 * Todas exportadas individualmente para componer en pestañas.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Skull, Heart, Shield, Wrench, BookOpen, Users, Crown, Award,
  ScrollText, Sparkles, Save, Loader2, Plus, X, Weight,
  AlertTriangle, Footprints, User as UserIcon,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

// ─── Helpers ───────────────────────────────────────────────────────────
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);
const modString = (m) => (m >= 0 ? `+${m}` : `${m}`);

const ATTR_ES = {
  fuerza: 'Fuerza', destreza: 'Destreza', constitucion: 'Constitución',
  inteligencia: 'Inteligencia', sabiduria: 'Sabiduría', carisma: 'Carisma',
};

const proficiencyByLevel = (lvl) => Math.ceil(1 + (Number(lvl || 1)) / 4);

// Capacidad de carga estándar 5e: STR × 7.5 kg para tamaño mediano,
// la mitad para tamaño pequeño (hobbits).
const carryCapacity = (character) => {
  const str = Number(character?.atributos?.fuerza ?? 10);
  const tam = (character?.tamano || character?.tamaño || character?.cultura_tamano || '').toLowerCase();
  const isSmall = tam.includes('peque') || tam.includes('small') || (Number(character?.altura_cm) > 0 && Number(character.altura_cm) < 130);
  const base = str * 7.5;
  return isSmall ? Math.round(base / 2 * 10) / 10 : Math.round(base * 10) / 10;
};

// Generic helper para hacer PATCH con feedback
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

// ─── Header info (jugador, bonif. competencia, sexo, iniciativa) ──────
export const HeaderInfoCard = ({ character, onUpdate }) => {
  const [nombreJugador, setNombreJugador] = useState(character?.nombre_jugador || '');
  const [sexo, setSexo] = useState(character?.sexo || '');
  const [iniciativaBonus, setIniciativaBonus] = useState(character?.iniciativa_bonus || 0);
  const dexMod = modFromScore(character?.atributos?.destreza);
  const iniciativaTotal = dexMod + Number(iniciativaBonus || 0);
  const profBonus = proficiencyByLevel(character?.nivel);

  useEffect(() => {
    setNombreJugador(character?.nombre_jugador || '');
    setSexo(character?.sexo || '');
    setIniciativaBonus(character?.iniciativa_bonus || 0);
  }, [character?.id]);

  const handleSave = () => persistField(character?.id, {
    nombre_jugador: nombreJugador,
    sexo,
    iniciativa_bonus: Number(iniciativaBonus || 0),
  }, onUpdate);

  return (
    <Card className="card-parchment" data-testid="header-info-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <UserIcon className="w-5 h-5" /> Identidad y métricas básicas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nombre del jugador</Label>
            <Input value={nombreJugador} onChange={e => setNombreJugador(e.target.value)} data-testid="player-name-input" />
          </div>
          <div>
            <Label className="text-xs">Sexo</Label>
            <Input value={sexo} onChange={e => setSexo(e.target.value)} data-testid="character-sex-input" />
          </div>
        </div>
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
            <Input
              type="number"
              value={iniciativaBonus}
              onChange={e => setIniciativaBonus(e.target.value)}
              className="h-8 text-center"
              data-testid="initiative-bonus-input"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} data-testid="header-info-save-btn">
            <Save className="w-4 h-4 mr-2" /> Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Tiradas de salvación (6 atributos) ────────────────────────────────
export const SavingThrowsCard = ({ character, onUpdate }) => {
  const profBonus = proficiencyByLevel(character?.nivel);
  const competencias = character?.salvaciones_competencia || [];
  const [comp, setComp] = useState(competencias);

  useEffect(() => { setComp(character?.salvaciones_competencia || []); }, [character?.id]);

  const toggle = (attr) => {
    setComp(prev => prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]);
  };
  const handleSave = () => persistField(character?.id, { salvaciones_competencia: comp }, onUpdate);

  return (
    <Card className="card-parchment" data-testid="saving-throws-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Shield className="w-5 h-5" /> Tiradas de salvación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {Object.entries(ATTR_ES).map(([key, label]) => {
            const score = character?.atributos?.[key];
            const m = modFromScore(score);
            const isComp = comp.includes(key);
            const total = isComp ? m + profBonus : m;
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-2 rounded border ${isComp ? 'border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/5' : 'border-border/30 bg-black/20'}`}
                data-testid={`save-row-${key}`}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isComp}
                    onCheckedChange={() => toggle(key)}
                    data-testid={`save-comp-${key}`}
                  />
                  <span className="text-sm">{label}</span>
                </div>
                <span className={`font-mono font-bold ${isComp ? 'text-[hsl(var(--gold))]' : 'text-foreground'}`}>
                  {modString(total)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Marca los atributos en los que el personaje tiene competencia.
          </p>
          <Button size="sm" onClick={handleSave} data-testid="saving-throws-save-btn">
            <Save className="w-4 h-4 mr-2" /> Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Salvaciones contra la muerte (3 éxitos / 3 fracasos) ─────────────
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
      className={`w-6 h-6 rounded-full border-2 transition-all ${
        filled
          ? (color === 'green' ? 'bg-emerald-500 border-emerald-300' : 'bg-red-500 border-red-300')
          : 'bg-transparent border-muted-foreground/40 hover:border-muted-foreground'
      }`}
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
                <Dot
                  key={n}
                  filled={exitos >= n}
                  color="green"
                  onClick={() => update(exitos >= n ? n - 1 : n, fracasos)}
                  testId={`death-save-success-${n}`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-red-900/20 border border-red-500/30">
            <span className="text-sm flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-400" /> Fracasos
            </span>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <Dot
                  key={n}
                  filled={fracasos >= n}
                  color="red"
                  onClick={() => update(exitos, fracasos >= n ? n - 1 : n)}
                  testId={`death-save-fail-${n}`}
                />
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

// ─── Peso transportado / capacidad / estorbo ───────────────────────────
export const WeightEncumbranceCard = ({ character, onUpdate }) => {
  // Suma peso del inventario si hay campo `peso` en cada item.
  const inventario = character?.inventario || [];
  const pesoInventario = inventario.reduce((acc, it) => acc + (Number(it?.peso || 0) * Number(it?.cantidad || 1)), 0);
  const capacidad = carryCapacity(character);
  const monturaCarga = !!character?.montura?.transporta_equipo;
  // Si la montura carga el equipo, el personaje no sufre estorbo por el peso del inventario.
  const pesoEfectivo = monturaCarga ? 0 : pesoInventario;
  const ratio = capacidad > 0 ? pesoEfectivo / capacidad : 0;
  // Estorbo según 5e: > capacidad → estorbado (-3m). > 2× capacidad → muy estorbado (-6m).
  let estorboM = 0;
  let estorboLabel = 'Sin estorbo';
  let estorboColor = 'text-emerald-300';
  if (ratio > 2) { estorboM = -6; estorboLabel = 'Muy estorbado (-6 m)'; estorboColor = 'text-red-400'; }
  else if (ratio > 1) { estorboM = -3; estorboLabel = 'Estorbado (-3 m)'; estorboColor = 'text-orange-300'; }

  // Devuelve además velocidad efectiva
  const velBase = Number(character?.velocidad || character?.cultura_velocidad || 9);
  const velEfectiva = Math.max(0, velBase + estorboM);

  // Persistimos el estorbo para que el sistema de viaje pueda leerlo.
  useEffect(() => {
    if (!character?.id) return;
    const prev = Number(character?.estorbo_metros ?? 0);
    if (prev === estorboM) return;
    api.patch(`/characters/${character.id}`, { estorbo_metros: estorboM }).then(res => {
      if (onUpdate) onUpdate(res.data);
    }).catch(() => {});
  }, [character?.id, estorboM]);

  return (
    <Card className="card-parchment" data-testid="weight-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Weight className="w-5 h-5" /> Peso y carga
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Transportado</p>
            <p className="font-mono font-bold">{pesoInventario.toFixed(1)} kg</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Capacidad (FUE×7.5)</p>
            <p className="font-mono font-bold">{capacidad.toFixed(1)} kg</p>
          </div>
          <div className="bg-black/20 p-2 rounded">
            <p className="text-[10px] text-muted-foreground">Velocidad efectiva</p>
            <p className="font-mono font-bold text-amber-200">{velEfectiva} m</p>
          </div>
        </div>
        <div className={`p-2 rounded border text-sm flex items-center gap-2 ${estorboM < 0 ? 'border-orange-500/40 bg-orange-900/10' : 'border-emerald-500/30 bg-emerald-900/10'}`}>
          {estorboM < 0
            ? <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
            : <Footprints className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          <span className={`font-medium ${estorboColor}`} data-testid="encumbrance-label">{estorboLabel}</span>
          {monturaCarga && (
            <Badge variant="outline" className="ml-auto text-[10px]">Montura carga el equipo</Badge>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Cuando un miembro estorbado ralentiza al grupo en un viaje, los demás
          (sin estorbo) reciben +5 a las salvaciones contra cansancio.
        </p>
      </CardContent>
    </Card>
  );
};

// ─── Competencia con herramientas ──────────────────────────────────────
export const ToolsProficiencyCard = ({ character, onUpdate }) => {
  const tools = character?.competencias_herramientas || [];
  const [list, setList] = useState(tools);
  const [draft, setDraft] = useState('');

  useEffect(() => { setList(character?.competencias_herramientas || []); }, [character?.id]);

  const add = () => {
    if (!draft.trim()) return;
    const next = [...list, draft.trim()];
    setList(next); setDraft('');
    persistField(character?.id, { competencias_herramientas: next }, onUpdate);
  };
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    persistField(character?.id, { competencias_herramientas: next }, onUpdate);
  };

  return (
    <Card className="card-parchment" data-testid="tools-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Wrench className="w-5 h-5" /> Competencia en herramientas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {list.length === 0 && <p className="text-xs text-muted-foreground italic">Sin competencias en herramientas.</p>}
          {list.map((t, i) => (
            <Badge key={i} variant="outline" className="gap-1" data-testid={`tool-${i}`}>
              {t}
              <button onClick={() => remove(i)} className="hover:text-red-400" aria-label="quitar">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Ej: Herramientas de carpintero"
            onKeyDown={e => e.key === 'Enter' && add()}
            data-testid="tool-input"
          />
          <Button size="sm" onClick={add} data-testid="tool-add-btn">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Sombra extendida (cicatrices + maldición) ─────────────────────────
export const ShadowExtendedCard = ({ character, onUpdate }) => {
  const cicatrices = character?.cicatrices_sombra || [];
  const [list, setList] = useState(cicatrices);
  const [draft, setDraft] = useState('');
  const [maldicion, setMaldicion] = useState(character?.maldicion_sombra || '');

  useEffect(() => {
    setList(character?.cicatrices_sombra || []);
    setMaldicion(character?.maldicion_sombra || '');
  }, [character?.id]);

  const addScar = () => {
    if (!draft.trim()) return;
    const next = [...list, draft.trim()];
    setList(next); setDraft('');
    persistField(character?.id, { cicatrices_sombra: next }, onUpdate);
  };
  const removeScar = (i) => {
    const next = list.filter((_, idx) => idx !== i);
    setList(next);
    persistField(character?.id, { cicatrices_sombra: next }, onUpdate);
  };
  const saveMaldicion = () => persistField(character?.id, { maldicion_sombra: maldicion }, onUpdate);

  return (
    <Card className="card-parchment border border-purple-500/30" data-testid="shadow-extended-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-purple-300 flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Cicatrices y maldición de la Sombra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Cicatrices acumuladas</Label>
          <div className="flex flex-wrap gap-1.5 my-2">
            {list.length === 0 && <p className="text-xs text-muted-foreground italic">Sin cicatrices.</p>}
            {list.map((c, i) => (
              <Badge key={i} variant="outline" className="gap-1 border-purple-500/40 text-purple-200" data-testid={`scar-${i}`}>
                {c}
                <button onClick={() => removeScar(i)} className="hover:text-red-400" aria-label="quitar">
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
              onKeyDown={e => e.key === 'Enter' && addScar()}
              data-testid="scar-input"
            />
            <Button size="sm" onClick={addScar} data-testid="scar-add-btn"><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
        <div>
          <Label className="text-xs">Maldición de la Sombra</Label>
          <Textarea
            value={maldicion}
            onChange={e => setMaldicion(e.target.value)}
            rows={3}
            placeholder="Describe la maldición que asola al personaje (vacío si no la sufre)…"
            data-testid="curse-textarea"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={saveMaldicion} data-testid="curse-save-btn">
              <Save className="w-3.5 h-3.5 mr-1" /> Guardar maldición
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Mecenas ───────────────────────────────────────────────────────────
export const PatronCard = ({ character, onUpdate }) => {
  const m = character?.mecenas || { nombre: '', tipo: '', descripcion: '', beneficios: '' };
  const [data, setData] = useState(m);
  useEffect(() => { setData(character?.mecenas || { nombre: '', tipo: '', descripcion: '', beneficios: '' }); }, [character?.id]);
  const save = () => persistField(character?.id, { mecenas: data }, onUpdate);

  return (
    <Card className="card-parchment" data-testid="patron-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Crown className="w-5 h-5" /> Mecenas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input value={data.nombre || ''} onChange={e => setData({ ...data, nombre: e.target.value })} data-testid="patron-name" />
          </div>
          <div>
            <Label className="text-xs">Tipo / casa</Label>
            <Input value={data.tipo || ''} onChange={e => setData({ ...data, tipo: e.target.value })} data-testid="patron-type" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Descripción</Label>
          <Textarea rows={2} value={data.descripcion || ''} onChange={e => setData({ ...data, descripcion: e.target.value })} data-testid="patron-desc" />
        </div>
        <div>
          <Label className="text-xs">Beneficios concedidos</Label>
          <Textarea rows={2} value={data.beneficios || ''} onChange={e => setData({ ...data, beneficios: e.target.value })} data-testid="patron-benefits" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} data-testid="patron-save"><Save className="w-3.5 h-3.5 mr-1" /> Guardar</Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Especiales de profesión / vocación ────────────────────────────────
export const ProfessionSpecialsCard = ({ character, onUpdate }) => {
  const [list, setList] = useState(character?.especiales_profesion || []);
  const [draft, setDraft] = useState('');
  useEffect(() => setList(character?.especiales_profesion || []), [character?.id]);
  const add = () => {
    if (!draft.trim()) return;
    const next = [...list, draft.trim()]; setList(next); setDraft('');
    persistField(character?.id, { especiales_profesion: next }, onUpdate);
  };
  const remove = (i) => {
    const next = list.filter((_, idx) => idx !== i); setList(next);
    persistField(character?.id, { especiales_profesion: next }, onUpdate);
  };
  return (
    <Card className="card-parchment" data-testid="profession-specials-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-[hsl(var(--gold))] flex items-center gap-2">
          <Award className="w-5 h-5" /> Especiales de la profesión
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5 mb-3">
          {list.length === 0 && <p className="text-xs text-muted-foreground italic">Aún no se han añadido especiales.</p>}
          {list.map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded bg-black/20 border border-border/30" data-testid={`profession-special-${i}`}>
              <span className="text-sm flex-1">{s}</span>
              <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input value={draft} onChange={e => setDraft(e.target.value)}
            placeholder="Ej: Atributo (+1 CON), Talento de Maestro Artesano…"
            onKeyDown={e => e.key === 'Enter' && add()} data-testid="profession-special-input" />
          <Button size="sm" onClick={add} data-testid="profession-special-add"><Plus className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Historia narrativa ────────────────────────────────────────────────
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
