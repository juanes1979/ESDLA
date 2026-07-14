/**
 * PNJForgeSection — Creador UNIFICADO de PNJ (Reglas → «PNJs»).
 * Paso 1: elegir "Profesión" (comerciantes/artesanos) o "Adversario" (malignos).
 *  - Profesión → genera y guarda un PNJ de comercio (autorrelleno del backend).
 *  - Adversario → auto-rellena el bloque del adversario elegido y, según su modo
 *    de raza (Racial con exclusiones / Sin raza con tipo de criatura), genera el
 *    nombre y lo guarda en el Bestiario.
 * (Fase A. La edición de las "bases" —profesiones, atributos, exclusiones y
 *  diccionarios de nombres— llegará en la Fase B.)
 */
import { useEffect, useState } from 'react';
import { Users, Skull, Wand2, Save, Loader2, Dices, ChevronLeft, Shield, Heart, Swords, Settings, Swords as SwordsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import CreatureNameConfigEditor from './CreatureNameConfigEditor';

const sexoCorto = (s) => ((s || 'Masculino').toLowerCase().startsWith('m') ? 'M' : 'F');

const PNJForgeSection = () => {
  const [tipo, setTipo] = useState(null); // 'profesion' | 'adversario'
  const [meta, setMeta] = useState(null);
  const [adversarios, setAdversarios] = useState([]);
  const [creatureTypes, setCreatureTypes] = useState([]);
  const [activeRuns, setActiveRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const loadCreatureTypes = async () => {
    try { const ct = await api.get('/npc-generator/creature-types'); setCreatureTypes(ct.data?.tipos || []); } catch { /* noop */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [m, npcs, ct, runs] = await Promise.all([
          api.get('/trading/npc-meta'),
          api.get('/data/npcs'),
          api.get('/npc-generator/creature-types'),
          api.get('/campaign-runs'),
        ]);
        setMeta(m.data);
        setAdversarios((npcs.data?.malignos || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre)));
        setCreatureTypes(ct.data?.tipos || []);
        const rl = Array.isArray(runs.data) ? runs.data : (runs.data?.runs || []);
        setActiveRuns(rl.filter((r) => r.status === 'active'));
      } catch {
        toast.error('No se pudieron cargar los datos de PNJ');
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-[hsl(var(--gold))]" /></div>;

  if (!tipo) {
    return (
      <div className="space-y-4" data-testid="pnj-forge">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Elige qué tipo de PNJ quieres crear:</p>
          <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="open-config-btn">
            <Settings className="w-3.5 h-3.5 mr-1" /> Bases de nombres
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={() => setTipo('profesion')} data-testid="forge-tipo-profesion"
            className="group rounded-xl border border-[hsl(var(--gold))/40] bg-black/30 p-6 text-left hover:border-[hsl(var(--gold))] transition-colors">
            <Users className="w-8 h-8 text-[hsl(var(--gold))] mb-2" />
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Profesión</h3>
            <p className="text-sm text-muted-foreground mt-1">Comerciantes y artesanos. Se elige profesión, raza y subcultura.</p>
          </button>
          <button onClick={() => setTipo('adversario')} data-testid="forge-tipo-adversario"
            className="group rounded-xl border border-[hsl(var(--destructive))/40] bg-black/30 p-6 text-left hover:border-[hsl(var(--destructive))] transition-colors">
            <Skull className="w-8 h-8 text-[hsl(var(--destructive))] mb-2" />
            <h3 className="font-heading text-lg text-[hsl(var(--destructive))]">Adversario</h3>
            <p className="text-sm text-muted-foreground mt-1">Malignos del Bestiario. Copia su bloque y genera el nombre según su raza o tipo de criatura.</p>
          </button>
        </div>
        <CreatureNameConfigEditor open={showConfig} onClose={() => setShowConfig(false)} onSaved={loadCreatureTypes} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pnj-forge">
      <div className="flex items-center justify-between">
        <button onClick={() => setTipo(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[hsl(var(--gold))]" data-testid="forge-back">
          <ChevronLeft className="w-4 h-4" /> Cambiar tipo
        </button>
        <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="open-config-btn">
          <Settings className="w-3.5 h-3.5 mr-1" /> Bases de nombres
        </Button>
      </div>
      {tipo === 'profesion'
        ? <ProfesionForge meta={meta} />
        : <AdversarioForge adversarios={adversarios} razas={meta?.razas || {}} creatureTypes={creatureTypes} activeRuns={activeRuns} />}
      <CreatureNameConfigEditor open={showConfig} onClose={() => setShowConfig(false)} onSaved={loadCreatureTypes} />
    </div>
  );
};

// ── Profesión ────────────────────────────────────────────────────────────────
const ProfesionForge = ({ meta }) => {
  const razasKeys = Object.keys(meta?.razas || {});
  const modos = meta?.modos_habla || [];
  const perfiles = Object.keys(meta?.merchant_profiles || {});
  const [profesion, setProfesion] = useState('');
  const [raza, setRaza] = useState('');
  const [sub, setSub] = useState('');
  const [sexo, setSexo] = useState('Masculino');
  const [busy, setBusy] = useState(false);
  const [npc, setNpc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyRetrato, setBusyRetrato] = useState(false);
  const [busyStory, setBusyStory] = useState(false);
  const [busyPerfil, setBusyPerfil] = useState(false);
  const subs = (meta?.razas?.[raza] || []).map((s) => s.nombre);
  const [validRasgos, setValidRasgos] = useState({ positivos: [], negativos: [] });

  const upd = (k, v) => setNpc((prev) => ({ ...prev, [k]: v }));

  // Cargar rasgos válidos (coherencia por raza/profesión) cuando hay un PNJ generado.
  useEffect(() => {
    if (!npc?.raza && !npc?.profesion) return;
    (async () => {
      try {
        const res = await api.post('/trading/npc-meta/rasgos', { raza: npc.raza, profesion: npc.profesion });
        setValidRasgos(res.data || { positivos: [], negativos: [] });
      } catch { /* noop */ }
    })();
  }, [npc?.raza, npc?.profesion]);

  const rasgoTipo = npc?.rasgo_tipo === 'negativo' ? 'negativo' : 'positivo';
  const rasgoOptions = rasgoTipo === 'negativo' ? (validRasgos.negativos || []) : (validRasgos.positivos || []);
  const setRasgoTipo = (t) => setNpc((prev) => ({ ...prev, rasgo_tipo: t, rasgo: '', rasgo_descripcion: '' }));
  const onSelectRasgo = (nombre) => {
    const found = rasgoOptions.find((r) => r.nombre === nombre);
    setNpc((prev) => ({ ...prev, rasgo: nombre, rasgo_descripcion: found?.descripcion || '' }));
  };

  const crear = async () => {
    if (!profesion) { toast.error('Elige una profesión'); return; }
    setBusy(true);
    try {
      const res = await api.post('/trading/npcs', { profesion, raza, subcultura: sub, sexo });
      setNpc(res.data?.npc || res.data);
      toast.success('PNJ generado — edítalo y guarda los cambios');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al crear el PNJ');
    } finally { setBusy(false); }
  };

  const guardar = async () => {
    if (!npc?._id) return;
    setSaving(true);
    try {
      const { _id, ...rest } = npc;
      await api.put(`/trading/npcs/${_id}`, rest);
      toast.success('Cambios guardados');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudieron guardar los cambios');
    } finally { setSaving(false); }
  };

  // Constructores de contexto compartidos (todos los datos del PNJ).
  const buildStoryContext = () => [
    `Profesión: ${npc.profesion || '—'}.`,
    `Raza: ${npc.raza || '—'}${npc.subcultura ? ` (${npc.subcultura})` : ''}.`,
    npc.sexo || sexo ? `Sexo: ${npc.sexo || sexo}.` : '',
    npc.edad ? `Edad: ${npc.edad} años.` : '',
    npc.alineamiento ? `Alineamiento: ${npc.alineamiento}.` : '',
    npc.apariencia ? `Apariencia y rasgos físicos: ${npc.apariencia}.` : '',
    npc.rasgo ? `Rasgo (${npc.rasgo_tipo || 'positivo'}): ${npc.rasgo}${npc.rasgo_descripcion ? ` — ${npc.rasgo_descripcion}` : ''}.` : '',
    npc.modo_hablar ? `Modo de hablar: ${npc.modo_hablar}${npc.modo_hablar_desc ? ` (${npc.modo_hablar_desc})` : ''}.` : '',
  ].filter(Boolean).join(' ');

  const buildPortraitExtra = () => {
    const parts = [];
    if (npc.apariencia) parts.push(`distinctive physical features: ${npc.apariencia}`);
    if (npc.rasgo) parts.push(`personality trait: ${npc.rasgo}`);
    if (npc.alineamiento) parts.push(`alignment: ${npc.alineamiento}`);
    return parts.join('; ');
  };

  const doHistoria = async () => {
    const res = await api.post('/npc-generator/story', { nombre: npc.nombre, contexto: buildStoryContext() });
    const historia = res.data?.historia || '';
    setNpc((prev) => ({ ...prev, historia }));
    return historia;
  };

  const doRetrato = async () => {
    const res = await api.post('/npc-generator/portrait', {
      subculture_name: npc.subcultura,
      sex: sexo,
      occupation: npc.profesion,
      age: npc.edad ? String(npc.edad) : '',
      extra: buildPortraitExtra(),
    });
    setNpc((prev) => ({ ...prev, retrato_file_id: res.data?.file_id || null, _retrato_b64: res.data?.image_base64 || null }));
  };

  const genRetrato = async () => {
    setBusyRetrato(true);
    try {
      await doRetrato();
      toast.success('Retrato generado');
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar el retrato'); }
    finally { setBusyRetrato(false); }
  };

  const genHistoria = async () => {
    setBusyStory(true);
    try {
      await doHistoria();
      toast.success('Historia generada');
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar la historia'); }
    finally { setBusyStory(false); }
  };

  // Botón único: primero el trasfondo (con todos los datos), luego el retrato.
  const genPerfilCompleto = async () => {
    setBusyPerfil(true);
    try {
      toast.info('Generando trasfondo…');
      await doHistoria();
      toast.info('Generando retrato…');
      await doRetrato();
      toast.success('Trasfondo y retrato generados');
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar el perfil completo'); }
    finally { setBusyPerfil(false); }
  };

  const attrVal = (v) => (typeof v === 'object' && v ? (v.valor ?? '') : v);
  const setAttr = (key, val) => {
    const cur = npc.caracteristicas || {};
    const prev = cur[key];
    const nv = (typeof prev === 'object' && prev) ? { ...prev, valor: Number(val) } : Number(val);
    upd('caracteristicas', { ...cur, [key]: nv });
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--gold))/30] bg-black/20 p-4 space-y-3" data-testid="profesion-forge">
      <h3 className="font-heading text-[hsl(var(--gold))] flex items-center gap-2"><Users className="w-5 h-5" /> PNJ por profesión</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Profesión">
          <select value={profesion} onChange={(e) => setProfesion(e.target.value)} className="forge-select" data-testid="profesion-select">
            <option value="">— elige —</option>
            {(meta?.profesiones || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Sexo">
          <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="forge-select" data-testid="profesion-sexo">
            {(meta?.sexos || ['Masculino', 'Femenino']).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Raza (opcional)">
          <select value={raza} onChange={(e) => { setRaza(e.target.value); setSub(''); }} className="forge-select" data-testid="profesion-raza">
            <option value="">— cualquiera —</option>
            {razasKeys.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Subcultura (opcional)">
          <select value={sub} onChange={(e) => setSub(e.target.value)} disabled={!raza} className="forge-select" data-testid="profesion-sub">
            <option value="">— cualquiera —</option>
            {subs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Button onClick={crear} disabled={busy} className="bg-[hsl(var(--gold))] text-black hover:opacity-90" data-testid="profesion-crear-btn">
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Dices className="w-4 h-4 mr-1" />} Autogenerar
      </Button>

      {npc && (
        <div className="rounded-lg border border-[hsl(var(--gold))/30] bg-black/30 p-3 space-y-3" data-testid="profesion-result">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Retrato IA</label>
              <div className="w-full aspect-square rounded-lg border border-border/50 bg-black/40 overflow-hidden flex items-center justify-center">
                {npc._retrato_b64 ? <img src={`data:image/png;base64,${npc._retrato_b64}`} alt="retrato" className="w-full h-full object-cover" data-testid="prof-retrato-img" /> : <Users className="w-7 h-7 text-muted-foreground/40" />}
              </div>
              <Button size="sm" variant="outline" onClick={genRetrato} disabled={busyRetrato} className="w-full border-[hsl(var(--gold))/50] text-[hsl(var(--gold))] text-xs" data-testid="prof-retrato-btn">
                {busyRetrato ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wand2 className="w-3.5 h-3.5 mr-1" /> Retrato</>}
              </Button>
            </div>
            <div className="sm:col-span-2 grid grid-cols-2 gap-2">
              <Field label="Nombre"><Input value={npc.nombre || ''} onChange={(e) => upd('nombre', e.target.value)} data-testid="prof-nombre" /></Field>
              <Field label="Apodo"><Input value={npc.apodo || ''} onChange={(e) => upd('apodo', e.target.value)} data-testid="prof-apodo" /></Field>
              <Field label="Edad"><Input value={npc.edad || ''} onChange={(e) => upd('edad', e.target.value)} data-testid="prof-edad" /></Field>
              <Field label="Alineamiento">
                <select value={npc.alineamiento || ''} onChange={(e) => upd('alineamiento', e.target.value)} className="forge-select" data-testid="prof-alineamiento">
                  <option value="">—</option>
                  {(meta?.alineamientos || []).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Perfil comerciante">
                <select value={npc.perfil_comerciante || 'normal'} onChange={(e) => upd('perfil_comerciante', e.target.value)} className="forge-select" data-testid="prof-perfil">
                  {perfiles.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="CA / PG">
                <div className="flex gap-1">
                  <Input type="number" value={npc.ca ?? ''} onChange={(e) => upd('ca', Number(e.target.value))} className="w-16" data-testid="prof-ca" />
                  <Input type="number" value={npc.pg ?? ''} onChange={(e) => upd('pg', Number(e.target.value))} className="w-16" data-testid="prof-pg" />
                </div>
              </Field>
            </div>
          </div>

          <Field label="Apariencia / rasgos físicos">
            <textarea rows={2} value={npc.apariencia || ''} onChange={(e) => upd('apariencia', e.target.value)}
              placeholder="Descripción física, ropa, cicatrices…" className="w-full bg-black/40 rounded p-2 text-sm outline-none border border-border/50 resize-y" data-testid="prof-apariencia" />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Modo de hablar">
              <select value={npc.modo_hablar || ''} onChange={(e) => { const m = modos.find((x) => x.nombre === e.target.value); upd('modo_hablar', e.target.value); upd('modo_hablar_desc', m?.descripcion || ''); }} className="forge-select" data-testid="prof-modo">
                <option value="">—</option>
                {modos.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted-foreground">Rasgo único (positivo/negativo)</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setRasgoTipo('positivo')} data-testid="prof-rasgo-positivo-btn"
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${rasgoTipo === 'positivo' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-200' : 'border-border/50 text-muted-foreground'}`}>Positivo</button>
                  <button type="button" onClick={() => setRasgoTipo('negativo')} data-testid="prof-rasgo-negativo-btn"
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${rasgoTipo === 'negativo' ? 'bg-rose-900/40 border-rose-700 text-rose-200' : 'border-border/50 text-muted-foreground'}`}>Negativo</button>
                </div>
              </div>
              <select value={npc.rasgo || ''} onChange={(e) => onSelectRasgo(e.target.value)} className="forge-select" data-testid="prof-rasgo-select">
                <option value="">— elige un rasgo {rasgoTipo} —</option>
                {rasgoOptions.map((r) => <option key={r.nombre} value={r.nombre}>{r.nombre}</option>)}
              </select>
              {npc.rasgo_descripcion && <p className="text-xs text-muted-foreground mt-1 italic" data-testid="prof-rasgo-desc">{npc.rasgo_descripcion}</p>}
            </div>
          </div>
          {npc.modo_hablar_desc && <p className="text-xs text-muted-foreground -mt-1">{npc.modo_hablar_desc}</p>}

          {npc.caracteristicas && typeof npc.caracteristicas === 'object' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Características</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-testid="prof-caracteristicas">
                {Object.keys(npc.caracteristicas).map((k) => (
                  <div key={k}>
                    <div className="text-[10px] text-muted-foreground uppercase">{k.slice(0, 3)}</div>
                    <Input type="number" value={attrVal(npc.caracteristicas[k])} onChange={(e) => setAttr(k, e.target.value)} className="h-8 text-center px-1" data-testid={`prof-attr-${k}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button onClick={genPerfilCompleto} disabled={busyPerfil || busyStory || busyRetrato}
              className="bg-[hsl(var(--gold))] text-black hover:opacity-90" data-testid="prof-perfil-completo-btn">
              {busyPerfil ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
              Generar trasfondo + retrato
            </Button>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Historia (IA, editable)</label>
              <Button size="sm" variant="outline" onClick={genHistoria} disabled={busyStory} className="h-6 border-[hsl(var(--gold))/50] text-[hsl(var(--gold))] text-[11px]" data-testid="prof-historia-btn">
                {busyStory ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Wand2 className="w-3 h-3 mr-1" /> Generar</>}
              </Button>
            </div>
            <textarea rows={3} value={npc.historia || ''} onChange={(e) => upd('historia', e.target.value)} className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y mt-1" data-testid="prof-historia" />
          </div>

          <Button onClick={guardar} disabled={saving} className="bg-[hsl(var(--gold))] text-black hover:opacity-90" data-testid="prof-guardar-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar cambios
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Se guarda en los PNJ de comercio (visible también en Compra-Venta → «PNJs»).</p>
      <style>{`.forge-select{width:100%;background:rgba(0,0,0,.4);border:1px solid hsl(var(--border));border-radius:.375rem;padding:.4rem .5rem;font-size:.875rem;color:inherit}`}</style>
    </div>
  );
};

// ── Adversario ───────────────────────────────────────────────────────────────
const AdversarioForge = ({ adversarios, razas, creatureTypes, activeRuns }) => {
  const razasKeys = Object.keys(razas || {});
  const [advId, setAdvId] = useState('');
  const [modo, setModo] = useState('sin_raza'); // 'racial' | 'sin_raza'
  const [excluidas, setExcluidas] = useState([]); // razas excluidas (para racial)
  const [raza, setRaza] = useState('');
  const [sub, setSub] = useState('');
  const [tipoCriatura, setTipoCriatura] = useState('');
  const [sexo, setSexo] = useState('M');
  const [nombre, setNombre] = useState('');
  const [busyName, setBusyName] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [runId, setRunId] = useState(activeRuns?.[0]?.id || '');
  const [count, setCount] = useState(1);
  const [busyDrop, setBusyDrop] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState([]); // tipos permitidos (sin_raza)
  const [showCfg, setShowCfg] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [retrato, setRetrato] = useState(null); // base64 preview
  const [retratoFileId, setRetratoFileId] = useState(null);
  const [historia, setHistoria] = useState('');
  const [nivel, setNivel] = useState('');
  const [busyRetrato, setBusyRetrato] = useState(false);
  const [busyStory, setBusyStory] = useState(false);

  const adv = adversarios.find((a) => (a._id || a.id) === advId) || null;

  // Al elegir adversario, precarga su configuración de raza guardada.
  useEffect(() => {
    if (!adv) return;
    setModo(adv.modo_raza === 'racial' ? 'racial' : (adv.modo_raza === 'sin_raza' ? 'sin_raza' : 'sin_raza'));
    setExcluidas(Array.isArray(adv.razas_excluidas) ? adv.razas_excluidas : []);
    setAllowedTypes(Array.isArray(adv.tipos_criatura) ? adv.tipos_criatura : []);
    setTipoCriatura('');
    setNombre('');
    setRetrato(null); setRetratoFileId(null); setHistoria(''); setNivel('');
  }, [advId]); // eslint-disable-line react-hooks/exhaustive-deps

  const generarRetrato = async () => {
    if (!adv) return;
    setBusyRetrato(true);
    try {
      const body = modo === 'racial'
        ? { subculture_name: sub, sex: sexo, occupation: adv.nombre }
        : { occupation: adv.nombre, sex: sexo, extra: `${ct?.label || 'criatura'} de la Tierra Media, monstruoso` };
      const res = await api.post('/npc-generator/portrait', body);
      setRetrato(res.data?.image_base64 || null);
      setRetratoFileId(res.data?.file_id || null);
      toast.success('Retrato generado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo generar el retrato');
    } finally { setBusyRetrato(false); }
  };

  const generarHistoria = async () => {
    if (!adv) return;
    setBusyStory(true);
    try {
      const ctx = `Adversario tipo «${adv.nombre}». ${modo === 'racial' ? `Raza/subcultura: ${sub || raza}.` : `Criatura: ${ct?.label || tipoCriatura}.`} Nombre: ${nombre || '—'}.`;
      const res = await api.post('/npc-generator/story', { nombre: nombre || adv.nombre, contexto: ctx });
      setHistoria(res.data?.historia || '');
      toast.success('Historia generada');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo generar la historia');
    } finally { setBusyStory(false); }
  };

  const guardarCfgAdversario = async () => {
    if (!adv) return;
    setSavingCfg(true);
    try {
      await api.patch(`/data/npcs/${adv._id || adv.id}`, {
        modo_raza: modo, razas_excluidas: excluidas, tipos_criatura: allowedTypes,
      });
      toast.success('Configuración del adversario guardada');
      setShowCfg(false);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar la configuración');
    } finally { setSavingCfg(false); }
  };
  const razasDisponibles = razasKeys.filter((r) => !excluidas.includes(r));
  const subs = (razas?.[raza] || []).map((s) => s.nombre);
  const ct = creatureTypes.find((c) => c.id === tipoCriatura);

  const toggleExcluida = (r) => setExcluidas((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const generarNombre = async () => {
    setBusyName(true);
    try {
      if (modo === 'sin_raza') {
        if (!tipoCriatura) { toast.error('Elige el tipo de criatura'); return; }
        const res = await api.post('/npc-generator/creature-name', { tipo: tipoCriatura, sexo });
        setNombre(res.data?.name || '');
      } else {
        if (!sub) { toast.error('Elige la subcultura'); return; }
        const res = await api.post('/npc-generator/name', { subculture_name: sub, sex: sexo, occupation: adv?.nombre || '' });
        setNombre(res.data?.name || '');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo generar el nombre');
    } finally { setBusyName(false); }
  };

  const guardar = async () => {
    if (!adv) { toast.error('Elige un adversario'); return; }
    if (!nombre.trim()) { toast.error('Genera o escribe un nombre'); return; }
    setBusySave(true);
    try {
      const origen = modo === 'sin_raza'
        ? `${ct?.label || tipoCriatura}`
        : `en vida: ${sub || raza || 'desconocido'}`;
      const { _id, id, ...rest } = adv;
      const payload = {
        ...rest,
        nombre: nombre.trim(),
        categoria: 'malignos',
        descripcion: `${adv.descripcion || ''}${adv.descripcion ? ' · ' : ''}[${adv.nombre} — ${origen}]`.trim(),
        ...(historia ? { historia } : {}),
        ...(nivel !== '' ? { nivel: parseInt(nivel, 10) } : {}),
        ...(retratoFileId ? { retrato_file_id: retratoFileId } : {}),
      };
      const res = await api.post('/data/npcs', payload);
      toast.success(`«${nombre.trim()}» guardado en el Bestiario`);
      setNombre('');
      return res.data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar el adversario');
    } finally { setBusySave(false); }
  };

  const soltarEnCombate = async () => {
    if (!adv) { toast.error('Elige un adversario'); return; }
    if (!runId) { toast.error('Elige una campaña activa'); return; }
    setBusyDrop(true);
    try {
      const { _id, id, ...rest } = adv;
      const res = await api.post(`/campaign-runs/${runId}/dj-screen/add-combatant`, {
        npc: rest, name: nombre.trim() || adv.nombre, count: Math.max(1, Math.min(20, count)),
      });
      toast.success(`${res.data?.added?.length || 0} enemigo(s) añadido(s) a la Pantalla del DJ`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo soltar en combate');
    } finally { setBusyDrop(false); }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--destructive))/30] bg-black/20 p-4 space-y-3" data-testid="adversario-forge">
      <h3 className="font-heading text-[hsl(var(--destructive))] flex items-center gap-2"><Skull className="w-5 h-5" /> PNJ adversario</h3>

      <Field label="Adversario del Bestiario">
        <select value={advId} onChange={(e) => setAdvId(e.target.value)} className="forge-select" data-testid="adv-select">
          <option value="">— elige —</option>
          {adversarios.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{a.nombre}</option>)}
        </select>
      </Field>

      {adv && (
        <div className="rounded-lg border border-border/40 bg-black/30 p-3 text-xs flex flex-wrap gap-3" data-testid="adv-preview">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-400" /> CA {adv.clase_armadura ?? '—'}</span>
          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" /> PG {adv.puntos_golpe ?? '—'}</span>
          <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5 text-amber-400" /> {(adv.armas || []).length} arma(s)</span>
          <span>Desafío {adv.desafio || '—'}</span>
          {adv.tipo && <span className="text-muted-foreground">{adv.tipo}</span>}
        </div>
      )}

      {/* Modo de raza */}
      <div className="flex gap-2 items-center">
        <ModoBtn active={modo === 'sin_raza'} onClick={() => setModo('sin_raza')} testid="modo-sin-raza">Sin raza (criatura)</ModoBtn>
        <ModoBtn active={modo === 'racial'} onClick={() => setModo('racial')} testid="modo-racial">Racial (con raza)</ModoBtn>
        <button onClick={() => setShowCfg((v) => !v)} title="Configurar y guardar el modo de raza de este adversario"
          className="px-2 py-2 rounded-lg border border-[hsl(var(--gold))/40] text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10" data-testid="adv-cfg-toggle">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showCfg && (
        <div className="rounded-lg border border-[hsl(var(--gold))/30] bg-black/30 p-3 space-y-2" data-testid="adv-cfg-panel">
          <p className="text-xs text-muted-foreground">Guarda para «{adv?.nombre}» su modo de raza actual y (si es sin raza) qué tipos de criatura puede ser. Así se preselecciona al elegirlo y se evitan errores.</p>
          <div>
            <label className="text-xs text-[hsl(var(--gold))] block mb-1">Tipos de criatura permitidos (si «sin raza»)</label>
            <div className="flex flex-wrap gap-1.5" data-testid="allowed-types">
              {creatureTypes.map((c) => (
                <button key={c.id} onClick={() => setAllowedTypes((p) => p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id])}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${allowedTypes.includes(c.id) ? 'bg-[hsl(var(--gold))]/15 border-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground'}`}
                  data-testid={`allow-${c.id}`}>{c.label}</button>
              ))}
              {creatureTypes.length === 0 && <span className="text-xs text-muted-foreground">(sin tipos; añádelos en «Bases de nombres»)</span>}
            </div>
          </div>
          <Button size="sm" onClick={guardarCfgAdversario} disabled={savingCfg} className="bg-[hsl(var(--gold))] text-black" data-testid="adv-cfg-save">
            {savingCfg ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar configuración
          </Button>
        </div>
      )}

      {modo === 'sin_raza' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tipo de criatura">
            <select value={tipoCriatura} onChange={(e) => setTipoCriatura(e.target.value)} className="forge-select" data-testid="criatura-select">
              <option value="">— elige —</option>
              {creatureTypes.filter((c) => allowedTypes.length === 0 || allowedTypes.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          {ct?.usa_sexo && (
            <Field label="Sexo">
              <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="forge-select" data-testid="criatura-sexo">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </Field>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Razas excluidas para este adversario (p. ej. Espectro no puede ser Elfo)</label>
            <div className="flex flex-wrap gap-1.5 mt-1" data-testid="excl-chips">
              {razasKeys.map((r) => (
                <button key={r} onClick={() => toggleExcluida(r)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${excluidas.includes(r) ? 'bg-rose-900/40 border-rose-700 text-rose-200 line-through' : 'border-border/50 text-muted-foreground hover:border-border'}`}
                  data-testid={`excl-${r}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Raza">
              <select value={raza} onChange={(e) => { setRaza(e.target.value); setSub(''); }} className="forge-select" data-testid="racial-raza">
                <option value="">— elige —</option>
                {razasDisponibles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Subcultura">
              <select value={sub} onChange={(e) => setSub(e.target.value)} disabled={!raza} className="forge-select" data-testid="racial-sub">
                <option value="">— elige —</option>
                {subs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Sexo">
              <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="forge-select" data-testid="racial-sexo">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </Field>
          </div>
        </div>
      )}

      {/* Nombre */}
      <div className="flex items-end gap-2">
        <Field label="Nombre" className="flex-1">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Genera o escribe el nombre" data-testid="adv-nombre-input" />
        </Field>
        <Button onClick={generarNombre} disabled={busyName || !adv} variant="outline" className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="adv-gen-nombre-btn">
          {busyName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Retrato IA + Historia IA + Nivel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Retrato IA</label>
          <div className="w-full aspect-square rounded-lg border border-border/50 bg-black/40 overflow-hidden flex items-center justify-center">
            {retrato ? <img src={`data:image/png;base64,${retrato}`} alt="retrato" className="w-full h-full object-cover" data-testid="adv-retrato-img" /> : <Skull className="w-7 h-7 text-muted-foreground/40" />}
          </div>
          <Button size="sm" variant="outline" onClick={generarRetrato} disabled={busyRetrato || !adv} className="w-full border-[hsl(var(--gold))/50] text-[hsl(var(--gold))] text-xs" data-testid="adv-retrato-btn">
            {busyRetrato ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wand2 className="w-3.5 h-3.5 mr-1" /> Retrato</>}
          </Button>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Historia (IA, editable)</label>
            <Button size="sm" variant="outline" onClick={generarHistoria} disabled={busyStory || !adv} className="h-6 border-[hsl(var(--gold))/50] text-[hsl(var(--gold))] text-[11px]" data-testid="adv-historia-btn">
              {busyStory ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Wand2 className="w-3 h-3 mr-1" /> Generar</>}
            </Button>
          </div>
          <textarea rows={4} value={historia} onChange={(e) => setHistoria(e.target.value)} placeholder="Trasfondo del PNJ…"
            className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="adv-historia-input" />
          <Field label="Nivel / Desafío">
            <input type="number" value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder={String(adv?.desafio ?? '')}
              className="forge-select w-24" data-testid="adv-nivel-input" />
          </Field>
        </div>
      </div>

      <Button onClick={guardar} disabled={busySave || !adv} className="bg-[hsl(var(--destructive))] text-white hover:opacity-90" data-testid="adv-guardar-btn">
        {busySave ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar en Bestiario
      </Button>

      {/* Soltar en la Pantalla del DJ */}
      <div className="rounded-lg border border-amber-800/40 bg-black/30 p-3 mt-1" data-testid="drop-combat">
        <div className="text-xs text-[hsl(var(--gold))] mb-2 flex items-center gap-1"><SwordsIcon className="w-3.5 h-3.5" /> Soltar en la Pantalla del DJ</div>
        {activeRuns.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tienes campañas activas donde soltarlo.</p>
        ) : (
          <div className="flex items-end gap-2 flex-wrap">
            <Field label="Campaña activa" className="flex-1 min-w-[160px]">
              <select value={runId} onChange={(e) => setRunId(e.target.value)} className="forge-select" data-testid="drop-run-select">
                {activeRuns.map((r) => <option key={r.id} value={r.id}>{r.adventure_name}</option>)}
              </select>
            </Field>
            <Field label="Cantidad">
              <input type="number" min="1" max="20" value={count} onChange={(e) => setCount(parseInt(e.target.value || '1', 10))}
                className="forge-select w-20" data-testid="drop-count" />
            </Field>
            <Button onClick={soltarEnCombate} disabled={busyDrop || !adv} variant="outline" className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="drop-combat-btn">
              {busyDrop ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <SwordsIcon className="w-4 h-4 mr-1" />} Soltar en combate
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Se copia el bloque completo del adversario con el nuevo nombre. Podrás afinarlo después en el Bestiario.</p>
      <style>{`.forge-select{width:100%;background:rgba(0,0,0,.4);border:1px solid hsl(var(--border));border-radius:.375rem;padding:.4rem .5rem;font-size:.875rem;color:inherit}`}</style>
    </div>
  );
};

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="text-xs text-muted-foreground block mb-1">{label}</label>
    {children}
  </div>
);

const ModoBtn = ({ active, onClick, children, testid }) => (
  <button onClick={onClick} data-testid={testid}
    className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${active ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]' : 'border-border/50 text-muted-foreground hover:border-border'}`}>
    {children}
  </button>
);

export default PNJForgeSection;
