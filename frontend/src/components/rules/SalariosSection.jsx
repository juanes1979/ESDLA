/**
 * Salarios (Wages) Rules Section
 * Displays wage tables for different worker categories
 */
import { Crown, Users, Swords, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SalariosSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Salarios cargados</p>;

  const renderCategoriaTable = (titulo, trabajadores, icon) => (
    <div className="card-parchment rounded-lg p-4 mb-4">
      <h4 className="font-heading text-md text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
        {icon}
        {titulo}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="text-left py-2 px-2">Ocupación</th>
              <th className="text-center py-2 px-2">Modificador</th>
              <th className="text-center py-2 px-2">Bajo</th>
              <th className="text-center py-2 px-2">Medio</th>
              <th className="text-center py-2 px-2">Alto</th>
              <th className="text-center py-2 px-2">Diario</th>
              <th className="text-left py-2 px-2">Notas</th>
            </tr>
          </thead>
          <tbody>
            {trabajadores?.map((t, i) => (
              <tr key={i} className="border-b border-border/10">
                <td className="py-2 px-2 font-medium">{t.ocupacion}</td>
                <td className="text-center py-2 px-2">
                  {t.modificador !== undefined && t.modificador !== null && t.modificador !== '' && (
                    <span className={t.modificador > 0 ? 'text-green-400' : t.modificador < 0 ? 'text-red-400' : ''}>
                      {t.modificador > 0 ? `+${t.modificador}` : t.modificador}
                    </span>
                  )}
                </td>
                <td className="text-center py-2 px-2 text-muted-foreground">{t.salario_bajo}</td>
                <td className="text-center py-2 px-2 text-[hsl(var(--gold))]">{t.salario_medio}</td>
                <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">{t.salario_alto}</td>
                <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{t.diario}</td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{t.notas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderModificadores = (titulo, mods, colorClass) => (
    <div className="card-parchment rounded-lg p-4 mb-4">
      <h4 className={`font-heading text-md ${colorClass} mb-3 flex items-center gap-2`}>
        {titulo.includes('Aumentan') ? <TrendingUp className="w-4 h-4" /> : 
         titulo.includes('Reducen') ? <TrendingDown className="w-4 h-4" /> : 
         <Minus className="w-4 h-4" />}
        {titulo}
      </h4>
      <ul className="space-y-1">
        {mods?.map((m, i) => (
          <li key={i} className="text-sm text-muted-foreground">
            • {typeof m === 'string' ? m : `${m.factor}: ${m.descripcion || m.efecto}`}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Description */}
      {data.descripcion && (
        <div className="card-parchment rounded-lg p-4">
          <p className="text-sm text-muted-foreground">{data.descripcion}</p>
          {data.nota && (
            <p className="text-xs text-[hsl(var(--gold))] mt-2 italic">{data.nota}</p>
          )}
        </div>
      )}

      {/* Workers Tables */}
      {data.categorias?.trabajadores_no_cualificados && renderCategoriaTable(
        "Trabajadores No Cualificados", 
        data.categorias.trabajadores_no_cualificados,
        <Users className="w-4 h-4" />
      )}
      
      {data.categorias?.trabajadores_cualificados && renderCategoriaTable(
        "Trabajadores Cualificados", 
        data.categorias.trabajadores_cualificados,
        <Crown className="w-4 h-4" />
      )}
      
      {data.categorias?.nobles_y_guerreros && renderCategoriaTable(
        "Nobles y Guerreros", 
        data.categorias.nobles_y_guerreros,
        <Swords className="w-4 h-4" />
      )}
      
      {data.categorias?.razas_especiales && renderCategoriaTable(
        "Razas Especiales", 
        data.categorias.razas_especiales,
        <Sparkles className="w-4 h-4" />
      )}

      {/* Modifiers */}
      {data.modificadores && (
        <div className="grid md:grid-cols-2 gap-4">
          {data.modificadores.aumentan && renderModificadores(
            "Factores que Aumentan el Salario",
            data.modificadores.aumentan,
            "text-green-400"
          )}
          {data.modificadores.reducen && renderModificadores(
            "Factores que Reducen el Salario",
            data.modificadores.reducen,
            "text-red-400"
          )}
          {data.modificadores.otros && renderModificadores(
            "Otros Factores",
            data.modificadores.otros,
            "text-[hsl(var(--magic-blue))]"
          )}
        </div>
      )}
    </div>
  );
};

export default SalariosSection;
