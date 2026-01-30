/**
 * Step 7: Equipment Selection
 * El equipo inicial se asigna AUTOMÁTICAMENTE según el Nivel de Vida de la cultura
 * + ropa según nivel de vida
 * + monedas según ocupación
 * NO hay selección de equipo adicional durante la creación de personaje
 */
import { useState, useMemo } from 'react';
import { Loader2, ChevronLeft, Package, Coins } from 'lucide-react';
import { updateDraftStep7 } from '@/services/api';
import { Button } from '@/components/ui/button';

// Equipo inicial según Nivel de Vida (según las reglas del juego)
const EQUIPO_POR_NIVEL_VIDA = {
  'Frugal': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
      // Ropa Frugal
      { nombre: 'Botas de viaje', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda común', cantidad: 1 },
    ],
    dinero: { mp: 0, mo: 0, me: 0, mc: 0 },
    descripcion: 'Equipo básico para supervivencia. Tu cultura vive de forma austera, sin monedas.'
  },
  'Común': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Raciones (1 día)', cantidad: 10 },
      { nombre: 'Antorchas (paquete de 10)', cantidad: 1 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de cáñamo (15 m)', cantidad: 1 },
      // Ropa Común
      { nombre: 'Botas de buena piel', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda de viajero', cantidad: 1 },
    ],
    dinero: { mp: 0, mo: 0, me: 0, mc: 0 }, // Base sin ocupación
    descripcion: 'Equipo estándar para un aventurero. Tu cultura tiene recursos moderados.'
  },
  'Próspero': {
    items: [
      { nombre: 'Mochila', cantidad: 1 },
      { nombre: 'Petate', cantidad: 1 },
      { nombre: 'Utensilios de cocina', cantidad: 1 },
      { nombre: 'Lata de yesca', cantidad: 1 },
      { nombre: 'Linterna sorda', cantidad: 1 },
      { nombre: 'Aceite (frasco)', cantidad: 3 },
      { nombre: 'Raciones de cram (1 día)', cantidad: 10 },
      { nombre: 'Odre (lleno)', cantidad: 1 },
      { nombre: 'Cuerda de seda (15 m)', cantidad: 1 },
      { nombre: 'Tienda para 2 personas', cantidad: 1 },
      // Ropa Próspero
      { nombre: 'Botas de cuero', cantidad: 1 },
      { nombre: 'Capa de viaje', cantidad: 1 },
      { nombre: 'Muda fina', cantidad: 1 },
      { nombre: 'Muda de viajero', cantidad: 1 },
    ],
    dinero: { mp: 0, mo: 0, me: 0, mc: 0 }, // Base sin ocupación
    descripcion: 'Equipo de alta calidad. Tu cultura goza de riqueza y comodidades.'
  }
};

// Monedas iniciales según tipo de ocupación
const DINERO_POR_OCUPACION = {
  'Buscador de tesoros': { mp: 0, mo: 0, me: 50, mc: 70 },   // Explorador
  'Campeón': { mp: 0, mo: 0, me: 50, mc: 80 },              // Guerrero
  'Capitán': { mp: 2, mo: 0, me: 50, mc: 95 },              // Lider
  'Erudito': { mp: 0, mo: 0, me: 20, mc: 70 },              // Maestro
  'Guardian': { mp: 0, mo: 0, me: 30, mc: 70 },             // Protector
  'Mensajero': { mp: 0, mo: 0, me: 45, mc: 75 },            // Trotamundos
};

const Step7Equipment = ({ draftId, draft, onComplete, onBack }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Obtener el nivel de vida del personaje
  const nivelVida = draft?.nivel_vida || 'Común';
  const vocacion = draft?.vocacion_nombre || '';
  
  // Obtener equipo automático según nivel de vida
  const equipoAutomatico = useMemo(() => {
    return EQUIPO_POR_NIVEL_VIDA[nivelVida] || EQUIPO_POR_NIVEL_VIDA['Común'];
  }, [nivelVida]);
  
  // Obtener dinero según ocupación
  const dineroOcupacion = useMemo(() => {
    return DINERO_POR_OCUPACION[vocacion] || { mp: 0, mo: 0, me: 0, mc: 0 };
  }, [vocacion]);
  
  // Dinero total (nivel de vida + ocupación)
  const dineroTotal = useMemo(() => {
    return {
      mp: (equipoAutomatico.dinero?.mp || 0) + dineroOcupacion.mp,
      mo: (equipoAutomatico.dinero?.mo || 0) + dineroOcupacion.mo,
      me: (equipoAutomatico.dinero?.me || 0) + dineroOcupacion.me,
      mc: (equipoAutomatico.dinero?.mc || 0) + dineroOcupacion.mc,
    };
  }, [equipoAutomatico, dineroOcupacion]);

  // Handle submit - only automatic equipment, no optional items
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Solo equipo automático del nivel de vida
      const inventario = equipoAutomatico.items.map(item => ({
        item_id: `auto-${item.nombre.toLowerCase().replace(/\s/g, '-')}`,
        nombre: item.nombre,
        cantidad: item.cantidad,
        equipado: false,
        origen: 'nivel_vida'
      }));
      
      const updatedDraft = await updateDraftStep7(draftId, {
        inventario,
        dinero: dineroTotal, // Use combined money from lifestyle + occupation
      });
      onComplete(updatedDraft);
    } catch (err) {
      console.error('Error saving step 7:', err);
      setError('No se pudo guardar el equipo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="step-7-equipment">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-heading text-3xl text-[hsl(var(--gold))] text-glow-gold mb-2">
          Equipo Inicial
        </h2>
        <p className="text-muted-foreground">
          Tu equipo base depende del Nivel de Vida de tu cultura
        </p>
      </div>

      {/* Character & Level of Living Summary */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <span className="font-heading text-xl text-[hsl(var(--gold))]">
                {draft?.nombre?.[0]?.toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="font-heading text-lg text-foreground">{draft?.nombre}</h3>
              <p className="text-sm text-muted-foreground">
                {draft?.cultura_nombre} · {draft?.vocacion_nombre}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Nivel de Vida</p>
            <p className="font-heading text-xl text-[hsl(var(--gold))]">
              {nivelVida}
            </p>
          </div>
        </div>
      </div>

      {/* Automatic Equipment from Level of Living */}
      <div className="card-parchment rounded-lg p-6 border-magic">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-6 h-6 text-[hsl(var(--gold))]" />
          <h3 className="font-heading text-xl text-[hsl(var(--gold))]">
            Equipo Automático ({nivelVida})
          </h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4 italic">
          {equipoAutomatico.descripcion}
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {equipoAutomatico.items.map((item, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 rounded-lg bg-[hsl(var(--gold))/10] border border-[hsl(var(--gold))/30]"
            >
              <span className="text-foreground">{item.nombre}</span>
              <span className="text-[hsl(var(--gold))] font-medium">x{item.cantidad}</span>
            </div>
          ))}
        </div>

        {/* Starting Money - Combined from lifestyle + occupation */}
        <div className="p-4 rounded-lg bg-secondary">
          <div className="flex items-center gap-3 mb-2">
            <Coins className="w-5 h-5 text-[hsl(var(--gold))]" />
            <p className="text-sm text-muted-foreground">Dinero Inicial ({vocacion})</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded bg-[hsl(var(--gold))/20]">
              <p className="font-heading text-lg text-[hsl(var(--gold))]">{dineroTotal.mp}</p>
              <p className="text-xs text-muted-foreground">mp</p>
            </div>
            <div className="p-2 rounded bg-[hsl(var(--gold))/10]">
              <p className="font-heading text-lg text-foreground">{dineroTotal.mo}</p>
              <p className="text-xs text-muted-foreground">mo</p>
            </div>
            <div className="p-2 rounded bg-[hsl(var(--gold))/10]">
              <p className="font-heading text-lg text-foreground">{dineroTotal.me}</p>
              <p className="text-xs text-muted-foreground">me</p>
            </div>
            <div className="p-2 rounded bg-[hsl(var(--gold))/5]">
              <p className="font-heading text-lg text-muted-foreground">{dineroTotal.mc}</p>
              <p className="text-xs text-muted-foreground">mc</p>
            </div>
          </div>
        </div>
      </div>

      {/* Equipment from Occupation */}
      {draft?.equipo_ocupacion?.length > 0 && (
        <div className="card-parchment rounded-lg p-6">
          <h3 className="font-heading text-xl text-[hsl(var(--magic-blue))] mb-4">
            Equipo de Ocupación
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este equipo viene incluido por tu ocupación de {draft?.vocacion_nombre}
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {draft.equipo_ocupacion.map((item, index) => (
              <div 
                key={index}
                className="flex items-center p-3 rounded-lg bg-[hsl(var(--magic-blue))/10] border border-[hsl(var(--magic-blue))/30]"
              >
                <span className="text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment from Background */}
      {draft?.equipo_trasfondo?.length > 0 && (
        <div className="card-parchment rounded-lg p-6">
          <h3 className="font-heading text-xl text-[hsl(var(--torch-orange))] mb-4">
            Equipo de Trasfondo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este equipo viene incluido por tu trasfondo de {draft?.trasfondo_nombre}
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {draft.equipo_trasfondo.map((item, index) => (
              <div 
                key={index}
                className="flex items-center p-3 rounded-lg bg-[hsl(var(--torch-orange))/10] border border-[hsl(var(--torch-orange))/30]"
              >
                <span className="text-foreground">{typeof item === 'string' ? item : item.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-[hsl(var(--destructive))/20] border border-[hsl(var(--destructive))/50] rounded-lg text-center">
          <p className="text-[hsl(var(--destructive))]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 pb-16">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
          data-testid="step-7-back-btn"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading px-8"
          data-testid="step-7-next-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Continuar
        </Button>
      </div>
    </div>
  );
};

export default Step7Equipment;
