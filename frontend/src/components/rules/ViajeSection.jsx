/**
 * Viaje (Travel) Rules Section
 * Displays travel rules: roles, sequence, fatigue, events
 */
import { Map, Users, Clock, Footprints, AlertTriangle } from 'lucide-react';

const ViajeSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Viaje cargados</p>;

  return (
    <div className="space-y-6">
      {/* PAPELES */}
      {data.papeles && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            PAPELES EN EL VIAJE
          </h3>
          {data.papeles.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.papeles.descripcion}</p>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {data.papeles.roles?.map((rol, i) => (
              <div key={i} className="bg-black/10 p-3 rounded">
                <p className="font-bold text-[hsl(var(--torch-orange))]">{rol.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">{rol.descripcion}</p>
                {rol.habilidad && (
                  <p className="text-xs text-[hsl(var(--magic-blue))] mt-1">Habilidad: {rol.habilidad}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECUENCIA DEL VIAJE */}
      {data.secuencia && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            SECUENCIA DEL VIAJE
          </h3>
          {data.secuencia.pasos?.map((paso, i) => (
            <div key={i} className="flex gap-3 mb-3">
              <span className="w-6 h-6 rounded-full bg-[hsl(var(--magic-blue))] text-black flex items-center justify-center text-sm font-bold flex-shrink-0">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{paso.nombre}</p>
                {paso.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1">{paso.descripcion}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FATIGA */}
      {data.fatiga && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
            <Footprints className="w-5 h-5" />
            FATIGA DEL VIAJE
          </h3>
          {data.fatiga.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.fatiga.descripcion}</p>
          )}
          {data.fatiga.cd_base && (
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              <div className="bg-green-500/10 p-3 rounded text-center">
                <p className="text-xs text-green-400">Camino</p>
                <p className="text-2xl font-bold text-green-400">{data.fatiga.cd_base.camino}</p>
              </div>
              <div className="bg-yellow-500/10 p-3 rounded text-center">
                <p className="text-xs text-yellow-400">Campo Abierto</p>
                <p className="text-2xl font-bold text-yellow-400">{data.fatiga.cd_base.campo_abierto}</p>
              </div>
              <div className="bg-red-500/10 p-3 rounded text-center">
                <p className="text-xs text-red-400">Terreno Difícil</p>
                <p className="text-2xl font-bold text-red-400">{data.fatiga.cd_base.terreno_dificil}</p>
              </div>
            </div>
          )}
          {data.fatiga.consecuencias && (
            <div className="bg-[hsl(var(--torch-orange))/10] p-3 rounded">
              <p className="text-sm text-muted-foreground">{data.fatiga.consecuencias}</p>
            </div>
          )}
        </div>
      )}

      {/* DURACIÓN */}
      {data.duracion && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Map className="w-5 h-5" />
            DURACIÓN DEL VIAJE
          </h3>
          {data.duracion.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.duracion.descripcion}</p>
          )}
          {data.duracion.velocidades && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Montura/A Pie</th>
                    <th className="text-center py-2 px-2">Velocidad</th>
                    <th className="text-center py-2 px-2">Casillas/Día</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duracion.velocidades.map((v, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2">{v.tipo}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{v.velocidad}m</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{v.casillas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ACONTECIMIENTOS */}
      {data.acontecimientos && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ACONTECIMIENTOS
          </h3>
          {data.acontecimientos.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.acontecimientos.descripcion}</p>
          )}
          {data.acontecimientos.tabla && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-center py-2 px-2">d20</th>
                    <th className="text-left py-2 px-2">Acontecimiento</th>
                    <th className="text-center py-2 px-2">CD Fatiga</th>
                    <th className="text-left py-2 px-2">Efecto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.acontecimientos.tabla.map((a, i) => (
                    <tr key={i} className={`border-b border-border/10 ${
                      a.rango?.includes('1') || a.rango?.includes('2') ? 'bg-red-500/5' :
                      a.rango?.includes('20') ? 'bg-green-500/5' : ''
                    }`}>
                      <td className="text-center py-2 px-2 font-mono">{a.rango}</td>
                      <td className="py-2 px-2 font-medium">{a.nombre}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))]">+{a.cd_fatiga}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{a.efecto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TIPOS DE TIERRA */}
      {data.tipos_tierra && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            🗺️ TIPOS DE TIERRA
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            {data.tipos_tierra.fronteriza && (
              <div className="bg-green-500/10 p-3 rounded border border-green-500/20">
                <p className="font-bold text-green-400">Fronteriza</p>
                <p className="text-xs text-muted-foreground mt-1">{data.tipos_tierra.fronteriza}</p>
              </div>
            )}
            {data.tipos_tierra.salvaje && (
              <div className="bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                <p className="font-bold text-yellow-400">Salvaje</p>
                <p className="text-xs text-muted-foreground mt-1">{data.tipos_tierra.salvaje}</p>
              </div>
            )}
            {data.tipos_tierra.oscura && (
              <div className="bg-red-500/10 p-3 rounded border border-red-500/20">
                <p className="font-bold text-red-400">Oscura</p>
                <p className="text-xs text-muted-foreground mt-1">{data.tipos_tierra.oscura}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ViajeSection;
