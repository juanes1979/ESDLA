/**
 * Storage Page
 * File management interface using GridFS
 */
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import FileManager from '@/components/FileManager';

const StoragePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/')}
          className="text-[hsl(var(--gold))]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-heading text-2xl text-[hsl(var(--gold))]">
          ALMACÉN DE ARCHIVOS
        </h1>
      </div>

      {/* File Manager */}
      <div className="flex-1">
        <FileManager 
          maestroId="default_maestro"
          allowUpload={true}
          showCreateCampaign={true}
        />
      </div>
    </div>
  );
};

export default StoragePage;
