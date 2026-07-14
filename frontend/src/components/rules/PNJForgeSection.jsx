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
import { Users, Skull, Wand2, Save, Loader2, Dices, ChevronLeft, Shield, Heart, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

const sexoCorto = (s) => ((s || 'Masculino').toLowerCase().startsWith('m') ? 'M' : 'F');

const PNJForgeSection = () => {
  const [tipo, setTipo] = useState(null); // 'profesion' | 'adversario'
  const [meta, setMeta] = useState(null);
  const [adversarios, setAdversarios] = useState([]);
  const [creatureTypes, setCreatureTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [m, npcs, ct] = await Promise.all([
          api.get('/trading/npc-meta'),
          api.get('/data/npcs'),
          api.get('/npc-generator/creature-types'),
        ]);
        setMeta(m.data);
        setAdversarios((npcs.data?.malignos || []).slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre)));
        setCreatureTypes(ct.data?.tipos || []);
      } catch {
        toast.error('No se pudieron cargar los datos de PNJ');
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-[hsl(var(--gold))]" /></div>;

  if (!tipo) {
    return (
      <div className="space-y-4" data-testid="pnj-forge">
        <p className="text-sm text-muted-foreground">Elige qué tipo de PNJ quieres crear:</p>
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
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="pnj-forge">
      <button onClick={() => setTipo(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[hsl(var(--gold))]" data-testid="forge-back">
        <ChevronLeft className="w-4 h-4" /> Cambiar tipo
      </button>
      {tipo === 'profesion'
        ? <ProfesionForge meta={meta} />
        : <AdversarioForge adversarios={adversarios} razas={meta?.razas || {}} creatureTypes={creatureTypes} />}
    </div>
  );
};

// ── Profesión ────────────────────────────────────────────────────────────────
const ProfesionForge = ({ meta }) => {
  const razasKeys = Object.keys(meta?.razas || {});
  const [profesion, setProfesion] = useState('');
  const [raza, setRaza] = useState('');
  const [sub, setSub] = useState('');
  const [sexo, setSexo] = useState('Masculino');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const subs = (meta?.razas?.[raza] || []).map((s) => s.nombre);

  const crear = async () => {
    if (!profesion) { toast.error('Elige una profesión'); return; }
    setBusy(true);
    try {
      const res = await api.post('/trading/npcs', { profesion, raza, subcultura: sub, sexo });
      setResult(res.data?.npc || res.data);
      toast.success('PNJ de comercio creado y guardado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error al crear el PNJ');
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--gold))/30] bg-black/20 p-4 space-y-3" data-testid="profesion-forge">
      <h3 className="font-heading text-[hsl(var(--gold))] flex items-center gap-2"><Users className="w-5 h-5" /> PNJ por profesión</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Dices className="w-4 h-4 mr-1" />} Crear y guardar
      </Button>
      {result && (
        <div className="rounded-lg border border-[hsl(var(--gold))/30] bg-black/30 p-3 text-sm" data-testid="profesion-result">
          <div className="text-[hsl(var(--gold))] font-heading">{result.nombre}</div>
          <div className="text-muted-foreground">{result.profesion || result.profesion_comerciante} · {result.raza} {result.subcultura ? `(${result.subcultura})` : ''}</div>
          {result.rasgo && <div className="text-xs mt-1">Rasgo: {result.rasgo}</div>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Se guarda en los PNJ de comercio. Podrás editarlo con todo el detalle en Compra-Venta → «PNJs».</p>
      <style>{`.forge-select{width:100%;background:rgba(0,0,0,.4);border:1px solid hsl(var(--border));border-radius:.375rem;padding:.4rem .5rem;font-size:.875rem;color:inherit}`}</style>
    </div>
  );
};

// ── Adversario ───────────────────────────────────────────────────────────────
const AdversarioForge = ({ adversarios, razas, creatureTypes }) => {
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

  const adv = adversarios.find((a) => (a._id || a.id) === advId) || null;
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
      };
      const res = await api.post('/data/npcs', payload);
      toast.success(`«${nombre.trim()}» guardado en el Bestiario`);
      setNombre('');
      return res.data;
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar el adversario');
    } finally { setBusySave(false); }
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
      <div className="flex gap-2">
        <ModoBtn active={modo === 'sin_raza'} onClick={() => setModo('sin_raza')} testid="modo-sin-raza">Sin raza (criatura)</ModoBtn>
        <ModoBtn active={modo === 'racial'} onClick={() => setModo('racial')} testid="modo-racial">Racial (con raza)</ModoBtn>
      </div>

      {modo === 'sin_raza' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Tipo de criatura">
            <select value={tipoCriatura} onChange={(e) => setTipoCriatura(e.target.value)} className="forge-select" data-testid="criatura-select">
              <option value="">— elige —</option>
              {creatureTypes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
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

      <Button onClick={guardar} disabled={busySave || !adv} className="bg-[hsl(var(--destructive))] text-white hover:opacity-90" data-testid="adv-guardar-btn">
        {busySave ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Guardar en Bestiario
      </Button>
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
