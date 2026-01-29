/**
 * Characters List Page - View all characters and drafts
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, User, FileEdit, Trash2, ArrowLeft } from 'lucide-react';
import { getCharacters } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';
import { cn } from '@/lib/utils';

const CharactersListPage = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load characters and drafts
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [charactersData, draftsData] = await Promise.all([
          getCharacters(),
          api.get('/characters/drafts').then(r => r.data.drafts).catch(() => [])
        ]);
        setCharacters(charactersData);
        setDrafts(draftsData);
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Delete draft
  const handleDeleteDraft = async (draftId) => {
    if (!window.confirm('¿Eliminar este borrador?')) return;
    try {
      await api.delete(`/characters/draft/${draftId}`);
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } catch (err) {
      console.error('Error deleting draft:', err);
    }
  };

  // Continue draft
  const handleContinueDraft = (draftId) => {
    navigate(`/create-character?draft=${draftId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen tavern-bg flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen tavern-bg" data-testid="characters-list-page">
      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="font-heading text-2xl text-[hsl(var(--gold))] text-glow-gold">
            Mis Personajes
          </h1>
          <Button
            onClick={() => navigate('/create-character')}
            className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))] text-[hsl(var(--primary-foreground))]"
            data-testid="new-character-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="characters" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary mb-6">
            <TabsTrigger 
              value="characters"
              className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20] data-[state=active]:text-[hsl(var(--gold))]"
            >
              <User className="w-4 h-4 mr-2" />
              Personajes ({characters.length})
            </TabsTrigger>
            <TabsTrigger 
              value="drafts"
              className="font-heading data-[state=active]:bg-[hsl(var(--gold))/20] data-[state=active]:text-[hsl(var(--gold))]"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Borradores ({drafts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characters">
            {characters.length === 0 ? (
              <div className="card-parchment rounded-lg p-12 text-center">
                <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-heading text-xl text-foreground mb-2">
                  No tienes personajes
                </h3>
                <p className="text-muted-foreground mb-6">
                  Crea tu primer héroe para comenzar tu aventura
                </p>
                <Button
                  onClick={() => navigate('/create-character')}
                  className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold-dim))]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Personaje
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {characters.map(char => (
                  <button
                    key={char.id}
                    onClick={() => navigate(`/character/${char.id}`)}
                    className="selection-card rounded-lg p-5 text-left"
                    data-testid={`character-${char.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center border border-[hsl(var(--gold))/50]">
                        <span className="font-heading text-xl text-[hsl(var(--gold))]">
                          {char.nombre?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading text-lg text-foreground">{char.nombre}</h3>
                        <p className="text-sm text-muted-foreground">
                          {char.cultura_nombre} {char.vocacion_nombre}
                        </p>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Nivel {char.nivel || 1}</span>
                          <span>PG: {char.puntos_golpe_actual}/{char.puntos_golpe_max}</span>
                          <span>XP: {char.experiencia || 0}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts">
            {drafts.length === 0 ? (
              <div className="card-parchment rounded-lg p-12 text-center">
                <FileEdit className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="font-heading text-xl text-foreground mb-2">
                  No tienes borradores
                </h3>
                <p className="text-muted-foreground">
                  Los personajes a medio crear aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map(draft => (
                  <div
                    key={draft.id}
                    className="card-parchment rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <FileEdit className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-heading text-foreground">
                          {draft.nombre || 'Sin nombre'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {draft.cultura_nombre || 'Cultura no seleccionada'} · Paso {draft.paso_actual}/9
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleContinueDraft(draft.id)}
                        className="border-[hsl(var(--gold))/50] hover:bg-[hsl(var(--gold))/10]"
                      >
                        Continuar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDraft(draft.id)}
                        className="text-muted-foreground hover:text-[hsl(var(--destructive))]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CharactersListPage;
