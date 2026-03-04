/**
 * Map Selection Page
 * Allows users to choose between Master Map (admin only) and Player Map
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Crown, Users, Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useUser } from '../contexts/UserContext';

const MapSelectionPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUser();

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ 
        backgroundImage: 'url(/images/bg-dark.jpg)',
        backgroundColor: '#1a1512'
      }}
    >
      {/* Header */}
      <div className="bg-black/60 border-b border-[hsl(var(--gold))/30]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div className="flex items-center gap-2">
              <Map className="h-6 w-6 text-[hsl(var(--gold))]" />
              <h1 className="text-2xl font-heading text-[hsl(var(--gold))]">
                MAPA DE LA TIERRA MEDIA
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <p className="text-gray-300 text-lg">
            Selecciona el modo de visualización del mapa
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Master Map Card */}
          <div 
            className={`
              relative group cursor-pointer transition-all duration-300
              ${!isAdmin ? 'opacity-60' : 'hover:scale-105'}
            `}
            onClick={() => isAdmin && navigate('/map/master')}
          >
            <div className="bg-black/70 border-2 border-[hsl(var(--gold))] rounded-lg p-6 h-full
                          shadow-[0_0_30px_rgba(212,175,55,0.3)]
                          group-hover:shadow-[0_0_50px_rgba(212,175,55,0.5)]">
              {/* Lock overlay for non-admin */}
              {!isAdmin && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center z-10">
                  <div className="text-center">
                    <Lock className="h-12 w-12 text-[hsl(var(--gold))] mx-auto mb-2" />
                    <p className="text-[hsl(var(--gold))] font-heading">Solo Maestro</p>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[hsl(var(--gold))]/20 flex items-center justify-center
                              border-2 border-[hsl(var(--gold))]">
                  <Crown className="h-10 w-10 text-[hsl(var(--gold))]" />
                </div>
                
                <h2 className="text-2xl font-heading text-[hsl(var(--gold))]">
                  Mapa del Maestro
                </h2>
                
                <p className="text-gray-400 text-sm">
                  Mapa completo con todas las ubicaciones, caminos, ríos, barreras y herramientas de edición.
                </p>
                
                <ul className="text-left text-sm text-gray-300 space-y-1 w-full">
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--gold))]">✓</span>
                    182 ubicaciones con nombres
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--gold))]">✓</span>
                    Dibujar caminos, ríos y barreras
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--gold))]">✓</span>
                    Capas de terreno y peligro
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--gold))]">✓</span>
                    Cálculo de rutas y viajes
                  </li>
                </ul>

                <div className="pt-4 w-full">
                  <Button
                    disabled={!isAdmin}
                    className="w-full bg-[hsl(var(--gold))] text-black hover:bg-[hsl(var(--gold))]/80
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAdmin ? 'Entrar al Mapa del Maestro' : 'Requiere rol de Maestro'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Player Map Card */}
          <div 
            className="relative group cursor-pointer transition-all duration-300 hover:scale-105"
            onClick={() => navigate('/map/player')}
          >
            <div className="bg-black/70 border-2 border-[hsl(var(--magic-blue))] rounded-lg p-6 h-full
                          shadow-[0_0_30px_rgba(59,130,246,0.3)]
                          group-hover:shadow-[0_0_50px_rgba(59,130,246,0.5)]">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-[hsl(var(--magic-blue))]/20 flex items-center justify-center
                              border-2 border-[hsl(var(--magic-blue))]">
                  <Users className="h-10 w-10 text-[hsl(var(--magic-blue))]" />
                </div>
                
                <h2 className="text-2xl font-heading text-[hsl(var(--magic-blue))]">
                  Mapa del Jugador
                </h2>
                
                <p className="text-gray-400 text-sm">
                  Mapa simplificado sin nombres de ubicaciones. Perfecto para la exploración durante las partidas.
                </p>
                
                <ul className="text-left text-sm text-gray-300 space-y-1 w-full">
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--magic-blue))]">✓</span>
                    Vista limpia sin spoilers
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--magic-blue))]">✓</span>
                    Visualización de rutas de viaje
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--magic-blue))]">✓</span>
                    Navegación y zoom
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[hsl(var(--magic-blue))]">✓</span>
                    Acceso para todos los jugadores
                  </li>
                </ul>

                <div className="pt-4 w-full">
                  <Button
                    className="w-full bg-[hsl(var(--magic-blue))] text-white hover:bg-[hsl(var(--magic-blue))]/80"
                  >
                    Entrar al Mapa del Jugador
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-12 bg-[hsl(var(--torch-orange))]/10 border border-[hsl(var(--torch-orange))]/30 rounded-lg p-4">
          <p className="text-sm text-gray-300 text-center">
            <span className="text-[hsl(var(--torch-orange))] font-heading">Nota:</span> El cálculo de viajes 
            utiliza los datos del Mapa del Maestro, pero las rutas calculadas se pueden visualizar en ambos mapas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapSelectionPage;
