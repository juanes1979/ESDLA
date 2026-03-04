/**
 * Characters List Page - View all characters and drafts
 * With multi-select delete functionality and LOTR theme
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, User, FileEdit, Trash2, CheckSquare, Square, AlertTriangle, X, Home } from 'lucide-react';
import { getCharacters } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FireButton from '@/components/ui/FireButton';
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
        await Promise.all(
          Array.from(selectedCharacters).map(id =>
            api.delete(`/characters/${id}`)
          )
        );
        setCharacters(prev => prev.filter(c => !selectedCharacters.has(c.id)));
        setSelectedCharacters(new Set());
      } else if (deleteType === 'drafts') {
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
      <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-orange-400 font-heading">Cargando personajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" data-testid="characters-list-page" style={{ backgroundColor: '#0f0f10' }}>
      {/* Background effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-600/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900/95 border border-red-500/50 rounded-xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-heading text-xl text-red-400 mb-2">
                  ¡Atención! Acción irreversible
                </h3>
                <p className="text-gray-400 text-sm">
                  {deleteType === 'characters' ? (
                    <>
                      Estás a punto de eliminar <strong className="text-white">{selectedCharacters.size} personaje{selectedCharacters.size > 1 ? 's' : ''}</strong>. 
                      Esta acción <strong className="text-red-400">NO se puede deshacer</strong>. 
                    </>
                  ) : (
                    <>
                      Estás a punto de eliminar <strong className="text-white">{selectedDrafts.size} borrador{selectedDrafts.size > 1 ? 'es' : ''}</strong>. 
                      Esta acción <strong className="text-red-400">NO se puede deshacer</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <FireButton
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancelar
              </FireButton>
              <FireButton
                variant="danger"
                onClick={handleDeleteSelected}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Eliminar
              </FireButton>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 border-b border-orange-900/30 bg-black/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg bg-orange-600/20 hover:bg-orange-600/40 
                     text-orange-400 hover:text-orange-300 transition-all
                     border border-orange-500/30 hover:border-orange-500/50"
          >
            <Home className="w-5 h-5" />
          </button>
          <h1 className="font-heading text-2xl md:text-3xl text-orange-400 tracking-wide">
            Mis Personajes
          </h1>
          <FireButton
            onClick={() => navigate('/create-character')}
            variant="primary"
            size="sm"
            data-testid="new-character-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo
          </FireButton>
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="characters" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900/50 border border-orange-500/20 mb-6">
            <TabsTrigger 
              value="characters"
              className="font-heading data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <User className="w-4 h-4 mr-2" />
              Personajes ({characters.length})
            </TabsTrigger>
            <TabsTrigger 
              value="drafts"
              className="font-heading data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Borradores ({drafts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characters">
            {characters.length === 0 ? (
              <div className="bg-gray-900/50 border border-orange-500/20 rounded-xl p-12 text-center">
                <User className="w-16 h-16 mx-auto mb-4 text-orange-500/30" />
                <h3 className="font-heading text-xl text-orange-400 mb-2">
                  No tienes personajes
                </h3>
                <p className="text-gray-400 mb-6">
                  Crea tu primer héroe para comenzar tu aventura
                </p>
                <FireButton onClick={() => navigate('/create-character')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Personaje
                </FireButton>
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
                          className="text-gray-400 hover:text-white"
                        >
                          {selectedCharacters.size === characters.length ? (
                            <CheckSquare className="w-4 h-4 mr-2" />
                          ) : (
                            <Square className="w-4 h-4 mr-2" />
                          )}
                          {selectedCharacters.size === characters.length ? 'Deseleccionar' : 'Seleccionar todo'}
                        </Button>
                        <span className="text-sm text-gray-500">
                          {selectedCharacters.size} seleccionado{selectedCharacters.size !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectMode(true)}
                        className="text-gray-400 hover:text-white"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Seleccionar
                      </Button>
                    )}
                  </div>
                  {selectMode && (
                    <div className="flex items-center gap-2">
                      <FireButton
                        variant="secondary"
                        size="sm"
                        onClick={cancelSelectMode}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </FireButton>
                      <FireButton
                        variant="danger"
                        size="sm"
                        onClick={() => openDeleteModal('characters')}
                        disabled={selectedCharacters.size === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar ({selectedCharacters.size})
                      </FireButton>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {characters.map(char => (
                    <div
                      key={char.id}
                      className={cn(
                        "bg-gray-900/50 border border-orange-500/20 rounded-xl p-5 text-left relative transition-all hover:border-orange-500/40 hover:bg-gray-900/70",
                        selectMode && selectedCharacters.has(char.id) && "border-2 border-red-500 bg-red-500/10"
                      )}
                    >
                      {selectMode && (
                        <button
                          onClick={() => toggleCharacterSelection(char.id)}
                          className="absolute top-3 right-3 z-10"
                        >
                          {selectedCharacters.has(char.id) ? (
                            <CheckSquare className="w-6 h-6 text-red-500" />
                          ) : (
                            <Square className="w-6 h-6 text-gray-500 hover:text-white" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => !selectMode && navigate(`/character/${char.id}`)}
                        className="flex items-center gap-4 w-full"
                        disabled={selectMode}
                      >
                        <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/50">
                          <span className="font-heading text-xl text-orange-400">
                            {char.nombre?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="font-heading text-lg text-orange-300">{char.nombre}</h3>
                          <p className="text-sm text-gray-400">
                            {char.cultura_nombre} {char.vocacion_nombre}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-500">
                            <span>Nivel {char.nivel || 1}</span>
                            <span>PG: {char.puntos_golpe_actual}/{char.puntos_golpe_max}</span>
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
              <div className="bg-gray-900/50 border border-orange-500/20 rounded-xl p-12 text-center">
                <FileEdit className="w-16 h-16 mx-auto mb-4 text-orange-500/30" />
                <h3 className="font-heading text-xl text-orange-400 mb-2">
                  No tienes borradores
                </h3>
                <p className="text-gray-400">
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
                          className="text-gray-400 hover:text-white"
                        >
                          {selectedDrafts.size === drafts.length ? (
                            <CheckSquare className="w-4 h-4 mr-2" />
                          ) : (
                            <Square className="w-4 h-4 mr-2" />
                          )}
                          {selectedDrafts.size === drafts.length ? 'Deseleccionar' : 'Seleccionar todo'}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectMode(true)}
                        className="text-gray-400 hover:text-white"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Seleccionar
                      </Button>
                    )}
                  </div>
                  {selectMode && (
                    <div className="flex items-center gap-2">
                      <FireButton
                        variant="secondary"
                        size="sm"
                        onClick={cancelSelectMode}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancelar
                      </FireButton>
                      <FireButton
                        variant="danger"
                        size="sm"
                        onClick={() => openDeleteModal('drafts')}
                        disabled={selectedDrafts.size === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar ({selectedDrafts.size})
                      </FireButton>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {drafts.map(draft => (
                    <div
                      key={draft.id}
                      className={cn(
                        "bg-gray-900/50 border border-orange-500/20 rounded-xl p-4 flex items-center justify-between transition-all hover:border-orange-500/40",
                        selectMode && selectedDrafts.has(draft.id) && "border-2 border-red-500 bg-red-500/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {selectMode && (
                          <button onClick={() => toggleDraftSelection(draft.id)}>
                            {selectedDrafts.has(draft.id) ? (
                              <CheckSquare className="w-6 h-6 text-red-500" />
                            ) : (
                              <Square className="w-6 h-6 text-gray-500 hover:text-white" />
                            )}
                          </button>
                        )}
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                          <FileEdit className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <h4 className="font-heading text-orange-300">
                            {draft.nombre || 'Sin nombre'}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {draft.cultura_nombre || 'Cultura no seleccionada'} · Paso {draft.paso_actual}/9
                          </p>
                        </div>
                      </div>
                      {!selectMode && (
                        <div className="flex gap-2">
                          <FireButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleContinueDraft(draft.id)}
                          >
                            Continuar
                          </FireButton>
                          <FireButton
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedDrafts(new Set([draft.id]));
                              openDeleteModal('drafts');
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </FireButton>
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
