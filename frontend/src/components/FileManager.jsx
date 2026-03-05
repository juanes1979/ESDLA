/**
 * FileManager Component
 * Hierarchical file browser for GridFS storage system
 * Structure: Maestro > Campaña > Jugador > Personaje
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  Folder, File, Upload, Download, Trash2, Plus, ChevronRight, ChevronDown, 
  FolderPlus, RefreshCw, ArrowLeft, Home, Search, FileText, Image, 
  FileArchive, Users, User, Scroll, Loader2, MoreVertical 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

// File type icons
const FILE_ICONS = {
  'application/pdf': FileText,
  'image/png': Image,
  'image/jpeg': Image,
  'image/webp': Image,
  'application/json': FileArchive,
  'text/plain': FileText,
  'default': File
};

// Get icon for file type
const getFileIcon = (contentType) => {
  return FILE_ICONS[contentType] || FILE_ICONS.default;
};

// Format bytes to human readable
const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// Format date
const formatDate = (isoString) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const FileManager = ({ 
  maestroId = null,
  campaignId = null,
  playerId = null,
  characterId = null,
  onFileSelect = null,
  allowUpload = true,
  showCreateCampaign = true
}) => {
  // State
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [fileTree, setFileTree] = useState(null);

  // Build current filter context
  const currentContext = {
    maestro_id: currentPath[0]?.id || maestroId,
    campaign_id: currentPath[1]?.id || campaignId,
    player_id: currentPath[2]?.id || playerId,
    character_id: currentPath[3]?.id || characterId
  };

  // Load files
  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentContext.maestro_id) params.append('maestro_id', currentContext.maestro_id);
      if (currentContext.campaign_id) params.append('campaign_id', currentContext.campaign_id);
      if (currentContext.player_id) params.append('player_id', currentContext.player_id);
      if (currentContext.character_id) params.append('character_id', currentContext.character_id);

      const response = await api.get(`/storage/list?${params.toString()}`);
      setFiles(response.data?.files || []);
    } catch (err) {
      console.error('Error loading files:', err);
      toast.error('Error al cargar archivos');
    } finally {
      setLoading(false);
    }
  }, [currentContext.maestro_id, currentContext.campaign_id, currentContext.player_id, currentContext.character_id]);

  // Load file tree
  const loadFileTree = useCallback(async () => {
    try {
      const params = maestroId ? `?maestro_id=${maestroId}` : '';
      const response = await api.get(`/storage/tree${params}`);
      setFileTree(response.data);
    } catch (err) {
      console.error('Error loading file tree:', err);
    }
  }, [maestroId]);

  // Load campaigns for a maestro
  const loadCampaigns = useCallback(async () => {
    if (!currentContext.maestro_id) return;
    try {
      const response = await api.get(`/storage/campaigns/${currentContext.maestro_id}`);
      setCampaigns(response.data?.campaigns || []);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  }, [currentContext.maestro_id]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const params = maestroId ? `?maestro_id=${maestroId}` : '';
      const response = await api.get(`/storage/stats${params}`);
      setStats(response.data?.stats?.[0] || null);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [maestroId]);

  // Initial load
  useEffect(() => {
    loadFiles();
    loadStats();
    if (maestroId) {
      loadCampaigns();
      loadFileTree();
    }
  }, [loadFiles, loadStats, loadCampaigns, loadFileTree, maestroId]);

  // Upload file
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    
    if (currentContext.maestro_id) formData.append('maestro_id', currentContext.maestro_id);
    if (currentContext.campaign_id) formData.append('campaign_id', currentContext.campaign_id);
    if (currentContext.player_id) formData.append('player_id', currentContext.player_id);
    if (currentContext.character_id) formData.append('character_id', currentContext.character_id);
    formData.append('folder', 'documents');

    try {
      await api.post('/storage/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });
      toast.success(`Archivo "${file.name}" subido correctamente`);
      loadFiles();
    } catch (err) {
      toast.error('Error al subir archivo: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  // Download file
  const handleDownload = async (file) => {
    try {
      window.open(`${api.defaults.baseURL}/storage/download/${file.file_id}`, '_blank');
    } catch (err) {
      toast.error('Error al descargar archivo');
    }
  };

  // Delete file
  const handleDelete = async (file) => {
    if (!window.confirm(`¿Eliminar "${file.original_filename}"?`)) return;

    try {
      await api.delete(`/storage/file/${file.file_id}`);
      toast.success('Archivo eliminado');
      loadFiles();
    } catch (err) {
      toast.error('Error al eliminar archivo');
    }
  };

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    
    try {
      const maestro = currentContext.maestro_id || 'default_maestro';
      const params = new URLSearchParams({
        maestro_id: maestro,
        campaign_name: newCampaignName.trim()
      });
      if (newCampaignDescription.trim()) {
        params.append('description', newCampaignDescription.trim());
      }
      
      await api.post(`/storage/campaigns?${params.toString()}`);
      toast.success(`Campaña "${newCampaignName}" creada`);
      setShowNewCampaignModal(false);
      setNewCampaignName('');
      setNewCampaignDescription('');
      loadCampaigns();
    } catch (err) {
      toast.error('Error al crear campaña: ' + (err.response?.data?.detail || err.message));
    }
  };

  // Navigate to folder
  const navigateTo = (pathItem, index) => {
    if (index === -1) {
      // Go to root
      setCurrentPath([]);
    } else {
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  // Enter folder
  const enterFolder = (folderType, folderId, folderName) => {
    setCurrentPath([...currentPath, { type: folderType, id: folderId, name: folderName }]);
  };

  // Filter files by search
  const filteredFiles = files.filter(f => 
    !searchTerm || f.original_filename?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group files by folder
  const groupedFiles = filteredFiles.reduce((acc, file) => {
    const folder = file.folder || 'documents';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-[hsl(var(--background))]" data-testid="file-manager">
      {/* Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-xl text-[hsl(var(--gold))] flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Gestor de Archivos
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { loadFiles(); loadStats(); }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {allowUpload && (
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploadProgress !== null}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-1" />
                    Subir
                  </span>
                </Button>
              </label>
            )}
            {showCreateCampaign && (
              <Button
                size="sm"
                onClick={() => setShowNewCampaignModal(true)}
                className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
              >
                <FolderPlus className="w-4 h-4 mr-1" />
                Nueva Campaña
              </Button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          <button 
            onClick={() => navigateTo(null, -1)}
            className="flex items-center gap-1 hover:text-[hsl(var(--gold))] transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Inicio</span>
          </button>
          {currentPath.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => navigateTo(item, i)}
                className="hover:text-[hsl(var(--gold))] transition-colors"
              >
                {item.name}
              </button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar archivos..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="px-4 py-2 bg-[hsl(var(--magic-blue))]/10 border-b border-[hsl(var(--magic-blue))]/30">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[hsl(var(--magic-blue))]" />
            <span className="text-sm">Subiendo... {uploadProgress}%</span>
          </div>
          <div className="h-1 bg-black/20 rounded mt-1">
            <div 
              className="h-full bg-[hsl(var(--magic-blue))] rounded transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="px-4 py-2 bg-black/10 border-b border-border/20 flex items-center gap-6 text-xs">
          <span className="text-muted-foreground">
            Archivos: <span className="text-white font-bold">{stats.total_files}</span>
          </span>
          <span className="text-muted-foreground">
            Tamaño: <span className="text-white font-bold">{stats.total_mb} MB</span>
          </span>
          <span className="text-muted-foreground">
            Campañas: <span className="text-white font-bold">{stats.campaign_count}</span>
          </span>
          <span className="text-muted-foreground">
            Personajes: <span className="text-white font-bold">{stats.character_count}</span>
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
          </div>
        ) : currentPath.length === 0 ? (
          // Root view - show campaigns
          <div className="space-y-6">
            {/* Campaigns section */}
            <div>
              <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-3 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Campañas
              </h3>
              {campaigns.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.campaign_id}
                      onClick={() => enterFolder('campaign', campaign.campaign_id, campaign.name)}
                      className="card-parchment p-4 rounded-lg text-left hover:ring-2 hover:ring-[hsl(var(--gold))]/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <Folder className="w-8 h-8 text-[hsl(var(--gold))]" />
                        <div>
                          <p className="font-heading text-[hsl(var(--gold))]">{campaign.name}</p>
                          {campaign.description && (
                            <p className="text-xs text-muted-foreground mt-1">{campaign.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {campaign.players?.length || 0} jugadores
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No hay campañas creadas</p>
                  <p className="text-sm mt-2">Haz clic en "Nueva Campaña" para empezar</p>
                </div>
              )}
            </div>

            {/* Shared files section */}
            {files.length > 0 && (
              <div>
                <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))] mb-3 flex items-center gap-2">
                  <File className="w-5 h-5" />
                  Archivos Compartidos
                </h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <FileRow
                      key={file.file_id}
                      file={file}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      onSelect={onFileSelect}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Folder view - show files
          <div className="space-y-6">
            {Object.keys(groupedFiles).length > 0 ? (
              Object.entries(groupedFiles).map(([folder, folderFiles]) => (
                <div key={folder}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    {folder}
                  </h4>
                  <div className="space-y-2">
                    {folderFiles.map((file) => (
                      <FileRow
                        key={file.file_id}
                        file={file}
                        onDownload={handleDownload}
                        onDelete={handleDelete}
                        onSelect={onFileSelect}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <File className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No hay archivos en esta carpeta</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[hsl(var(--background))] border border-[hsl(var(--gold))]/50 rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-border/30">
              <h3 className="font-heading text-lg text-[hsl(var(--gold))] flex items-center gap-2">
                <FolderPlus className="w-5 h-5" />
                Nueva Campaña
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Nombre de la campaña</label>
                <Input
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Ej: La Búsqueda del Anillo"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Descripción (opcional)</label>
                <textarea
                  value={newCampaignDescription}
                  onChange={(e) => setNewCampaignDescription(e.target.value)}
                  placeholder="Breve descripción de la campaña..."
                  className="w-full h-20 bg-black/20 border border-border rounded px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-border/30 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewCampaignModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={!newCampaignName.trim()}
                className="bg-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/90 text-black"
              >
                Crear Campaña
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// File row component
const FileRow = ({ file, onDownload, onDelete, onSelect }) => {
  const FileIcon = getFileIcon(file.content_type);
  
  return (
    <div 
      className="flex items-center gap-3 p-3 bg-black/10 rounded hover:bg-black/20 transition-colors group"
      data-testid={`file-${file.file_id}`}
    >
      <FileIcon className="w-8 h-8 text-[hsl(var(--magic-blue))]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.original_filename}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatBytes(file.size_bytes)}</span>
          <span>{formatDate(file.uploaded_at)}</span>
          {file.description && <span className="truncate">{file.description}</span>}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onSelect && (
          <Button variant="ghost" size="sm" onClick={() => onSelect(file)} className="h-8 w-8 p-0">
            <Scroll className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onDownload(file)} className="h-8 w-8 p-0">
          <Download className="w-4 h-4" />
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onDelete(file)} 
          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default FileManager;
