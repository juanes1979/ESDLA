/**
 * Home Page - Landing page for LOTR 5e RPG
 * Simplified: Only the main "Create Character" button
 */
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen tavern-bg flex items-center justify-center" data-testid="home-page">
      {/* Torch glow effects */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-[hsl(var(--torch-orange))] rounded-full blur-[100px] opacity-20 animate-torch-flicker" />
      <div className="absolute top-32 right-20 w-40 h-40 bg-[hsl(var(--torch-orange))] rounded-full blur-[120px] opacity-15 animate-torch-flicker" style={{ animationDelay: '1s' }} />
      
      {/* Main CTA Button */}
      <div className="text-center">
        <Button
          size="lg"
          onClick={() => navigate('/create-character')}
          className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))] font-heading text-2xl px-16 py-10 animate-magic-pulse"
          data-testid="create-character-btn"
        >
          <Plus className="w-8 h-8 mr-3" />
          Crear Personaje
        </Button>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 border-t border-border/50">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground/50">
            Basado en el mundo de J.R.R. Tolkien • Sistema 5e adaptado
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
