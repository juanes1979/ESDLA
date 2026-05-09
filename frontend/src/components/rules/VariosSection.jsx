/**
 * Varios (Miscellaneous) Rules Section
 * Displays skill checks, exhaustion, inspiration, Eye of Mordor
 */
import { BookOpen, AlertCircle, Sparkles, Eye, TrendingUp, TrendingDown } from 'lucide-react';
import IdiomasSection from './IdiomasSection';

const VariosSection = ({ data, currentRole }) => {
  return (
    <div className="space-y-6">
      {/* IDIOMAS — fuente de verdad editable */}
      <IdiomasSection currentRole={currentRole} />

      {!data && (
        <p className="text-muted-foreground">No hay datos de reglas varias</p>
      )}
      {data && (
        <>
      {/* PRUEBAS DE HABILIDAD */}
      {data.pruebas_habilidad && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            PRUEBAS DE HABILIDAD
          </h3>
          
          {/* Habilidades por característica */}
          {data.pruebas_habilidad.habilidades_por_caracteristica && (
            <div className="grid md:grid-cols-3 gap-3 mb-4">
              {Object.entries(data.pruebas_habilidad.habilidades_por_caracteristica).map(([carac, habs]) => (
                <div key={carac} className="bg-black/10 p-3 rounded">
                  <p className="font-bold text-[hsl(var(--torch-orange))] text-sm mb-2">{carac}</p>
                  <div className="flex flex-wrap gap-1">
                    {habs.map((h, i) => (
                      <span key={i} className="text-xs bg-black/20 px-2 py-0.5 rounded">{h}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabla de dificultad */}
          {data.pruebas_habilidad.dificultad && (
            <div className="overflow-x-auto">
              <p className="text-sm text-muted-foreground mb-2">Tabla de Clase de Dificultad (CD):</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2">Dificultad</th>
                    <th className="text-center py-2 px-2">CD</th>
                    <th className="text-left py-2 px-2">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pruebas_habilidad.dificultad.map((row, i) => (
                    <tr key={i} className="border-b border-border/10">
                      <td className="py-2 px-2">{row.nombre || row.dificultad}</td>
                      <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{row.cd}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{row.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VENTAJA Y DESVENTAJA */}
      {data.ventaja && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            🎲 VENTAJA Y DESVENTAJA
          </h3>
          {data.ventaja.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.ventaja.descripcion}</p>
          )}
          {/* Handle both old format (ventaja/desventaja strings) and new format (reglas array) */}
          {data.ventaja.reglas ? (
            <div className="grid md:grid-cols-2 gap-4">
              {data.ventaja.reglas.map((regla, i) => (
                <div key={i} className={`p-4 rounded border ${
                  regla.tipo === 'Ventaja' 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <p className={`font-bold flex items-center gap-2 ${
                    regla.tipo === 'Ventaja' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {regla.tipo === 'Ventaja' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {regla.tipo}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">{regla.efecto}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-500/10 p-4 rounded border border-green-500/30">
                <p className="font-bold text-green-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  VENTAJA
                </p>
                <p className="text-sm text-muted-foreground mt-2">{data.ventaja.ventaja}</p>
                {data.ventaja.ventaja_bonus && (
                  <p className="text-[hsl(var(--gold))] font-bold mt-2">Equivalente: +{data.ventaja.ventaja_bonus}</p>
                )}
              </div>
              <div className="bg-red-500/10 p-4 rounded border border-red-500/30">
                <p className="font-bold text-red-400 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  DESVENTAJA
                </p>
                <p className="text-sm text-muted-foreground mt-2">{data.ventaja.desventaja}</p>
                {data.ventaja.desventaja_penalizacion && (
                  <p className="text-red-400 font-bold mt-2">Equivalente: {data.ventaja.desventaja_penalizacion}</p>
                )}
              </div>
            </div>
          )}
          {data.ventaja.nota && (
            <p className="text-xs text-[hsl(var(--magic-blue))] mt-4 italic">{data.ventaja.nota}</p>
          )}
        </div>
      )}

      {/* CANSANCIO */}
      {data.cansancio && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            CANSANCIO
          </h3>
          {data.cansancio.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.cansancio.descripcion}</p>
          )}
          {data.cansancio.niveles && (
            <div className="space-y-2">
              {data.cansancio.niveles.map((nivel, i) => (
                <div key={i} className={`p-3 rounded ${
                  nivel.nivel <= 2 ? 'bg-yellow-500/10 border border-yellow-500/20' :
                  nivel.nivel <= 4 ? 'bg-orange-500/10 border border-orange-500/20' :
                  'bg-red-500/10 border border-red-500/20'
                }`}>
                  <span className={`font-bold ${
                    nivel.nivel <= 2 ? 'text-yellow-400' :
                    nivel.nivel <= 4 ? 'text-orange-400' :
                    'text-red-400'
                  }`}>
                    Nivel {nivel.nivel}:
                  </span>
                  <span className="text-sm text-muted-foreground ml-2">{nivel.efecto || nivel.consecuencia}</span>
                </div>
              ))}
            </div>
          )}
          {/* Reglas de cansancio */}
          {data.cansancio.reglas && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-bold text-[hsl(var(--torch-orange))]">Reglas:</p>
              {data.cansancio.reglas.map((regla, i) => (
                <div key={i} className="bg-black/10 p-2 rounded">
                  <span className="text-sm font-medium text-[hsl(var(--gold))]">{regla.regla}: </span>
                  <span className="text-sm text-muted-foreground">{regla.efecto}</span>
                </div>
              ))}
            </div>
          )}
          {data.cansancio.recuperacion && (
            <p className="text-xs text-[hsl(var(--magic-blue))] mt-4 italic">
              Recuperación: {data.cansancio.recuperacion}
            </p>
          )}
        </div>
      )}

      {/* INSPIRACIÓN */}
      {data.inspiracion && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            INSPIRACIÓN
          </h3>
          {data.inspiracion.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.inspiracion.descripcion}</p>
          )}
          {data.inspiracion.como_obtener && (
            <div className="bg-[hsl(var(--gold))/10] p-3 rounded mb-3">
              <p className="text-sm font-bold text-[hsl(var(--gold))]">Cómo obtener:</p>
              {Array.isArray(data.inspiracion.como_obtener) ? (
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  {data.inspiracion.como_obtener.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{data.inspiracion.como_obtener}</p>
              )}
            </div>
          )}
          {data.inspiracion.nota_acumulacion && (
            <p className="text-xs text-[hsl(var(--torch-orange))] mb-3 italic">{data.inspiracion.nota_acumulacion}</p>
          )}
          {data.inspiracion.como_usar && (
            <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
              <p className="text-sm font-bold text-[hsl(var(--magic-blue))]">Cómo usar:</p>
              {Array.isArray(data.inspiracion.como_usar) ? (
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  {data.inspiracion.como_usar.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{data.inspiracion.como_usar}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* OJO DE MORDOR */}
      {data.ojo_de_mordor && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2 flex items-center gap-2">
            <Eye className="w-5 h-5" />
            OJO DE MORDOR
          </h3>
          {data.ojo_de_mordor.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.ojo_de_mordor.descripcion}</p>
          )}
          
          {/* Puntuación Inicial - handle array or string */}
          {data.ojo_de_mordor.puntuacion_inicial && (
            <div className="bg-[hsl(var(--destructive))/10] p-3 rounded mb-4">
              <p className="text-sm text-[hsl(var(--destructive))] font-bold mb-2">Puntuación Inicial</p>
              {Array.isArray(data.ojo_de_mordor.puntuacion_inicial) ? (
                <div className="space-y-1">
                  {data.ojo_de_mordor.puntuacion_inicial.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.condicion}</span>
                      <span className="text-[hsl(var(--gold))] font-bold">+{item.puntos}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{data.ojo_de_mordor.puntuacion_inicial}</p>
              )}
            </div>
          )}
          
          {/* Durante el Juego - handle array or string */}
          {data.ojo_de_mordor.durante_juego && (
            <div className="bg-purple-500/10 p-3 rounded mb-4">
              <p className="text-sm text-purple-400 font-bold mb-2">Durante el Juego</p>
              {Array.isArray(data.ojo_de_mordor.durante_juego) ? (
                <div className="space-y-1">
                  {data.ojo_de_mordor.durante_juego.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.evento}</span>
                      <span className="text-purple-400 font-bold">+{item.puntos}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{data.ojo_de_mordor.durante_juego}</p>
              )}
            </div>
          )}
          
          {/* Episodios de Revelación */}
          {data.ojo_de_mordor.episodios_revelacion && (
            <div className="bg-[hsl(var(--torch-orange))/10] p-3 rounded mb-4">
              <p className="text-sm text-[hsl(var(--torch-orange))] font-bold mb-2">Episodios de Revelación</p>
              <p className="text-sm text-muted-foreground">{data.ojo_de_mordor.episodios_revelacion}</p>
            </div>
          )}
          
          {/* Volver al nivel inicial */}
          {data.ojo_de_mordor.volver_nivel_inicial && (
            <p className="text-xs text-[hsl(var(--magic-blue))] mb-4 italic">{data.ojo_de_mordor.volver_nivel_inicial}</p>
          )}
          
          {/* La Caza - handle object or string */}
          {data.ojo_de_mordor.la_caza && (
            <div className="bg-red-500/10 p-3 rounded">
              <p className="text-sm text-red-400 font-bold mb-2">La Caza</p>
              {typeof data.ojo_de_mordor.la_caza === 'object' ? (
                <div className="space-y-3">
                  {data.ojo_de_mordor.la_caza.descripcion && (
                    <p className="text-sm text-muted-foreground">{data.ojo_de_mordor.la_caza.descripcion}</p>
                  )}
                  {data.ojo_de_mordor.la_caza.regiones && (
                    <div>
                      <p className="text-xs text-red-400 font-bold mb-1">Umbrales por Región:</p>
                      <div className="grid grid-cols-3 gap-2">
                        {data.ojo_de_mordor.la_caza.regiones.map((r, i) => (
                          <div key={i} className="bg-black/20 p-2 rounded text-center">
                            <p className="text-xs text-muted-foreground">{r.region}</p>
                            <p className="text-lg font-bold text-red-400">{r.umbral}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.ojo_de_mordor.la_caza.modificadores && (
                    <div>
                      <p className="text-xs text-red-400 font-bold mb-1">Modificadores:</p>
                      <div className="space-y-1">
                        {data.ojo_de_mordor.la_caza.modificadores.map((m, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{m.descripcion}</span>
                            <span className={m.modificador.startsWith('+') ? 'text-green-400' : 'text-red-400'}>
                              {m.modificador}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{data.ojo_de_mordor.la_caza}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* MÁS ALLÁ DEL NIVEL 10 */}
      {data.mas_alla_nivel_10 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2">
            🌟 MÁS ALLÁ DEL NIVEL 10
          </h3>
          <p className="text-sm text-muted-foreground">{data.mas_alla_nivel_10.descripcion}</p>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default VariosSection;
