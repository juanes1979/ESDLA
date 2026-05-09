/**
 * NPCGeneratorDialogs — modales para el generador avanzado de PNJs:
 *
 * - <BestiaryPickDialog>: tras pulsar una entrada del bestiario,
 *   pregunta si el PNJ será "Genérico" (auto-numerado) o "Especial"
 *   (editable, con generación IA opcional de nombre/retrato).
 *
 * - <SubcultureGeneratorDialog>: formulario completo para crear un
 *   PNJ desde cero según subcultura/sexo/ocupación. Llama al backend
 *   `/api/npc-generator/generate`, `/name`, `/portrait` y devuelve el
 *   stat block completo listo para insertar en el adventure.
 */
import { useState, useEffect, useMemo } from 'react';
import { Dice5, Sparkles, Loader2, Image as ImageIcon, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  getNpcGeneratorOccupations,
  generateNpc,
  generateNpcName,
  generateNpcPortrait,
  getCultures,
} from '@/services/api';

// =====================================================================
// BestiaryPickDialog
// =====================================================================
export const BestiaryPickDialog = ({ open, bestiaryEntry, onClose, onConfirm }) => {
  const [mode, setMode] = useState('generico');
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (open && bestiaryEntry) {
      setMode('generico');
      setCustomName(bestiaryEntry.nombre || '');
    }
  }, [open, bestiaryEntry]);

  if (!bestiaryEntry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md" data-testid="bestiary-pick-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Añadir "{bestiaryEntry.nombre}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Cómo lo añades a la aventura?
          </p>

          <button
            type="button"
            onClick={() => setMode('generico')}
            className={`w-full text-left p-3 rounded border-2 transition-all ${
              mode === 'generico'
                ? 'border-amber-500 bg-amber-900/30'
                : 'border-amber-800/40 hover:border-amber-600'
            }`}
            data-testid="pick-mode-generico"
          >
            <div className="flex items-center gap-2 font-bold text-amber-200">
              <Dice5 className="w-4 h-4" /> Genérico
            </div>
            <p className="text-xs text-amber-300/70 mt-1">
              Se añadirá como copia rápida y se auto-numerará si ya tienes otros del
              mismo tipo (p. ej. {bestiaryEntry.nombre} 1, {bestiaryEntry.nombre} 2…).
              No editable individualmente.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('especial')}
            className={`w-full text-left p-3 rounded border-2 transition-all ${
              mode === 'especial'
                ? 'border-emerald-500 bg-emerald-900/30'
                : 'border-amber-800/40 hover:border-amber-600'
            }`}
            data-testid="pick-mode-especial"
          >
            <div className="flex items-center gap-2 font-bold text-emerald-200">
              <Sparkles className="w-4 h-4" /> Especial
            </div>
            <p className="text-xs text-emerald-300/70 mt-1">
              Crea una versión editable con nombre y stats propios. Podrás generar
              nombre/retrato con IA y cambiar lo que quieras.
            </p>
          </button>

          {mode === 'especial' && (
            <div>
              <Label className="text-xs">Nombre del PNJ especial</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={`p. ej. ${bestiaryEntry.nombre} el Tuerto`}
                data-testid="pick-special-name-input"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm({ mode, name: mode === 'especial' ? customName.trim() : null })}
            disabled={mode === 'especial' && !customName.trim()}
            data-testid="pick-confirm-btn"
          >
            Añadir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


// =====================================================================
// SubcultureGeneratorDialog
// =====================================================================
export const SubcultureGeneratorDialog = ({ open, onClose, onConfirm }) => {
  const [cultures, setCultures] = useState([]);
  const [occupations, setOccupations] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Form state
  const [cultureId, setCultureId] = useState('');
  const [subcultureName, setSubcultureName] = useState('');
  const [sex, setSex] = useState('M');
  const [occupation, setOccupation] = useState('');
  const [level, setLevel] = useState(1);
  const [age, setAge] = useState('');
  const [eyes, setEyes] = useState('');
  const [hair, setHair] = useState('');
  const [extra, setExtra] = useState('');
  const [mode, setMode] = useState('especial'); // 'generico' | 'especial'

  // Generated result
  const [generated, setGenerated] = useState(null);
  const [generatedName, setGeneratedName] = useState('');
  const [portraitB64, setPortraitB64] = useState(null);
  const [portraitFileId, setPortraitFileId] = useState(null);

  // Loading flags
  const [generating, setGenerating] = useState(false);
  const [loadingName, setLoadingName] = useState(false);
  const [loadingPortrait, setLoadingPortrait] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setGenerated(null);
      setGeneratedName('');
      setPortraitB64(null);
      setPortraitFileId(null);
      setLoadingMeta(true);
      Promise.all([getCultures(), getNpcGeneratorOccupations()])
        .then(([cs, os]) => {
          setCultures(cs || []);
          setOccupations(os?.occupations || []);
        })
        .catch((e) => toast.error('No se pudo cargar metadatos: ' + e.message))
        .finally(() => setLoadingMeta(false));
    }
  }, [open]);

  const subcultureOptions = useMemo(() => {
    const cul = cultures.find((c) => (c.id || c._id) === cultureId);
    if (!cul) return [];
    return cul.subculturas || cul.subcultures || [];
  }, [cultures, cultureId]);

  const handleGenerate = async () => {
    if (!occupation) {
      toast.error('Elige una ocupación');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateNpc({
        subculture_id: null,
        subculture_name: subcultureName || null,
        sex,
        occupation,
        level,
        mode,
      });
      setGenerated(result);
      toast.success('Stat block generado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error generando PNJ');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateName = async () => {
    setLoadingName(true);
    try {
      const r = await generateNpcName({
        subculture_name: subcultureName || null,
        sex,
        occupation,
      });
      setGeneratedName(r.name || '');
      if (r.fallback) {
        toast.warning('IA no respondió, usando nombre fallback');
      } else {
        toast.success('Nombre IA generado');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error generando nombre');
    } finally {
      setLoadingName(false);
    }
  };

  const handleGeneratePortrait = async () => {
    setLoadingPortrait(true);
    try {
      const r = await generateNpcPortrait({
        subculture_name: subcultureName || null,
        sex,
        occupation,
        age,
        eyes,
        hair,
        extra,
      });
      setPortraitB64(r.image_base64 || null);
      setPortraitFileId(r.file_id || null);
      toast.success('Retrato IA generado');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Error generando retrato');
    } finally {
      setLoadingPortrait(false);
    }
  };

  const handleConfirm = () => {
    if (!generated) {
      toast.error('Genera primero el stat block');
      return;
    }
    const finalName = generatedName || `${generated.archetype_label}${subcultureName ? ' ' + subcultureName : ''}`;
    onConfirm({
      generated,
      name: finalName,
      portrait_file_id: portraitFileId || null,
      portrait_b64: portraitFileId ? null : portraitB64, // prefer file_id
      mode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="subculture-generator-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-amber-300" /> Generar PNJ desde subcultura
          </DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* === FORM === */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Cultura</Label>
                <select
                  value={cultureId}
                  onChange={(e) => {
                    setCultureId(e.target.value);
                    setSubcultureName('');
                  }}
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
                  data-testid="gen-culture-select"
                >
                  <option value="">— Sin cultura específica —</option>
                  {cultures.map((c) => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {c.nombre || c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs">Subcultura</Label>
                <select
                  value={subcultureName}
                  onChange={(e) => setSubcultureName(e.target.value)}
                  disabled={!cultureId}
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm disabled:opacity-50"
                  data-testid="gen-subculture-select"
                >
                  <option value="">— Cualquiera —</option>
                  {subcultureOptions.map((s) => {
                    const sname = s.nombre || s.name || s;
                    return (
                      <option key={sname} value={sname}>
                        {sname}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Sexo</Label>
                  <select
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
                    data-testid="gen-sex-select"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Nivel</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={level}
                    onChange={(e) => setLevel(Math.max(1, Math.min(20, +e.target.value || 1)))}
                    data-testid="gen-level-input"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Ocupación *</Label>
                <select
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full h-9 px-3 rounded border border-input bg-background text-sm"
                  data-testid="gen-occupation-select"
                >
                  <option value="">— Elige una —</option>
                  {occupations.map((o) => (
                    <option key={`${o.source}-${o.name}`} value={o.name}>
                      {o.name}
                      {o.has_saving_throws ? ' ⚔' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                  ⚔ = Tiene tiradas de salvación reglamentadas (del creador de personajes).
                </p>
              </div>

              <div>
                <Label className="text-xs">Modo</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('generico')}
                    className={`flex-1 px-3 py-1.5 rounded border text-xs ${
                      mode === 'generico'
                        ? 'border-amber-500 bg-amber-900/40 text-amber-100'
                        : 'border-amber-800/40 text-amber-300/70'
                    }`}
                    data-testid="gen-mode-generico"
                  >
                    Genérico (auto-numerado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('especial')}
                    className={`flex-1 px-3 py-1.5 rounded border text-xs ${
                      mode === 'especial'
                        ? 'border-emerald-500 bg-emerald-900/40 text-emerald-100'
                        : 'border-amber-800/40 text-amber-300/70'
                    }`}
                    data-testid="gen-mode-especial"
                  >
                    Especial (editable)
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-800/30">
                <p className="text-xs text-amber-300/70 mb-2">Detalles para el retrato (opcional):</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Edad (joven, viejo…)" value={age} onChange={(e) => setAge(e.target.value)} data-testid="gen-age-input" />
                  <Input placeholder="Ojos" value={eyes} onChange={(e) => setEyes(e.target.value)} data-testid="gen-eyes-input" />
                  <Input placeholder="Pelo / barba" value={hair} onChange={(e) => setHair(e.target.value)} data-testid="gen-hair-input" />
                  <Input placeholder="Otros rasgos" value={extra} onChange={(e) => setExtra(e.target.value)} data-testid="gen-extra-input" />
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !occupation}
                className="w-full bg-amber-700 hover:bg-amber-600"
                data-testid="gen-generate-btn"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Dice5 className="w-4 h-4 mr-2" />
                )}
                Generar stat block
              </Button>
            </div>

            {/* === PREVIEW === */}
            <div className="space-y-3">
              {!generated ? (
                <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm border border-dashed border-amber-800/30 rounded p-6">
                  Aún no se ha generado nada.
                </div>
              ) : (
                <>
                  <div className="p-3 rounded border border-amber-700/40 bg-black/40">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-amber-200">{generatedName || `${generated.archetype_label} (sin nombre)`}</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleGenerateName}
                        disabled={loadingName}
                        data-testid="gen-ai-name-btn"
                      >
                        {loadingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                        <span className="ml-1 text-xs">Nombre IA</span>
                      </Button>
                    </div>
                    <Input
                      value={generatedName}
                      onChange={(e) => setGeneratedName(e.target.value)}
                      placeholder="Edita el nombre…"
                      className="mb-2 text-sm"
                      data-testid="gen-name-input"
                    />
                    <div className="text-xs text-amber-200/90 grid grid-cols-2 gap-x-2 gap-y-1">
                      <div><strong>CA:</strong> {generated.ca}</div>
                      <div><strong>HP:</strong> {generated.hp} ({generated.hp_formula})</div>
                      <div><strong>Vel:</strong> {generated.speed_m} m</div>
                      <div><strong>PX:</strong> {generated.experiencia}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                      {Object.entries(generated.atributos).map(([k, a]) => (
                        <div key={k} className="text-center bg-amber-900/30 rounded p-1">
                          <div className="text-amber-300/70 uppercase">{k.slice(0, 3)}</div>
                          <div className="font-bold text-amber-100">{a.valor} ({a.modificador >= 0 ? '+' : ''}{a.modificador})</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-amber-200/80">
                      <strong>TS:</strong> {generated.tiradas_salvacion.join(', ') || '—'}<br />
                      <strong>Equipo:</strong> {generated.equipo.join(', ')}<br />
                      <strong>Idiomas:</strong> {generated.idiomas.join(', ')}
                    </div>
                  </div>

                  {/* Portrait */}
                  <div className="p-3 rounded border border-amber-700/40 bg-black/40">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-amber-200 text-sm">Retrato B&N</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleGeneratePortrait}
                        disabled={loadingPortrait}
                        data-testid="gen-ai-portrait-btn"
                      >
                        {loadingPortrait ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span className="ml-1 text-xs">Generar IA</span>
                      </Button>
                    </div>
                    {loadingPortrait ? (
                      <div className="h-48 flex items-center justify-center text-amber-300/60 text-xs">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Pintando con carboncillo…
                      </div>
                    ) : portraitB64 ? (
                      <img
                        src={`data:image/png;base64,${portraitB64}`}
                        alt="Retrato generado"
                        className="w-full max-h-64 object-contain rounded"
                        data-testid="gen-portrait-img"
                      />
                    ) : (
                      <div className="h-32 flex items-center justify-center text-amber-300/30 text-xs italic">
                        Aún no se ha generado retrato.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!generated}
            className="bg-emerald-700 hover:bg-emerald-600"
            data-testid="gen-confirm-btn"
          >
            <Sparkles className="w-4 h-4 mr-1" /> Añadir a la aventura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
