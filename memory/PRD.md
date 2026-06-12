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
