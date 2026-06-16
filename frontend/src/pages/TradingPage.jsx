/**
 * Trading Page — standalone Compra-Venta accesible desde la pantalla principal.
 * Reutiliza el componente TradingSystemSection (mismo de la sección de Reglas).
 * Solo Maestro / DJ. (En el futuro se integrará en la Pantalla del DJ.)
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { TradingSystemSection } from '@/components/rules';

export default function TradingPage() {
  const navigate = useNavigate();
  const { isAdmin } = useUser();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors"
            data-testid="trading-back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            Inicio
          </button>
          <h1 className="font-heading text-2xl md:text-3xl text-[hsl(var(--gold))] flex items-center gap-3">
            <Coins className="w-7 h-7" />
            Compra-Venta
          </h1>
        </div>

        <TradingSystemSection isAdmin={isAdmin} />
      </div>
    </div>
  );
}
