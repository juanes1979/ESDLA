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
                    <th className="text-center py-2 px-2">Velocidad (m)</th>
                    <th className="text-center py-2 px-2">km/Día</th>
                  </tr>
                </thead>
                <tbody>
                  {data.duracion_viaje.velocidades.map((v, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2">{v.tipo}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--magic-blue))]">{v.velocidad}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{v.km_dia || v.casillas}</td>
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
            <p className="text-sm text-muted-foreground mb-4">{data.experiencia_viaje.descripcion}</p>
          )}
          
          {/* Fórmula */}
          <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded mb-4">
            <p className="text-sm font-bold text-[hsl(var(--magic-blue))] mb-2">Fórmula de cálculo:</p>
            <p className="text-sm font-mono text-center py-2 bg-black/20 rounded">
              PX final = PX base × diferencia × terreno × peligrosidad
            </p>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Límite: máximo ±12 PX por tirada. Redondeo al entero más cercano.
            </p>
          </div>
          
          {/* 1. PX Base según CD */}
          <div className="mb-4">
            <h4 className="font-semibold text-[hsl(var(--torch-orange))] mb-2">1️⃣ PX Base según Clase de Dificultad (CD)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 bg-black/20">
                    <th className="text-center py-2 px-2">CD</th>
                    <th className="text-left py-2 px-2">Dificultad</th>
                    <th className="text-center py-2 px-2">PX Éxito</th>
                    <th className="text-center py-2 px-2">PX Fallo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">10</td>
                    <td className="py-1 px-2">Muy fácil</td>
                    <td className="text-center py-1 px-2 text-green-400">+1</td>
                    <td className="text-center py-1 px-2 text-muted-foreground">0</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">12</td>
                    <td className="py-1 px-2">Fácil</td>
                    <td className="text-center py-1 px-2 text-green-400">+2</td>
                    <td className="text-center py-1 px-2 text-red-400">−1</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">14</td>
                    <td className="py-1 px-2">Moderada</td>
                    <td className="text-center py-1 px-2 text-green-400">+3</td>
                    <td className="text-center py-1 px-2 text-red-400">−1</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">16</td>
                    <td className="py-1 px-2">Difícil</td>
                    <td className="text-center py-1 px-2 text-green-400">+4</td>
                    <td className="text-center py-1 px-2 text-red-400">−2</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">18</td>
                    <td className="py-1 px-2">Muy difícil</td>
                    <td className="text-center py-1 px-2 text-green-400">+5</td>
                    <td className="text-center py-1 px-2 text-red-400">−2</td>
                  </tr>
                  <tr className="border-b border-border/10">
                    <td className="text-center py-1 px-2 font-mono">20+</td>
                    <td className="py-1 px-2">Extrema</td>
                    <td className="text-center py-1 px-2 text-green-400">+6</td>
                    <td className="text-center py-1 px-2 text-red-400">−3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* 2. Modificador por diferencia */}
          <div className="mb-4">
            <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">2️⃣ Modificador según diferencia con la tirada</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-green-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">+10 o más</p>
                <p className="font-bold text-green-400">×2</p>
              </div>
              <div className="bg-green-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">+5 a +9</p>
                <p className="font-bold text-green-400">×1.5</p>
              </div>
              <div className="bg-green-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">+1 a +4</p>
                <p className="font-bold text-green-400">×1.2</p>
              </div>
              <div className="bg-yellow-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">0</p>
                <p className="font-bold text-yellow-400">×1</p>
              </div>
              <div className="bg-yellow-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">−1 a −3</p>
                <p className="font-bold text-yellow-400">×1</p>
              </div>
              <div className="bg-red-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">−4 a −6</p>
                <p className="font-bold text-red-400">×1.2</p>
              </div>
              <div className="bg-red-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">−7 o más</p>
                <p className="font-bold text-red-400">×1.5</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">En fallos, el multiplicador aumenta la penalización.</p>
          </div>
          
          {/* 3. Multiplicador por Terreno */}
          <div className="mb-4">
            <h4 className="font-semibold text-yellow-400 mb-2">3️⃣ Multiplicador por Tipo de Terreno</h4>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-green-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">Fácil</p>
                <p className="font-bold text-green-400">×0.8</p>
              </div>
              <div className="bg-yellow-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">Moderado</p>
                <p className="font-bold text-yellow-400">×1</p>
              </div>
              <div className="bg-orange-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">Difícil</p>
                <p className="font-bold text-orange-400">×1.2</p>
              </div>
              <div className="bg-red-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">Muy Difícil</p>
                <p className="font-bold text-red-400">×1.5</p>
              </div>
              <div className="bg-red-900/20 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">Desalentador</p>
                <p className="font-bold text-red-500">×1.8</p>
              </div>
            </div>
          </div>
          
          {/* 4. Multiplicador por Tierras */}
          <div className="mb-4">
            <h4 className="font-semibold text-purple-400 mb-2">4️⃣ Multiplicador por Tipo de Tierras</h4>
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-green-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">T. Libres</p>
                <p className="font-bold text-green-400">×0.8</p>
              </div>
              <div className="bg-yellow-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">T. Fronterizas</p>
                <p className="font-bold text-yellow-400">×1</p>
              </div>
              <div className="bg-orange-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">T. Salvajes</p>
                <p className="font-bold text-orange-400">×1.2</p>
              </div>
              <div className="bg-red-500/10 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">T. Sombra</p>
                <p className="font-bold text-red-400">×1.5</p>
              </div>
              <div className="bg-red-900/20 p-2 rounded text-center">
                <p className="text-xs text-muted-foreground">T. Oscuras</p>
                <p className="font-bold text-red-500">×1.8</p>
              </div>
            </div>
          </div>
          
          {/* Ejemplo */}
          <div className="bg-black/20 p-4 rounded">
            <h4 className="font-semibold text-[hsl(var(--gold))] mb-3">📝 Ejemplo: Tirada de orientación del Guía</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="mb-1"><span className="text-muted-foreground">CD:</span> <span className="font-mono">16</span></p>
                <p className="mb-1"><span className="text-muted-foreground">Resultado:</span> <span className="font-mono">22</span></p>
                <p className="mb-1"><span className="text-muted-foreground">Diferencia:</span> <span className="font-mono text-green-400">+6</span></p>
              </div>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">1. PX base (CD 16):</span> <span className="text-green-400">4 PX</span></p>
                <p><span className="text-muted-foreground">2. Diferencia (+6):</span> 4 × 1.5 = <span className="text-[hsl(var(--magic-blue))]">6</span></p>
                <p><span className="text-muted-foreground">3. Terreno Difícil:</span> 6 × 1.2 = <span className="text-yellow-400">7.2</span></p>
                <p><span className="text-muted-foreground">4. T. Salvajes:</span> 7.2 × 1.2 = <span className="text-orange-400">8.6</span></p>
                <p className="pt-2 border-t border-border/30 font-bold">
                  <span className="text-muted-foreground">Resultado final:</span> <span className="text-[hsl(var(--gold))] text-lg">9 PX</span>
                </p>
              </div>
            </div>
          </div>
          
          {data.experiencia_viaje.condiciones && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Se otorgan PX solo si:</p>
              <ul className="text-sm mb-4 space-y-1">
                {data.experiencia_viaje.condiciones.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ViajeSection;
