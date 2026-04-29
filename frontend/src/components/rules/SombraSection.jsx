/**
 * Sombra (Shadow) Rules Section
 * Displays shadow mechanics: pavor, avaricia, fechorias, estados, sendas
 */
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const SombraSection = ({ data, isAdmin, onDeleteSenda }) => {
  if (!data) return <p className="text-muted-foreground">No hay datos de Sombra cargados</p>;

  return (
    <div className="space-y-6">
      {/* PAVOR */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
          🌑 PAVOR
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Se puede obtener puntos de sombra al ser testigo de acontecimientos terribles.
          <br /><span className="text-[hsl(var(--magic-blue))]">Tirada de salvación de CARISMA. Si tiene éxito se retira 1 punto.</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2">Fuente</th>
                <th className="text-left py-2 px-2">Ejemplo</th>
                <th className="text-center py-2 px-2">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {data.pavor?.map((p, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-2 px-2">{p.fuente}</td>
                  <td className="py-2 px-2 text-muted-foreground text-xs">{p.ejemplo}</td>
                  <td className="text-center py-2 px-2 text-[hsl(var(--destructive))] font-bold">{p.puntos_sombra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AVARICIA */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2">
          💰 AVARICIA
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Propio deseo de riquezas. Tesoros mágicos o artefactos encontrados.
          <br /><span className="text-[hsl(var(--magic-blue))]">Tirada de salvación de SABIDURÍA. Si tiene éxito se retira 1 punto.</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2">Tesoro Mágico</th>
                <th className="text-left py-2 px-2">Descripción</th>
                <th className="text-center py-2 px-2">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {data.avaricia?.map((a, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-2 px-2 font-medium">{a.tesoro_magico}</td>
                  <td className="py-2 px-2 text-muted-foreground text-xs">{a.descripcion}</td>
                  <td className="text-center py-2 px-2 text-[hsl(var(--gold))] font-bold">{a.puntos_sombra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FECHORÍAS */}
      <div className="card-parchment rounded-lg p-4">
        <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2">
          ⚠️ FECHORÍAS
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          La intención es lo que cuenta. Si la fechoría es sin querer, se puede reducir a la mitad.
          <br /><span className="text-[hsl(var(--destructive))]">NO se puede realizar tirada de salvación.</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-2 px-2">Acción</th>
                <th className="text-center py-2 px-2">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {data.fechorias?.map((f, i) => (
                <tr key={i} className="border-b border-border/10">
                  <td className="py-2 px-2">{f.accion}</td>
                  <td className="text-center py-2 px-2 text-[hsl(var(--torch-orange))] font-bold">{f.puntos_sombra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* HECHICERÍA */}
      {data.hechiceria && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2">
            🔮 HECHICERÍA
          </h3>
          <p className="text-sm text-muted-foreground">
            {data.hechiceria.descripcion}
          </p>
        </div>
      )}

      {/* FORTALECER LA VOLUNTAD */}
      {data.fortalecer_voluntad && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2">
            💪 FORTALECER LA VOLUNTAD
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {data.fortalecer_voluntad.descripcion}
          </p>
          {data.fortalecer_voluntad.requisitos && (
            <div className="bg-[hsl(var(--magic-blue))/10] p-3 rounded">
              <p className="text-xs text-muted-foreground italic">
                <strong>Requisitos:</strong> {data.fortalecer_voluntad.requisitos}
              </p>
            </div>
          )}
        </div>
      )}

      {/* CÓMO SUCUMBIR */}
      {data.como_sucumbir && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            💀 CÓMO SUCUMBIR
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            {data.como_sucumbir.descripcion}
          </p>
          {data.como_sucumbir.consecuencias && (
            <div className="bg-[hsl(var(--destructive))/10] p-3 rounded">
              <p className="text-xs text-muted-foreground italic">
                <strong>Consecuencias:</strong> {data.como_sucumbir.consecuencias}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ESTADOS DE LA SOMBRA */}
      {data.estados?.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-purple-400 mb-4 border-b border-purple-400/30 pb-2">
            😵 ESTADOS DE LA SOMBRA
          </h3>
          <div className="space-y-3">
            {data.estados.map((estado, i) => {
              // BD guarda {nombre, condicion, efectos[]} — soportamos también
              // el formato antiguo {estado, descripcion, efecto}.
              const nombre = estado.nombre || estado.estado || '';
              const condicion = estado.condicion || estado.descripcion || '';
              const efectos = Array.isArray(estado.efectos)
                ? estado.efectos
                : (estado.efecto ? [estado.efecto] : []);
              return (
                <div key={i} className="bg-purple-500/10 p-3 rounded border border-purple-500/20" data-testid={`shadow-state-${i}`}>
                  <p className="font-bold text-purple-400">{nombre}</p>
                  {condicion && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="text-purple-300/80">Condición:</span> {condicion}
                    </p>
                  )}
                  {efectos.length > 0 && (
                    <ul className="text-xs text-purple-300 mt-2 italic list-disc list-inside space-y-0.5">
                      {efectos.map((ef, k) => <li key={k}>{ef}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SENDAS DE LA SOMBRA (Defectos por Ocupación) */}
      {data.sendas_sombra?.length > 0 && (
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--destructive))] mb-4 border-b border-[hsl(var(--destructive))/30] pb-2">
            🛤️ SENDAS DE LA SOMBRA
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Cada ocupación tiene su propia senda de corrupción con defectos específicos.
          </p>
          {(() => {
            // Group by senda name
            const grouped = {};
            data.sendas_sombra.forEach(s => {
              if (!grouped[s.senda]) {
                grouped[s.senda] = {
                  senda: s.senda,
                  ocupacion: s.ocupacion,
                  descripcion: s.descripcion_senda,
                  defectos: []
                };
              }
              grouped[s.senda].defectos.push({
                nombre: s.defecto,
                descripcion: s.descripcion,
                efecto_juego: s.efecto_juego
              });
            });
            
            return Object.values(grouped).map((group, i) => (
              <div key={i} className="bg-[hsl(var(--destructive))/10] p-4 rounded mb-4 border border-[hsl(var(--destructive))/20]">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-[hsl(var(--destructive))] text-lg">{group.senda}</p>
                    <p className="text-xs text-muted-foreground">Ocupación: {group.ocupacion}</p>
                  </div>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDeleteSenda && onDeleteSenda(group.senda)}
                      data-testid={`delete-senda-${group.senda}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {group.descripcion && (
                  <p className="text-sm text-muted-foreground mt-2 italic">{group.descripcion}</p>
                )}
                <div className="mt-3 space-y-2">
                  {group.defectos.map((d, j) => (
                    <div key={j} className="bg-black/20 p-2 rounded">
                      <p className="text-sm font-medium text-[hsl(var(--torch-orange))]">{d.nombre}</p>
                      {d.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{d.descripcion}</p>
                      )}
                      {d.efecto_juego && (
                        <p className="text-xs text-[hsl(var(--magic-blue))] mt-1 italic">Efecto: {d.efecto_juego}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

export default SombraSection;
