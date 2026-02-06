/**
 * Viaje (Travel) Rules Section
 * Displays travel rules: roles, sequence, fatigue, events
 */
import { Map, Users, Clock, Footprints, AlertTriangle } from 'lucide-react';

const ViajeSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Viaje cargados</p>;

  return (
    <div className="space-y-6">
      {/* INTRODUCCION */}
      {data.introduccion && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            {data.introduccion.titulo || 'LA COMPAÑÍA EN EL VIAJE'}
          </h3>
          <p className="text-sm text-muted-foreground">{data.introduccion.descripcion}</p>
        </div>
      )}

      {/* PAPELES DE VIAJE */}
      {data.papeles_viaje && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Users className="w-5 h-5" />
            PAPELES EN EL VIAJE
          </h3>
          {data.papeles_viaje.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.papeles_viaje.descripcion}</p>
          )}
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {data.papeles_viaje.papeles?.map((rol, i) => (
              <div key={i} className="bg-black/10 p-3 rounded">
                <p className="font-bold text-[hsl(var(--torch-orange))]">{rol.papel || rol.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">{rol.funcion || rol.descripcion}</p>
              </div>
            ))}
          </div>
          
          {/* Reglas de asignación */}
          {data.papeles_viaje.asignacion?.reglas && (
            <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
              <p className="font-bold text-[hsl(var(--magic-blue))] text-sm mb-2">Reglas de Asignación:</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {data.papeles_viaje.asignacion.reglas.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* SECUENCIA DEL VIAJE */}
      {data.secuencia_viaje && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            SECUENCIA DEL VIAJE
          </h3>
          {data.secuencia_viaje.nota && (
            <p className="text-sm text-[hsl(var(--torch-orange))] mb-4 italic">{data.secuencia_viaje.nota}</p>
          )}
          {data.secuencia_viaje.pasos?.map((paso, i) => (
            <div key={i} className="flex gap-3 mb-4">
              <span className="w-8 h-8 rounded-full bg-[hsl(var(--magic-blue))] text-black flex items-center justify-center text-sm font-bold flex-shrink-0">
                {paso.numero || i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-foreground">{paso.titulo || paso.nombre}</p>
                {paso.descripcion && (
                  <p className="text-xs text-muted-foreground mt-1">{paso.descripcion}</p>
                )}
                {paso.consideraciones?.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {paso.consideraciones.map((c, j) => (
                      <li key={j}>• {c}</li>
                    ))}
                  </ul>
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
          
          {/* CD por terreno */}
          {data.fatiga.cd_terreno && (
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {data.fatiga.cd_terreno.map((t, i) => (
                <div key={i} className={`p-3 rounded text-center ${
                  t.cd <= 10 ? 'bg-green-500/10 border border-green-500/20' :
                  t.cd <= 14 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                  'bg-red-500/10 border border-red-500/20'
                }`}>
                  <p className="text-xs text-muted-foreground">{t.terreno}</p>
                  <p className={`text-2xl font-bold ${
                    t.cd <= 10 ? 'text-green-400' :
                    t.cd <= 14 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>{t.cd}</p>
                </div>
              ))}
            </div>
          )}
          
          {/* Modificadores de fatiga */}
          {data.fatiga.modificadores && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Modificador</th>
                    <th className="text-center py-2 px-2">CD</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fatiga.modificadores.map((m, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2">{m.modificador}</td>
                      <td className={`text-center py-2 px-2 font-bold ${
                        String(m.cd).startsWith('+') ? 'text-red-400' :
                        String(m.cd).startsWith('-') ? 'text-green-400' :
                        'text-[hsl(var(--gold))]'
                      }`}>{m.cd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {data.fatiga.consecuencia && (
            <div className="bg-[hsl(var(--torch-orange))/10] p-3 rounded mt-3">
              <p className="text-sm text-muted-foreground">{data.fatiga.consecuencia}</p>
            </div>
          )}
        </div>
      )}

      {/* DURACION DEL VIAJE */}
      {data.duracion_viaje && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Map className="w-5 h-5" />
            DURACIÓN DEL VIAJE
          </h3>
          {data.duracion_viaje.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.duracion_viaje.descripcion}</p>
          )}
          
          {/* Velocidades */}
          {data.duracion_viaje.velocidades && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Tipo</th>
                    <th className="text-center py-2 px-2">Velocidad</th>
                    <th className="text-center py-2 px-2">Casillas/Día</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duracion_viaje.velocidades.map((v, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2">{v.tipo}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{v.velocidad}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{v.casillas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Reglas */}
          {data.duracion_viaje.reglas && (
            <div className="grid md:grid-cols-2 gap-3">
              {data.duracion_viaje.reglas.map((r, i) => (
                <div key={i} className="bg-black/10 p-2 rounded flex justify-between items-center">
                  <span className="text-sm">{r.condicion}</span>
                  <span className="text-sm font-mono text-[hsl(var(--torch-orange))]">{r.duracion}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACONTECIMIENTOS */}
      {data.acontecimientos && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ACONTECIMIENTOS DE VIAJE
          </h3>
          
          {/* Secuencia */}
          {data.acontecimientos.secuencia && (
            <div className="mb-4">
              <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">Secuencia:</h4>
              <div className="flex flex-wrap gap-2">
                {data.acontecimientos.secuencia.map((s, i) => (
                  <div key={i} className="bg-black/10 px-3 py-1 rounded text-sm">
                    <span className="font-semibold text-[hsl(var(--gold))]">{s.paso}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Tipos de acontecimiento */}
          {data.acontecimientos.tipos && (
            <div className="space-y-2">
              {data.acontecimientos.tipos.map((t, i) => (
                <div key={i} className={`p-3 rounded ${
                  t.rango?.includes('1') ? 'bg-red-500/10 border border-red-500/20' :
                  t.rango?.includes('20') ? 'bg-green-500/10 border border-green-500/20' :
                  'bg-black/10'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t.tipo}</span>
                    <span className="font-mono text-[hsl(var(--gold))]">{t.rango}</span>
                  </div>
                  {t.descripcion && (
                    <p className="text-xs text-muted-foreground mt-1">{t.descripcion}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OTRAS REGLAS */}
      {data.otras_reglas && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2">
            📋 OTRAS REGLAS DE VIAJE
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {Object.entries(data.otras_reglas).map(([key, value]) => (
              <div key={key} className="bg-black/10 p-3 rounded">
                <h4 className="font-semibold text-[hsl(var(--gold))] capitalize">
                  {key.replace(/_/g, ' ')}
                </h4>
                {typeof value === 'string' ? (
                  <p className="text-sm text-muted-foreground">{value}</p>
                ) : (
                  <div>
                    {value.descripcion && <p className="text-sm text-muted-foreground">{value.descripcion}</p>}
                    {value.penalizacion && <p className="text-xs text-red-400 mt-1">{value.penalizacion}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXPERIENCIA POR VIAJE */}
      {data.experiencia_viaje && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            ⭐ EXPERIENCIA POR VIAJE
          </h3>
          {data.experiencia_viaje.descripcion && (
            <p className="text-sm text-muted-foreground mb-2">{data.experiencia_viaje.descripcion}</p>
          )}
          {data.experiencia_viaje.condiciones && (
            <>
              <p className="text-sm text-muted-foreground mb-2">Se otorgan PX solo si:</p>
              <ul className="text-sm mb-4 space-y-1">
                {data.experiencia_viaje.condiciones.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </>
          )}
          {data.experiencia_viaje.calculo && (
            <p className="text-sm text-[hsl(var(--magic-blue))]">{data.experiencia_viaje.calculo}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ViajeSection;
