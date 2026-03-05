/**
 * Storage Manager Component
 * Allows managing files and campaigns with hierarchical organization
 * Uses GridFS for persistent storage
 */
import { useState, useEffect } from 'react';
import { 
  Folder, FolderOpen, File, FileText, Image, FileJson, 
  Upload, Download, Trash2, Plus, RefreshCw, ChevronRight, ChevronDown,
  Users, Shield, Database, HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/services/api';

// File type icons
const FILE_ICONS = {
  'application/json': FileJson,
  'application/pdf': FileText,
  'image/png': Image,
  'image/jpeg': Image,
  'image/webp': Image,
  default: File
};

const StorageManager = ({ maestroId = 'default_maestro' }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [files, setFiles] = useState([]);
  const [fileTree, setFileTree] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  // New campaign form
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');

  useEffect(() => {
    loadData();
  }, [maestroId]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadCampaigns(),
        loadFileTree()
      ]);
    } catch (err) {
      console.error('Error loading storage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get(`/storage/stats?maestro_id=${maestroId}`);
      setStats(res.data.stats?.[0] || null);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadCampaigns = async () => {
    try {
      const res = await api.get(`/storage/campaigns/${maestroId}`);
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      console.error('Error loading campaigns:', err);
    }
  };

  const loadFileTree = async () => {
    try {
      const res = await api.get(`/storage/tree?maestro_id=${maestroId}`);
      setFileTree(res.data || {});
    } catch (err) {
      console.error('Error loading file tree:', err);
    }
  };

  const loadFiles = async (campaignId = null) => {
    try {
      let url = `/storage/list?maestro_id=${maestroId}`;
      if (campaignId) url += `&campaign_id=${campaignId}`;
      
      const res = await api.get(url);
      setFiles(res.data.files || []);
    } catch (err) {
      console.error('Error loading files:', err);
    }
  };

  const createCampaign = async () => {
    if (!newCampaignName.trim()) {
      toast.error('El nombre de la campaña es obligatorio');
      return;
    }
    
    try {
      const res = await api.post('/storage/campaigns', {
        maestro_id: maestroId,
        campaign_name: newCampaignName,
        description: newCampaignDesc
      });
      
      toast.success(`Campaña "${newCampaignName}" creada`);
      setNewCampaignName('');
      setNewCampaignDesc('');
      setShowNewCampaign(false);
      loadCampaigns();
      loadStats();
    } catch (err) {
      toast.error('Error al crear la campaña');
    }
  };

  const downloadBackup = async () => {
    try {
      window.open(`${api.defaults.baseURL}/storage/backup/${maestroId}`, '_blank');
      toast.success('Descargando backup...');
    } catch (err) {
      toast.error('Error al descargar backup');
    }
  };

  const deleteFile = async (fileId, filename) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return;
    
    try {
      await api.delete(`/storage/file/${fileId}`);
      toast.success('Archivo eliminado');
      loadFiles(selectedCampaign);
      loadStats();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFileIcon = (contentType) => {
    const Icon = FILE_ICONS[contentType] || FILE_ICONS.default;
    return <Icon className="w-4 h-4" />;
  };

  const renderFolderTree = (tree, path = '', level = 0) => {
    if (!tree || typeof tree !== 'object') return null;
    
    const entries = Object.entries(tree).filter(([key]) => !key.startsWith('_'));
    const files = tree._files || [];
    
    return (
      <div className={`${level > 0 ? 'ml-4' : ''}`}>
        {entries.map(([folderName, content]) => {
          const fullPath = path ? `${path}/${folderName}` : folderName;
          const isExpanded = expandedFolders[fullPath];
          
          return (
            <div key={fullPath}>
              <button
                className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded w-full text-left"
                onClick={() => toggleFolder(fullPath)}
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    <FolderOpen className="w-4 h-4 text-[hsl(var(--gold))]" />
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    <Folder className="w-4 h-4 text-[hsl(var(--gold))]" />
                  </>
                )}
                <span className="text-sm">{folderName}</span>
              </button>
              
              {isExpanded && (
                <div className="ml-4">
                  {renderFolderTree(content._folders || content, fullPath, level + 1)}
                  
                  {/* Files in this folder */}
                  {(content._files || []).map((file, i) => (
                    <div 
                      key={i}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded text-sm text-muted-foreground"
                    >
                      {renderFileIcon(file.content_type)}
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-xs">{formatBytes(file.size_bytes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Root level files */}
        {files.map((file, i) => (
          <div 
            key={i}
            className="flex items-center gap-2 py-1 px-2 hover:bg-white/5 rounded text-sm text-muted-foreground"
          >
            {renderFileIcon(file.content_type)}
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-xs">{formatBytes(file.size_bytes)}</span>
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-[hsl(var(--gold))]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="storage-manager">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-heading text-xl text-[hsl(var(--gold))]">Gestión de Archivos</h2>
          <p className="text-sm text-muted-foreground">Almacenamiento persistente con GridFS</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={downloadBackup}>
            <Download className="w-4 h-4 mr-2" /> Backup
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-parchment rounded-lg p-4 text-center">
          <Database className="w-8 h-8 mx-auto text-[hsl(var(--gold))] mb-2" />
          <p className="text-2xl font-bold text-[hsl(var(--gold))]">{stats?.total_files || 0}</p>
          <p className="text-xs text-muted-foreground">Archivos</p>
        </div>
        <div className="card-parchment rounded-lg p-4 text-center">
          <HardDrive className="w-8 h-8 mx-auto text-[hsl(var(--torch-orange))] mb-2" />
          <p className="text-2xl font-bold text-[hsl(var(--torch-orange))]">{stats?.total_mb || 0} MB</p>
          <p className="text-xs text-muted-foreground">Almacenamiento</p>
        </div>
        <div className="card-parchment rounded-lg p-4 text-center">
          <Shield className="w-8 h-8 mx-auto text-[hsl(var(--magic-blue))] mb-2" />
          <p className="text-2xl font-bold text-[hsl(var(--magic-blue))]">{campaigns.length}</p>
          <p className="text-xs text-muted-foreground">Campañas</p>
        </div>
        <div className="card-parchment rounded-lg p-4 text-center">
          <Users className="w-8 h-8 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold text-green-500">{stats?.character_count || 0}</p>
          <p className="text-xs text-muted-foreground">Personajes</p>
        </div>
      </div>

      {/* Campaigns Section */}
      <div className="card-parchment rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-lg text-[hsl(var(--magic-blue))]">Campañas</h3>
          <Button size="sm" onClick={() => setShowNewCampaign(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Campaña
          </Button>
        </div>

        {showNewCampaign && (
          <div className="mb-4 p-4 bg-black/20 rounded-lg space-y-3">
            <Input
              placeholder="Nombre de la campaña"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
            />
            <Input
              placeholder="Descripción (opcional)"
              value={newCampaignDesc}
              onChange={(e) => setNewCampaignDesc(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createCampaign}>Crear</Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewCampaign(false)}>Cancelar</Button>
            </div>
          </div>
        )}

        {campaigns.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No hay campañas creadas</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {campaigns.map(campaign => (
              <div 
                key={campaign.campaign_id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedCampaign === campaign.campaign_id 
                    ? 'border-[hsl(var(--gold))] bg-[hsl(var(--gold))]/10' 
                    : 'border-border/30 bg-black/10 hover:border-border/50'
                }`}
                onClick={() => {
                  setSelectedCampaign(campaign.campaign_id);
                  loadFiles(campaign.campaign_id);
                }}
              >
                <h4 className="font-medium text-[hsl(var(--gold))]">{campaign.name}</h4>
                {campaign.description && (
                  <p className="text-xs text-muted-foreground mt-1">{campaign.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {campaign.players?.length || 0} jugadores
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File Browser */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Tree View */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--torch-orange))] mb-4">Estructura de Archivos</h3>
          {Object.keys(fileTree).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No hay archivos</p>
          ) : (
            renderFolderTree(fileTree)
          )}
        </div>

        {/* File List */}
        <div className="card-parchment rounded-lg p-4">
          <h3 className="font-heading text-lg text-[hsl(var(--gold))] mb-4">
            Archivos {selectedCampaign && `(${campaigns.find(c => c.campaign_id === selectedCampaign)?.name})`}
          </h3>
          {files.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {selectedCampaign ? 'No hay archivos en esta campaña' : 'Selecciona una campaña'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {files.map(file => (
                <div 
                  key={file.file_id}
                  className="flex items-center gap-3 p-2 bg-black/10 rounded hover:bg-black/20"
                >
                  {renderFileIcon(file.content_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{file.original_filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)}</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => window.open(`${api.defaults.baseURL}/storage/download/${file.file_id}`, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => deleteFile(file.file_id, file.original_filename)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-[hsl(var(--magic-blue))]/10 border border-[hsl(var(--magic-blue))]/30 rounded-lg p-4">
        <h4 className="text-sm font-heading text-[hsl(var(--magic-blue))] mb-2">Estructura Jerárquica</h4>
        <div className="text-xs text-gray-300 font-mono">
          <p>/maestros/[maestro_id]/</p>
          <p className="ml-4">/campaigns/[campaign_id]/</p>
          <p className="ml-8">/players/[player_id]/</p>
          <p className="ml-12">/characters/[character_id]/</p>
          <p className="ml-16">- character_data.json</p>
          <p className="ml-16">- character_sheet.pdf</p>
          <p className="ml-8">/sessions/ - Registros de sesiones</p>
          <p className="ml-8">/maps/ - Mapas de campaña</p>
          <p className="ml-8">/documents/ - Documentos varios</p>
        </div>
      </div>
    </div>
  );
};

export default StorageManager;
