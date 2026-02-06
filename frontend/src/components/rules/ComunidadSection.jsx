/**
 * Comunidad (Community Phase) Rules Section
 * Displays community phase rules: structure, Yule, enterprises
 */
import { Users, Clock, MapPin, Heart, Briefcase, Music, Map, Sparkles, Shield, MessageCircle, Package, Crown, BookOpen, RefreshCw } from 'lucide-react';

const ComunidadSection = ({ data }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Comunidad cargados</p>;

  // Icon mapping for empresas
  const getEmpresaIcon = (nombre) => {
    const iconMap = {
      'Educar a un heredero': Crown,
      'Escribir una canción': Music,
      'Estudiar mapas': Map,
      'Estudiar objetos mágicos': Sparkles,
      'Fortalecer la comunidad': Users,
      'Recopilar rumores': MessageCircle,
      'Cambiar equipo': Package,
      'Reunión con un mecenas': Crown,
      'Sanar cicatrices': Heart,
      'Volver a contar': RefreshCw
    };
    
    for (const [key, Icon] of Object.entries(iconMap)) {
      if (nombre.toLowerCase().includes(key.toLowerCase())) {
        return Icon;
      }
    }
    return Briefcase;
  };

  return (
    <div className="space-y-6">
      {/* INTRODUCCIÓN */}
      {data.introduccion && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
            {data.introduccion.titulo || 'FASE DE COMUNIDAD'}
          </h3>
          <p className="text-sm text-muted-foreground mb-3">{data.introduccion.descripcion}</p>
          {data.introduccion.rol_maestro && (
            <p className="text-sm text-[hsl(var(--magic-blue))] mb-3 italic">{data.introduccion.rol_maestro}</p>
          )}
          {data.introduccion.narracion && (
            <p className="text-xs text-muted-foreground">{data.introduccion.narracion}</p>
          )}
        </div>
      )}

      {/* LÍMITES NARRATIVOS */}
      {data.limites_narrativos && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
            ⚠️ LÍMITES NARRATIVOS
          </h3>
          {data.limites_narrativos.descripcion && (
            <p className="text-sm text-muted-foreground mb-3">{data.limites_narrativos.descripcion}</p>
          )}
          {data.limites_narrativos.limites && (
            <ul className="space-y-1 mb-4">
              {data.limites_narrativos.limites.map((limite, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-[hsl(var(--torch-orange))]">•</span>
                  {limite}
                </li>
              ))}
            </ul>
          )}
          {data.limites_narrativos.cuando && (
            <div className="bg-black/10 p-3 rounded">
              <p className="text-xs text-[hsl(var(--gold))] font-bold mb-2">La fase de comunidad:</p>
              <ul className="space-y-1">
                {data.limites_narrativos.cuando.map((cuando, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {cuando}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ESTRUCTURA */}
      {data.estructura && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ESTRUCTURA DE LA FASE
          </h3>
          {data.estructura.descripcion && (
            <p className="text-sm text-muted-foreground mb-4">{data.estructura.descripcion}</p>
          )}
          
          {data.estructura.pasos?.map((paso, i) => (
            <div key={i} className="mb-6 last:mb-0">
              <div className="flex gap-3 mb-2">
                <span className="w-8 h-8 rounded-full bg-[hsl(var(--magic-blue))] text-black flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {paso.numero || i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-bold text-[hsl(var(--gold))]">{paso.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-1">{paso.descripcion}</p>
                </div>
              </div>
              
              {/* Duración específica para paso 1 */}
              {paso.duracion && (
                <div className="ml-11 grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-green-500/10 p-2 rounded text-center">
                    <p className="text-xs text-green-400">Mínimo</p>
                    <p className="text-sm font-bold text-green-400">{paso.duracion.minimo}</p>
                  </div>
                  <div className="bg-yellow-500/10 p-2 rounded text-center">
                    <p className="text-xs text-yellow-400">Máximo habitual</p>
                    <p className="text-sm font-bold text-yellow-400">{paso.duracion.maximo_habitual}</p>
                  </div>
                  {paso.duracion.nota && (
                    <div className="bg-[hsl(var(--gold))/10] p-2 rounded text-center col-span-3">
                      <p className="text-xs text-[hsl(var(--gold))]">{paso.duracion.nota}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Reglas específicas para paso 2 */}
              {paso.reglas && (
                <div className="ml-11 mt-2">
                  <ul className="space-y-1">
                    {paso.reglas.map((regla, j) => (
                      <li key={j} className="text-xs text-muted-foreground">• {regla}</li>
                    ))}
                  </ul>
                  {paso.refugios_recomendados && (
                    <div className="mt-2 flex gap-2 items-center">
                      <MapPin className="w-4 h-4 text-[hsl(var(--magic-blue))]" />
                      <span className="text-xs text-[hsl(var(--magic-blue))]">
                        Refugios recomendados: {paso.refugios_recomendados.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Tabla de reducción para paso 3 */}
              {paso.tabla_reduccion && (
                <div className="ml-11 mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 px-2">Impacto de las acciones</th>
                        <th className="text-center py-2 px-2">Reducción de Sombra</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paso.tabla_reduccion.map((row, j) => (
                        <tr key={j} className="border-b border-border/10">
                          <td className="py-2 px-2">{row.impacto}</td>
                          <td className="text-center py-2 px-2 text-green-400 font-bold">{row.reduccion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Selección para paso 4 */}
              {paso.seleccion && (
                <div className="ml-11 mt-2 grid md:grid-cols-2 gap-2">
                  {paso.seleccion.map((sel, j) => (
                    <div key={j} className="bg-black/10 p-2 rounded">
                      <p className="text-xs text-[hsl(var(--torch-orange))] font-bold">{sel.tipo}</p>
                      <p className="text-sm">{sel.empresas}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {paso.resumen && (
                <div className="ml-11 mt-2 bg-[hsl(var(--gold))/10] p-3 rounded">
                  <p className="text-xs text-[hsl(var(--gold))] font-bold mb-2">Resumen:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {paso.resumen.map((res, j) => (
                      <div key={j} className="text-xs">
                        <span className="text-muted-foreground">{res.tipo}:</span>
                        <span className="text-[hsl(var(--gold))] ml-1 font-bold">{res.maximo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* YULE */}
      {data.yule && (
        <div className="card-parchment rounded-lg p-4 bg-gradient-to-br from-blue-900/20 to-purple-900/20">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2 flex items-center gap-2">
            ❄️ {data.yule.titulo || 'YULE (FIN DE AÑO)'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{data.yule.descripcion}</p>
          
          {data.yule.caracteristicas && (
            <div className="grid md:grid-cols-3 gap-2 mb-4">
              {data.yule.caracteristicas.map((carac, i) => (
                <div key={i} className="bg-purple-500/10 p-2 rounded text-center">
                  <p className="text-xs text-purple-300">{carac}</p>
                </div>
              ))}
            </div>
          )}
          
          {data.yule.paso_anos && (
            <div className="bg-black/20 p-4 rounded">
              <h4 className="font-bold text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {data.yule.paso_anos.titulo}
              </h4>
              
              {data.yule.paso_anos.efectos && (
                <ul className="space-y-1 mb-3">
                  {data.yule.paso_anos.efectos.map((efecto, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {efecto}</li>
                  ))}
                </ul>
              )}
              
              {data.yule.paso_anos.regla_px && (
                <div className="bg-[hsl(var(--gold))/10] p-3 rounded mb-3">
                  <p className="text-sm text-muted-foreground">{data.yule.paso_anos.regla_px.descripcion}</p>
                  <p className="text-lg font-mono text-[hsl(var(--gold))] mt-2">{data.yule.paso_anos.regla_px.formula}</p>
                  {data.yule.paso_anos.regla_px.ejemplo && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Ejemplo: {data.yule.paso_anos.regla_px.ejemplo}</p>
                  )}
                </div>
              )}
              
              {data.yule.paso_anos.maestro && (
                <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
                  <p className="text-xs text-[hsl(var(--magic-blue))] font-bold mb-2">El Maestro del saber puede:</p>
                  <ul className="space-y-1">
                    {data.yule.paso_anos.maestro.map((m, i) => (
                      <li key={i} className="text-xs text-muted-foreground">• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EMPRESAS */}
      {data.empresas && data.empresas.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            EMPRESAS DE LA FASE DE COMUNIDAD
          </h3>
          
          {/* Empresas ordinarias */}
          <div className="mb-6">
            <h4 className="font-bold text-[hsl(var(--torch-orange))] mb-3">Empresas Ordinarias</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {data.empresas.filter(e => e.tipo === 'Ordinaria').map((empresa, i) => {
                const Icon = getEmpresaIcon(empresa.nombre);
                return (
                  <div key={i} className="bg-black/10 p-3 rounded border border-border/20 hover:border-[hsl(var(--gold))/30] transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className="w-5 h-5 text-[hsl(var(--gold))] flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-foreground">{empresa.nombre}</p>
                        {empresa.gratuita && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            Gratuita: {empresa.requisito_gratuita}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{empresa.descripcion}</p>
                    {empresa.efecto && (
                      <p className="text-xs text-[hsl(var(--magic-blue))]">✨ {empresa.efecto}</p>
                    )}
                    {empresa.tipos_cancion && (
                      <div className="mt-2 space-y-1">
                        {empresa.tipos_cancion.map((tc, j) => (
                          <div key={j} className="text-xs bg-black/10 p-1 rounded flex justify-between">
                            <span className="text-[hsl(var(--torch-orange))]">{tc.tipo}</span>
                            <span className="text-muted-foreground">{tc.efecto}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Empresas de Yule */}
          <div>
            <h4 className="font-bold text-purple-400 mb-3 flex items-center gap-2">
              ❄️ Empresas de Yule
            </h4>
            <div className="grid md:grid-cols-2 gap-3">
              {data.empresas.filter(e => e.tipo === 'Yule').map((empresa, i) => {
                const Icon = getEmpresaIcon(empresa.nombre);
                return (
                  <div key={i} className="bg-purple-500/10 p-3 rounded border border-purple-500/20">
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                      <p className="font-bold text-foreground">{empresa.nombre}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{empresa.descripcion}</p>
                    {empresa.coste && (
                      <p className="text-xs text-[hsl(var(--gold))]">💰 {empresa.coste}</p>
                    )}
                    {empresa.efecto && (
                      <p className="text-xs text-[hsl(var(--magic-blue))] mt-1">✨ {empresa.efecto}</p>
                    )}
                    {empresa.penalizacion && (
                      <p className="text-xs text-red-400 mt-1">⚠️ {empresa.penalizacion}</p>
                    )}
                    {empresa.permite && (
                      <div className="mt-2">
                        <p className="text-xs text-[hsl(var(--torch-orange))] mb-1">Permite:</p>
                        <ul className="space-y-0.5">
                          {empresa.permite.map((p, j) => (
                            <li key={j} className="text-xs text-muted-foreground">• {p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {empresa.maximo && (
                      <p className="text-xs text-yellow-400 mt-1">📊 Máximo: {empresa.maximo}</p>
                    )}
                    {empresa.bonus && (
                      <p className="text-xs text-green-400 mt-1">🎁 {empresa.bonus}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComunidadSection;
