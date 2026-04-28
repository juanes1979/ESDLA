/**
 * PrivateNotesCard
 * Notas privadas que el DJ escribe sobre el personaje y que SOLO debería
 * ver el jugador propietario dentro de su propia ficha. Hasta que tengamos
 * RBAC (Maestro / DJ / Jugador), el campo se muestra siempre con un
 * banner naranja recordando su naturaleza confidencial.
 */
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Save, Loader2, Lock } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';

export const PrivateNotesCard = ({ character, onUpdate }) => {
  const [notas, setNotas] = useState(character?.notas_privadas_jugador || '');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotas(character?.notas_privadas_jugador || '');
  }, [character?.id, character?.notas_privadas_jugador]);

  const handleSave = async () => {
    if (!character?.id) return;
    setSaving(true);
    try {
      const res = await api.patch(`/characters/${character.id}`, {
        notas_privadas_jugador: notas,
      });
      if (onUpdate) onUpdate(res.data);
      toast.success('Notas privadas guardadas.');
    } catch (err) {
      console.error('Error guardando notas privadas:', err);
      toast.error('No se pudieron guardar las notas privadas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="card-parchment border border-purple-500/40 bg-purple-950/10"
      data-testid="private-notes-card"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-purple-300 flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Notas privadas del jugador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-purple-200/70 italic">
          Estas notas las escribe el DJ y <strong>solo</strong> el jugador
          propietario las ve en su ficha. Cosas que tu personaje sabe pero
          el resto del grupo no — comparte solo lo que decidas en partida.
        </p>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setVisible(v => !v)}
            data-testid="toggle-private-notes-btn"
          >
            {visible ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" /> Ocultar
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" /> Mostrar
              </>
            )}
          </Button>
          {(notas || '').length > 0 && !visible && (
            <span className="text-xs text-purple-200/60">
              {notas.length} caracteres ocultos
            </span>
          )}
        </div>

        {visible && (
          <>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={6}
              placeholder="Anota aquí lo que tu personaje sabe en secreto, premoniciones, pistas que el DJ te ha entregado…"
              className="text-sm bg-black/40"
              data-testid="private-notes-textarea"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || notas === (character?.notas_privadas_jugador || '')}
                data-testid="save-private-notes-btn"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Guardar
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PrivateNotesCard;
