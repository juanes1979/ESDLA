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
import { useEffect, useState, useMemo } from 'react';
import { Users, Skull, Wand2, Save, Loader2, ChevronLeft, Shield, Heart, Swords, Settings, Swords as SwordsIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';
import CreatureNameConfigEditor from './CreatureNameConfigEditor';
import { NpcEditorModal, NpcFichaCard } from './TradingSystemSection';
import AdversaryFicha from './AdversaryFicha';

// 5e XP → CR: deriva el "Desafío" cuando solo hay experiencia.
const XP_TO_CR = [
  [0, '0'], [25, '1/8'], [50, '1/4'], [100, '1/2'], [200, '1'], [450, '2'],
  [700, '3'], [1100, '4'], [1800, '5'], [2300, '6'], [2900, '7'], [3900, '8'],
  [5000, '9'], [5900, '10'], [7200, '11'], [8400, '12'], [10000, '13'],
  [11500, '14'], [13000, '15'], [15000, '16'], [18000, '17'], [20000, '18'],
];
const xpToCr = (xp) => {
  if (xp == null || xp === '') return null;
  const n = Number(xp);
  if (!Number.isFinite(n) || n < 0) return null;
  let cr = '0';
  for (const [t, c] of XP_TO_CR) { if (n >= t) cr = c; else break; }
  return cr;
};
const formatDesafio = (npc) => {
  if (!npc) return null;
  if (npc.desafio && String(npc.desafio).trim()) return String(npc.desafio).trim();
  const cr = xpToCr(npc.experiencia);
  if (cr == null) return null;
  return `${cr} (${npc.experiencia || 0} PX)`;
};

const PNJForgeSection = () => {
  const [view, setView] = useState('home'); // 'home' | 'adversario' | 'browse'
  const [meta, setMeta] = useState(null);
  const [config, setConfig] = useState(null);
  const [adversarios, setAdversarios] = useState([]);
  const [creatureTypes, setCreatureTypes] = useState([]);
  const [activeRuns, setActiveRuns] = useState([]);
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [showNpcEditor, setShowNpcEditor] = useState(false);
  const [editingNpc, setEditingNpc] = useState(null);

  const loadCreatureTypes = async () => {
    try { const ct = await api.get('/npc-generator/creature-types'); setCreatureTypes(ct.data?.tipos || []); } catch { /* noop */ }
  };

  const loadNpcs = async () => {
    try { const res = await api.get('/trading/npcs'); setNpcs(res.data?.npcs || []); } catch { /* noop */ }
  };

  useEffect(() => {
    (async () => {
      try {
        const [m, cfg, bestiary, ct, runs, tn] = await Promise.all([
          api.get('/trading/npc-meta'),
          api.get('/trading/config'),
          api.get('/data/npcs'),
          api.get('/npc-generator/creature-types'),
          api.get('/campaign-runs'),
          api.get('/trading/npcs'),
        ]);
        setMeta(m.data);
        setConfig(cfg.data);
        setAdversarios((bestiary.data?.malignos || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre)));
        setCreatureTypes(ct.data?.tipos || []);
        const rl = Array.isArray(runs.data) ? runs.data : (runs.data?.runs || []);
        setActiveRuns(rl.filter((r) => r.status === 'active'));
        setNpcs(tn.data?.npcs || []);
      } catch {
        toast.error('No se pudieron cargar los datos de PNJ');
      } finally { setLoading(false); }
    })();
  }, []);

  const saveNpc = async (npcData) => {
    try {
      if (npcData._id) await api.put(`/trading/npcs/${npcData._id}`, npcData);
      else await api.post('/trading/npcs', npcData);
      toast.success(npcData._id ? 'PNJ actualizado' : 'PNJ creado');
      await loadNpcs();
      setShowNpcEditor(false); setEditingNpc(null);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Error al guardar el PNJ'); }
  };

  const deleteNpc = async (npcId) => {
    if (!window.confirm('¿Eliminar este PNJ?')) return;
    try { await api.delete(`/trading/npcs/${npcId}`); await loadNpcs(); toast.success('PNJ eliminado'); }
    catch { toast.error('No se pudo eliminar'); }
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-[hsl(var(--gold))]" /></div>;

  const ConfigBtn = () => (
    <Button size="sm" variant="outline" onClick={() => setShowConfig(true)} className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="open-config-btn">
      <Settings className="w-3.5 h-3.5 mr-1" /> Bases de creación
    </Button>
  );

  const editor = showNpcEditor && (
    <NpcEditorModal npc={editingNpc} config={config} onSave={saveNpc}
      onClose={() => { setShowNpcEditor(false); setEditingNpc(null); }} />
  );

  if (view === 'home') {
    return (
      <div className="space-y-4" data-testid="pnj-forge">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Crea PNJ o accede a los ya creados:</p>
          <ConfigBtn />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={() => { setEditingNpc({}); setShowNpcEditor(true); }} data-testid="forge-tipo-profesion"
            className="group rounded-xl border border-[hsl(var(--gold))/40] bg-black/30 p-6 text-left hover:border-[hsl(var(--gold))] transition-colors">
            <Users className="w-8 h-8 text-[hsl(var(--gold))] mb-2" />
            <h3 className="font-heading text-lg text-[hsl(var(--gold))]">Profesión</h3>
            <p className="text-sm text-muted-foreground mt-1">Comerciantes y artesanos. Primero raza y subcultura, luego la profesión (coherente) y la ubicación.</p>
          </button>
          <button onClick={() => setView('adversario')} data-testid="forge-tipo-adversario"
            className="group rounded-xl border border-[hsl(var(--destructive))/40] bg-black/30 p-6 text-left hover:border-[hsl(var(--destructive))] transition-colors">
            <Skull className="w-8 h-8 text-[hsl(var(--destructive))] mb-2" />
            <h3 className="font-heading text-lg text-[hsl(var(--destructive))]">Adversario</h3>
            <p className="text-sm text-muted-foreground mt-1">Malignos del Bestiario. Copia su bloque y genera el nombre según su raza o tipo de criatura.</p>
          </button>
          <button onClick={() => setView('browse')} data-testid="forge-tipo-browse"
            className="group rounded-xl border border-[hsl(var(--magic-blue))/40] bg-black/30 p-6 text-left hover:border-[hsl(var(--magic-blue))] transition-colors">
            <Search className="w-8 h-8 text-[hsl(var(--magic-blue))] mb-2" />
            <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))]">PNJs existentes</h3>
            <p className="text-sm text-muted-foreground mt-1">Consulta, edita o borra los PNJ de comercio ya creados. Filtra por ubicación y busca por nombre.</p>
          </button>
        </div>
        <CreatureNameConfigEditor open={showConfig} onClose={() => setShowConfig(false)} onSaved={loadCreatureTypes} />
        {editor}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pnj-forge">
      <div className="flex items-center justify-between">
        <button onClick={() => setView('home')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[hsl(var(--gold))]" data-testid="forge-back">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <ConfigBtn />
      </div>
      {view === 'adversario'
        ? <AdversarioForge adversarios={adversarios} razas={meta?.razas || {}} creatureTypes={creatureTypes} activeRuns={activeRuns} />
        : <NpcBrowser npcs={npcs} config={config}
            onEdit={(n) => { setEditingNpc(n); setShowNpcEditor(true); }} onDelete={deleteNpc} />}
      <CreatureNameConfigEditor open={showConfig} onClose={() => setShowConfig(false)} onSaved={loadCreatureTypes} />
      {editor}
    </div>
  );
};

// ── PNJs existentes (navegador con filtro por ubicación + búsqueda) ───────────
const NpcBrowser = ({ npcs, config, onEdit, onDelete }) => {
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');       // '' | 'comerciante' | 'adversario'
  const [raza, setRaza] = useState('');
  const [sub, setSub] = useState('');
  const [loc, setLoc] = useState('');
  const [prof, setProf] = useState('');
  const [selected, setSelected] = useState(null);

  const uniq = (fn) => Array.from(new Set((npcs || []).map(fn).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
  const razas = uniq((n) => n.raza);
  const subs = uniq((n) => n.subcultura);
  const locs = uniq((n) => n.ubicacion);
  const profs = uniq((n) => n.profesion || n.profesion_comerciante || n.tipo_adversario);

  const filtered = useMemo(() => (npcs || []).filter((n) => {
    const esAdv = !!n.es_adversario;
    const okTipo = !tipo || (tipo === 'adversario' ? esAdv : !esAdv);
    const okRaza = !raza || n.raza === raza;
    const okSub = !sub || n.subcultura === sub;
    const okLoc = !loc || n.ubicacion === loc;
    const p = n.profesion || n.profesion_comerciante || n.tipo_adversario;
    const okProf = !prof || p === prof;
    const okQ = !q || `${n.nombre || ''} ${n.apodo || ''}`.toLowerCase().includes(q.toLowerCase());
    return okTipo && okRaza && okSub && okLoc && okProf && okQ;
  }), [npcs, tipo, raza, sub, loc, prof, q]);

  const selCls = "bg-black/30 border border-border rounded px-2 py-2 text-sm";

  return (
    <div className="space-y-3" data-testid="npc-browser">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre…" className="pl-8" data-testid="npc-browser-search" />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selCls} data-testid="npc-browser-tipo">
          <option value="">— Todos —</option>
          <option value="comerciante">Comerciantes</option>
          <option value="adversario">Adversarios</option>
        </select>
        <select value={raza} onChange={(e) => setRaza(e.target.value)} className={selCls} data-testid="npc-browser-raza">
          <option value="">— Raza —</option>
          {razas.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} className={selCls} data-testid="npc-browser-sub">
          <option value="">— Subcultura —</option>
          {subs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={loc} onChange={(e) => setLoc(e.target.value)} className={selCls} data-testid="npc-browser-loc">
          <option value="">— Ubicación —</option>
          {locs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select value={prof} onChange={(e) => setProf(e.target.value)} className={selCls} data-testid="npc-browser-prof">
          <option value="">— Profesión/Tipo —</option>
          {profs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} PNJ</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No hay PNJ que coincidan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filtered.map((n) => {
            const portrait = n.retrato_file_id ? `${API_URL}/api/trading/npcs/${n._id}/portrait` : null;
            const oficio = n.es_adversario ? (n.tipo_adversario || n.profesion) : (n.profesion_comerciante || n.profesion || n.ocupacion);
            const linea = [n.raza, n.subcultura].filter(Boolean).join(' · ');
            return (
              <button key={n._id} onClick={() => setSelected(n)} data-testid={`npc-compact-${n._id}`}
                className="flex items-center gap-3 text-left rounded-lg border border-border/40 bg-black/20 p-2 hover:border-[hsl(var(--gold))]/60 transition-colors">
                <div className="shrink-0">
                  {portrait
                    ? <img src={portrait} alt={n.nombre} className="w-14 h-14 rounded-md object-cover border border-[hsl(var(--gold))]/40" />
                    : <div className="w-14 h-14 rounded-md border border-border/40 bg-black/40 flex items-center justify-center">{n.es_adversario ? <Skull className="w-6 h-6 text-muted-foreground/50" /> : <Users className="w-6 h-6 text-muted-foreground/50" />}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading text-[hsl(var(--gold))] truncate">{n.nombre}{n.apodo ? ` "${n.apodo}"` : ''}</div>
                  {oficio && <div className="text-xs text-muted-foreground truncate">{oficio}</div>}
                  <div className="text-[11px] italic text-muted-foreground/70 truncate">{linea}{n.ubicacion ? `${linea ? ' · ' : ''}${n.ubicacion}` : ''}</div>
                </div>
                {n.es_adversario && <span className="text-[10px] text-rose-300/80 border border-rose-800/50 rounded px-1 py-0.5 shrink-0">Adversario</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Ficha completa al pulsar una tarjeta compacta */}
      {selected && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" data-testid="npc-ficha-modal"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            {selected.es_adversario ? (
              <AdversaryFicha npc={selected}
                onDelete={() => { const id = selected._id; setSelected(null); onDelete(id); }} />
            ) : (
              <NpcFichaCard npc={selected} config={config}
                onEdit={() => { const n = selected; setSelected(null); onEdit(n); }}
                onDelete={() => { const id = selected._id; setSelected(null); onDelete(id); }} />
            )}
            <div className="mt-2 flex justify-end">
              <Button variant="outline" onClick={() => setSelected(null)} data-testid="npc-ficha-close">Cerrar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ── Adversario ───────────────────────────────────────────────────────────────
const AdversarioForge = ({ adversarios, razas, creatureTypes, activeRuns }) => {
  const razasKeys = Object.keys(razas || {});
  const [advId, setAdvId] = useState('');
  const [modo, setModo] = useState('sin_raza'); // 'racial' | 'sin_raza'
  const [excluidas, setExcluidas] = useState([]); // razas excluidas (para racial)
  const [permitidas, setPermitidas] = useState([]); // razas permitidas (definidas en la ficha del Bestiario)
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
  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionId, setUbicacionId] = useState('');
  const [apariencia, setApariencia] = useState('');
  const [alineamiento, setAlineamiento] = useState('');
  const [edad, setEdad] = useState('');
  const [notas, setNotas] = useState('');
  const [relacionesDj, setRelacionesDj] = useState('');
  const [busyPerfil, setBusyPerfil] = useState(false);
  const [familiaRasgos, setFamiliaRasgos] = useState('');
  const [rasgos, setRasgos] = useState([]);
  const [modoHablar, setModoHablar] = useState('');
  const [busyRasgos, setBusyRasgos] = useState(false);

  const adv = adversarios.find((a) => (a._id || a.id) === advId) || null;

  // Agrupa los adversarios por su tipo/raza (Orcos, Trolls, Espectros…) para el desplegable.
  const gruposAdv = useMemo(() => {
    const grupoDe = (a) => {
      if (Array.isArray(a.tipos_criatura) && a.tipos_criatura.length) {
        const cm = creatureTypes.find((c) => c.id === a.tipos_criatura[0]);
        if (cm) return cm.label;
      }
      const m = (a.tipo || '').match(/\(([^)]+)\)/);
      if (m) { const w = m[1].trim(); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
      if (a.tipo) { const w = a.tipo.split(/[\s(]/)[0]; return w || 'Otros'; }
      return 'Otros';
    };
    const map = {};
    (adversarios || []).forEach((a) => { const g = grupoDe(a); (map[g] = map[g] || []).push(a); });
    return Object.entries(map)
      .map(([g, arr]) => [g, arr.slice().sort((x, y) => (x.nombre || '').localeCompare(y.nombre || '', 'es'))])
      .sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [adversarios, creatureTypes]);

  useEffect(() => {
    (async () => {
      try {
        const l = await api.get('/data/locations');
        setUbicaciones((l.data?.locations || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')));
      } catch { /* noop */ }
    })();
  }, []);

  // Al elegir adversario, precarga su configuración de raza guardada.
  useEffect(() => {
    if (!adv) return;
    setModo(adv.modo_raza === 'racial' ? 'racial' : (adv.modo_raza === 'sin_raza' ? 'sin_raza' : 'sin_raza'));
    setExcluidas(Array.isArray(adv.razas_excluidas) ? adv.razas_excluidas : []);
    setPermitidas(Array.isArray(adv.razas_permitidas) ? adv.razas_permitidas : []);
    setAllowedTypes(Array.isArray(adv.tipos_criatura) ? adv.tipos_criatura : []);
    setTipoCriatura('');
    setNombre('');
    setRetrato(null); setRetratoFileId(null); setHistoria(''); setNivel(formatDesafio(adv) || '');
    setApariencia(''); setAlineamiento(adv.alineamiento || ''); setEdad(''); setNotas(''); setRelacionesDj('');
    setRasgos([]); setModoHablar('');
    // Detecta la familia de rasgos (orcos/trolls/huargos/espectros).
    const idToFam = { orco: 'orcos', trol: 'trolls', troll: 'trolls', huargo: 'huargos' };
    let fam = '';
    if (Array.isArray(adv.tipos_criatura) && adv.tipos_criatura.length) fam = idToFam[adv.tipos_criatura[0]] || '';
    if (!fam) {
      const t = `${adv.tipo || ''} ${adv.nombre || ''}`.toLowerCase();
      if (/espectr|nazg[uû]l|sombra|aparici|no-?muerto|fantasma/.test(t)) fam = 'espectros';
      else if (/orco|trasgo|uruk|snaga|goblin/.test(t)) fam = 'orcos';
      else if (/trol|troll/.test(t)) fam = 'trolls';
      else if (/huargo|lobo|warg/.test(t)) fam = 'huargos';
    }
    setFamiliaRasgos(fam);
  }, [advId]); // eslint-disable-line react-hooks/exhaustive-deps

  const doRetrato = async () => {
    const extraParts = [`${modo === 'sin_raza' ? (ct?.label || 'criatura') + ' de la Tierra Media, monstruoso' : ''}`];
    if (apariencia) extraParts.push(`distinctive physical features: ${apariencia}`);
    if (alineamiento) extraParts.push(`alignment: ${alineamiento}`);
    const body = modo === 'racial'
      ? { subculture_name: sub, sex: sexo, occupation: adv.nombre, extra: extraParts.filter(Boolean).join('; ') }
      : { occupation: adv.nombre, sex: sexo, extra: extraParts.filter(Boolean).join('; ') };
    const res = await api.post('/npc-generator/portrait', body);
    setRetrato(res.data?.image_base64 || null);
    setRetratoFileId(res.data?.file_id || null);
  };

  const doHistoria = async () => {
    const partes = [
      `Adversario tipo «${adv.nombre}».`,
      modo === 'racial' ? `Raza/subcultura: ${sub || raza || '—'}.` : `Criatura: ${ct?.label || tipoCriatura || '—'}.`,
      `Nombre: ${nombre || '—'}.`,
      alineamiento ? `Alineamiento: ${alineamiento}.` : '',
      edad ? `Edad: ${edad}.` : '',
      apariencia ? `Apariencia y rasgos físicos: ${apariencia}.` : '',
      adv.descripcion ? `Descripción del tipo: ${adv.descripcion}.` : '',
    ].filter(Boolean).join(' ');
    const res = await api.post('/npc-generator/story', { nombre: nombre || adv.nombre, contexto: partes });
    setHistoria(res.data?.historia || '');
  };

  const generarRetrato = async () => {
    if (!adv) return;
    setBusyRetrato(true);
    try { await doRetrato(); toast.success('Retrato generado'); }
    catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar el retrato'); }
    finally { setBusyRetrato(false); }
  };

  const generarHistoria = async () => {
    if (!adv) return;
    setBusyStory(true);
    try { await doHistoria(); toast.success('Historia generada'); }
    catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar la historia'); }
    finally { setBusyStory(false); }
  };

  const tirarRasgos = async () => {
    if (!familiaRasgos) { toast.error('No se ha detectado la familia de rasgos (orcos/trolls/huargos/espectros)'); return; }
    setBusyRasgos(true);
    try {
      const res = await api.post('/npc-generator/adversary-traits', { familia: familiaRasgos });
      setRasgos(res.data?.rasgos || []);
      if (res.data?.modo_hablar) setModoHablar(res.data.modo_hablar);
      toast.success('Rasgos generados');
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudieron generar los rasgos'); }
    finally { setBusyRasgos(false); }
  };

  const generarPerfilCompleto = async () => {
    if (!adv) return;
    setBusyPerfil(true);
    try {
      toast.info('Generando trasfondo…'); await doHistoria();
      toast.info('Generando retrato…'); await doRetrato();
      toast.success('Trasfondo y retrato generados');
    } catch (e) { toast.error(e?.response?.data?.detail || 'No se pudo generar el perfil completo'); }
    finally { setBusyPerfil(false); }
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
  const razasDisponibles = (permitidas && permitidas.length)
    ? razasKeys.filter((r) => permitidas.includes(r))
    : razasKeys.filter((r) => !excluidas.includes(r));
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
    if (!ubicacionId) { toast.error('Elige la ubicación del PNJ'); return; }
    setBusySave(true);
    try {
      const origen = modo === 'sin_raza'
        ? `${ct?.label || tipoCriatura}`
        : `en vida: ${sub || raza || 'desconocido'}`;
      const loc = ubicaciones.find((u) => u.id === ubicacionId);
      const razaFinal = modo === 'racial' ? (raza || '') : '';
      const subFinal = modo === 'racial' ? (sub || '') : '';
      const { _id, id, ...rest } = adv;
      // Adversario CONCRETO → se guarda en «PNJs existentes» (trading_npcs),
      // normalizando el bloque de combate a la forma de la ficha (ca/pg/caracteristicas).
      const payload = {
        ...rest,
        es_adversario: true,
        nombre: nombre.trim(),
        apodo: '',
        tipo_adversario: adv.nombre,
        profesion: adv.nombre,
        profesion_comerciante: adv.nombre,
        raza: razaFinal || (ct?.label || tipoCriatura || ''),
        subcultura: subFinal,
        sexo: sexo === 'M' ? 'Masculino' : 'Femenino',
        ca: adv.clase_armadura ?? 10,
        pg: adv.puntos_golpe ?? '',
        caracteristicas: adv.atributos || {},
        ubicacion: loc?.nombre || '',
        ubicacion_id: ubicacionId,
        region: loc?.region || '',
        descripcion: `${adv.descripcion || ''}${adv.descripcion ? ' · ' : ''}[${adv.nombre} — ${origen}]`.trim(),
        experiencia: adv.experiencia,
        desafio: nivel || formatDesafio(adv) || '',
        ...(alineamiento ? { alineamiento } : {}),
        ...(edad ? { edad } : {}),
        ...(apariencia ? { apariencia } : {}),
        ...(notas ? { notas } : {}),
        ...(relacionesDj ? { relaciones_dj: relacionesDj } : {}),
        ...(rasgos.length ? { rasgos } : {}),
        ...(modoHablar ? { modo_hablar: modoHablar } : {}),
        ...(historia ? { historia } : {}),
        ...(retratoFileId ? { retrato_file_id: retratoFileId } : {}),
      };
      const res = await api.post('/trading/npcs', payload);
      toast.success(`«${nombre.trim()}» guardado en PNJs existentes`);
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
          {gruposAdv.map(([grupo, items]) => (
            <optgroup key={grupo} label={grupo}>
              {items.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{a.nombre}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>

      {adv && (
        <div className="rounded-lg border border-border/40 bg-black/30 p-3 text-xs flex flex-wrap gap-3" data-testid="adv-preview">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-400" /> CA {adv.clase_armadura ?? '—'}</span>
          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" /> PG {adv.puntos_golpe ?? '—'}</span>
          <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5 text-amber-400" /> {(adv.armas || []).length} arma(s)</span>
          <span>Desafío {formatDesafio(adv) || '—'}</span>
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

      {/* Nombre + Ubicación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-end gap-2">
          <Field label="Nombre" className="flex-1">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Genera o escribe el nombre" data-testid="adv-nombre-input" />
          </Field>
          <Button onClick={generarNombre} disabled={busyName || !adv} variant="outline" className="border-[hsl(var(--gold))/50] text-[hsl(var(--gold))]" data-testid="adv-gen-nombre-btn">
            {busyName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          </Button>
        </div>
        <Field label="Ubicación *">
          <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)} className="forge-select" data-testid="adv-ubicacion-select">
            <option value="">— elige ubicación —</option>
            {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}{u.region ? ` (${u.region})` : ''}</option>)}
          </select>
        </Field>
      </div>

      {/* Alineamiento + Edad + Apariencia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Alineamiento">
          <Input value={alineamiento} onChange={(e) => setAlineamiento(e.target.value)} placeholder="Ej: Caótico Maligno" data-testid="adv-alineamiento-input" />
        </Field>
        <Field label="Edad (opcional)">
          <Input value={edad} onChange={(e) => setEdad(e.target.value)} placeholder="En blanco = sin especificar" data-testid="adv-edad-input" />
        </Field>
        <Field label="Apariencia / rasgos físicos">
          <textarea rows={2} value={apariencia} onChange={(e) => setApariencia(e.target.value)} placeholder="Ej: múltiples cicatrices, una oreja cortada"
            className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="adv-apariencia-input" />
        </Field>
      </div>

      {/* Rasgos de adversario (5 aleatorios: defecto, obsesión, miedo, manía, fortaleza) */}
      <div className="rounded-lg border border-[hsl(var(--gold))]/30 bg-black/20 p-3 space-y-2" data-testid="adv-rasgos-block">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-[hsl(var(--gold))] font-bold">Rasgos de adversario</label>
          <select value={familiaRasgos} onChange={(e) => setFamiliaRasgos(e.target.value)} className="forge-select h-8 text-xs w-36" data-testid="adv-familia-select">
            <option value="">— familia —</option>
            <option value="orcos">Orcos</option>
            <option value="trolls">Trolls</option>
            <option value="huargos">Huargos</option>
            <option value="espectros">Espectros</option>
          </select>
          <Button size="sm" variant="outline" onClick={tirarRasgos} disabled={busyRasgos || !familiaRasgos}
            className="h-8 border-[hsl(var(--gold))/50] text-[hsl(var(--gold))] text-xs" data-testid="adv-tirar-rasgos-btn">
            {busyRasgos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Wand2 className="w-3.5 h-3.5 mr-1" /> Tirar 5 rasgos</>}
          </Button>
        </div>
        {rasgos.length > 0 && (
          <div className="space-y-1" data-testid="adv-rasgos-list">
            {rasgos.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={r} onChange={(e) => setRasgos((p) => p.map((x, j) => j === i ? e.target.value : x))}
                  className="flex-1 bg-black/40 rounded px-2 py-1 text-xs outline-none border border-border/50" data-testid={`adv-rasgo-${i}`} />
                <button onClick={() => setRasgos((p) => p.filter((_, j) => j !== i))} className="text-red-400 text-xs px-1" title="Quitar">✕</button>
              </div>
            ))}
          </div>
        )}
        {(familiaRasgos === 'orcos' || familiaRasgos === 'trolls') && (
          <div>
            <label className="text-xs text-muted-foreground">Forma de hablar</label>
            <input value={modoHablar} onChange={(e) => setModoHablar(e.target.value)} placeholder="Se rellena al tirar rasgos"
              className="w-full bg-black/40 rounded px-2 py-1 text-xs outline-none border border-border/50" data-testid="adv-modo-hablar-input" />
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Button onClick={generarPerfilCompleto} disabled={busyPerfil || busyStory || busyRetrato || !adv}
          className="bg-[hsl(var(--gold))] text-black hover:opacity-90" data-testid="adv-perfil-completo-btn">
          {busyPerfil ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
          Generar trasfondo + retrato
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
            <input type="text" value={nivel} onChange={(e) => setNivel(e.target.value)} placeholder={formatDesafio(adv) || ''}
              className="forge-select w-40" data-testid="adv-nivel-input" />
          </Field>
        </div>
      </div>

      {/* Relaciones con PJs + Notas del DJ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Relaciones con personajes (notas del DJ)</label>
          <textarea rows={2} value={relacionesDj} onChange={(e) => setRelacionesDj(e.target.value)} placeholder="Ej: humilló a Faramir en el paso; le guarda rencor…"
            className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="adv-relaciones-input" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Notas del DJ</label>
          <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas privadas del máster…"
            className="w-full bg-black/40 rounded p-2 text-xs outline-none border border-border/50 resize-y" data-testid="adv-notas-input" />
        </div>
      </div>

      <Button onClick={guardar} disabled={busySave || !adv} className="bg-[hsl(var(--destructive))] text-white hover:opacity-90" data-testid="adv-guardar-btn">
        {busySave ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar en PNJs existentes
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
      <p className="text-xs text-muted-foreground">Se copia el bloque completo del adversario con el nuevo nombre y aparece en «PNJs existentes». Podrás afinarlo después.</p>
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
