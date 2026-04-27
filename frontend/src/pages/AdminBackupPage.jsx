/**
 * Admin Backup / Restore page.
 *
 * Protected by a shared token (X-Admin-Token). The token is stored in
 * localStorage once verified so the user does not have to retype it on each
 * visit. When the role-based auth system lands, this will be moved behind a
 * proper Maestro role.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, Download, Upload, Lock, AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';

const TOKEN_STORAGE_KEY = 'lotr5e_admin_token';

const AdminBackupPage = () => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_STORAGE_KEY) || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreMode, setRestoreMode] = useState('replace');
  const [restoreSummary, setRestoreSummary] = useState(null);

  // Auto-verify saved token on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) {
      verifyToken(saved, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyToken = async (tk, silent = false) => {
    setVerifying(true);
    try {
      await api.post('/admin/verify-token', null, {
        headers: { 'X-Admin-Token': tk },
      });
      setAuthenticated(true);
      localStorage.setItem(TOKEN_STORAGE_KEY, tk);
      if (!silent) toast.success('Token válido. Acceso concedido.');
    } catch (err) {
      setAuthenticated(false);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (!silent) toast.error('Token inválido.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/admin/backup', {
        headers: { 'X-Admin-Token': token },
      });
      const data = res.data;

      // Save info for the UI
      setLastBackupInfo({
        generatedAt: data.generated_at,
        dbName: data.db_name,
        collections: Object.keys(data.collections || {}).length,
        totalDocs: Object.values(data.counts || {}).reduce((a, b) => a + b, 0),
        counts: data.counts || {},
      });

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.href = url;
      a.download = `lotr5e_backup_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Copia descargada · ${lastBackupInfo?.totalDocs || ''} documentos.`);
    } catch (err) {
      console.error(err);
      toast.error(`Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error('Selecciona un archivo JSON primero.');
      return;
    }
    if (
      !window.confirm(
        `¿Restaurar la base de datos en modo "${restoreMode}"? ` +
          (restoreMode === 'replace'
            ? 'Esto BORRARÁ todas las colecciones antes de insertar.'
            : 'Esto fusionará el contenido por _id.')
      )
    ) {
      return;
    }
    setRestoring(true);
    setRestoreSummary(null);
    try {
      const text = await restoreFile.text();
      const payload = JSON.parse(text);
      const res = await api.post(
        `/admin/restore?mode=${restoreMode}`,
        payload,
        { headers: { 'X-Admin-Token': token } }
      );
      setRestoreSummary(res.data.summary || {});
      toast.success(
        `Restauración completada (${res.data.mode}). ${
          Object.keys(res.data.summary || {}).length
        } colecciones procesadas.`
      );
    } catch (err) {
      console.error(err);
      toast.error(`Error en restauración: ${err.response?.data?.detail || err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken('');
    setAuthenticated(false);
    setLastBackupInfo(null);
    setRestoreSummary(null);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="card-parchment max-w-md w-full" data-testid="admin-login-card">
          <CardHeader>
            <CardTitle className="text-xl text-[hsl(var(--gold))] flex items-center gap-2">
              <Lock className="w-6 h-6" />
              Panel de Administración
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta zona contiene acciones destructivas (backup / restauración de la base de
              datos). Hasta que llegue el sistema de roles, está protegida con un token compartido.
            </p>
            <div>
              <Label htmlFor="admin-token-input" className="text-sm">
                Token de admin
              </Label>
              <Input
                id="admin-token-input"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && token && verifyToken(token)}
                placeholder="Introduce el token..."
                className="font-mono"
                autoFocus
                data-testid="admin-token-input"
              />
            </div>
            <Button
              onClick={() => verifyToken(token)}
              disabled={!token || verifying}
              className="w-full"
              data-testid="admin-token-submit"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Acceder
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[hsl(var(--gold))] flex items-center gap-3">
          <Database className="w-8 h-8" />
          Backup &amp; Restauración
        </h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="admin-logout-btn">
          Cerrar sesión
        </Button>
      </div>

      {/* Backup Card */}
      <Card className="card-parchment">
        <CardHeader>
          <CardTitle className="text-xl text-emerald-300 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Descargar copia de seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Genera un archivo JSON con TODA la base de datos (locations, characters, climate,
            travel rules, etc.). Guárdalo en un lugar seguro — es tu seguro frente a errores.
          </p>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="admin-download-btn"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {downloading ? 'Generando...' : 'Descargar copia ahora'}
          </Button>

          {lastBackupInfo && (
            <div className="mt-3 p-3 rounded bg-emerald-900/20 border border-emerald-500/30 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-bold">Última copia descargada</span>
                <Badge variant="outline">
                  {new Date(lastBackupInfo.generatedAt).toLocaleString('es-ES')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                BD: <strong>{lastBackupInfo.dbName}</strong> · {lastBackupInfo.collections}{' '}
                colecciones · {lastBackupInfo.totalDocs} documentos
              </p>
              <ScrollArea className="h-32">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-[11px]">
                  {Object.entries(lastBackupInfo.counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => (
                      <div
                        key={name}
                        className="flex justify-between bg-black/20 px-2 py-0.5 rounded"
                      >
                        <span className="truncate">{name}</span>
                        <span className="font-mono text-emerald-300">{count}</span>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Card */}
      <Card className="card-parchment border-2 border-red-500/40">
        <CardHeader>
          <CardTitle className="text-xl text-red-300 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Restaurar copia de seguridad
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded bg-red-900/20 border border-red-500/30 flex gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-red-300 mb-1">Acción destructiva</p>
              <p className="text-muted-foreground">
                En modo <strong>"replace"</strong>, todas las colecciones del JSON serán
                <strong> borradas y sobreescritas</strong> con el contenido del archivo. Asegúrate
                de tener una copia reciente antes.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Archivo JSON de copia</Label>
              <Input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="cursor-pointer"
                data-testid="admin-restore-file-input"
              />
              {restoreFile && (
                <p className="text-xs text-muted-foreground mt-1">
                  {restoreFile.name} · {(restoreFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm">Modo</Label>
              <Select value={restoreMode} onValueChange={setRestoreMode}>
                <SelectTrigger data-testid="admin-restore-mode-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="replace">
                    Replace — borra cada colección antes de insertar
                  </SelectItem>
                  <SelectItem value="merge">
                    Merge — upsert por _id (mantiene docs no incluidos)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleRestore}
            disabled={restoring || !restoreFile}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="admin-restore-btn"
          >
            {restoring ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {restoring ? 'Restaurando...' : 'Restaurar copia'}
          </Button>

          {restoreSummary && (
            <div className="mt-3 p-3 rounded bg-black/20 border border-border/40">
              <p className="font-bold text-sm mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Resumen de la restauración
              </p>
              <ScrollArea className="h-40">
                <div className="space-y-1 text-xs font-mono">
                  {Object.entries(restoreSummary).map(([name, s]) => (
                    <div
                      key={name}
                      className="grid grid-cols-5 gap-2 px-2 py-1 rounded bg-black/20"
                    >
                      <span className="col-span-2 truncate">{name}</span>
                      <span className="text-muted-foreground">→ {s.before}</span>
                      <span className="text-emerald-400">+{s.inserted}</span>
                      <span className="text-blue-400">~{s.updated}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Columnas: nombre · documentos antes · insertados · actualizados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="card-parchment opacity-80">
        <CardHeader>
          <CardTitle className="text-base text-yellow-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recomendaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            • Haz una <strong>copia ANTES</strong> de cualquier cambio importante (importar
            mapas, editar reglas, instalar parches…).
          </p>
          <p>
            • Las copias son JSON puro: puedes editarlas a mano si lo necesitas, pero ten cuidado
            con la consistencia entre colecciones (referencias por id).
          </p>
          <p>
            • El token vive en <code>backend/.env</code> como <code>ADMIN_BACKUP_TOKEN</code>.
            Cámbialo si se filtra.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBackupPage;
