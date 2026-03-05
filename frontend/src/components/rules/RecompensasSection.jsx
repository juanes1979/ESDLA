/**
 * Rewards Section Component  
 * Displays reward rules, equipment upgrades, blessings and named weapons
 */
import { Crown, Swords, Sparkles, Shield } from 'lucide-react';

const RecompensasSection = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Crown className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No hay recompensas cargadas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="recompensas-section">
      {/* General Info */}
      {data.info_general && <GeneralInfoSection info={data.info_general} />}

      {/* Reward Levels */}
      {data.niveles_recompensa && <RewardLevelsSection niveles={data.niveles_recompensa} />}

      {/* Equipment Upgrades */}
      {data.mejoras && <EquipmentUpgradesSection mejoras={data.mejoras} />}

      {/* Blessings */}
      {data.bendiciones && <BlessingsSection bendiciones={data.bendiciones} />}

      {/* Named Weapons */}
      {data.armas_con_nombre && <NamedWeaponsSection armas={data.armas_con_nombre} />}
    </div>
  );
};

// General Info Section
const GeneralInfoSection = ({ info }) => (
  <div className="card-parchment rounded-lg p-4">
    <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-4 border-b border-[hsl(var(--magic-blue))/30] pb-2 flex items-center gap-2">
      <Crown className="w-5 h-5" />
      Reglas de Recompensas
    </h3>
    <p className="text-sm mb-4">{info.descripcion}</p>
    
    <div className="grid md:grid-cols-2 gap-4 text-sm">
      <div className="bg-black/10 p-3 rounded">
        <p className="text-[hsl(var(--gold))] font-bold mb-1">Cuándo elegir:</p>
        <p className="text-muted-foreground">{info.cuando_elegir}</p>
      </div>
      <div className="bg-black/10 p-3 rounded">
        <p className="text-[hsl(var(--torch-orange))] font-bold mb-1">Aplicación:</p>
        <p className="text-muted-foreground">{info.aplicacion}</p>
      </div>
      <div className="bg-black/10 p-3 rounded">
        <p className="text-[hsl(var(--magic-blue))] font-bold mb-1">Interpretación:</p>
        <p className="text-muted-foreground">{info.interpretacion}</p>
      </div>
      <div className="bg-black/10 p-3 rounded">
        <p className="text-[hsl(var(--destructive))] font-bold mb-1">Inmunidad Argumental:</p>
        <p className="text-muted-foreground">{info.inmunidad_argumental}</p>
      </div>
    </div>
    
    {info.prestamo && (
      <div className="mt-4 p-3 bg-[hsl(var(--torch-orange))/10] rounded border border-[hsl(var(--torch-orange))/30]">
        <p className="text-sm">
          <span className="font-bold text-[hsl(var(--torch-orange))]">Préstamo:</span> {info.prestamo}
        </p>
      </div>
    )}
  </div>
);

// Reward Levels Section
const RewardLevelsSection = ({ niveles }) => (
  <div className="card-parchment rounded-lg p-4">
    <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
      <Shield className="w-5 h-5" />
      Niveles de Recompensa
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {niveles.map((n, i) => (
        <div key={i} className="bg-black/10 p-3 rounded text-center">
          <p className="text-2xl font-bold text-[hsl(var(--gold))]">Nivel {n.nivel}</p>
          <p className="text-sm text-muted-foreground">
            {n.recompensas} recompensa{n.recompensas > 1 ? 's' : ''}
          </p>
          {n.descripcion && (
            <p className="text-xs text-[hsl(var(--torch-orange))] mt-1">{n.descripcion}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Equipment Upgrades Section
const EquipmentUpgradesSection = ({ mejoras }) => (
  <div className="card-parchment rounded-lg p-4">
    <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
      <Swords className="w-5 h-5" />
      Mejoras de Equipo
    </h3>
    <div className="space-y-4">
      {mejoras.map((m, i) => (
        <div key={i} className="bg-black/10 p-4 rounded border-l-4 border-[hsl(var(--torch-orange))]">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 bg-[hsl(var(--magic-blue))/20] text-[hsl(var(--magic-blue))] text-xs font-bold rounded">
              {m.tipo}
            </span>
            <h4 className="font-heading text-lg text-[hsl(var(--torch-orange))]">{m.nombre}</h4>
          </div>
          
          {m.descripcion && (
            <p className="text-sm text-muted-foreground italic mb-2">{m.descripcion}</p>
          )}
          
          <div className="bg-[hsl(var(--gold))/10] p-2 rounded mb-2">
            <p className="text-sm">
              <span className="font-bold text-[hsl(var(--gold))]">Efecto:</span> {m.efecto_mecanico || m.efecto}
            </p>
          </div>
          
          {m.restricciones && (
            <p className="text-xs text-destructive">
              <span className="font-bold">Restricciones:</span> {m.restricciones}
            </p>
          )}
          
          {m.efecto_adicional_anillo_unico && (
            <div className="mt-2 p-2 bg-[hsl(var(--magic-blue))/10] rounded text-xs">
              <span className="font-bold text-[hsl(var(--magic-blue))]">El Anillo Único:</span> {m.efecto_adicional_anillo_unico}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Blessings Section
const BlessingsSection = ({ bendiciones }) => (
  <div className="card-parchment rounded-lg p-4">
    <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4 border-b border-[hsl(var(--gold))/30] pb-2 flex items-center gap-2">
      <Sparkles className="w-5 h-5" />
      Bendiciones
    </h3>
    <p className="text-sm mb-4">{bendiciones.descripcion}</p>
    
    {/* Proficiency Bonus Dice */}
    {bendiciones.bonificador_competencia && (
      <div className="mt-4 p-3 bg-[hsl(var(--magic-blue))/10] rounded">
        <h4 className="font-semibold text-[hsl(var(--magic-blue))] mb-2">
          Dado de Bendición por Nivel
        </h4>
        <p className="text-sm text-muted-foreground mb-3">
          {bendiciones.bonificador_competencia.descripcion}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {bendiciones.bonificador_competencia.tabla?.map((b, i) => (
            <div key={i} className="bg-black/20 p-2 rounded text-center">
              <p className="text-xs text-muted-foreground">Nivel {b.nivel}</p>
              <p className="text-lg font-bold text-[hsl(var(--torch-orange))]">{b.dado}</p>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

// Named Weapons Section
const NamedWeaponsSection = ({ armas }) => (
  <div className="card-parchment rounded-lg p-4">
    <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4 border-b border-[hsl(var(--torch-orange))/30] pb-2 flex items-center gap-2">
      <Swords className="w-5 h-5" />
      Armas con Nombre
    </h3>
    <p className="text-sm mb-4">{armas.descripcion}</p>
    
    <div className="space-y-3">
      {armas.tradiciones?.map((t, i) => (
        <div key={i} className="bg-black/10 p-3 rounded">
          <p className="font-bold text-[hsl(var(--gold))] mb-1">{t.cultura}</p>
          <p className="text-sm text-muted-foreground">{t.descripcion}</p>
        </div>
      ))}
    </div>
  </div>
);

export default RecompensasSection;
