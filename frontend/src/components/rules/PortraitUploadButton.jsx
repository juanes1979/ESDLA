/** Botón reutilizable para subir una imagen (JPG/PNG) como retrato. */
import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const PortraitUploadButton = ({ onFile, label = 'Subir imagen (JPG/PNG)', testid = 'portrait-upload' }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const handle = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Selecciona una imagen (JPG o PNG)'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('La imagen supera el máximo de 10 MB'); return; }
    setBusy(true);
    try {
      await onFile(f);
      toast.success('Retrato actualizado');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'No se pudo subir la imagen');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handle} data-testid={`${testid}-input`} />
      <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} data-testid={`${testid}-btn`}>
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} {label}
      </Button>
    </>
  );
};

export default PortraitUploadButton;
