/**
 * AuthenticatedImage — carga una imagen desde un endpoint que requiere
 * Authorization: Bearer. Funciona descargando el blob con `fetch`+token y
 * creando un `objectURL` que se asigna al `<img>`.
 *
 * Uso típico para `/api/storage/download/{file_id}`:
 *   <AuthenticatedImage fileId={id} alt="..." className="..." />
 *
 * Limpia el objectURL al desmontar para no perder memoria.
 */
import { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const getToken = () =>
  localStorage.getItem('lotr5e_token') || sessionStorage.getItem('lotr5e_token');

const AuthenticatedImage = ({
  fileId,
  url,
  alt = '',
  className = '',
  fallbackClassName = '',
  onLoaded,
  ...rest
}) => {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl = null;

    const load = async () => {
      setError(false);
      setLoading(true);
      try {
        const target = url || `${BACKEND_URL}/api/storage/download/${fileId}`;
        const token = getToken();
        const res = await fetch(target, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        if (onLoaded) onLoaded(objectUrl);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (fileId || url) load();
    else setLoading(false);

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, url]);

  if (!fileId && !url) {
    return (
      <div
        className={`flex items-center justify-center bg-black/40 text-amber-300/40 ${fallbackClassName || className}`}
        data-testid="authimg-empty"
      >
        <ImageIcon className="w-8 h-8" />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center bg-black/40 text-amber-300/60 ${className}`}
        data-testid="authimg-loading"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div
        className={`flex items-center justify-center bg-black/40 text-rose-400/70 ${className}`}
        data-testid="authimg-error"
      >
        <ImageIcon className="w-8 h-8 opacity-40" />
      </div>
    );
  }

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={src} alt={alt} className={className} {...rest} />;
};

export default AuthenticatedImage;
