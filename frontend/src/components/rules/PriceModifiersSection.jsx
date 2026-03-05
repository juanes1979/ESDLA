/**
 * Price Modifiers Section Component
 * Displays price modification rules by region, settlement, relationship, and context
 */
import { Coins, MapPin, Users, User, BookOpen } from 'lucide-react';

const PriceModifiersSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay modificadores de precio cargados</p>;
  
  // Helper to format modifier as percentage
  const formatModifier = (mod) => {
    const percent = Math.round(mod * 100);
    if (percent === 100) return '100%';
    const diff = percent - 100;
    return `${percent}% (${diff >= 0 ? '+' : ''}${diff}%)`;
  };
  
  // Helper to get color based on modifier value
  const getModifierColor = (mod) => {
    if (mod < 1) return 'text-green-400';
    if (mod > 1) return 'text-red-400';
    return 'text-muted-foreground';
  };
  
  // Render a modifier table
  const renderModifierTable = (items, title, icon, colorClass, description) => {
    if (!items?.length) return null;
    
    return (
      <div className="card-parchment rounded-lg p-4" data-testid={`price-mod-${title.toLowerCase().replace(/\s/g, '-')}`}>
        <h4 className={`font-heading text-lg ${colorClass} mb-3 flex items-center gap-2`}>
          {icon}
          {title}
        </h4>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2">{title.split(' ').pop()}</th>
                <th className="text-center py-2 px-2">Modificador</th>
                <th className="text-left py-2 px-2">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m, i) => (
                <tr key={i} className="border-b border-border/10 hover:bg-black/10">
                  <td className="py-2 px-2 font-medium">{m.nombre}</td>
                  <td className={`text-center py-2 px-2 font-mono font-bold ${getModifierColor(m.modificador)}`}>
                    {formatModifier(m.modificador)}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground text-xs">{m.descripcion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-6" data-testid="price-modifiers-section">
      {/* Header */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-xl text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Modificadores de Precio
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Estos modificadores afectan al precio base de los artículos al comprar equipamiento. 
          Los modificadores se multiplican entre sí para calcular el precio final.
          <br />
          <span className="text-[hsl(var(--magic-blue))]">
            Ejemplo: Un artículo de 100mp en Bosque Negro (115%) + Aldea pequeña (115%) = 100 × 1.15 × 1.15 = 132.25mp
          </span>
        </p>
      </div>
      
      {/* Region Modifiers */}
      {renderModifierTable(
        data.region,
        'Por Región',
        <MapPin className="w-4 h-4" />,
        'text-[hsl(var(--gold))]',
        'El coste de vida y disponibilidad varían según la región de la Tierra Media.'
      )}
      
      {/* Settlement Modifiers */}
      {renderModifierTable(
        data.asentamiento,
        'Por Tipo de Asentamiento',
        <Users className="w-4 h-4" />,
        'text-[hsl(var(--torch-orange))]',
        'El tamaño del asentamiento afecta la disponibilidad y precios de los productos.'
      )}
      
      {/* Relationship Modifiers */}
      {renderModifierTable(
        data.relacion,
        'Por Relación con el Vendedor',
        <User className="w-4 h-4" />,
        'text-[hsl(var(--magic-blue))]',
        'La relación personal del personaje con el vendedor puede mejorar o empeorar los precios.'
      )}
      
      {/* Context Modifiers */}
      {renderModifierTable(
        data.contexto,
        'Por Contexto Histórico',
        <BookOpen className="w-4 h-4" />,
        'text-destructive',
        'Eventos y circunstancias históricas que afectan el comercio en la Tierra Media.'
      )}
      
      {/* Calculation Example */}
      <div className="card-parchment rounded-lg p-4 bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/20">
        <h4 className="font-heading text-lg text-[hsl(var(--gold))] mb-3">Cómo calcular el precio final</h4>
        <div className="text-sm space-y-2">
          <p className="text-muted-foreground">
            <strong>Fórmula:</strong>{' '}
            <span className="font-mono text-[hsl(var(--magic-blue))]">
              Precio Final = Precio Base × Mod. Región × Mod. Asentamiento × Mod. Relación × Mod. Contexto
            </span>
          </p>
          <div className="bg-black/20 rounded p-3 mt-3">
            <p className="text-xs text-muted-foreground mb-2"><strong>Ejemplo práctico:</strong></p>
            <p className="text-sm">
              Una espada de 50mp comprada en <span className="text-[hsl(var(--gold))]">Bosque Negro</span> (+15%), 
              en una <span className="text-[hsl(var(--torch-orange))]">aldea pequeña</span> (+15%), 
              de un <span className="text-[hsl(var(--magic-blue))]">comerciante amistoso</span> (-10%):
            </p>
            <p className="font-mono text-lg mt-2 text-[hsl(var(--gold))]">
              50 × 1.15 × 1.15 × 0.9 = <strong>59.51 mp</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceModifiersSection;
