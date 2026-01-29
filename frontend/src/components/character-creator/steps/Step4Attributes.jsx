/**
 * Step 4: Attributes Assignment
 */
import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, Dices, Minus, Plus } from 'lucide-react';
import { updateDraftStep4 } from '@/services/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ATTRIBUTES = [
  { key: 'fuerza', name: 'Fuerza', abbr: 'FUE', description: 'Potencia física, fuerza bruta' },
  { key: 'destreza', name: 'Destreza', abbr: 'DES', description: 'Agilidad, reflejos, equilibrio' },
  { key: 'constitucion', name: 'Constitución', abbr: 'CON', description: 'Resistencia, salud, vigor' },
  { key: 'inteligencia', name: 'Inteligencia', abbr: 'INT', description: 'Razonamiento, memoria, análisis' },
  { key: 'sabiduria', name: 'Sabiduría', abbr: 'SAB', description: 'Percepción, intuición, perspicacia' },
  { key: 'carisma', name: 'Carisma', abbr: 'CAR', description: 'Fuerza de personalidad, liderazgo' },
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_TOTAL = 27;
const POINT_BUY_COSTS = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};

const getModifier = (score) => Math.floor((score - 10) / 2);
const formatModifier = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

const Step4Attributes = ({ draftId, draft, onComplete, onBack }) => {
  const [method, setMethod] = useState('standard_array');
  const [attributes, setAttributes] = useState({
    fuerza: 10,
    destreza: 10,
    constitucion: 10,
    inteligencia: 10,
    sabiduria: 10,
    carisma: 10,
  });
  const [availableScores, setAvailableScores] = useState([...STANDARD_ARRAY]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Culture modifiers
  const cultureMods = draft?.mod_cultura || {};

  // Calculate point buy remaining
  const pointBuySpent = Object.values(attributes).reduce(
    (sum, val) => sum + (POINT_BUY_COSTS[val] || 0), 0
  );
  const pointBuyRemaining = POINT_BUY_TOTAL - pointBuySpent;

  // Reset attributes when method changes
  useEffect(() => {
    if (method === 'standard_array') {
      setAttributes({
        fuerza: 10,
        destreza: 10,
        constitucion: 10,
        inteligencia: 10,
        sabiduria: 10,
        carisma: 10,
      });
      setAvailableScores([...STANDARD_ARRAY]);
    } else if (method === 'point_buy') {
      setAttributes({
        fuerza: 8,
        destreza: 8,
        constitucion: 8,
        inteligencia: 8,
        sabiduria: 8,
        carisma: 8,
      });
    } else if (method === 'random') {
      // Roll 4d6 drop lowest for each attribute
      const rollAttribute = () => {
        const rolls = Array(4).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
        rolls.sort((a, b) => b - a);
        return rolls.slice(0, 3).reduce((a, b) => a + b, 0);
      };
      setAttributes({
        fuerza: rollAttribute(),
        destreza: rollAttribute(),
        constitucion: rollAttribute(),
        inteligencia: rollAttribute(),
        sabiduria: rollAttribute(),
        carisma: rollAttribute(),
      });
    }
    setSelectedSlot(null);
  }, [method]);

  // Handle standard array assignment
  const handleAssignScore = (attrKey, score) => {
    // If this attribute already has a non-default value, return it to available
    const currentVal = attributes[attrKey];
    if (STANDARD_ARRAY.includes(currentVal)) {
      setAvailableScores(prev => [...prev, currentVal].sort((a, b) => b - a));
    }

    // Assign new score
    setAttributes(prev => ({ ...prev, [attrKey]: score }));
    setAvailableScores(prev => prev.filter((s, i) => i !== prev.indexOf(score)));
    setSelectedSlot(null);
  };

  // Handle point buy adjustment
  const handlePointBuyAdjust = (attrKey, delta) => {
    const currentVal = attributes[attrKey];
    const newVal = currentVal + delta;
    
    if (newVal < 8 || newVal > 15) return;
    
    const costDiff = (POINT_BUY_COSTS[newVal] || 0) - (POINT_BUY_COSTS[currentVal] || 0);
    if (costDiff > pointBuyRemaining) return;
    
    setAttributes(prev => ({ ...prev, [attrKey]: newVal }));
  };

  // Handle submit
  const handleSubmit = async () => {
    try {
      setSaving(true);
      const updatedDraft = await updateDraftStep4(draftId, {
        atributos: attributes,
        metodo_asignacion: method,
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 4:', err);
      setError('No se pudieron guardar los atributos');
    } finally {
      setSaving(false);
    }
  };

  // Check if all attributes are assigned (for standard array)
  const isComplete = method !== 'standard_array' || availableScores.length === 0;

  return (
    <div className="space-y-8" data-testid="step-4-attributes">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Asigna tus Atributos
        </h2>
        <p className="text-muted-foreground">
          Define las capacidades físicas y mentales de tu personaje
        </p>
      </div>

      {/* Character Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
              <p className="text-sm text-muted-foreground">
                {draft?.cultura_nombre} · {draft?.vocacion_nombre || draft?.ocupacion_tipo}
              </p>
            </div>
          </div>
          
          {/* Culture bonuses reminder */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Bonificadores de Cultura:</p>
            <div className="flex gap-1 justify-end flex-wrap">
              {Object.entries(cultureMods).map(([attr, mod]) => mod > 0 && (
                <span key={attr} className="text-xs bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] px-2 py-0.5 rounded">
                  {attr.substring(0, 3).toUpperCase()} +{mod}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Method Selection */}
      <div className="flex justify-center gap-4">
        {[
          { id: 'standard_array', name: 'Matriz Estándar', desc: '15, 14, 13, 12, 10, 8' },
          { id: 'point_buy', name: 'Compra de Puntos', desc: `${POINT_BUY_TOTAL} puntos` },
          { id: 'random', name: 'Tirar Dados', desc: '4d6 descarta menor' },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={cn(
              'selection-card rounded-lg px-6 py-4 text-center',
              method === m.id && 'selected'
            )}
            data-testid={`method-${m.id}`}
          >
            <p className="font-heading text-foreground">{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.desc}</p>
          </button>
        ))}
      </div>

      {/* Standard Array - Available Scores */}
      {method === 'standard_array' && availableScores.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-3 text-center">
            Haz clic en un atributo y luego en un valor para asignarlo:
          </p>
          <div className="flex justify-center gap-3">
            {availableScores.map((score, i) => (
              <button
                key={i}
                onClick={() => selectedSlot && handleAssignScore(selectedSlot, score)}
                disabled={!selectedSlot}
                className={cn(
                  'w-14 h-14 rounded-lg border-2 flex items-center justify-center transition-all',
                  'font-heading text-xl',
                  selectedSlot
                    ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))/10] text-[hsl(var(--gold))] cursor-pointer hover:bg-[hsl(var(--gold))/20]'
                    : 'border-border bg-secondary text-muted-foreground cursor-not-allowed'
                )}
                data-testid={`available-score-${score}`}
              >
                {score}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Point Buy Remaining */}
      {method === 'point_buy' && (
        <div className="card-parchment rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Puntos restantes:</p>
          <p className={cn(
            'font-heading text-3xl',
            pointBuyRemaining < 0 ? 'text-[hsl(var(--destructive))]' : 
            pointBuyRemaining === 0 ? 'text-[hsl(var(--magic-blue))]' : 'text-[hsl(var(--gold))]'
          )}>
            {pointBuyRemaining}
          </p>
        </div>
      )}

      {/* Attributes Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {ATTRIBUTES.map((attr) => {
          const baseValue = attributes[attr.key];
          const cultureMod = cultureMods[attr.key] || 0;
          const totalValue = baseValue + cultureMod;
          const modifier = getModifier(totalValue);
          const isSelected = selectedSlot === attr.key;

          return (
            <div
              key={attr.key}
              onClick={() => method === 'standard_array' && setSelectedSlot(attr.key)}
              className={cn(
                'stat-box p-4 transition-all',
                method === 'standard_array' && 'cursor-pointer hover:border-[hsl(var(--gold))/50]',
                isSelected && 'border-[hsl(var(--gold))] ring-2 ring-[hsl(var(--gold))/30]'
              )}
              data-testid={`attribute-${attr.key}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-heading text-[hsl(var(--gold))]">{attr.name}</h4>
                  <p className="text-xs text-muted-foreground">{attr.description}</p>
                </div>
                <span className="text-xs font-heading text-muted-foreground">{attr.abbr}</span>
              </div>

              <div className="flex items-center justify-between mt-4">
                {method === 'point_buy' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePointBuyAdjust(attr.key, -1); }}
                    disabled={baseValue <= 8}
                    className="w-8 h-8 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center"
                    data-testid={`${attr.key}-minus`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}

                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-2">
                    <span className="stat-value">{baseValue}</span>
                    {cultureMod > 0 && (
                      <span className="text-sm text-[hsl(var(--magic-blue))]">+{cultureMod}</span>
                    )}
                  </div>
                  <p className="stat-modifier">
                    Total: {totalValue} ({formatModifier(modifier)})
                  </p>
                </div>

                {method === 'point_buy' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePointBuyAdjust(attr.key, 1); }}
                    disabled={baseValue >= 15 || POINT_BUY_COSTS[baseValue + 1] - POINT_BUY_COSTS[baseValue] > pointBuyRemaining}
                    className="w-8 h-8 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center"
                    data-testid={`${attr.key}-plus`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {method === 'point_buy' && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Coste: {POINT_BUY_COSTS[baseValue]} pts
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Reroll button for random */}
      {method === 'random' && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setMethod('random')} // Re-triggers the effect
            className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
            data-testid="reroll-btn"
          >
            <Dices className="w-4 h-4 mr-2 text-[hsl(var(--gold))]" />
            Volver a Tirar
          </Button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-4-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isComplete || saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-4-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step4Attributes;
