/**
 * Combate (Combat) Rules Section
 * Displays combat rules: structure, actions, attacking, death
 */

const CombateSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Combate cargados</p>;

  return (
    <div className="space-y-6">
      {/* ESTRUCTURA DEL COMBATE */}
      {data.estructura && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            ⚔️ ESTRUCTURA DEL COMBATE
          </h3>
          {data.estructura.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.estructura.descripcion}</p>
          )}
          {data.estructura.fases?.map((fase, i) => (
            <div key={i} className="mb-4">
              <p className="font-bold text-[hsl(var(--torch-orange))]">{fase.fase || fase.nombre}</p>
              <p className="text-sm text-muted-foreground mt-1">{fase.descripcion}</p>
              {fase.pasos?.length > 0 && (
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-2">
                  {fase.pasos.map((paso, j) => (
                    <li key={j}>{typeof paso === 'string' ? paso : paso.descripcion || paso.nombre}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ACCIONES EN COMBATE */}
      {data.acciones && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            🎯 ACCIONES EN COMBATE
          </h3>
          {data.acciones.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.acciones.descripcion}</p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {data.acciones.lista?.map((accion, i) => (
              <div key={i} className="bg-black/10 p-3 rounded">
                <p className="font-bold text-[hsl(var(--gold))]">{accion.accion || accion.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">{accion.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ATACAR */}
      {data.atacar && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
            🗡️ ATACAR
          </h3>
          {data.atacar.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.atacar.descripcion}</p>
          )}
          {data.atacar.pasos?.length > 0 && (
            <div className="space-y-2">
              {data.atacar.pasos.map((paso, i) => (
                <div key={i} className="flex gap-3 bg-black/10 p-3 rounded">
                  <span className="w-6 h-6 rounded-full bg-[hsl(var(--torch-orange))] text-black flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{typeof paso === 'string' ? paso : paso.paso || paso.nombre}</p>
                    {typeof paso === 'object' && paso.descripcion && (
                      <p className="text-xs text-muted-foreground mt-1">{paso.descripcion}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Críticos */}
          {(data.atacar.critico_20 || data.atacar.critico_1) && (
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              {data.atacar.critico_20 && (
                <div className="bg-green-500/10 p-3 rounded border border-green-500/30">
                  <p className="font-bold text-green-400">🎯 Crítico (20 natural)</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.atacar.critico_20}</p>
                </div>
              )}
              {data.atacar.critico_1 && (
                <div className="bg-red-500/10 p-3 rounded border border-red-500/30">
                  <p className="font-bold text-red-400">💥 Pifia (1 natural)</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.atacar.critico_1}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MUERTE E INCONSCIENCIA */}
      {data.muerte_e_inconsciencia && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            💀 MUERTE E INCONSCIENCIA
          </h3>
          <div className="space-y-4">
            {data.muerte_e_inconsciencia.a_0_pg && (
              <div className="bg-red-500/10 p-3 rounded">
                <p className="font-bold text-red-400">A 0 Puntos de Golpe</p>
                <p className="text-sm text-muted-foreground mt-1">{data.muerte_e_inconsciencia.a_0_pg}</p>
              </div>
            )}
            {data.muerte_e_inconsciencia.tiradas_salvacion && (
              <div className="bg-[hsl(var(--destructive))/10] p-3 rounded">
                <p className="font-bold text-[hsl(var(--destructive))]">Tiradas de Salvación contra la Muerte</p>
                <p className="text-sm text-muted-foreground mt-1">{data.muerte_e_inconsciencia.tiradas_salvacion}</p>
                {data.muerte_e_inconsciencia.exitos && (
                  <p className="text-xs text-green-400 mt-2">✓ Éxitos necesarios: {data.muerte_e_inconsciencia.exitos}</p>
                )}
                {data.muerte_e_inconsciencia.fracasos && (
                  <p className="text-xs text-red-400">✗ Fracasos: {data.muerte_e_inconsciencia.fracasos}</p>
                )}
              </div>
            )}
            {data.muerte_e_inconsciencia.estabilizar && (
              <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
                <p className="font-bold text-[hsl(var(--magic-blue))]">Estabilizar</p>
                <p className="text-sm text-muted-foreground mt-1">{data.muerte_e_inconsciencia.estabilizar}</p>
              </div>
            )}
            {data.muerte_e_inconsciencia.curar_en_0 && (
              <div className="bg-green-500/10 p-3 rounded">
                <p className="font-bold text-green-400">Curar a 0 PG</p>
                <p className="text-sm text-muted-foreground mt-1">{data.muerte_e_inconsciencia.curar_en_0}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CombateSection;
