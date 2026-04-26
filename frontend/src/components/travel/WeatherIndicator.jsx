/**
 * WeatherIndicator — Visor meteorológico para la pantalla de Viaje.
 *
 * Calcula y muestra un icono de tiempo (☀️ ☁️ 🌧 ❄️ 🌫️ ⛈️) y datos clave
 * (temperatura mín/máx, viento, % lluvia/nieve/niebla) para una ubicación
 * en un mes determinado, consultando el sistema de clima vía API.
 *
 * Acepta el mes en formato élfico (Nénimë…) o abreviado (Ene…).
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';

// Map Elvish month IDs -> Spanish abbreviations used in climate data
const ELDARIN_TO_ABBREV = {
  'Nénimë': 'Ene', 'Súlimë': 'Feb', 'Coiviennë': 'Mar', 'Víressë': 'Abr',
  'Lótessë': 'May', 'Nárië': 'Jun', 'Cermië': 'Jul', 'Urimë': 'Ago',
  'Yavannië': 'Sep', 'Narquelië': 'Oct', 'Hísimë': 'Nov', 'Ringarë': 'Dic',
};

const MONTH_ABBREVS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function normalizeMonth(input) {
  if (!input) return null;
  if (MONTH_ABBREVS.includes(input)) return input;
  if (ELDARIN_TO_ABBREV[input]) return ELDARIN_TO_ABBREV[input];
  // Try first 3 chars
  const m = input.slice(0, 3);
  return MONTH_ABBREVS.includes(m) ? m : null;
}

const WeatherIndicator = ({ locationId, mes, dia, compact = false, label = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mesAbbrev = normalizeMonth(mes);

  useEffect(() => {
    if (!locationId || !mesAbbrev) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ mes: mesAbbrev });
    if (dia) params.append('dia', String(dia));
    api.get(`/climate/icon/location/${locationId}?${params.toString()}`)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch(err => { if (!cancelled) setError(err.response?.data?.detail || err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [locationId, mesAbbrev, dia]);

  if (!locationId || !mesAbbrev) return null;

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`} data-testid="weather-indicator-loading">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return null; // silently hide if no climate data
  }

  const tooltip = [
    label || data.climate_region,
    data.temp_min !== undefined && data.temp_max !== undefined ? `${data.temp_min}°C — ${data.temp_max}°C` : null,
    data.viento_kmh !== undefined ? `Viento: ${data.viento_kmh} km/h ${data.dir_viento || ''}`.trim() : null,
    data.pct_lluvia !== undefined ? `Lluvia: ${data.pct_lluvia}%` : null,
    data.pct_nieve_helada ? `Nieve/Helada: ${data.pct_nieve_helada}%` : null,
    data.pct_niebla ? `Niebla: ${data.pct_niebla}%` : null,
    data.notas ? `· ${data.notas}` : null,
  ].filter(Boolean).join(' | ');

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-sm"
        title={tooltip}
        data-testid="weather-indicator-compact"
      >
        <span className="text-base leading-none">{data.icon}</span>
        <span className="text-xs text-muted-foreground">{data.label}</span>
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/30 rounded-md border border-border/30"
      title={tooltip}
      data-testid="weather-indicator"
    >
      <span className="text-2xl leading-none" data-testid="weather-indicator-icon">{data.icon}</span>
      <div className="text-xs">
        <div className="text-[hsl(var(--gold))] font-medium leading-tight" data-testid="weather-indicator-label">{data.label}</div>
        <div className="text-muted-foreground leading-tight">
          {data.temp_min !== undefined && `${data.temp_min}° / ${data.temp_max}°`}
          {data.viento_kmh !== undefined && ` · ${data.viento_kmh} km/h ${data.dir_viento || ''}`}
        </div>
      </div>
    </div>
  );
};

export default WeatherIndicator;
