/**
 * Appearance Card - Physical appearance details
 */
import { Eye } from 'lucide-react';

const AppearanceCard = ({ character }) => {
  return (
    <div className="card-parchment rounded-lg p-4">
      <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
        <Eye className="w-5 h-5" />
        Apariencia Física
      </h3>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="bg-secondary rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">Ojos</p>
          <p className="text-foreground">{character.ojos || '—'}</p>
        </div>
        <div className="bg-secondary rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">Piel</p>
          <p className="text-foreground">{character.piel || '—'}</p>
        </div>
        <div className="bg-secondary rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">Pelo</p>
          <p className="text-foreground">{character.pelo || '—'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
        <div className="bg-secondary rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">Tamaño</p>
          <p className="text-foreground">{character.tamano || character.tamanio || '—'}</p>
        </div>
        <div className="bg-secondary rounded p-2 text-center">
          <p className="text-xs text-muted-foreground">Nivel de Vida</p>
          <p className="text-foreground">{character.nivel_vida || '—'}</p>
        </div>
      </div>
    </div>
  );
};

export default AppearanceCard;
