/**
 * Character Summary - Final review before creation
 */
import { useState } from 'react';
import { Loader2, Edit2, Check, User, Sword, Shield, Heart, Star, Crown, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { downloadCharacterPDF } from '@/utils/characterPDF';

const getModifier = (score) => {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
};

const CharacterSummary = ({ draft, onFinalize, onEdit, loading }) => {
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    try {
      setGeneratingPDF(true);
      await downloadCharacterPDF(draft);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (!draft) return null;

  const attributes = draft.atributos_finales || {};

  return (
    <div className="space-y-8" data-testid="character-summary">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Resumen del Personaje
        </h2>
        <p className="text-muted-foreground">
          Revisa los detalles antes de finalizar la creación
        </p>
      </div>

      {/* Main Card */}
      <div className="card-parchment rounded-lg p-6">
        {/* Character Header */}
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-border">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--gold))/30] to-[hsl(var(--gold))/10] flex items-center justify-center border-2 border-[hsl(var(--gold))]">
            <span className="font-heading text-4xl text-[hsl(var(--gold))]">
              {draft.nombre?.[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-heading text-3xl text-foreground mb-1">
              {draft.nombre}
            </h1>
            <p className="text-lg text-muted-foreground">
              {draft.cultura_nombre} {draft.vocacion_nombre}
            </p>
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>{draft.edad} años</span>
              <span>{draft.altura_cm} cm</span>
              <span>{draft.peso_kg} kg</span>
            </div>
          </div>
        </div>

        {/* Attributes */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Star className="w-5 h-5" />
            Atributos
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'fuerza', name: 'FUE' },
              { key: 'destreza', name: 'DES' },
              { key: 'constitucion', name: 'CON' },
              { key: 'inteligencia', name: 'INT' },
              { key: 'sabiduria', name: 'SAB' },
              { key: 'carisma', name: 'CAR' },
            ].map(attr => (
              <div key={attr.key} className="stat-box p-3 text-center">
                <p className="text-xs text-muted-foreground">{attr.name}</p>
                <p className="stat-value text-xl">{attributes[attr.key] || 10}</p>
                <p className="text-xs text-muted-foreground">
                  ({getModifier(attributes[attr.key] || 10)})
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Combat Stats */}
        <div className="mb-6">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
            <Sword className="w-5 h-5" />
            Combate
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-box p-3 text-center">
              <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
              <p className="text-xs text-muted-foreground">Puntos de Golpe</p>
              <p className="stat-value">{draft.puntos_golpe_max || 8}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <Shield className="w-5 h-5 mx-auto mb-1 text-[hsl(var(--magic-blue))]" />
              <p className="text-xs text-muted-foreground">Clase de Armadura</p>
              <p className="stat-value">
                {10 + Math.floor(((attributes.destreza || 10) - 10) / 2)}
              </p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Dado de Golpe</p>
              <p className="stat-value text-lg">{draft.dado_golpe || '1d8'}</p>
            </div>
            <div className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">Velocidad</p>
              <p className="stat-value text-lg">{draft.velocidad || 9}m</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Background & Virtue */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Trasfondo y Virtud
            </h3>
            <div className="space-y-3">
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Trasfondo</p>
                <p className="text-foreground">{draft.trasfondo_nombre}</p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Virtud</p>
                <p className="text-foreground">{draft.virtud_nombre}</p>
                {draft.rasgos_virtud && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {draft.rasgos_virtud.substring(0, 100)}...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Habilidades
            </h3>
            <div className="bg-secondary rounded-lg p-3">
              <div className="flex flex-wrap gap-2">
                {(draft.habilidades_elegidas || []).map((skill, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded bg-[hsl(var(--gold))/20] text-[hsl(var(--gold))] text-sm"
                  >
                    {skill}
                  </span>
                ))}
                {(draft.competencias_trasfondo?.habilidades || []).map((skill, i) => (
                  <span
                    key={`bg-${i}`}
                    className="px-2 py-1 rounded bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Patron */}
        {draft.patron_nombre && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Mecenas
            </h3>
            <div className="bg-secondary rounded-lg p-3">
              <p className="text-foreground">{draft.patron_nombre}</p>
              <p className="text-sm text-muted-foreground">
                Puntos de Comunidad: {draft.puntos_comunidad || 0}
              </p>
            </div>
          </div>
        )}

        {/* Personal Details */}
        {(draft.rasgo_distintivo || draft.defecto || draft.motivacion) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Personalidad
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {draft.rasgo_distintivo && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Rasgo Distintivo</p>
                  <p className="text-sm text-foreground">{draft.rasgo_distintivo}</p>
                </div>
              )}
              {draft.defecto && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Defecto</p>
                  <p className="text-sm text-foreground">{draft.defecto}</p>
                </div>
              )}
              {draft.motivacion && (
                <div className="bg-secondary rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Motivación</p>
                  <p className="text-sm text-foreground">{draft.motivacion}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Equipment Summary */}
        {(draft.inventario?.length > 0 || (draft.dinero?.mp > 0 || draft.dinero?.mo > 0)) && (
          <div className="mt-6">
            <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">
              Equipo
            </h3>
            <div className="bg-secondary rounded-lg p-3">
              {draft.inventario?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {draft.inventario.map((item, i) => (
                    <span key={i} className="text-sm text-muted-foreground">
                      {item.nombre}
                      {i < draft.inventario.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-4 text-sm">
                {draft.dinero?.mp > 0 && <span>{draft.dinero.mp} mp</span>}
                {draft.dinero?.mo > 0 && <span>{draft.dinero.mo} mo</span>}
                {draft.dinero?.mc > 0 && <span>{draft.dinero.mc} mc</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 flex-wrap">
        <Button
          variant="outline"
          onClick={onEdit}
          className="border-border hover:bg-secondary"
          data-testid="edit-character-btn"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadPDF}
          disabled={generatingPDF}
          className="border-[hsl(var(--magic-blue))] text-[hsl(var(--magic-blue))] hover:bg-[hsl(var(--magic-blue))/10]"
          data-testid="download-pdf-btn"
        >
          {generatingPDF ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          Descargar PDF (3 hojas)
        </Button>
        <Button
          onClick={onFinalize}
          disabled={loading}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="finalize-character-btn"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Check className="w-4 h-4 mr-2" />
          )}
          Crear Personaje
        </Button>
      </div>
    </div>
  );
};

export default CharacterSummary;
