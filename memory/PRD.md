# LOTR 5e RPG — Producto / PRD

## Visión
Aplicación web full-stack para una versión modificada de "Lord of the Rings 5e" (TTRPG):
gestión completa de personajes, mapas, viajes, combate, NPC, campañas y editor de mundo.

## Estado actual (Feb 2026)
- ✅ Autenticación (JWT, roles Maestro/DJ/Jugador, aprobación manual).
- ✅ Aislamiento BD (`owner_id` por entidad).
- ✅ Mapa interactivo de Tierra Media (v3, 19791×15133 px).
- ✅ Sistema de viajes con A* (terrenos, caminos, ríos, barreras).
- ✅ Iter 118 — Caminos sobre infranqueable se tratan como pasos/puentes.
- ✅ Iter 119 — Editor de terreno **raster** (2000×1536) sustituye al de polígonos.

## Iter 119 — Sistema raster de terreno (Feb 2026)
Reemplaza el sistema de polígonos vectoriales (frágil, con solapes y bugs en
operaciones booleanas) por una rejilla raster de celdas. Cada celda pertenece a
**un único** tipo de dificultad y **un único** tipo de tierra — solapes
imposibles por diseño.

### Backend
- `routes/terrain_grid_routes.py`
  - `GET    /api/terrain-grid` → carga rejilla zlib+base64.
  - `PUT    /api/terrain-grid` → guarda rejilla completa.
  - `POST   /api/terrain-grid/migrate-from-polygons` → rasteriza polígonos legacy.
  - `GET    /api/terrain-grid/export-png?layer=difficulty|land_type` → PNG transparente.
  - `POST   /api/terrain-grid/import-png` → reemplaza una capa desde PNG.
  - `GET    /api/terrain-grid/lookup?x&y` → debug: valor en una coordenada.
- `utils/pathfinding.py`
  - Nuevo helper `load_terrain_grid_kwargs(db)`.
  - `MiddleEarthPathfinder` ahora acepta `terrain_grid`, `land_grid`,
    `grid_width`, `grid_height`. Lookup O(1) si están presentes.
  - Polígonos legacy quedan como fallback si la rejilla no está cargada.

### Frontend
- `pages/TerrainGridEditor.jsx` — nuevo editor en `/terrain-editor`.
  - Capas: Dificultad (7 tipos) / Tipo de tierra (5 tipos).
  - Herramientas: Pincel, Goma, Bote (flood fill 4-conectado clásico).
  - Slider de radio del pincel (1-80 celdas), opacidad ajustable.
  - Atajos: 1-7 color · B/E/G herramientas · L capa · Ctrl+Z/Y · Ctrl+S.
  - Render: Canvas 2D con ImageData escalada `image-rendering: pixelated`.
  - Export/Import PNG transparente (Photoshop round-trip).
  - Botón "Migrar polígonos" rasteriza el sistema legacy a la rejilla.
  - Persistencia comprimida con `pako` (zlib JS).
- `pages/TerrainEditor.jsx` queda accesible en `/terrain-editor-legacy`
  (modo lectura/edición legacy). Polígonos NO se borran de Mongo.

### Estado de migración
- Rasterización inicial ejecutada: 1315 polígonos de dificultad → rejilla.
- Tamaño en BD: difficulty ≈ 62 KB (zlib comprimido), land_type ≈ 3 KB.
- `terrain_polygons` y `land_type_zones` siguen en BD por seguridad.

## Tests
- 23 tests pasan (1 preexistente fallando, no es regresión).
- Tests añadidos:
  - `test_clip.mjs` (legacy, polígonos clipping).
  - Geométricos del bote y de la unión (en consola, no en pytest).

## Backlog
### P1
- Pantalla del Director de Juego (Pantalla del DJ): tracker en vivo de
  iniciativa, HP, condiciones y combate.
- Subida de mapas/PDFs por DJ a sus campañas.
- Colisión de etiquetas en `MiddleEarthMap.jsx` (auto-hide por zoom).

### P2 — Refactor
- `data_routes.py` (5000+ líneas) → desglosar por dominio.
- `RulesPage.jsx` (4900+ líneas).
- `TerrainEditor.jsx` (legacy) — eliminar cuando se confirme estabilidad
  del raster.

## Decisiones técnicas clave
- Resolución de rejilla: **2000×1536** (≈10 px reales por celda, fino).
- Compresión: zlib level 6 + base64. ≈40 KB típicos en BD.
- Pathfinding usa O(1) lookup en rejilla; fallback a polígonos si no hay grid.
- Photoshop round-trip: PNG con paleta indexada por proximidad (tolerancia 40).


## Iter 120 — Viajes, monturas y acampada (Feb 2026)

### Velocidad por segmento (P0)
- `travel_routes.py::calculate_journey` calcula días **segmento a segmento**:
  - Velocidad de grupo = `min(velocidad_efectiva)` por tramo (regla del más lento).
  - Monturas BLOQUEADAS off-road en terreno `infranqueable`, `muy_dificil`,
    `desalentador` o `agua`. Si el segmento está sobre un camino (gran/menor/
    senda), las monturas se permiten aunque el terreno subyacente sea hostil.
  - Respuesta incluye `velocidad_grupo.segmentos_velocidad` (log por tramo) y
    `velocidad_grupo.km_a_pie_forzado` (km que cada montado tuvo que caminar).
- `pathfinding.py::_reconstruct_path` ahora aplica el override de carretera
  también al coste del segmento → evita `inf` en respuestas JSON.

### Trazado del path (P1)
- `MiddleEarthMap.jsx::renderRoute` usa interpolación cuadrática entre
  mid-points (Bézier suave) en vez de líneas rectas → camino más natural.

### Clima Rivendel (P2)
- Ampliados `match_keywords` de las regiones de clima Eriador, Gondor, Rohan,
  Mordor, Rhovanion, Bosque Negro, Colinas de Hierro y Forodwaith.
  - 255/255 localizaciones resuelven región climática.

### Acampada — nueva mecánica del centinela (P1)
- Implementado en `CampDialog.jsx::performCamp`.
- El centinela tira **una vez por evento nocturno** (Sab/Per CD 12, +2 si
  papel "vigía"):
  - Éxito → evento ANULADO (no suma CD).
  - Pifia (1) o fallo por 5+ → vigía gana `+0,5` cansancio personal.
  - 20 natural → éxito por 5+ automático.

## Iter 121 — Limpieza legacy + POC refactor NPC (Feb 2026)

### Limpieza editor de terreno legacy (DONE)
- Borrado `TerrainEditor.jsx` (1904 líneas) y la ruta `/terrain-editor-legacy` en `App.js`.
- Eliminados endpoints `/data/terrain-zones`, `/data/terrain-polygons`,
  `/data/land-type-zones` de `data_routes.py`.
- `pathfinding.py`: quitado el parámetro `terrain_polygons` y las funciones
  `_point_in_polygon` / fallbacks. El raster grid es ahora la única fuente
  de verdad.
- `travel_routes.py`: eliminado `get_terrain_polygons()`, helpers de
  polígonos y todas las llamadas. `/api/travel/terrain-at/{x}/{y}` ahora
  lee directamente del grid.
- `terrain_grid_routes.py`: eliminado `/migrate-from-polygons` y el helper
  `_rasterize_polygon`.
- Colecciones MongoDB `terrain_zones`, `terrain_polygons`, `land_type_zones`
  y `terrain_polygons_legacy` borradas.
- Tests obsoletos eliminados de `tests/test_terrain_path_debugger.py`.

### POC refactor data_routes.py — NPCs
- Creado `routes/npc_routes.py` (263 líneas) con los 6 endpoints NPC
  (GET list/by-id, POST, PATCH, DELETE, COPY). Bug arreglado: PATCH no
  devolvía el documento actualizado.
- `data_routes.py` baja de 4998 → 4617 líneas.
- Registrado el nuevo router en `server.py`.

## Iter 122 — Tipos de ubicación + Anti-colisión etiquetas (Feb 2026)

### Tipos de ubicación
- Unificadas 26 ubicaciones con tipos huérfanos a tipos canónicos
  (aldea→pueblo, bahia→puerto, colina→colinas, paso→paso_montaña, etc.).
- 16 tipos eliminados; 11 nuevos añadidos con icono y nombre legible en
  `frontend/src/components/map/mapConstants.js`: cascada, ciudad_lago,
  cueva, isla, llanura, mina, paramo, peninsula, puente, puerta, túmulos,
  valle. Total de tipos: 43.

### Anti-colisión de etiquetas en `MiddleEarthMap.jsx`
- `labelVisibleIds` (useMemo) calcula qué etiquetas se muestran en cada
  zoom usando bounding boxes y prioridad por tipo.
- Pasada greedy: ordena por (LABEL_PRIORITY[tipo] + refugio_bonus) desc,
  acepta si no solapa con ninguna anterior.
- Excepciones siempre visibles: selección, origen y destino del viaje.
- El marcador sigue visible aunque la etiqueta se descarte — solo se
  oculta el texto.


- Tests curl: list/create/get/update/copy/delete OK.


- Si TODAS las tiradas son éxito por 5+ → descanso del grupo `-1 CD` (en vez
  de `-0,5`). Se envía como `fatiga_cd_decrement` al endpoint
  `POST /api/travel/journey/{id}/camp`.
- UI: nuevo panel `camp-watchman-panel` con desglose por tirada, NAT20/PIFIA
  destacados, eventos marcados como "Anulado por el centinela".

