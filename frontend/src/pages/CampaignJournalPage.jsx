/**
 * Diario de campaña — crónica acumulada de todas las sesiones.
 * Lista cada sesión como un capítulo con su resumen (editable por el DJ),
 * permite imprimir cada sesión y descargar el diario completo en PDF.
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ScrollText, Printer, Download, Save, Pencil, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getDjScreen, getSessions, editSession } from '@/services/api';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

// Genera un PDF (jsPDF) con una o varias sesiones y lo abre para imprimir/guardar.
const buildJournalPdf = (adventureName, sessions) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  let y = M;

  const ensure = (h) => { if (y + h > doc.internal.pageSize.getHeight() - M) { doc.addPage(); y = M; } };

  doc.setFont('times', 'bold'); doc.setFontSize(22);
  doc.text('Diario de Campaña', W / 2, y, { align: 'center' }); y += 26;
  doc.setFont('times', 'italic'); doc.setFontSize(14);
  doc.text(adventureName || '', W / 2, y, { align: 'center' }); y += 30;
  doc.setDrawColor(150); doc.line(M, y, W - M, y); y += 24;

  sessions.forEach((s) => {
    ensure(80);
    doc.setFont('times', 'bold'); doc.setFontSize(16);
    doc.text(s.titulo || `Sesión ${s.numero}`, M, y); y += 18;
    doc.setFont('times', 'italic'); doc.setFontSize(10); doc.setTextColor(110);
    doc.text(`${fmtDate(s.start_time)}  —  ${s.status === 'active' ? 'en curso' : fmtDate(s.end_time)}`, M, y);
    doc.setTextColor(0); y += 20;
    doc.setFont('times', 'normal'); doc.setFontSize(12);
    const body = s.summary || (s.status === 'active' ? 'Sesión en curso (resumen pendiente).' : 'Sin crónica.');
    const lines = doc.splitTextToSize(body, W - M * 2);
    lines.forEach((ln) => { ensure(16); doc.text(ln, M, y); y += 16; });
    y += 22;
  });

  return doc;
};

const CampaignJournalPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [adventure, setAdventure] = useState('');
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ titulo: '', summary: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [screen, sess] = await Promise.all([getDjScreen(id), getSessions(id)]);
      setCanEdit(screen.can_edit);
      setAdventure(screen.run?.adventure_name || '');
      // Orden cronológico ascendente (capítulos).
      setSessions((sess.sessions || []).slice().sort((a, b) => a.numero - b.numero));
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Sin acceso al diario');
      navigate(-1);
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (s) => { setEditingId(s.id); setDraft({ titulo: s.titulo || '', summary: s.summary || '' }); };
  const cancelEdit = () => { setEditingId(null); setDraft({ titulo: '', summary: '' }); };

  const saveEdit = async (sessionId) => {
    setSaving(true);
    try {
      const updated = await editSession(id, sessionId, { titulo: draft.titulo, summary: draft.summary });
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s)));
      setEditingId(null);
      toast.success('Crónica actualizada');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'No se pudo guardar');
    } finally { setSaving(false); }
  };

  const printSession = (s) => buildJournalPdf(adventure, [s]).output('dataurlnewwindow');
  const downloadFull = () => buildJournalPdf(adventure, sessions).save(`diario-${(adventure || 'campana').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  const printFull = () => buildJournalPdf(adventure, sessions).output('dataurlnewwindow');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 animate-spin text-amber-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-amber-100" data-testid="journal-page">
      <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md border-b border-amber-700/40 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/campanas/${id}/pantalla`)} className="text-amber-200 hover:bg-amber-900/30" data-testid="journal-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Pantalla del DJ
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-lg sm:text-xl text-amber-300 truncate flex items-center gap-2"><ScrollText className="w-5 h-5" /> Diario de campaña</h1>
            <div className="text-xs text-amber-300/60 truncate">{adventure}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={printFull} disabled={sessions.length === 0} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-8 text-xs" data-testid="print-full-btn"><Printer className="w-3.5 h-3.5 mr-1" /> Imprimir diario</Button>
          <Button size="sm" onClick={downloadFull} disabled={sessions.length === 0} className="bg-amber-700 hover:bg-amber-600 text-amber-50 h-8 text-xs" data-testid="download-full-btn"><Download className="w-3.5 h-3.5 mr-1" /> PDF completo</Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {sessions.length === 0 && (
          <div className="text-center py-16 text-stone-500">
            <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="italic">Aún no hay sesiones. Inicia una sesión desde la Pantalla del DJ; al cerrarla se añadirá su crónica al diario.</p>
          </div>
        )}

        {sessions.map((s) => (
          <div key={s.id} className="rounded-xl border border-amber-800/40 bg-black/50 p-4" data-testid={`journal-chapter-${s.numero}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                {editingId === s.id ? (
                  <input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })}
                    className="w-full bg-black/40 rounded px-2 py-1 text-lg font-heading text-amber-200 outline-none border border-amber-900/40" data-testid={`journal-title-input-${s.numero}`} />
                ) : (
                  <h2 className="font-heading text-lg text-amber-200 truncate flex items-center gap-2">
                    {s.titulo}
                    {s.status === 'active' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300">activa</span>}
                  </h2>
                )}
                <div className="text-[11px] text-stone-500 mt-0.5">{fmtDate(s.start_time)} — {s.status === 'active' ? 'en curso' : fmtDate(s.end_time)}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => printSession(s)} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-7 px-2 text-xs" data-testid={`print-session-${s.numero}`}><Printer className="w-3.5 h-3.5" /></Button>
                {canEdit && editingId !== s.id && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(s)} className="border-amber-700/50 text-amber-200 hover:bg-amber-900/30 h-7 px-2 text-xs" data-testid={`edit-session-${s.numero}`}><Pencil className="w-3.5 h-3.5" /></Button>
                )}
              </div>
            </div>

            {editingId === s.id ? (
              <div>
                <textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} rows={8}
                  className="w-full bg-black/40 rounded p-2 text-sm text-stone-200 outline-none border border-amber-900/40 resize-y" data-testid={`journal-summary-input-${s.numero}`} />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={() => saveEdit(s.id)} disabled={saving} className="bg-emerald-700 hover:bg-emerald-600 text-emerald-50 h-7 text-xs" data-testid={`save-session-${s.numero}`}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Guardar</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit} className="border-stone-600/50 text-stone-300 h-7 text-xs" data-testid={`cancel-session-${s.numero}`}><X className="w-3.5 h-3.5 mr-1" /> Cancelar</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-300 whitespace-pre-line leading-relaxed" data-testid={`journal-text-${s.numero}`}>
                {s.summary || (s.status === 'active'
                  ? <span className="italic text-stone-500">Sesión en curso. La crónica se generará al cerrarla.</span>
                  : <span className="italic text-stone-500">Sin crónica registrada.</span>)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CampaignJournalPage;
