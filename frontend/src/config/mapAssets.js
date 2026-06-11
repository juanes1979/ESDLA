/**
 * Mapas centrales de la app — un único punto de configuración para poder
 * REVERTIR fácilmente entre versiones del mapa de la Tierra Media.
 *
 * Para revertir: cambia las constantes ACTIVAS de vuelta a la sección
 * "LEGACY" comentada justo debajo. NO BORRES los archivos antiguos
 * de /app/frontend/public/ ni las URLs originales — se quedan ahí como
 * fallback permanente.
 *
 * Las coordenadas de las ubicaciones están en píxeles absolutos sobre el
 * sistema 19791x15133, así que cualquier mapa que mantenga esas
 * dimensiones encajará exactamente.
 */

// ============================================================================
// 🟢 VERSIÓN ACTIVA (prueba de junio 2026 — peso reducido)
// ============================================================================
//   Dimensiones: 19791 x 15133 px (idénticas a la anterior)
//   Peso: 39 MB (vs 91 MB anterior). Mismo encuadre y proyección.
//   Origen: subida por el usuario vía WeTransfer.
export const MAESTRO_MAP_URL = '/mapa_nuevo_v2.jpg';
export const PLAYER_MAP_URL = '/mapa_nuevo_v2.jpg';

// ============================================================================
// 🔄 LEGACY — para revertir, sustituye las constantes de arriba por estas
// ============================================================================
// Mapa Maestro original (asset Emergent — permanente):
//   const MAESTRO_MAP_URL = 'https://customer-assets.emergentagent.com/job_c7e3a7c3-5d85-46bd-b91f-9f0c34045f08/artifacts/8bm4010y_Tierra%20Media.jpg';
//
// Mapa Jugadores original (archivo local conservado):
//   const PLAYER_MAP_URL = '/mapa_jugadores.jpg';
