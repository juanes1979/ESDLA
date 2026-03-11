/**
 * Attributes Card - The 6 core attributes
 */
import { Star } from 'lucide-react';

const ATTRIBUTES = [
  { key: 'fuerza', name: 'Fuerza', abbr: 'FUE' },
  { key: 'destreza', name: 'Destreza', abbr: 'DES' },
  { key: 'constitucion', name: 'Constitución', abbr: 'CON' },
  { key: 'inteligencia', name: 'Inteligencia', abbr: 'INT' },
  { key: 'sabiduria', name: 'Sabiduría', abbr: 'SAB' },
  { key: 'carisma', name: 'Carisma', abbr: 'CAR' },
];

const getModifier = (score) => Math.floor((score - 10) / 2);
const formatModifier = (mod) => mod >= 0 ? `+${mod}` : `${mod}`;

const AttributesCard = ({ character }) => {
  const attributes = character.atributos || {};

  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
        <Star className="w-5 h-5" />
        Atributos
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {ATTRIBUTES.map(attr => {
          const value = attributes[attr.key] || 10;
          const mod = getModifier(value);
          return (
            <div key={attr.key} className="stat-box p-3 text-center">
              <p className="text-xs text-muted-foreground">{attr.name}</p>
              <p className="font-heading text-2xl text-[hsl(var(--gold))]">{value}</p>
              <p className="text-sm text-muted-foreground">({formatModifier(mod)})</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttributesCard;
