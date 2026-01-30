/**
 * Characters List Page - View all characters and drafts
 * With multi-select delete functionality
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, User, FileEdit, Trash2, ArrowLeft, CheckSquare, Square, AlertTriangle, X } from 'lucide-react';
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
  
  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState(new Set());
  const [selectedDrafts, setSelectedDrafts] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState(null); // 'characters' or 'drafts'
  const [deleting, setDeleting] = useState(false);

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

  // Toggle character selection
  const toggleCharacterSelection = (id) => {
    setSelectedCharacters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle draft selection
  const toggleDraftSelection = (id) => {
    setSelectedDrafts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Select all characters
  const selectAllCharacters = () => {
    if (selectedCharacters.size === characters.length) {
      setSelectedCharacters(new Set());
    } else {
      setSelectedCharacters(new Set(characters.map(c => c.id)));
    }
  };

  // Select all drafts
  const selectAllDrafts = () => {
    if (selectedDrafts.size === drafts.length) {
      setSelectedDrafts(new Set());
    } else {
      setSelectedDrafts(new Set(drafts.map(d => d.id)));
    }
  };

  // Open delete modal
  const openDeleteModal = (type) => {
    setDeleteType(type);
    setShowDeleteModal(true);
  };

  // Cancel selection mode
  const cancelSelectMode = () => {
    setSelectMode(false);
    setSelectedCharacters(new Set());
    setSelectedDrafts(new Set());
  };

  // Delete selected items
  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      if (deleteType === 'characters') {
        // Delete selected characters
        await Promise.all(
          Array.from(selectedCharacters).map(id =>
            api.delete(`/characters/${id}`)
          )
        );
        setCharacters(prev => prev.filter(c => !selectedCharacters.has(c.id)));
        setSelectedCharacters(new Set());
      } else if (deleteType === 'drafts') {
        // Delete selected drafts
        await Promise.all(
          Array.from(selectedDrafts).map(id =>
            api.delete(`/characters/draft/${id}`)
          )
        );
        setDrafts(prev => prev.filter(d => !selectedDrafts.has(d.id)));
        setSelectedDrafts(new Set());
      }
      setShowDeleteModal(false);
      setSelectMode(false);
    } catch (err) {
      console.error('Error deleting:', err);
    } finally {
      setDeleting(false);
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
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-parchment rounded-lg p-6 max-w-md w-full border-2 border-[hsl(var(--destructive))]">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--destructive))/20] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-[hsl(var(--destructive))]" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-[hsl(var(--destructive))] mb-2">
                  ¡Atención! Acción irreversible
                </h3>
                <p className="text-muted-foreground text-sm">
                  {deleteType === 'characters' ? (
                    <>
                      Estás a punto de eliminar <strong className="text-foreground">{selectedCharacters.size} personaje{selectedCharacters.size > 1 ? 's' : ''}</strong>. 
                      Esta acción <strong className="text-[hsl(var(--destructive))]">NO se puede deshacer</strong>. 
                      Todos los datos del personaje se perderán permanentemente.
                    </>
                  ) : (
                    <>
                      Estás a punto de eliminar <strong className="text-foreground">{selectedDrafts.size} borrador{selectedDrafts.size > 1 ? 'es' : ''}</strong>. 
                      Esta acción <strong className="text-[hsl(var(--destructive))]">NO se puede deshacer</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>
            
            <div className="bg-[hsl(var(--destructive))/10] rounded-lg p-3 mb-6 border border-[hsl(var(--destructive))/30]">
              <p className="text-xs text-[hsl(var(--destructive))]">
                {deleteType === 'characters' ? (
                  'Los personajes eliminados no podrán recuperarse. Asegúrate de que realmente quieres eliminarlos.'
                ) : (
                  'Los borradores eliminados no podrán recuperarse.'
                )}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="border-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/80 text-white"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Eliminar {deleteType === 'characters' ? 'personajes' : 'borradores'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border/50 bg-black/30 backdrop-blur-sm sticky top-0 z-40">
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
              <>
                {/* Selection toolbar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {selectMode ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllCharacters}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {selectedCharacters.size === characters.length ? (
                            <CheckSquare className="w-4 h-4 mr-2" />
                          ) : (
                            <Square className="w-4 h-4 mr-2" />
                          )}
                          {selectedCharacters.size === characters.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {selectedCharacters.size} seleccionado{selectedCharacters.size !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectMode(true)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Seleccionar
                      </Button>
                    )}
                  </div>
                  {selectMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelSelectMode}
                        className="text-muted-foreground"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteModal('characters')}
                        disabled={selectedCharacters.size === 0}
                        className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/80"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar ({selectedCharacters.size})
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {characters.map(char => (
                    <div
                      key={char.id}
                      className={cn(
                        "selection-card rounded-lg p-5 text-left relative transition-all",
                        selectMode && selectedCharacters.has(char.id) && "border-2 border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/5]"
                      )}
                    >
                      {selectMode && (
                        <button
                          onClick={() => toggleCharacterSelection(char.id)}
                          className="absolute top-3 right-3 z-10"
                          data-testid={`select-${char.id}`}
                        >
                          {selectedCharacters.has(char.id) ? (
                            <CheckSquare className="w-6 h-6 text-[hsl(var(--destructive))]" />
                          ) : (
                            <Square className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => !selectMode && navigate(`/character/${char.id}`)}
                        className="flex items-center gap-4 w-full"
                        disabled={selectMode}
                        data-testid={`character-${char.id}`}
                      >
                        <div 
                          className="w-14 h-14 rounded-full bg-[hsl(var(--gold))/20] flex items-center justify-center border border-[hsl(var(--gold))/50] cursor-pointer"
                          onClick={(e) => {
                            if (selectMode) {
                              e.stopPropagation();
                              toggleCharacterSelection(char.id);
                            }
                          }}
                        >
                          <span className="font-heading text-xl text-[hsl(var(--gold))]">
                            {char.nombre?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
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
                      </button>
                    </div>
                  ))}
                </div>
              </>
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
              <>
                {/* Selection toolbar for drafts */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {selectMode ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllDrafts}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {selectedDrafts.size === drafts.length ? (
                            <CheckSquare className="w-4 h-4 mr-2" />
                          ) : (
                            <Square className="w-4 h-4 mr-2" />
                          )}
                          {selectedDrafts.size === drafts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {selectedDrafts.size} seleccionado{selectedDrafts.size !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectMode(true)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Seleccionar
                      </Button>
                    )}
                  </div>
                  {selectMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelSelectMode}
                        className="text-muted-foreground"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteModal('drafts')}
                        disabled={selectedDrafts.size === 0}
                        className="bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/80"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar ({selectedDrafts.size})
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {drafts.map(draft => (
                    <div
                      key={draft.id}
                      className={cn(
                        "card-parchment rounded-lg p-4 flex items-center justify-between transition-all",
                        selectMode && selectedDrafts.has(draft.id) && "border-2 border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))/5]"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {selectMode && (
                          <button
                            onClick={() => toggleDraftSelection(draft.id)}
                            data-testid={`select-draft-${draft.id}`}
                          >
                            {selectedDrafts.has(draft.id) ? (
                              <CheckSquare className="w-6 h-6 text-[hsl(var(--destructive))]" />
                            ) : (
                              <Square className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                            )}
                          </button>
                        )}
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
                      {!selectMode && (
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
                            onClick={() => {
                              setSelectedDrafts(new Set([draft.id]));
                              openDeleteModal('drafts');
                            }}
                            className="text-muted-foreground hover:text-[hsl(var(--destructive))]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CharactersListPage;
