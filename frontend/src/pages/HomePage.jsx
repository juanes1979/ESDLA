/**
 * Home Page - Landing page for LOTR 5e RPG
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Scroll, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCharacters } from '@/services/api';

const HomePage = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCharacters = async () => {
      try {
        const data = await getCharacters();
        setCharacters(data);
      } catch (err) {
        console.error('Error loading characters:', err);
      } finally {
        setLoading(false);
      }
    };
    loadCharacters();
  }, []);

  return (
    <div className="min-h-screen tavern-bg" data-testid="home-page">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Torch glow effects */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-[hsl(var(--torch-orange))] rounded-full blur-[100px] opacity-20 animate-torch-flicker" />
        <div className="absolute top-32 right-20 w-40 h-40 bg-[hsl(var(--torch-orange))] rounded-full blur-[120px] opacity-15 animate-torch-flicker" style={{ animationDelay: '1s' }} />
        
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Logo/Title */}
            <div className="mb-8">
              <h1 className="font-heading text-5xl md:text-7xl text-[hsl(var(--gold))] text-glow-gold mb-4">
                ESDLA
              </h1>
              <div className="divider-ornament mb-4">
                <span className="text-muted-foreground text-sm font-heading tracking-widest">
                  5e Mod
                </span>
              </div>
              <p className="text-xl text-muted-foreground max-w-xl mx-auto">
                Embárcate en aventuras épicas por los reinos de la Tierra Media. 
                Crea tu héroe y escribe tu propia leyenda.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/create-character')}
                className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading text-lg px-8 py-6 animate-magic-pulse"
                data-testid="create-character-btn"
              >
                <Plus className="w-5 h-5 mr-2" />
                Crear Personaje
              </Button>
              {characters.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/characters')}
                  className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10] font-heading text-lg px-8 py-6"
                  data-testid="view-characters-btn"
                >
                  <Users className="w-5 h-5 mr-2" />
                  Mis Personajes ({characters.length})
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 - Creador de Personajes */}
          <button
            onClick={() => navigate('/create-character')}
            className="card-parchment rounded-lg p-6 text-center hover:bg-[hsl(var(--gold))/5] transition-all cursor-pointer border-2 border-transparent hover:border-[hsl(var(--gold))/30]"
            data-testid="feature-character-creator"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <Scroll className="w-8 h-8 text-[hsl(var(--gold))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Creador de Personajes
            </h3>
            <p className="text-muted-foreground text-sm">
              Crea héroes únicos de las culturas de la Tierra Media: Elfos, Enanos, 
              Hombres y Hobbits con trasfondos detallados.
            </p>
          </button>

          {/* Feature 2 - Reglas */}
          <button
            onClick={() => navigate('/rules')}
            className="card-parchment rounded-lg p-6 text-center hover:bg-[hsl(var(--magic-blue))/5] transition-all cursor-pointer border-2 border-transparent hover:border-[hsl(var(--magic-blue))/30]"
            data-testid="feature-rules"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--magic-blue))/20] flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-[hsl(var(--magic-blue))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Reglas Completas
            </h3>
            <p className="text-muted-foreground text-sm">
              Sistema basado en 5e adaptado al mundo de Tolkien con mecánicas 
              únicas de Sombra, Viajes y Comunidad.
            </p>
          </button>

          {/* Feature 3 - Juego en Línea (Próximamente) */}
          <div 
            className="card-parchment rounded-lg p-6 text-center opacity-60 relative"
            data-testid="feature-online-game"
          >
            <div className="absolute top-2 right-2 bg-[hsl(var(--torch-orange))/20] text-[hsl(var(--torch-orange))] text-xs px-2 py-1 rounded font-heading">
              Próximamente
            </div>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--torch-orange))/20] flex items-center justify-center">
              <Users className="w-8 h-8 text-[hsl(var(--torch-orange))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Juego en Línea
            </h3>
            <p className="text-muted-foreground text-sm">
              Conecta con otros jugadores, gestiona mapas, chat integrado 
              y herramientas para el Director de Juego.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Characters */}
      {characters.length > 0 && (
        <div className="container mx-auto px-4 py-8">
          <h2 className="font-heading text-2xl text-[hsl(var(--gold))] mb-6 text-center">
            Tus Personajes
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {loading ? (
              <div className="col-span-full text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))] mx-auto" />
              </div>
            ) : (
              characters.slice(0, 6).map((char) => (
                <button
                  key={char.id}
                  onClick={() => navigate(`/character/${char.id}`)}
                  className="selection-card rounded-lg p-4 text-left"
                  data-testid={`character-card-${char.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
                      <span className="font-heading text-lg text-[hsl(var(--gold))]">
                        {char.nombre?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-heading text-foreground">{char.nombre}</h4>
                      <p className="text-sm text-muted-foreground">
                        {char.cultura_nombre} {char.vocacion_nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nivel {char.nivel || 1}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16">
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Basado en el mundo creado por J.R.R. Tolkien
          </p>
          <p className="text-xs text-muted-foreground/50 mt-2">
            Sistema de reglas adaptado de Dungeons & Dragons 5e
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
