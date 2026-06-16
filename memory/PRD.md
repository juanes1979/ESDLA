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



## Iter 120 — Reescala de km, refundición del pathfinder y fix de PX (Jun 2026)

### Escala de distancias
- `COORD_TO_KM = 28.43` (antes 20) y `KM_PER_PERCENT = 28.43` (antes 1.974).
  Calibrado para Mithlond→Bree recta = 361,6 km.

### Esquema A — modelo de elección de ruta (`utils/pathfinding.py`)
`coste = distancia_km × mult_camino × mult_terreno × mult_tierra`
- **Camino**: grande 1.0 · mayor 1.1 · menor 1.25 · senda 1.5 · ninguno 2.0.
- **Terreno** (SOLO a campo a través; un camino lo anula → ×1.0): fácil 0.75 ·
  moderado 1.0 · difícil 1.5 · muy_difícil 2.0 · desalentador 3.0.
- **Tierra**: libres 0.9 · fronterizas 1.1 · salvajes 1.3 · sombra 2.5 · oscuras 3.5.
- **Sin barreras**: solo bloquean Infranqueable/Agua y SOLO a campo a través.
  Un camino/senda sobre infranqueable/agua/río se cruza a la velocidad del camino
  (terreno bajo ignorado).
- **Ríos** = agua: infranqueables salvo donde cruza un camino.
- **Opciones evitar** (penalización ×100 finita → se cruza si no hay otra vía):
  `avoid_shadow_lands`, `avoid_dark_lands`, `avoid_muy_dificil`, `avoid_desalentador`.
- **Evitar Caminos** (`avoid_roads`) para huida/modo directo.
- **Arranque consciente del destino** (`_find_best_nearby_road_point(point, end)`):
  engancha al camino cercano más próximo que NO aleje del destino → arregla el
  rodeo Casa Brandi→Casa de Beorn (1613 km → ~788 km).
- **Tramo final** sumado en `_build_result` para que la distancia llegue al destino.
- Nuevas casillas en JourneyConfig/PathDebugConfig y en la UI (`ConfigView.jsx`):
  `evitar_caminos`, `evitar_muy_dificil`, `evitar_desalentador`
  (testids: `travel-avoid-roads-switch`, `travel-avoid-veryhard-switch`,
  `travel-avoid-daunting-switch`, `travel-prefer-roads-switch`).
  Preferir/Evitar Caminos son mutuamente excluyentes.

### Esquema B — fix de PX (`routes/travel_routes.py`)
- BUG: `ROAD_TYPE_MAP` mapeaba `grande→camino_real`, pero la tabla usa
  `gran_camino` → 0 PX. Corregido (`grande→gran_camino`, `senda/sendero→sendas`).
- BUG: el bono de terreno se leía con `bonus_px_km`; la tabla usa `bonus_px`. Corregido.
- Verificado: Bree→Rivendel ahora da 454 PX (antes 0).
- PENDIENTE: definir cuántos PX dan los eventos de viaje (hoy 0 por defecto).

## Iter 123 — Reforma del módulo de creación de PNJ comerciante (3 fases) (Jun 2026)

### Datos (`routes/trading_npc_data.py`, NUEVO)
- 28 PROFESIONES (lista cerrada), 49+ RASGOS_NEGATIVOS y 49+ RASGOS_POSITIVOS
  (con descripción), 20 MODOS_HABLA.
- Coherencia por TAGS: cada rasgo lleva tags (suciedad, mala_artesania, caos,
  antimagia, magia_falsa, violencia, criminal, santo). `EXCLUSION_TAGS_RAZA` y
  `EXCLUSION_TAGS_PROFESION` prohíben tags incoherentes. Helpers: `rasgos_validos`,
  `elegir_rasgo_aleatorio`, `elegir_modo_hablar`. Test: `tests/test_trading_npc.py` (6 OK).

### Backend (`trading_routes.py`)
- `GET /trading/npc-meta` (profesiones, modos_habla, razas+subculturas de `cultures`, sexos, perfiles).
- `POST /trading/npc-meta/rasgos` {raza, profesion} → rasgos válidos (coherencia).
- `POST /trading/npcs/generate-name` → nombre IA (gpt-4o-mini) por raza/subcultura/sexo/profesión (con fallback).
- `POST /trading/npcs/generate-profile` → FASE 2: trasfondo unificado (gpt-4o) + retrato
  (gpt-image-1) con PREFIJO obligatorio "Boceto a lápiz de grafito tradicional…", guardado en GridFS.
- `GET /trading/npcs/{id}/portrait` → sirve el retrato (público, para <img>).
- `POST /trading/npcs/{id}/interaction` y `POST /trading/npcs/{id}/farewell` → FASE 3
  (historial estructurado en `npc_relationships.historial` + despedida IA según tono).
- `create_npc` reescrito: persiste raza/subcultura/sexo/edad/profesion/rasgo/modo_hablar/
  historia/retrato + AUTORRELLENO (nombre IA si vacío, rasgo aleatorio coherente, modo 50/50,
  edad coherente por `edad_min/max`+veteranía, `codigo_npc` = timestamp + nombre sin símbolos).
- Diálogo de negociación ahora usa contexto completo (rasgo+desc, modo_hablar+desc, subcultura, edad, historia).
- NOTA: la MATEMÁTICA del modificador de relación queda para la SIGUIENTE update (como pidió el usuario).

### Frontend (`TradingSystemSection.jsx`)
- `NpcEditorModal` reescrito: ubicación (selector)→región auto, raza→subcultura cascada, sexo,
  profesión, rasgo único (toggle Positivo/Negativo + select filtrado por coherencia), modo de
  hablar (automático), nombre + botón dados + edad auto, "Generar trasfondo + retrato", retrato preview.
- Calculadora: gate "jugador físicamente presente" — bloquea Calcular si `character.ubicacion_actual.id`
  ≠ `npc.ubicacion_id` (solo cuando ambos datos existen). Botón "Terminar de comerciar" + despedida IA.
- VERIFICADO en navegador: región autofill, cascada raza→subcultura, nombre IA, coherencia,
  guardado e2e (autorrelleno OK), gate de presencia bloqueando.
- PENDIENTE DE PRUEBA MANUAL (no se pulsó en navegador para ahorrar coste IA): botón
  "Generar trasfondo + retrato" (imagen) y "Terminar de comerciar" (despedida).

## Iter 122 — Compra-Venta aplica al personaje + acceso desde Inicio (Jun 2026)

### Backend — `POST /api/trading/confirm-transaction`
Aplica una transacción YA negociada al personaje (reutiliza endpoints de equipo):
- COMPRA: valida y descuenta dinero (helpers de moneda mo/mp/mc/me) y añade el
  artículo (`add_equipment_to_character` con is_purchase=False). Aviso si es montura
  (necesita silla/arnés/alforjas; solo Elfos montan a pelo).
- VENTA: elimina el artículo (`remove_equipment_from_character`) y suma el dinero.
  - Venta de MONTURA: mueve su `equipo` al inventario del personaje + avisos de carga.
  - Venta de mochila/petate: avisa si no hay alforjas en una montura.
  - Recalcula `_compute_weight_summary` → avisos de Cargado / Muy Cargado / inmóvil
    (peso > capacidad) / montura sobrecargada.
- Verificado vía curl: compra (95 mp), venta (conversión exacta a mo/mp), venta de
  montura con traspaso de carga + MUY CARGADO, venta de mochila sin alforjas.

### Frontend — `TradingSystemSection.jsx`
- Selector de **jugador** (búsqueda mientras escribo por nombre de personaje/jugador),
  filtrado por rol vía `/characters/` (Maestro todos, DJ los suyos). testids:
  `trade-player-search`, `trade-player-dropdown`, `trade-selected-character`.
- Botón **Confirmar transacción** (aparece con resultado acepta/contraoferta), aplica
  la operación y muestra los avisos devueltos. testids: `trade-confirm-btn`,
  `trade-confirm-counter-btn`, `trade-confirm-warnings`.
- FIX: `/characters` → `/characters/` (evita 307→http = Mixed Content que vaciaba la lista).
- NOTA: la lógica "espejo" Comprar↔Vender queda APARCADA a petición del usuario
  (prepara otra forma de tienda).

### Acceso desde pantalla principal
- Nueva ruta `/comercio` (solo STAFF) con `TradingPage.jsx` (reutiliza la sección).
- Nuevo medallón "Compra-Venta" en `HomePage` (icono lucide `Coins`, solo Maestro/DJ).
  `FloatingNavIcon` ahora soporta `item.icon` cuando no hay `item.image`.
- (En el futuro se integrará en la Pantalla del DJ.)

## Iter 121 — Fix peso por item en Gestión de Equipamiento (Jun 2026)
- BUG: en la "Tabla de Portadores" (`DistributionView.jsx`) los objetos sin
  `peso_kg` persistido (Capa de viaje, Muda fina, Cota de anillas, Botas…)
  mostraban `0.00 KG`. El backend (`equipment.py::get_weight`) ya resolvía el
  peso desde el catálogo, pero el frontend leía `raw.peso_kg` directo.
- FIX: `EquipmentManagerModal.jsx` construye `catalogWeights` (mapa
  nombre-normalizado→peso_kg de TODO el catálogo) y lo pasa a
  `DistributionView`, que resuelve el peso por nombre cuando el item no lo trae.
- Verificado en navegador: pesos correctos (Mochila 1.35, Cota de anillas 22.30,
  Odre semilleno 8.90…). NOTA: "Raciones (1 día)" sigue 0.00 por hueco del
  catálogo (solo existe "Raciones (1 día) (Paquete de 10)"), no es regresión.

### Mapa
- Eliminado el cálculo de ruta del Mapa del Maestro (vive solo en el Generador).
- Iconos de ubicación a partir de zoom ≥1200% (fontSize 374×inverseZoom).
- Paneles del mapa: `max-h-[calc(100%-2rem)]` + footer fijo (scroll completo).
- `PlayerMap.jsx`: filtros (región/tipo/búsqueda) solo-lectura + "Imprimir mapa"
  (PDF A4 horizontal vía @media print, solo el mapa visible).
