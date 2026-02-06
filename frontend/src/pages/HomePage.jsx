/**
 * Home Page - Landing page for LOTR 5e RPG
 * Three feature buttons only (no + Create Character button)
 */
import { useNavigate } from 'react-router-dom';
import { Scroll, BookOpen, Users, FileText, Map } from 'lucide-react';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen tavern-bg" data-testid="home-page">
      {/* Torch glow effects */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-[hsl(var(--torch-orange))] rounded-full blur-[100px] opacity-20 animate-torch-flicker" />
      <div className="absolute top-32 right-20 w-40 h-40 bg-[hsl(var(--torch-orange))] rounded-full blur-[120px] opacity-15 animate-torch-flicker" style={{ animationDelay: '1s' }} />
      
      {/* Hero Section - Title only, no button */}
      <div className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
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
          </div>
        </div>
      </div>

      {/* Features Section - Four clickable buttons */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
              Crear Personaje
            </h3>
            <p className="text-muted-foreground text-sm">
              Crea héroes únicos de las culturas de la Tierra Media.
            </p>
          </button>

          {/* Feature 2 - Mis Personajes */}
          <button
            onClick={() => navigate('/characters')}
            className="card-parchment rounded-lg p-6 text-center hover:bg-[hsl(var(--torch-orange))/5] transition-all cursor-pointer border-2 border-transparent hover:border-[hsl(var(--torch-orange))/30]"
            data-testid="feature-my-characters"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--torch-orange))/20] flex items-center justify-center">
              <FileText className="w-8 h-8 text-[hsl(var(--torch-orange))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Mis Personajes
            </h3>
            <p className="text-muted-foreground text-sm">
              Accede a tus fichas de personajes creados.
            </p>
          </button>

          {/* Feature 3 - Reglas */}
          <button
            onClick={() => navigate('/rules')}
            className="card-parchment rounded-lg p-6 text-center hover:bg-[hsl(var(--magic-blue))/5] transition-all cursor-pointer border-2 border-transparent hover:border-[hsl(var(--magic-blue))/30]"
            data-testid="feature-rules"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--magic-blue))/20] flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-[hsl(var(--magic-blue))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Reglas
            </h3>
            <p className="text-muted-foreground text-sm">
              Culturas, ocupaciones, equipo y precios.
            </p>
          </button>

          {/* Feature 4 - Generador de Viajes */}
          <button
            onClick={() => navigate('/travel')}
            className="card-parchment rounded-lg p-6 text-center hover:bg-[hsl(var(--gold))/5] transition-all cursor-pointer border-2 border-transparent hover:border-[hsl(var(--gold))/30]"
            data-testid="feature-travel"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center">
              <Map className="w-8 h-8 text-[hsl(var(--gold))]" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Generador de Viajes
            </h3>
            <p className="text-muted-foreground text-sm">
              Genera viajes con clima, acontecimientos y fatiga.
            </p>
          </button>

          {/* Feature 5 - Juego en Línea (Próximamente) */}
          <div 
            className="card-parchment rounded-lg p-6 text-center opacity-60 relative"
            data-testid="feature-online-game"
          >
            <div className="absolute top-2 right-2 bg-[hsl(var(--destructive))/20] text-[hsl(var(--destructive))] text-xs px-2 py-1 rounded font-heading">
              Próximamente
            </div>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              Juego en Línea
            </h3>
            <p className="text-muted-foreground text-sm">
              Mapas, chat y herramientas para el Director.
            </p>
          </div>
        </div>

        {/* Editor de Fichas - Developer tool */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/sheet-editor')}
            className="text-sm text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors underline underline-offset-4"
            data-testid="sheet-editor-link"
          >
            🛠️ Editor de Posiciones de Ficha
          </button>
        </div>
      </div>

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
