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

## Jun 2026 — Grupos de equipo dinámicos + Equipo corporal
### Grupos de objetos personalizados (Equipo → "Precios de Equipo", solo Maestro)
- Backend (`data_routes.py`): definiciones en `equipment_catalog._custom_categories`
  `[{key, name, fields[], section:"<título>"|"__root__", icono}]`.
  - `GET  /api/data/equipment-custom-categories`
  - `POST /api/data/equipment-custom-category` (slug único, sufijo _2/_3; whitelist de campos `_ALLOWED_GROUP_FIELDS`)
  - `PUT  /api/data/equipment-custom-category/{key}` (renombrar/recampos/sección)
  - `DELETE /api/data/equipment-custom-category/{key}` (borra def + `$unset` ítems)
  - Rutas con prefijo `equipment-custom-category` para evitar colisión con `/equipment/{categoria}/{item_nombre}`.
  - `get_equipment_catalog` incluye ítems custom y devuelve `_custom_categories`.
- Frontend (`EquipmentSection.jsx`): `sections` fusiona `EQUIPMENT_SECTIONS` + grupos custom (dentro de sección o raíz). Botón `create-group-btn`, `GroupEditorModal` (nombre/icono/sección/campos), botones Editar/Borrar por grupo, grupos vacíos visibles para admin, columna "Posición".
- `EquipmentEditor.jsx` ("Crear Equipo"): lista grupos custom con prefijo 🧩; `FIELD_CONFIG` incluye `posicion`.
- "Ropa" sembrada como grupo raíz individual (`scripts/seed_ropa_group.py`, 28 prendas).
### Interruptor "Es equipo corporal" (editor de ítem universal)- En `ItemEditorModal`: checkbox `field-es-corporal` que muestra `field-posicion`
  (cabeza/cuerpo/brazos/piernas/pies); persiste `posicion` + `es_corporal` en cualquier categoría
  (p. ej. yelmos). Modelo `EquipmentItem` ampliado con `posicion` y `es_corporal`.
- Opción A (armadura/yelmo/escudo) ya implementada en `character/equipment.py` (exclusividad por grupo) y auto-equipado de ropa en `finalize_character`.
- ⚠️ Fix regresión: la inserción de endpoints había partido `delete_equipment_item` (no guardaba/return); restaurado y verificado.
- Validado por testing agent (iteration_82.json): 100% backend + frontend.

## Jun 2026 — Equipo: auto-equip ropa, pesos y "Ropa complementaria" (capas)
- **Bug auto-equip + pesos**: el equipo inicial llegaba sin `categoria/peso_kg/posicion`,
  así que la ropa no se auto-equipaba ni se calculaba el peso (0.00 kg).
  - Nuevo helper `backend/utils/equipment_enrich.py`: `build_catalog_index`,
    `enrich_items` (rellena por nombre desde el catálogo), `auto_equip_ropa`.
  - `finalize_character` (drafts.py) enriquece inventario/equipo_* y auto-equipa antes de insertar.
  - Migración `scripts/fix_clothing_weights_equip.py`: enriqueció 46 personajes y marcó 5 capas como complementarias.
  - Verificado determinista: personaje nuevo finalizado → muda+capa+botas activas con pesos correctos.
- **Ropa complementaria (capas)**: campo `ropa_complementaria` en `EquipmentItem`;
  checkbox en el editor de ítems (solo categoría ropa, `field-ropa-complementaria`).
  - `_grupo_exclusivo` (character/equipment.py): ropa complementaria → no exclusiva (se lleva
    sobre otra prenda); ropa base → exclusiva por posición `ropa_<posicion>`; armadura/yelmo/escudo igual.
  - Capas del catálogo (nombre "capa…") marcadas como complementarias por defecto.
- Validado: testing agent iteration_85 (backend 100%) + verificación determinista de finalize.
- **Paquetes/raciones**: `enrich_items` reconoce nombres con sufijo "(Paquete de N)";
  el inventario "Raciones (1 día)" (cantidad 10) coincide con el catálogo
  "Raciones (1 día) (Paquete de 10)" (0.9 kg) → peso por unidad 0.09/día (×10 = 0.9 kg).
  Items de paquete completo ("Antorchas (paquete de 10)") coinciden exactos. Migración re-ejecutada.

## Jun 2026 — Tienda D100: moneda real por artículo (fix)
- Bug: el desplegable de artículos mostraba todo en 'mp' (plata). Cada artículo del catálogo
  tiene su `moneda` (mo/mp/mc/me). Fix en `TiendaD100.jsx`: `fmt(n, moneda)`, desplegable muestra
  `it.moneda`, etiqueta "Precio base (<moneda>)" dinámica, resultados de negociación en la moneda
  del artículo, y `confirm-transaction` recibe la moneda real (el backend ya convertía con COIN_VALUES).
- Pulido: chips de PNJ/ubicación sin "()" ni "(null)" cuando faltan profesión/región.
- Validado: testing agent iteration_86 (frontend 100%).


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

## Iter 125 — Excel completo + Profesión en equipo (quién vende qué) (Jun 2026)

### Punto 1 — Excel del catálogo de equipo (export / plantilla / import)
- CAUSA del desajuste: el tipo de daño se guarda en `modificador` pero el Excel
  exportaba `tipo_dano` (vacío). Reescrito para exportar TODOS los campos del sistema.
- `_equipment_columns()` = columnas base completas + cualquier campo extra hallado en
  los items (nada se queda fuera). Export, plantilla e import comparten las MISMAS columnas.
- Campos lista (`profesiones`, `regiones_disponibles`, `nivel_asentamiento`) se serializan
  con " | " y se reparsean al importar (acepta | , ;). Verificado round-trip export→import.
- `EquipmentItem` ampliado: profesiones, nivel_asentamiento, regiones_disponibles, ca_bonus,
  propiedades, tipo_dano, pasajeros, capacidad_kg, es_racion_diaria, unidades_paquete, racion_valor.

### Punto 2 — Profesión en el equipo (filtra qué vende cada PNJ)
- `profesiones` (multi) por OBJETO (editor de item) y por BLOQUE/categoría (cabecera en
  "Precios de Equipo"). HERENCIA: objeto usa las suyas; si vacío, hereda las del bloque;
  si tampoco, lo vende cualquiera (compatibilidad, opción 6b).
- Backend: `_block_profesiones` en el doc `equipment_catalog`; endpoints
  `GET/PUT /data/equipment/block-profesiones`; incluido en `/data/equipment-catalog`.
- Tienda (calculadora Compra-Venta): al elegir un PNJ, `filteredItems` filtra por la
  profesión del PNJ (profesiones efectivas del objeto/bloque) ADEMÁS del filtro por región.
- Profesiones = lista editable de PNJ (`npc_profesiones` de `trading_config`).
- VERIFICADO: export/import/plantilla, persistencia de profesiones por bloque, UI de chips
  (objeto y bloque) y que el catálogo expone `_block_profesiones`.
- PENDIENTE DE PRUEBA MANUAL: el filtrado en vivo en la tienda con un PNJ real + bloque asignado.

## Iter 124 — Listas de creación de PNJ EDITABLES desde Configuración (Jun 2026)
- Las listas de creación de PNJ (profesiones, rasgos positivos/negativos con
  descripción y tags, modos de hablar, y las reglas de coherencia por raza/profesión)
  ahora se guardan en el doc `trading_config` y son EDITABLES (añadir/cambiar/borrar)
  desde **Compra-Venta → Configuración** (componente `NpcConfigEditor`).
- Backend: GET/PUT `/trading/config` incluyen `npc_profesiones`, `npc_rasgos_positivos`,
  `npc_rasgos_negativos`, `npc_modos_habla`, `npc_exclusion_raza`, `npc_exclusion_profesion`
  (con defaults de `trading_npc_data`). `npc-meta`, `npc-meta/rasgos` y el autorrelleno de
  `create_npc` leen de la config (funciones `_rasgos_validos_db`, `_elegir_rasgo_db`, etc.).
- Verificado: editar/guardar una profesión en Configuración se refleja al instante en el
  editor de PNJ (npc-meta). Se guarda con "Guardar Todo".

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

## Iter 122 — PNJ: Alineamiento secreto + Estadísticas por profesión + Auto-profesiones equipo (Jun 2026)
- Petición multi-parte del usuario (validación manual). Implementado y probado (curl + screenshot).
- BACKEND `trading_npc_data.py`: añadido `ALINEAMIENTOS` (lista cerrada 9 opciones),
  `STAT_BLOCKS_POR_PROFESION` (28 profesiones → pools de Habilidades/Herramientas/
  Sentidos/Idiomas), helpers `elegir_alineamiento_aleatorio` y `elegir_stats_aleatorios`.
- BACKEND `trading_routes.py`:
  - `get/update_trading_config` exponen `npc_alineamientos` y `npc_stat_blocks` (editables).
  - `get_npc_meta` devuelve `alineamientos` y `stat_blocks`.
  - `create_npc` auto-rellena `alineamiento` (aleatorio si vacío) y bloques de stats
    (aleatorios por profesión si vacíos). Nuevo endpoint `POST /trading/npc-meta/stats`
    (re-tirar stats por profesión).
- BACKEND `data_routes.py`: `DEFAULT_BLOCK_PROFESIONES` (mapa categoría→profesiones) y
  endpoint `POST /equipment/block-profesiones/auto-defaults` (param `solo_vacios`).
- FRONTEND `TradingSystemSection.jsx` (NpcEditorModal): ubicaciones ORDENADAS alfabéticamente;
  nuevo bloque "Datos secretos del DJ" con select de Alineamiento (cerrado) + editor de
  Estadísticas con chips toggle por profesión y botón "Tirar". Ficha del PNJ muestra
  alineamiento (marcado DJ) + habilidades/idiomas. testids: `npc-alineamiento-select`,
  `npc-reroll-stats-btn`, `npc-stat-<field>-<opt>`, `npc-secret-dj-block`.
- FRONTEND `EquipmentSection.jsx`: botón admin "Profesiones por defecto"
  (`auto-assign-block-prof-btn`) que llama al endpoint de auto-asignación.

### PENDIENTE (P0 heredado, NO empezado):
- Bug inversión eje Y en rejilla de terreno (pathfinding rodea montañas fantasma).
- `ViajeSection.jsx` debe usar config dinámica PX (`/api/travel/config/px-roll-table`).

## Iter 123 — Rediseño Tienda (FASE 1: Matrices + base numérica de relación) (Jun 2026)
- Petición: rehacer la tienda con flujo nuevo + motor de negociación D100 + relación numérica.
  Sistema por FASES. El motor D100 SUSTITUYE al de niveles discretos. Validación manual.
- FASE 1 (hecha + verificada):
  - BACKEND `trading_npc_data.py`: helpers de valores por defecto de matrices
    (`default_subcultura_mod` por relaciones de raza + overrides; `default_oficio_ocupacion_mod`
    por categorías de profesión × reputación de ocupación) y `nivel_desde_relacion(-100..100)`.
  - BACKEND `trading_routes.py`: `GET/PUT /trading/config/matrices` (+`/reset`) que
    auto-amplían con subculturas (db.cultures) y ocupaciones (db.occupations, sin TEST_).
    `create_or_update_relationship` ahora persiste `relacion_actual` (-100..100) y deriva `nivel`.
  - FRONTEND `TradingSystemSection.jsx`: `RelationshipMatricesPanel` en pestaña Configuración
    (2 tablas editables, celdas con color, cabeceras/filas sticky). `NpcRelationshipHistory`
    en el editor de PNJ (lista de personajes con su `relacion_actual` editable + histórico).
  - Probado: matrices 20×20 y 28×6 con defaults lógicos (Dunedain×Noldor +8, Mercader×Buscador
    de tesoros −10, Delincuente×Buscador +10). Screenshot OK.
- FASES PENDIENTES: 2) nuevo flujo de tienda (jugador→ubicación/región→PNJ disponibles→
  comprar/vender→contexto). 3) motor D100 (Mod_Total, barra de enfado, tabla de resolución,
  bucle de contraoferta, fatiga, impacto post-venta en relación, efectos >50/<-50).
  4) tirada de habilidad enfrentada (campo de intención del DJ + IA narra el engaño/perspicacia).
  5) aplicar oro/inventario reales en el éxito.

## Iter 124 — Ficha completa del PNJ + 6 características + CA/PG (Jun 2026)
- Petición: ficha de PNJ más completa (estilo bestiario Mantecona/Saqueador) con RETRATO,
  TODOS los datos, las 6 características autogeneradas (array 15/13/12/11/9/8 asignado por
  prioridad según profesión), modificador = ⌊(valor−10)/2⌋, CA=10 sin armadura, PG aleatorios 8-20.
- BACKEND `trading_npc_data.py`: `ARRAY_CARACTERISTICAS`, `PERFILES_CARACTERISTICAS`,
  `PROFESION_PERFIL` (28 profesiones→perfil), `modificador_caracteristica`, `generar_caracteristicas`,
  `generar_pg`.
- BACKEND `trading_routes.py`: `create_npc` añade `caracteristicas/ca/pg`. `get_npcs` hace relleno
  PEREZOSO (genera y persiste atributos en PNJ antiguos). Nuevo endpoint
  `POST /trading/npc-meta/caracteristicas`.
- FRONTEND `TradingSystemSection.jsx`: nuevo `NpcFichaCard` (retrato + cabecera + fila de
  atributos CA/PG/6 carac. con modificadores + todos los datos + trasfondo + alineamiento DJ).
  Grid cambiado a 2 columnas. Editor de PNJ: bloque "Atributos" editable (6 carac.+CA+PG) con
  botón "Generar". Probado: Mercader→CAR15, Cazador→DES15, ficha Barin Toffin OK (screenshot).
- SIGUE PENDIENTE: Fase 2 (flujo tienda), Fase 3 (motor D100), Fase 4 (tirada enfrentada+IA),
  Fase 5 (oro/inventario reales).

## Iter 126 — P0 heredados + Bloque A (UI) + Motor de Comercio D100 (Fases 2-5) (Jun 2026)

### P0 heredados RESUELTOS
- **Eje Y terreno**: el pathfinder (`utils/pathfinding.py::_grid_lookup_terrain/_grid_lookup_land`)
  YA estaba correcto (flip `(100-y)` añadido en fork previo; verificado empíricamente:
  Hobbiton/Bree/Minas Tirith→fácil, Carn Dûm→desalentador). La inconsistencia restante
  estaba en los endpoints DEBUG: `terrain_grid_routes.py /lookup` y
  `travel_routes.py::_grid_lookup_cells` (alimenta `/terrain-at/{x}/{y}`) NO volteaban Y.
  Añadido el flip `(100.0 - y)` en ambos → coherentes con el pathfinder y el mapa visual.
- **ViajeSection.jsx PX dinámica**: la sección "Experiencia por viaje" ahora carga
  `/api/travel/config/px-roll-table` y renderiza las 4 tablas (PX base por CD, modificador por
  diferencia, multiplicador terreno, multiplicador tierras) y el límite de PX desde el backend
  (antes hardcodeado). testids: px-base-cd-table, px-mod-diferencia, px-mult-terreno, px-mult-tierras.

### Bloque A — Ajustes UI
- Trasfondo IA del PNJ limitado a 150 palabras (prompt + recorte de seguridad en
  `trading_routes.py::generate_npc_profile`).
- Ficha de PNJ imprimible en A4 vertical: botón imprimir (testid `npc-print-<id>`) en
  `NpcFichaCard` + `@media print` en `index.css` (clase `npc-printing`/`npc-print-area`,
  oculta `.no-print`, expande `line-clamp-3`, fuerza fondo blanco/texto negro).
- Icono Compra-Venta en Inicio: imagen `Icono comercio.png` con fondo transparente
  (`object-contain`, sin recorte circular) y animación `firePulse` (drop-shadow naranja
  pulsante) en `HomePage.jsx`. Eliminado el icono lucide `Coins`.

### Bloque B — Motor de Comercio D100 (NUEVO, Fases 2-5)
- BACKEND `routes/trading_d100.py` (NUEVO, registrado en server.py):
  - Config ajustable `trading_config.d100_engine` (GET/PUT `/trading/d100/config`):
    anger_umbral, anger_factor, tolerancia_base, tolerancia_por_relacion, venta_ratio,
    d100_base_aceptacion, aceptacion_por_relacion, aceptacion_por_desviacion,
    margen_contraoferta, opposed_skill_factor, relacion_delta_exito/enfado.
  - FASE 2 `GET /trading/d100/available-npcs?character_id=` → PNJs presentes en
    `character.ubicacion_actual` (gate por ubicación). NOTA: characters usan `_id` (UUID).
  - FASE 3 `POST /trading/d100/negotiate` → relación efectiva (relacion_actual + matriz
    subcultura + matriz oficio×ocupación), precio de referencia (venta=50% por defecto +
    contexto histórico), desviación %, tolerancia, barra de enfado (0..100, corta al llegar al
    umbral), tirada D100 de aceptación, contraoferta.
  - FASE 4 `POST /trading/d100/opposed-roll` → d20+mod jugador vs d20+mod PNJ (Engaño/
    Persuasión/Intimidación vs Perspicacia; mod PNJ por SAB/INT), narrativa IA con gpt-4o-mini,
    `opposed_bonus` que sube la tolerancia de la siguiente ronda.
  - FASE 5 `POST /trading/d100/close` → persiste `relacion_actual` (+delta) y el historial;
    el oro/inventario se aplica con el endpoint existente `/trading/confirm-transaction`.
- FRONTEND `components/trading/TiendaD100.jsx` (NUEVO): pestaña "Tienda D100" (por defecto)
  en `TradingSystemSection`. Flujo completo con barra de enfado animada, breakdown de la
  negociación, contraoferta, panel de tirada enfrentada con narrativa, y cierre que aplica todo
  al personaje. Todos los elementos con data-testid `d100-*`.
- Tests: `tests/test_trading_d100.py` (4 OK, partes deterministas). Endpoints verificados por
  curl (negotiate acepta/enfado, opposed con narrativa, close persiste relación, gate Bree↔Rivendel).
- TESTING AGENT (iteration_76): 11/11 PASS, 100% frontend, sin incidencias.
- El motor D100 SUSTITUYE al sistema de umbrales discretos; la pestaña "Calculadora" (legacy)
  se mantiene accesible por compatibilidad.

## Iter 127 — Motor D100 reescrito (regateo balanceado + tirada enfrentada por bandas) (Jun 2026)

### Tienda D100 — Filtro + UX (P0 resuelto)
- `TiendaD100.jsx`: `filteredItems` ahora filtra por PROFESIÓN del PNJ y REGIÓN del personaje
  (herencia objeto > bloque `_block_profesiones`/`_block_regiones`). Verificado: Posadero NO ve armas.
- Buscador de artículo: desplegable se abre al ENFOCAR (no solo al escribir) y se reduce al teclear.

### Habilidades del PNJ con modificador
- `trading_npc_data.py`: SKILL_ABILITY, PROFICIENCY_BONUS_NPC=2, `modificador_habilidad`,
  `habilidades_con_modificador`, `modificador_de_habilidad_en_pnj`.
- `create_npc`/`get_npcs` persisten/rellenan `habilidades_mods` ([{nombre, modificador}]).
  Barin Toffin → Perspicacia +3, Engaño +4. Ficha del PNJ muestra los modificadores.

### Motor D100 (`trading_d100.py`) — config ampliada (26 claves, editable en Reglas)
- BLOQUE A: venta_ratio, tolerancia_base/por_relacion, anger_factor, anger_umbral,
  d100_base_aceptacion, aceptacion_por_relacion/desviacion, relacion_delta_exito/enfado.
- BLOQUE A-2 (CONTRAOFERTA BALANCEADA): descuento_base_relacion(0.05), descuento_por_punto_relacion(0.01),
  descuento_maximo(0.40). %Desc = min(tope, descuento_relacion + Mod_Contexto + Mod_Afinidad_Raza).
  Precio_Contraoferta = objetivo×(1−%) [compra] / objetivo×(1+%) [venta]. Mod_Contexto = −(mod_ctx/100),
  Mod_Afinidad_Raza derivado de RELACIONES_RAZA (misma raza +0.05). El precio objetivo YA NO lleva contexto.
- BLOQUE B (tirada enfrentada): PJ=1d20+mod_jugador; PNJ=1d20+mod_Perspicacia(0 si no la tiene)
  −mod_relacion_nivel +desviacion%/divisor_desviacion(10). Niveles −4..+4 (hostil..hermandad).
- BLOQUE C (resultado, diff=PNJ−PJ): diff<0 Éxito (acepta precio ofertado, +relacion_delta_exito);
  0≤diff<umbral_pillado(6) Duda (+enfado_duda 15); diff≥6 Pillado (+enfado_pillado 40, relacion_pillado −15).
- BLOQUE D: subida_precio_duda/pillado (% automático, default 0).
- UI: `D100EngineConfigPanel` en Configuración (editable + guardar). Tirada enfrentada muestra bandas
  Éxito/Duda/Pillado + cierre en Éxito al precio ofertado.
- Tests: tests/test_trading_d100.py (8 OK) + test_trading_d100_integration_it77.py (6 OK).
- TESTING AGENT iteration_77: 12/12 PASS (filtro Posadero, desplegable, negociación, tirada enfrentada,
  config editable, ficha con modificadores). Sin errores de consola.

## Iter 128 — Creación de personaje: edad sesgada, rasgos faciales IA, fix array estándar (Jun 2026)

### 1. Edad sesgada a la juventud (editable por cultura)
- Fórmula nueva (mezcla uniforme↔cúbica): edad = round(min + (max−min)·((1−w)·r + w·r³)), w = sesgo/3.
  sesgo 0 = plano (uniforme) · 2 (default) ≈ 74% en la mitad joven · 3 = muy joven.
- `Step1Culture.jsx`: helper `edadSesgada()`; usa `culture.edad_sesgo ?? 2`.
- Backend `data_routes.py`: `CultureCreate.edad_sesgo` (default 2.0) + persistencia create/update.
- UI: deslizador 0–3 (default 2) en `CultureEditor.jsx` → sección Características Físicas
  (data-testid edad-sesgo-slider/value). Solo al editar, sin recargar, persiste al guardar.
- Verificado: Bree 18-50 → 51.8% en 18-26, 11.1% en 43-50.

### 2. Rasgos faciales aleatorios para la imagen IA (editables)
- `/app/frontend/src/data/facialTraits.js`: 6 grupos (estructura ósea, ojos/cejas, nariz, boca,
  piel, cabello), 20 rasgos c/u, `pickRandomFacialTraits()` (uno por grupo).
- `CharacterSummary.jsx`: recuadro editable (data-testid facial-traits-box) bajo el botón de
  crear imagen: input por rasgo, botón Aleatorizar, X para quitar. Se envían en `rasgos_faciales`.
- Backend `portrait_routes.py`: `PortraitRequest.rasgos_faciales` → prompt ('distinctive facial features').
  El retrato sigue usando edad, subcultura, raza, género, ojos, pelo, vocación, trasfondo.

### 3. Fix BUG array estándar (Step1Culture)
- Los <select> de asignación de características filtran STANDARD_ARRAY excluyendo valores ya usados
  por OTRA característica (cada uno conserva el suyo). El mensaje 'Valores disponibles' se mantiene.

- TESTING AGENT iteration_80: frontend 100% (array estándar y deslizador por UI; rasgos faciales por code review). Sin issues.

## Iter 129 — Fixes ficha + yelmos + retrato (Jun 2026)
- (A) Comida: `inventoryProvisions.js` diasComidaTotal = raciones/RACIONES_POR_DIA + otherFoodKg.
  Antes solo masa → 0 días con raciones peso_kg=null. Verificado: 10 raciones → 10 días.
- (B) Yelmos: nueva categoría 'yelmos' en catálogo (backend all_keys + seed 4 ítems) y en
  EquipmentSection (Armaduras → 'Yelmos y Cascos'). Cofia cuero/mallas, Yelmo abierto, Gran Yelmo.
- (C) Código en hoja oficial: SheetPage1 codigo_publico x:1310 width:420 fontSize:21 (antes se cortaba).
- (D) Retrato: CharacterHeader modal de previsualización GRANDE (portrait-preview-modal) al generar
  borrador, con Guardar/Regenerar/Descartar; miniatura de borrador reabre el modal.
- TESTING iteration_81: frontend 100% (4/4). Sin issues.
- PENDIENTE (a confirmar): auto-equipar ropa al crear + sistema de ranuras corporales e
  incompatibilidad de armaduras (solapamiento).

## Iter 130 — Retrato ampliable + Pantalla del DJ (Jun 2026)

### P0 — Ampliar retrato definitivo al hacer clic
- `CharacterHeader.jsx`: al pulsar el retrato circular DEFINITIVO se abre un modal de
  vista ampliada (`portrait-fullview-modal` / `-image` / `-close`) con la imagen a tamaño
  grande + nombre. Pista visual (icono Maximize) al pasar el ratón. El borrador sin guardar
  sigue abriendo su propio modal de previsualización.

### P1 — Pantalla del DJ (dashboard en vivo de campaña)
- BACKEND `routes/dj_screen_routes.py` (NUEVO, registrado en server.py). Colecciones
  `dj_screens` (1 doc por campaign_run) y `dj_chat_messages`.
  - `GET /api/campaign-runs/{run_id}/dj-screen` → estado con visibilidad por rol
    (`can_edit`/`is_player`); jugador aceptado recibe estado SANEADO (sin notas del DJ,
    enemigos solo con banda cualitativa de PG y sin CA/notas).
  - `PUT /api/campaign-runs/{run_id}/dj-screen` (solo DM/Maestro): guarda escena, notas,
    combatientes, turno y ronda.
  - `POST /…/dj-screen/sync-players`: añade los personajes ACEPTADOS al rastreador
    (idempotente por character_id; PG/CA/iniciativa desde la ficha).
  - `GET /…/dj-screen/portrait/{character_id}`: sirve el retrato del personaje (PNG) para
    las cartas/tracker.
  - Chat: `GET/POST /…/chat` (canales `group` y `private:<uid>`), `GET /…/chat/peers`
    (DM lista jugadores aceptados para abrir privados). Permisos por canal verificados.
- FRONTEND `pages/DjScreenPage.jsx` (NUEVO, ruta `/campanas/:id/pantalla`, accesible a
  cualquier rol; el backend hace el gate). 3 zonas: izquierda (notas DJ + chat con pestañas),
  centro (lienzo de escena con subida de imagen + cartas de héroes), derecha (rastreador de
  iniciativa: añadir enemigo, HP +/-, CA, iniciativa, condiciones, notas privadas, ordenar,
  control de turnos/rondas). Jugadores: vista solo lectura saneada (poll cada 5s); chat para todos.
- Accesos: botón `open-dj-screen-btn` en `CampaignHubPage` (cabecera) y botón
  `enter-screen-<id>` en `MyCampaignsPage` para jugadores aceptados (campaña activa/pausada).
- TESTING AGENT iteration_88: backend 9/9 PASS, frontend 100%. Sin incidencias.
  Datos de prueba (run de QA) eliminados tras validar.

## Iter 131 — Pantalla del DJ Fase A (Jun 2026)
- **Pestaña Jugadores → Invitar:** en `CampaignHubPage` el DJ ve "Invitar jugadores
  disponibles" (`/player-availability`), botón Invitar (`createInvitation`), y sección
  "Invitaciones enviadas" con estado y cancelar. Filtra a los ya invitados/en campaña.
- **Pantalla DJ → Del bestiario:** botón `open-bestiary-btn` abre modal `bestiary-modal`
  con filtro de categoría (malignos/pnj/animales/especiales) + búsqueda (`/data/npcs`);
  al pulsar una criatura se añade al rastreador con sus PG/CA.
- **Aviso de salida:** guard en `DjScreenPage` (botón Volver + beforeunload) que avisa solo
  si hay trabajo a medio hacer (notas en debounce, guardado en curso o enemigo sin añadir).
- Verificado por captura: invitar (toast + lista enviadas), bestiario (38 criaturas, añade
  Atracador), retrato y tracker. Campaña demo creada (código K7Q9NKFR) para el usuario.
- PENDIENTE Fase B: cajón lateral en la Pantalla del DJ con acceso sin recargar a
  Bestiario/PNJ/Tienda/Equipo/Sombra (a priorizar con el usuario).

## Iter 132 — Invitaciones: insignia, nota y modo Maestro (Jun 2026)
- **(a) Insignia de invitaciones** en `MyCampaignsPage`: cuenta `myInvitations()` pendientes
  → badge rojo en el botón "📜 Tablón" + banner que enlaza a El Tablón (`invites-badge`,
  `invites-banner`).
- **(b) Nota de disponibilidad** en pestaña Jugadores del hub (`availability-note`):
  explica que los jugadores solo aparecen si marcan su personaje "Disponible" en El Tablón.
- **(c) Modo Maestro — invitar a cualquiera:** endpoint `GET /api/campaign-runs/{run}/maestro-candidates`
  (solo maestro) lista TODOS los personajes (excluye los ya en el run, marca locked/invited).
  Sección UI `section-maestro-invite` (solo maestro) con buscador + invitar a cualquier personaje
  para pruebas, sin depender de la disponibilidad.
- **Guard anti-duplicados** en `create_invitation`: rechaza 2ª invitación pendiente al mismo personaje.
- Verificado por captura (badge+banner, nota, 48 candidatos) y curl. Recordatorio: El Tablón
  (`/tablon`) es donde el jugador marca disponibilidad (pestaña Disponibilidad) y responde
  invitaciones (pestaña Invitaciones); se accede desde Mis Campañas → 📜 Tablón.

## Pantalla del DJ — Fase 5: Sombra y Ojo de Mordor (Jul 2026)
- Panel `EyeShadowPanel` (columna derecha de la Pantalla del DJ): iris rúnico con bandas
  (Ojo dormido → entreabierto → vigilante → parpadeando → La Mirada), Atención/umbral y barra.
- DJ: botones "Incrementar Ojo" (+1/+2/+3) y control de Sombra a la Compañía (stepper + motivo,
  "Aplicar a la Compañía" y "Prueba de Sombra" que aplica +1 a todos los héroes aceptados).
- Jugador: solo iris + banda rúnica (sin números). PG enemigos ya saneados por bandas.
- Backend: `GET /…/eye`, `POST /…/dj-screen/apply-shadow`, `POST /…/dj-screen/eye-increment`;
  difusión WS `eye_update` y `shadow_applied` en vivo. Verificado por curl + captura.
- SIGUIENTE: Fase 6 (consolidación de módulos del mockup: Referencia de Reglas de solo lectura,
  gestor de tiradas con runas d4–d100 + d20 rápido, botones de encuentro, Mapa táctico Nivel A).

## Pantalla del DJ — Fase 6: Consolidación de módulos (Jul 2026)
- 6.1 Gestor de tiradas con runas (d4–d100, Nº/Mod, Compartida/Privada, d20 flotante).
  Endpoint `POST /…/dj-screen/roll-dice` (DJ y jugadores); compartidas narran en chat.
- 6.2 Panel de Encuentro (solo DJ): Acciones restantes (persistente), Disparar trampa,
  Suceso de Sombra aleatorio (`/shadow-event`), Terminar encuentro (retira enemigos).
- 6.3 Referencia rápida de Reglas: modal de chuleta curada (solo consulta) + enlace a /rules
  completo para el DJ.
- 6.4 Mapa táctico Nivel A (`TacticalMap`): imagen + rejilla + fichas arrastrables en vivo (WS).
  `DjScreenState` gana `tokens[]` y `actions_remaining`; tokens visibles para jugadores.
- Verificado por testing_agent iter89 (backend 13/13 PASS, frontend OK, sin regresiones).
- SIGUIENTE (P1): Persistencia de Sesión (`campaign_sessions`) con Iniciar/Cerrar sesión y
  agrupado histórico de chat/notas. Backlog (P2): refactor de `data_routes.py` (>4900 líneas).

## Pantalla del DJ — Persistencia de Sesión + resumen IA (Jul 2026)
- Colección `campaign_sessions` (id, campaign_run_id, numero, titulo, start/end_time, status,
  summary, notes_snapshot). Una sola sesión activa por campaña.
- Endpoints: GET /…/sessions, POST /…/sessions/start, POST /…/sessions/{sid}/close.
- Al cerrar: resumen automático con GPT-4o (Emergent LLM key) en español de España a partir del
  chat de la sesión (ventana temporal) + notas privadas del DJ; fallback si la IA no responde.
- Frontend: SessionsModal (Iniciar/Cerrar + historial con resúmenes), píldora de estado y botón
  "Sesiones" en la barra; sincronización WS `session_update`.
- Verificado por curl (flujo completo con resumen IA real, doble-start 400) y captura.
- SIGUIENTE (P2): refactor de `data_routes.py` (>4900 líneas) en world_data_routes.py y
  travel_data_routes.py. Posible: resumen IA visible/pegable en el diario de campaña.

## Diario de campaña (Jul 2026)
- Página `/campanas/:id/diario` (`CampaignJournalPage`): crónica acumulada de todas las sesiones
  como capítulos (orden cronológico), con fechas y resumen. Accesible a DJ y jugadores (lectura).
- El DJ puede EDITAR título y crónica de cada sesión: `PATCH /campaign-runs/{run}/sessions/{sid}`.
- Impresión: PDF por sesión (botón printer) y "PDF completo"/"Imprimir diario" del diario entero
  (jsPDF, formato A4, tipografía Times). Almacena todo para el final de la campaña.
- Acceso desde la Pantalla del DJ (botón "Diario"). Verificado por curl (PATCH) y captura
  (2 capítulos, descarga PDF `diario-*.pdf`, edición inline).

## Diario de campaña — Portada IA + Índice (Jul 2026)
- Portada ilustrada generada con IA (GPT Image 1 vía Emergent LLM key) a partir del nombre de la
  aventura; guardada en GridFS y persistida en campaign_runs.journal_cover_file_id.
  Endpoints: GET/POST `/campaign-runs/{run}/journal/cover` (POST solo DJ).
- La página del Diario muestra la portada + un Índice de capítulos (con scroll a cada sesión).
- El PDF completo incluye página de PORTADA ilustrada + página de ÍNDICE + capítulos → aspecto de
  "libro de campaña" descargable/compartible. Verificado por curl (cover generado y persistido) y
  captura (portada renderizada + índice).

## Diario de campaña — Envío a los jugadores (entrega en la app) (Jul 2026)
- Botón "Enviar a jugadores" (DJ) en el Diario: genera el PDF completo (portada+índice+capítulos),
  lo sube a GridFS (/storage/upload) y llama a `POST /campaign-runs/{run}/journal/share`
  {file_id, filename} que guarda `campaign_runs.shared_journal` y devuelve nº de destinatarios.
- `my_campaigns` expone `run.shared_journal`; en MyCampaignsPage cada jugador aceptado ve el botón
  "Descargar diario" (descarga autenticada del PDF). Sin servicios externos.
- Verificado: curl (share → recipients:1) + flujo real desde el navegador (PDF de 4.7 MB subido y
  compartido, shared_journal actualizado a diario-*.pdf application/pdf) + captura del botón.

## Reglas → «PNJs» — Creador unificado de PNJ (Fase A) (Jul 2026)
- Nueva sección Reglas → «PNJs» (`PNJForgeSection`, solo Maestro/DJ). Paso 1: elegir
  «Profesión» o «Adversario». La pestaña de PNJ de Comercio se mantiene intacta.
- Profesión: profesión + raza/subcultura + sexo → `POST /trading/npcs` (autorrelleno de nombre,
  rasgo, modo de habla, edad, stats) → guardado en PNJ de comercio.
- Adversario: se elige un maligno del Bestiario, se auto-rellena su bloque (preview CA/PG/armas)
  y, según su modo de raza:
    · Sin raza → tipo de criatura (Orco/Troll/Huargo, ampliable) + sexo → nombre procedimental.
    · Racial → raza/subcultura (con razas EXCLUIBLES, p. ej. Espectro≠Elfo) + sexo → nombre IA.
  Se guarda como nuevo maligno en el Bestiario (copia del bloque + nombre + origen en descripción).
- Backend nuevo: `routes/npc_creature_names.py` (diccionarios Orco/Trol/Huargo + algoritmo
  silábico: ataque + 70% núcleo + cierre por sexo/universal, fusión de dobles consonantes,
  capitalización, epíteto 25%). Endpoints `/npc-generator/creature-types` y `/creature-name`
  (leen de `npc_creature_name_config` si existe → base para Fase B).
- Verificado: curl (creature-name orco M/F, troll, huargo, inválido 400; /trading/npcs create;
  /data/npcs create) + capturas (adversario "Jefe Gran Orco" → "Grishbanakh"; formulario profesión).
- PENDIENTE Fase B: editor de "bases" (migrar a BD y editar desde la UI: profesiones, bloques de
  stats, atributos+modificadores, modo de raza/exclusiones por adversario, diccionarios de nombres)
  + traer del generador de Aventuras: retrato IA, nivel/PX, historia IA.

## Reglas → «PNJs» — Fase B (parte 1) (Jul 2026)
- SUGERENCIA aprobada «Soltar en la Pantalla del DJ»: al crear/elegir un adversario se puede
  seleccionar una campaña ACTIVA + cantidad y añadirlo como enemigo al rastreador de combate.
  Backend `POST /campaign-runs/{run}/dj-screen/add-combatant` {npc|npc_id, name, count} deriva
  CA/PG/atk/dmg/init del bloque y difunde por WS. Verificado (curl + UI, toast de confirmación).
- BASES editables de generadores de nombres: modal `CreatureNameConfigEditor` (solo Maestro) para
  añadir/quitar TIPOS de criatura y editar sus diccionarios (ataque/núcleo/cierres/epítetos) y el
  flag de sexo. Backend `GET/PUT /npc-generator/creature-name-config` (persiste en
  `npc_creature_name_config`; el generador lo lee con fallback a los valores por defecto).
  Verificado (curl: añadir tipo "trasgo" y generar; UI: modal con tabs y arrays).
- PENDIENTE Fase B (parte 2): editor de atributos+modificadores y de profesiones/bloques de stats
  (las profesiones/stat-blocks ya son editables en Comercio→config); persistir por-adversario el
  modo de raza + razas excluidas; y traer al creador: retrato IA, nivel/PX e historia IA.

## Reglas → «PNJs» — Fase B (parte 2) (Jul 2026)
- Config de raza PERSISTENTE por adversario: campos modo_raza/razas_excluidas/tipos_criatura en
  el bestiario (NPCCreate + expuestos en /data/npcs); panel inline en el creador (adv-cfg) para
  guardarlos vía PATCH. Al elegir un adversario se preselecciona su modo/exclusiones y se filtran
  los tipos de criatura permitidos. (Ej.: Espectro Cruel = racial, excluye Elfos.)
- Retrato IA (reutiliza /npc-generator/portrait), Historia IA (nuevo /npc-generator/story, GPT-4o)
  y campo Nivel/Desafío en el creador de adversarios; se guardan en el PNJ (retrato_file_id,
  historia, nivel).
- Verificado por testing_agent iter90 (backend 12/12 PASS, frontend 100%, sin issues; datos de
  prueba restaurados). 
- PENDIENTE (único de Fase B): editor de atributos+modificadores (fórmula fija) — baja prioridad;
  profesiones y bloques de stats ya son editables en Comercio → config.

## Reglas → «PNJs» — Fix rasgo (desplegable + toggle) en ProfesionForge (Jul 2026)
- CORRECCIÓN pedida por el usuario: en el Creador Unificado (Profesión) el "Rasgo único
  (positivo/negativo)" era un Input de texto libre. Ahora replica el creador antiguo de Comercio:
  DESPLEGABLE filtrado por coherencia (raza/profesión vía `POST /trading/npc-meta/rasgos`) +
  toggle Positivo/Negativo, con descripción del rasgo debajo. Es DISTINTO de los "rasgos físicos"
  (textarea Apariencia). testids: prof-rasgo-select, prof-rasgo-positivo-btn, prof-rasgo-negativo-btn,
  prof-rasgo-desc. Verificado visualmente (51 pos / 51 neg, "Tasador honesto" + descripción).
- Trasfondo IA ahora incluye TODOS los datos (apariencia/rasgos físicos, edad, alineamiento, rasgo+desc,
  modo de hablar+desc, raza/subcultura); antes omitía la apariencia. El retrato IA se basa en todos los
  datos (apariencia como "distinctive physical features", edad, rasgo, alineamiento vía `extra`).
  Verificado por curl: la historia refleja apariencia (ojo/parche/cicatriz), rasgo y modo de hablar.
- Botón único "Generar trasfondo + retrato" (testid prof-perfil-completo-btn): encadena trasfondo
  (con todos los datos) → retrato (basado en apariencia/rasgo/alineamiento/edad). Verificado e2e en
  navegador: un clic genera historia (609 chars, con cicatriz/ojo perdido) y retrato a lápiz coherente.

## Reglas → «PNJs» — Rediseño con modal de Compra-Venta + filtro profesión↔raza + navegador (Jul 2026)
- La creación de PNJ de Profesión ahora REUTILIZA el modal de Compra-Venta (`NpcEditorModal`,
  exportado desde TradingSystemSection). Se eliminó el antiguo `ProfesionForge` de página completa.
- Orden forzado raza→subcultura→profesión: el select de Profesión está deshabilitado hasta elegir
  Raza y solo muestra las profesiones coherentes (un Elfo no ve "Enano Herrero" ni "Caballero de Gondor";
  sí "Elfo Artesano").
- Filtro editable: mapa `npc_profesiones_por_raza` (profesión→razas permitidas; excepciones, vacío=todas)
  en trading_config; default en `trading_npc_data.PROFESIONES_POR_RAZA`; expuesto en npc-meta como
  `profesiones_por_raza`; editable en Compra-Venta → Configuración ("Profesiones permitidas por Raza").
- Ubicación OBLIGATORIA (ya en el modal): Guardar deshabilitado sin ubicación.
- Pestaña PNJs con 3 tarjetas: Profesión (abre modal), Adversario (AdversarioForge) y "PNJs existentes"
  (`NpcBrowser`: fichas NpcFichaCard + filtro por ubicación + búsqueda por nombre + editar + borrar).
- Verificado por testing_agent iteration_91: backend 5/5 pytest PASS + frontend 100%, cero errores.
  Regresión Compra-Venta OK (mismo modal exportado).

## Reglas → «PNJs» + Bestiario — Desafío, ubicación, adversarios concretos, consulta y razas por tipo (Jul 2026)
- (A) BUG Desafío: el chip del adversario mostraba «—». Ahora `formatDesafio`/`xpToCr` derivan el
  Desafío desde la experiencia (tabla XP→CR 5e). Chip y campo «Nivel/Desafío» autorrellenados.
- (B) Bestiario (NPCEditor): nuevo bloque «Razas que puede ocupar este tipo» (solo categorías
  malignos/pnj) con modo Racial (chips de razas permitidas) o Sin raza (tipos de criatura). Persiste
  modo_raza/razas_permitidas/tipos_criatura. FIX: añadido `razas_permitidas` a la proyección de
  GET /api/data/npcs y al modelo NPCCreate para que rehidrate al reabrir la ficha.
- (C) Los adversarios CONCRETOS creados desde «PNJs» ya NO van al Bestiario: se guardan en
  trading_npcs con `es_adversario=true` (bypass en create_npc, sin autorrelleno), normalizados a
  ca/pg/caracteristicas, con UBICACIÓN obligatoria. Botón «Guardar en PNJs existentes».
- (D) Consulta «PNJs existentes» (NpcBrowser) rediseñada: tarjetas COMPACTAS (retrato+nombre+apodo+
  oficio+raza·subcultura·ubicación); al pulsar abre la ficha completa en modal. Filtros: Tipo
  (Comerciante/Adversario), Raza, Subcultura, Ubicación, Profesión/Tipo + búsqueda por nombre.
- AdversarioForge usa `razas_permitidas` (si está definida en la ficha) para limitar las razas.
- Verificado por testing_agent iteration_92: backend 7/7 pytest PASS + frontend 100%. Bug de
  rehidratación de `razas_permitidas` corregido y verificado por curl. Sin datos de prueba residuales.

## FASE 1 — Ficha de adversario completa + riqueza + agrupación (Jul 2026)
- Nuevo componente `AdversaryFicha.jsx`: la ficha del adversario en la consulta muestra TODO el bloque
  del Bestiario (CA/PG/Velocidad/Desafío/Percepción, atributos, sentidos, idiomas, defensas, habilidades
  especiales, ataques con ataque múltiple, otras acciones, reacciones) + ubicación, apariencia, historia,
  relaciones y notas. Antes solo salían CA/PG/atributos.
- AdversarioForge enriquecido: apariencia, alineamiento, edad (opcional), notas del DJ, relaciones con PJs
  (texto libre) y botón único «Generar trasfondo + retrato» (trasfondo con todos los datos → retrato).
- Selector de adversarios AGRUPADO por tipo/raza (optgroup: Orcos, Trolls, Espectros…) derivado de
  tipos_criatura o del paréntesis de `tipo`.
- Botón renombrado a «Bases de creación» (editor con pestañas rasgos/formas/tipos → Fase 3).
- Verificado e2e: ficha del Cacique Orco muestra Cimitarra/Golpe con Escudo/Lanza, Ataque Furtivo, etc.;
  apariencia/alineamiento/relaciones persisten. Editar adversario desde la consulta: pendiente (Fase 3).

## FASE 2 — Rasgos y formas de hablar de adversario (Jul 2026) ✅
- Datos en `backend/routes/adversary_traits_data.py`: 1000 rasgos (orcos/trolls/huargos/espectros ×
  defectos/obsesiones/miedos/manías/fortalezas × 50) + 50 formas de hablar.
- Endpoints en npc_generator_routes: `POST /npc-generator/adversary-traits` {familia} → 5 rasgos
  (1 por grupo) + modo_hablar (solo orcos/trolls); `GET/PUT /npc-generator/adversary-traits-config`
  (editable, colección npc_adversary_traits_config).
- AdversarioForge: selector de familia (auto-detectado por tipos_criatura/keywords, editable), botón
  «Tirar 5 rasgos», lista editable (quitar ✕), campo forma de hablar (orcos/trolls). Se guardan
  `rasgos` (array) y `modo_hablar`; la AdversaryFicha ya los muestra.
- Verificado: backend por curl (orcos con habla; huargos/espectros sin habla) + e2e frontend.
- Nota: edición de la config de rasgos desde UI → Fase 3 («Bases de creación» con pestañas).

## BUG (categoría) + mejora raza/subcultura en PNJ del Bestiario (Jul 2026) ✅
- BUG CORREGIDO Y VERIFICADO (testing_agent iteration_93, 100%): al editar un NPC del Bestiario, la
  «Categoría» ya no cambia a «Malignos». Causa: GET /api/data/npcs agrupa por categoría pero la
  proyección no incluía `categoria`; añadido `'categoria': cat` a la proyección (npc_routes.get_all_npcs).
  El NPCEditor la carga vía `...npc`. Guardar mantiene la categoría; verificado en las 4 pestañas.
- Mejora: el creador de «Adversario» ahora incluye también los tipos de categoría `pnj` del Bestiario;
  para estos el modo por defecto es RACIAL (raza + subcultura → nombre por subcultura, como los PJ).
  Al guardarse se marcan `es_adversario:false` + `bestiario_categoria:'pnj'` para NO confundirlos con
  adversarios. La consulta añade el filtro «PNJ (Bestiario)» y una etiqueta azul «PNJ»; su ficha usa
  AdversaryFicha (bloque completo). Verificado e2e (Guardia de la Comarca → modo racial + subcultura).
- Espectros: al detectarse familia «espectros», el creador muestra «Origen del espectro»
  (Hombre/Elfo/Enano/Espíritu). Con raza → selector de subcultura (por raza) y nombre generado por
  subcultura (como los PJ, vía `/npc-generator/name`). Con «Espíritu» → sin subcultura, nombre a mano,
  raza guardada como «Espíritu» (agrupación).
- Editor «Bases de creación» (CreatureNameConfigEditor con pestañas): Nombres/Tipos (existente),
  Rasgos de adversario (4 familias × 5 grupos, textareas editables) y Formas de hablar. Persiste vía
  `PUT /npc-generator/adversary-traits-config` y `PUT /npc-generator/creature-name-config`.
- Edición de adversarios: se mantiene el flujo simple (sin editor propio nuevo), por decisión del usuario.
- Verificado: editor e2e (3 pestañas), origen espectro (Hombres→9 subculturas, Espíritu oculta subcultura),
  y round-trip de config por curl (PUT → generación refleja cambios; datos por defecto restaurados).

## PNJs/Adversarios — Agrupación, sin alineamiento, retrato de cuerpo entero (Jul 2026)
- **Agrupación en «PNJs existentes»** (NpcBrowser): las tarjetas se agrupan por «Raza · Subcultura»
  (o por el tipo no-racial: Orco, Trol, Huargo, Espectro…) con cabecera y contador por grupo.
- **Subcultura opcional = cualquiera**: en el creador de Adversario racial, si no se elige subcultura
  el desplegable muestra «— cualquiera —»; al generar nombre se toma una subcultura al azar de la raza.
- **Razas excluidas ya NO se editan desde la creación**: se quitó el bloque de chips editable y el
  engranaje que hacía PATCH al Bestiario. Ahora solo se muestra informativamente («Razas permitidas/
  excluidas: … Estas restricciones se editan desde el Bestiario»). Retiro del ejemplo «Espectro no
  puede ser Elfo» (los espectros SÍ pueden ser elfos).
- **Alineamiento eliminado** de toda la UI de PNJ (AdversarioForge, NpcEditorModal de Compra-Venta,
  NpcFichaCard y AdversaryFicha) — en LSDLA 5e no existe y no aportaba.
- **Retrato de cuerpo entero (reversible)**: nuevo `full_body` (default true) en
  `POST /npc-generator/portrait` y en `/trading/npcs/generate-profile`. Prompts alternan entre
  «head and shoulders» y figura completa de pies a cabeza (piernas/cicatrices/muletas visibles).
  Interruptor «Retrato de cuerpo entero» en ambos formularios (`adv-cuerpo-entero-toggle`,
  `npc-cuerpo-entero-toggle`) para comparar y decidir si se mantiene.
- Verificado por captura: form de adversario sin engranaje/chips/alineamiento + toggle marcado;
  navegador agrupado (ENANOS, HOMBRES, HOMBRES·GONDORIANOS, HOMBRES·HOMBRES DE BREE, ORCO).

## PNJs/Bestiario — Agrupación por raza, bloque editable, retrato fotorrealista y zoom (Jul 2026)
- **Bestiario agrupado** (NPCsSection): pestañas Malignos y PNJ se agrupan por raza/tipo
  (Hombres, Elfos, Enanos, Hobbits, Orcos, Trols, Huargos, Espectros y No-muertos, Bestia…) con
  cabecera y contador. La raza se deriva del paréntesis del `tipo` y, si no, de tipo+nombre.
  Animales y Especiales se ordenan alfabéticamente (sin grupos).
- **Bloque de combate EDITABLE al crear un adversario** (`AdversaryBlockEditor`): al elegir el
  adversario del Bestiario aparece su bloque completo editable (CA/PG/Velocidad/Percepción,
  atributos, ataque múltiple, armas con +impacto/alcance/daño/tipo/efecto, habilidades especiales,
  otras acciones y reacciones). Se puede personalizar antes de guardar; los cambios sobrescriben lo
  heredado en el payload de `/trading/npcs`.
- **Retrato FOTORREALISTA en B/N a lápiz**: prompts reescritos en `/npc-generator/portrait` y en
  `/trading/npcs/generate-profile` (bust y cuerpo entero) a «dibujo a lápiz fotorrealista, hiperdetallado,
  aspecto de fotografía real» para que se aprecien mejor los detalles.
- **Zoom de retrato + acciones en la ficha**: al pulsar el retrato en `NpcFichaCard` y `AdversaryFicha`
  se amplía a pantalla completa (modal con ×). `AdversaryFicha` ahora también tiene botón Imprimir
  (junto a Editar/Borrar); `NpcFichaCard` ya tenía imprimir/editar/borrar.
- Verificado por captura: Bestiario Malignos agrupado (BESTIA/ENANOS/ESPECTROS Y NO-MUERTOS…),
  bloque editable del «Jefe de Rufianes» (Gran Clava, Daga, Tácticas de Banda, Aullido de Triunfo),
  y zoom del retrato de «Barin Toffin».

## PNJs — Edición de adversarios/PNJ + retrato grande en impresión (Jul 2026)
- **Editar adversarios y PNJ del Bestiario**: nuevo `AdversaryEditModal` (reutiliza `AdversaryBlockEditor`).
  Botón Editar visible en `AdversaryFicha`; en `NpcBrowser`, los adversarios/PNJ-bestiario abren este
  editor propio (nombre, apodo, ubicación, sexo, edad, desafío, apariencia, rasgos, forma de hablar,
  historia, notas, relaciones y TODO el bloque de combate) y guardan con `PUT /trading/npcs/{id}`
  (los comerciantes siguen usando el modal de Compra-Venta). Verificado round-trip por API.
- **Retrato grande al imprimir/PDF**: en `@media print` la cabecera de la ficha se apila y centra y el
  retrato se amplía a ≈11 cm de ancho (media página) sin alterar el resto del diseño. Aplica a
  `NpcFichaCard` y `AdversaryFicha` (imgs `npc-ficha-portrait-*` y `adversary-ficha-portrait`).

## PDF/impresión — layout tipo mockup + sin badge (Jul 2026)
- **`AdversaryFicha` reestructurada** a 2 columnas arriba (retrato grande a la izquierda `object-cover`
  + nombre/estadísticas/atributos/ubicación a la derecha), replicando el ejemplo aportado por el usuario;
  el resto (Sentidos, Habilidades, Ataques, Acciones…) fluye a lo ancho debajo. Sirve para pantalla y PDF.
- **Retrato**: en la ficha/PDF se muestra recortado a marco (`object-cover object-top`) para que se vea
  lleno como el mockup; el retrato completo (cuerpo entero) se ve pulsando para ampliar (zoom `object-contain`).
- **Badge "Made with Emergent" oculto en impresión**: `#emergent-badge` tiene `display:inline-flex`
  inline `!important`, así que se oculta por JS en `handlePrint` (y regla CSS de respaldo). Ya no tapa texto.
- Se quitó la lista lateral solo-impresión y los hacks anteriores; el PDF usa el diseño real de la ficha.

## Retratos y ficha — características completas + encuadre + foto B/N (Jul 2026)
- **Retrato usa TODAS las características**: `doRetrato` construye el prompt con el tipo de criatura
  PRIMERO y destacado (orco/trol/huargo/espectro), raza/subcultura, rol/profesión, apariencia física,
  ARMAS asignadas (que se vean colocadas en su sitio, no flotando/deformes), ubicación y edad. El
  trasfondo (`doHistoria`) incluye ubicación, región, profesión, armas, rasgos y raza/subcultura.
- **Retrato más FOTOGRÁFICO**: prompts reescritos a «fotografía en blanco y negro, ultra fotorrealista,
  aspecto de foto real (NO dibujo/boceto), grano de película» en `/npc-generator/portrait` y en los
  prefijos de `trading_routes`. Cuerpo entero: cabeza y pies dentro del encuadre con margen.
- **Encuadre en la ficha**: el retrato se muestra con `object-contain` (figura entera, ya no se corta
  cabeza/pies); el detalle completo se ve al pulsar (zoom).
- **Impresión: hueco de la Edad**: la columna del retrato se estira a la altura de la columna de datos
  (`align-items: stretch`), así el texto inferior (Sentidos, Habilidades…) sube justo debajo de la línea
  Ubicación/Región/Sexo y la Edad ocupa su hueco sin empujar el resto.

## Retratos — descripción por tipo de criatura + estilo lápiz hecho a mano (Jul 2026)
- **Campo «Descripción física» por tipo de criatura** en «Bases de creación» → Nombres/Tipos
  (`descripcion_visual`, editable por Maestro). Se guarda en `npc_creature_name_config` y se expone
  vía `/npc-generator/creature-types`. Orco/Trol/Huargo traen descripción por defecto.
- `doRetrato` inyecta esa descripción como base prioritaria del prompt (para que un orco parezca un
  orco); usa `ct.descripcion_visual` (sin raza) o el tipo raíz de la familia (orcos→orco, etc.).
- **Estilo revertido a dibujo a lápiz HIPERREALISTA hecho a mano** (no foto): prompts reescritos en
  `/npc-generator/portrait` y prefijos de `trading_routes` («dibujo a lápiz de grafito hiperrealista,
  trazos visibles, aspecto de dibujo a mano, NO fotografía»).
- **Preview de creación** con `object-contain` (caja 3:4): se ve la figura entera, ya no se corta.

## Fichas de PNJ (comerciantes) impresas como los adversarios (Jul 2026)
- `NpcFichaCard` reestructurada al mismo layout 2-columnas (`.adv-top` / `.adv-portrait-col` /
  `.adv-info-col`): retrato grande a la izquierda + nombre/estadísticas(CA,PG,6 atributos)/Ubicación-
  Región-Sexo-Perfil a la derecha; el resto (Rasgo, Modo de hablar, apariencia, Habilidades,
  Herramientas, Sentidos, Idiomas, historia, notas) a lo ancho debajo. Aplica a pantalla y PDF.
- Se eliminó la regla de impresión específica del retrato de comerciante; ahora usa el mismo
  `.adv-portrait-col` (retrato grande, object-contain) y comparte el CSS de impresión con adversarios.

## Borrado rápido y masivo de PNJs/adversarios (Jul 2026)
- **Borrado rápido por tarjeta**: cada tarjeta compacta del navegador tiene un icono de papelera
  (con confirmación) sin necesidad de abrir la ficha.
- **Modo «Borrar varios»**: botón que activa selección múltiple; se marcan tarjetas (check + resalte),
  con «Seleccionar todos (N filtrados)», «Quitar selección», «Borrar N seleccionados» y «Cancelar».
- **Confirmación con aviso**: `window.confirm` advirtiendo que es DEFINITIVO y NO hay vuelta atrás.
  `bulkDeleteNpcs` borra en paralelo (`Promise.allSettled`), recarga y avisa por toast (éxitos/fallos).

## Subir retrato propio (JPG/PNG) para PJ, PNJ y Adversario (Jul 2026)
- **Backend (PNJ/Adversario)**: `POST /trading/npcs/{id}/portrait/upload` (multipart) valida imagen,
  guarda en GridFS (`content_type` en metadata), actualiza `retrato_file_id` y borra el anterior. El
  GET `/portrait` ahora sirve el `content_type` real (JPG/PNG). Componente reutilizable
  `PortraitUploadButton`.
- **UI PNJ/Adversario**: botón «Subir JPG/PNG» + preview en `AdversaryEditModal`; botón «Subir JPG/PNG»
  junto a «Generar trasfondo + retrato» en `NpcEditorModal` (comerciantes) cuando el PNJ ya existe.
- **PJ (personaje)**: en `CharacterHeader`, botón «Subir imagen» / «Sustituir por imagen» que convierte
  el JPG a PNG (canvas) y lo fija vía `PATCH /characters/{id}` (`portrait_image`+`portrait_locked`),
  permitiendo reemplazar incluso un retrato ya fijado.
- Verificado por API (upload JPG → GET image/jpeg 200) y por UI (botón + preview en el editor).

## Refactor de data_routes.py → travel_data_routes.py (Jun 2026)
- **Objetivo**: reducir el tamaño de `data_routes.py` (>4900 líneas) para escalabilidad.
- **Qué se hizo**: se extrajeron todos los endpoints de viaje/mapa (locations, regions, roads,
  rivers, barriers, pathfinding, travel, viaje/viajes, clima, distancias, monturas, custom-paths)
  y sus modelos Pydantic (RegionCreate, RoadCreate, RiverCreate, BarrierCreate, PathfindingRequest,
  TravelCalculationRequest, TravelConfig, SavedTravel, PathPoint, CustomPath) + helper
  `get_cardinal_direction` a un nuevo fichero `routes/travel_data_routes.py`.
- **Compatibilidad total**: el nuevo router mantiene el MISMO prefijo `/data`, así que todas las
  URLs del frontend siguen igual. Registrado en `server.py` como `travel_data_router`
  (import + include_router justo tras `data_router`).
- **Resultado**: `data_routes.py` 4960 → 3413 líneas; `travel_data_routes.py` 1594 líneas.
  Las 164 rutas `@router` se conservan (111 world + 53 travel), verificado por diff de rutas.
- **Verificación**: py_compile OK, pyflakes sin nombres indefinidos, y smoke-test por API externa
  (cultures/races/regions/roads/rivers/barriers/monturas/travel-options → 200).

## Editor de PNJ/Criaturas (NPCEditor): Ataque Múltiple opcional + Habilidades (Jun 2026)
- **Ataque Múltiple opcional** (pestaña Armas): ya NO aparece por defecto. Si el bloque está vacío se
  muestra un botón «Añadir ataque múltiple» (npc-multi-add); al añadirlo aparece el textarea
  (npc-multi-text) con un botón «Quitar» (npc-multi-remove) que lo limpia y oculta. En PNJs existentes
  con ataque múltiple, se muestra directamente. La ficha (AdversaryFicha) ya solo lo pintaba si existía.
- **Habilidades conocidas** (pestaña Defensa): nueva sección para añadir habilidades con su modificador
  (p. ej. Percepción +3, Sigilo +4). Desplegable con `ALL_SKILLS` (npc-hab-select) + recuadro de
  modificador (npc-hab-new-mod) + botón «Añadir habilidad» (npc-hab-add). Cada habilidad añadida se
  lista con su modificador editable (npc-hab-mod-<skill>) y papelera (npc-hab-remove-<skill>). El
  desplegable oculta las ya añadidas. Se guardan en `formData.habilidades` (objeto {skill: mod}) y los
  modificadores se normalizan a entero al guardar.
- **Visualización**: las habilidades se muestran en el detalle de NPCsSection (npc-detail-habilidades-<id>)
  y en la ficha de adversario (adv-ficha-habilidades) con formato «Percepción +3, Sigilo +4».
- Verificado por testing agent (frontend 100%) sobre la criatura «Gato».

## Descripción física de retratos IA independiente del nombre (Jun 2026)
- **Problema**: en «Bases de creación» → «Nombres / Tipos», el backend exigía al menos una sílaba de
  «Ataque» para guardar CUALQUIER tipo, así que un tipo que no genera nombre (usa raza/subcultura,
  p. ej. «Espectro») no se podía guardar y bloqueaba también su «Descripción física (para los retratos de IA)».
- **Backend** (`npc_generator_routes.py`): la validación de `PUT /creature-name-config` ahora permite
  guardar un tipo sin sílabas de Ataque siempre que tenga `descripcion_visual`. Solo rechaza tipos
  totalmente vacíos (ni ataque ni descripción). `generate_creature_name` (`npc_creature_names.py`)
  lanza un ValueError claro si se pide un nombre silábico de un tipo sin sílabas (evita 500).
- **Frontend** (`CreatureNameConfigEditor.jsx`): la sección de sílabas se marca como «Generación de
  nombre por sílabas (opcional)» con aviso de que se deja vacía para tipos que usan raza/subcultura;
  la descripción física queda claramente separada y se guarda de forma independiente.
- Verificado por API: Espectro (solo descripción) → 200; tipo vacío → 400; nombre de Espectro → 400 claro; nombre de Orco → 200.

## Retratos autónomos (sin créditos IA) + PDF con html-to-image (Jun 2026)
### Objetivo: app 100% autónoma en hosting privado, sin gastar créditos de IA en retratos.
- **PJ (CharacterSummary.jsx)**: eliminado el botón «Generar Retrato con IA». Ahora:
  «Copiar prompt para retrato» (POST /api/portraits/prompt, prompt en ESPAÑOL, sin IA) +
  «Subir retrato (JPG/PNG)» (base64 → PATCH /characters/draft/{id}/portrait). El prompt reúne
  cultura (prompt_imagen_ia), edad aparente por raza, ojos, pelo, rasgos físicos/faciales y
  vestimenta según ocupación.
- **Herrero PNJs/Adversarios (PNJForgeSection.jsx)**: eliminado el retrato IA. Ahora «Copiar prompt»
  (construido en cliente, español) + «Subir retrato» (POST /api/trading/npcs/portrait/upload-standalone
  → devuelve retrato_file_id + base64, guardado con el PNJ). El botón grande pasa a «Generar trasfondo (IA)».
- **Backend nuevo**: `portrait_routes.build_portrait_prompt_es` + `POST /portraits/prompt` (sin IA);
  `trading_routes` `POST /trading/npcs/portrait/upload-standalone`. El viejo `/portraits/generate`
  (IA) se conserva pero ya NO se usa desde la UI.
- **PDF (InteractiveCharacterSheet.jsx)**: cambiado `html2canvas` → `html-to-image` (toJpeg) +
  `await document.fonts.ready`. Corrige el desfase vertical del texto respecto a la vista web.
- **Verificado**: testing agent 100% (backend 6/6 pytest; Herrero UI + descarga PDF sin errores).
- **Pendiente opcional (P2)**: autoalojar la fuente caligráfica «Caveat» (hoy vía Google Fonts) para
  fidelidad total del texto manuscrito en el PDF y eliminar dependencia externa (autonomía).

## Campo posicionable CODIGOUNICOPJ (código único del PJ) (Jun 2026)
- **Problema**: el código único del personaje (character.codigo_publico) se salía por el borde
  derecho de la hoja (se renderizaba en x:1310 width:420 → borde 1730 > 1701 px) y aparecía cortado.
- **Solución**: nuevo campo posicionable independiente `CODIGOUNICOPJ` (SheetPage1.PAGE1_FIELDS,
  x:1160 y:55 width:500 fontSize:20 align:right → borde 1660 < 1701), renderizado con
  `getPos('CODIGOUNICOPJ')` que fusiona la posición guardada en el Editor sobre el default.
- SheetPage1 ahora recibe `fieldPositions` (page1) desde InteractiveCharacterSheet, de modo que las
  posiciones del Editor afectan a este campo. Añadido a FIELD_SUGGESTIONS del Editor y sembrado por
  defecto al cargar si no existe en BD (arrastrable y persistible vía PUT /data/sheet-positions).
- Verificado por testing agent (frontend 100%): el código 'HOMDUNE2611023' se ve completo dentro de
  la hoja y CODIGOUNICOPJ aparece/mueve en /sheet-editor, sin errores de consola.

## Campo de imagen RETRATO en la ficha oficial (Jun 2026)
- Nuevo campo posicionable **y redimensionable** `RETRATO` en el Editor de posiciones (/sheet-editor)
  que representa la imagen del retrato del personaje (character.portrait_image).
- Editor: recuadro azul con tirador de esquina (data-testid retrato-resize-handle) para arrastrar y
  redimensionar, + inputs Ancho y Alto (retrato-height-input). Sembrado por defecto (x:70,y:120,
  380x480,page1), añadido a FIELD_SUGGESTIONS y persistido (x,y,width,height) vía PUT /data/sheet-positions.
- Render: SheetPage1 pinta <img data-testid='sheet-retrato-image'> con getPos('RETRATO') (width/height)
  cuando el personaje tiene portrait_image; aparece también en el PDF exportado (misma captura).
- Verificado por testing agent (frontend 100%): editor, redimensionado por inputs, persistencia tras
  recargar (480→600), imagen renderizada en la hoja del personaje, sin regresiones en CODIGOUNICOPJ.

## Prompt de retrato + Sistema de Virtudes con elección (Jun 2026)
### Prompt del retrato (PJ y PNJ)
- Nueva frase de estilo: "Dibujo fotorrealista a lápiz de grafito, obra maestra, muy detallado, arte a
  lápiz crudo dibujado a mano". PJ ahora es CUERPO ENTERO e incluye las ARMAS/equipo del personaje.
- El trasfondo solo se añade si es una descripción con contenido (>=60 chars), no un simple nombre.
- Backend build_portrait_prompt_es (+ campo armas en PortraitRequest); payloads de CharacterSummary y
  CharacterHeader envían armas (equipo_ocupacion). Verificado por API.

### Virtudes: elección real + aplicación completa + ficha
- Paso 5 (Step5Virtue): selectores para ELEGIR característica (+1), habilidad, salvación y herramienta
  (data-testid virtue-char-*/virtue-skill-*/virtue-save-*/virtue-tool-*). Continuar deshabilitado hasta
  elegir cuando hay 2+ opciones. Envía la elección concreta (no todas las opciones).
- Backend: step5 aplica el +1 de la característica elegida a atributos_finales (map ES→key). finalize
  aplica PG/CA/Comunidad extra y añade competencias (habilidades_virtud, tiradas_salvacion, herramientas)
  y guarda virtud_caracteristica_elegida.
- **BUG CRÍTICO CORREGIDO**: finalize usaba draft['caracteristicas'] (base) en vez de atributos_finales,
  perdiéndose el +1 de virtud Y los modificadores de cultura y la mejora Noldor. Ahora
  `final_attributes = atributos_finales or caracteristicas`. (Solo afecta a personajes NUEVOS; los
  existentes se dejan como están, por decisión del usuario.)
- Ficha oficial: nuevo campo posicionable multilínea `DescripcionVirtud` (texto completo: nombre +
  descripción + rasgos + "Efectos: +1 INT · Competencia: ..."). En FIELD_SUGGESTIONS y sembrado en editor.
- Verificado: testing agent backend 100% (6/6 incluida persistencia del +1); frontend por revisión de
  código (los selectores y el render coinciden con la spec).


## Iter 133 — Fix +1 virtud (raíz) + editor de virtudes + reglas de virtud + filtros + montura (Jun 2026)
- **BUG RAÍZ +1 virtud (P0) RESUELTO**: el asistente asigna atributos en el Paso 1 (Cultura) y
  los guarda en `draft['caracteristicas']`; el endpoint `step4` (`atributos_finales`) NUNCA se
  ejecuta. Por eso `update_draft_step5` leía `atributos_finales` (vacío) y el +1 no se aplicaba a
  nada. FIX en `drafts.py::update_draft_step5`: `atributos = dict(caracteristicas or atributos_finales or {})`
  (recalcula en fresco cada vez → idempotente al revisitar el paso). Verificado E2E por curl y por
  testing agent iter100 (INT 11→12 tras step5+finalize).
- **PERFECCIONAMIENTO** (virtud común NUEVA): +2 a una característica o +1 a dos (tope 20).
  Selector en Step5 (`virtue-perf-mode-one/two`, `virtue-perf-<stat>`). Backend aplica con
  `min(20, x+bonus)`. Script `scripts/update_specific_virtues.py`.
- **MAESTRÍA**: además del +1, otorga Pericia (doble competencia) en una habilidad/herramienta que
  ya domines. Selector `virtue-pericia-<opt>` (lee draft.habilidades_competencia/herramientas). Se
  guarda en `virtud_pericia_elegida` y se añade a `pericia_elegida` en finalize (la hoja la marca 'P').
- **FIRMEZA** (+1 PG por nivel, flag `pg_por_nivel`) y **MANO IMPERTURBABLE** (+1 daño armas de FUE,
  flag `bonus_dano_fuerza`): textos/flags actualizados. `map_virtue` expone los 4 flags.
- **EDITOR DE VIRTUDES** (bug: onEdit era TODO vacío): nuevo `components/admin/VirtueEditor.jsx`
  (modal con todos los campos). Cableado en RulesPage (Nueva Virtud + Editar). CRUD /data/virtudes.
  Corregido el borrado en VirtuesSection (endpoint /virtudes y `id` en vez de `_id`).
- **RETRATO PDF por página**: SheetPage1 solo pinta el retrato si está en page1 o si no está en
  ninguna (fallback, prop `retratoFallback`); SheetPage2 lo pinta si está en page2. Antes salía
  siempre en la 1. El PDF reutiliza estos componentes.
- **Pestaña Trasfondo (BackgroundCard)**: el bloque de Virtud muestra ahora TODOS los aportes
  (bonos fijos, +1 elegido, PG/CA/Comunidad, habilidad/salvación/herramienta). testid summary-virtud-block.
- **Filtros MIS PERSONAJES** (CharactersListPage): desplegables Raza/Subcultura/Ocupación/Ubicación
  + 'Limpiar filtros' (filter-raza/-subcultura/-ocupacion/-ubicacion/-clear), sobre el buscador de texto.
- **Carga del jinete** (DistributionView): la tarjeta de montura montada muestra 'Carga (sin jinete)',
  'Carga del jinete' y 'Total sobre la montura' (mount-rider-load-{id}). Datos del backend
  (peso_sin_jinete / peso_cargado).
- **Hobbits descalzos** (Step7Equipment): se filtra cualquier 'Botas' del equipo inicial para
  culturas Hobbit/Mediano.
- Verificado: testing agent iter100 (backend 4/4 100%, frontend filtros + editor de virtudes 100%).
  Test file: tests/test_virtue_bugs_iter100.py. Personajes antiguos se dejan como están (decisión del usuario).

## Iter 134 — Resumen de creación: pesos de tienda + caballo no cuenta como peso personal (Jun 2026)
- **Pesos de lo comprado en la tienda** (CharacterSummary, "EQUIPO COMPLETO / PESO TOTAL"): antes se
  ignoraba el `peso_kg` persistido y se usaba una tabla local que devolvía 0.25 kg por defecto para lo
  desconocido (accesorios de monta, etc.). Nuevo helper `resolveWeight(item, name, qty)` que prioriza
  `item.peso_kg` (lo comprado lo trae del catálogo; verificado: Alforjas 3.6, Bocado y bridas 0.5) y
  cae a la tabla local solo si falta.
- **Caballo + accesorios de monta NO cuentan como peso personal**: helpers `isMount` (por categoría
  'monturas' o keywords caballo/poni/mula…) e `isMountAccessory` (silla de monta, bocado/bridas,
  alforjas, arnés, herradura…). `cargaElCaballo()` los excluye del `totalWeight` (los carga la montura);
  se siguen listando con marca 🐎 y nota aclaratoria en Equipo General.
- Alcance: SOLO el resumen de creación (lo pedido). La ficha final ya excluye lo marcado
  `portado_por === 'montura'`. Compila OK; verificado por inspección de código + datos del catálogo.


## Iter 135 — Auto-ajuste de letra en 'descripcion_ocupacion_larga' (ficha oficial, pág. 3) (Jun 2026)
- Nuevo componente `AutoFitField` en `SheetPage1.jsx` (exportado): reduce automáticamente el
  tamaño de letra hasta que TODO el texto cabe dentro del recuadro (width × height) del campo,
  midiendo `scrollHeight` en `useLayoutEffect` (mín. 12px). Re-mide al cargar la fuente Caveat
  (document.fonts.ready) para que el PDF quede exacto.
- `SheetPage3.jsx` usa `AutoFitField` para `descripcion_ocupacion_larga` y ahora respeta las
  posiciones/tamaños personalizados del Editor (nuevo `getPos` que fusiona fieldPositions sobre
  PAGE3_FIELDS) — antes SheetPage3 ignoraba las ediciones del Editor de posiciones.
- Verificado visualmente: personaje HalAnar (~3.700 chars de descripción) → el texto cabe entero
  y formateado en el recuadro (antes se recortaba con fontSize fijo 40).


## Iter 136 — Texto fantasma en esquina de Página 2 de la ficha (Jun 2026)
- Los campos `rasgos_culturales_1/2` se pintaban con `getPos` pero NO estaban en `PAGE2_FIELDS`,
  así que caían al fallback {x:0,y:0} y su texto (rasgos culturales) salía en la esquina
  superior izquierda, fuera del recuadro. FIX: helper `hasPos()` en SheetPage2; esos dos campos
  solo se renderizan si tienen posición definida (editor o PAGE2_FIELDS). Verificado por captura.

## Iter 137 — rasgos_culturales_1/2 multilínea con auto-ajuste (Jun 2026)
- El usuario colocó rasgos_culturales_1/2 en el editor (page2) pero se pintaban en una sola
  línea (DisplayField sin multiline). Ahora usan `AutoFitField`: el texto se envuelve dentro de
  la anchura y el tamaño de letra se reduce para que quepa TODO en el alto disponible, sin
  solaparse con el bloque siguiente. Alto por defecto: el del editor, o hasta el siguiente
  bloque (col1), o un valor razonable (col2). Verificado por captura (personaje Odvin, 7 rasgos).

## Iter 138 — Rasgos culturales unificados en un solo recuadro justificado (Jun 2026)
- Nuevo campo ÚNICO `rasgos_culturales` (sustituye a rasgos_culturales_1/2). Une TODOS los rasgos
  en un bloque, con texto JUSTIFICADO (align: justify) y auto-ajuste de letra (AutoFitField) para
  caber en el recuadro (inicio x,y ; fin x+width, y+height).
- Editor de posiciones: `rasgos_culturales` añadido a campos disponibles y renderizado como CAJA
  redimensionable (borde morado + tirador, data-testid rasgos-culturales-resize-handle) para que el
  usuario defina dónde empieza y termina. Al nombrarlo se marca multiline+justify+alto por defecto.
- PAGE2_FIELDS.rasgos_culturales default (x900,y1090,w300,h620,justify). SheetPage2 pinta un solo
  AutoFitField uniendo todos los rasgos. Migración BD: eliminados _1/_2, creado rasgos_culturales.
- Verificado por captura (Odvin, 7 rasgos): todo junto, justificado y ajustado dentro del recuadro.

## Iter 139 — Peso de montura unificado ficha oficial = gestor + avisos de tienda (Jun 2026)
- BUG (circulado): la ficha oficial mostraba un peso de montura distinto (139) al del Gestor de
  Equipamiento (124.6) porque recalculaba por su cuenta (y duplicaba accesorios). FIX: InteractiveCharacterSheet
  carga `/characters/{id}/weight-summary` (misma fuente autoritativa del backend) y lo pasa a SheetPage1;
  el campo montura_peso usa `peso_cargado`/`capacidad` de monturas_detalle. Verificado: ahora "Poni robusto, 125/130 Kg".
  (Corregido también un ReferenceError pesoEnMontura al reintroducir la declaración del cálculo de reserva.)
- Accesorios de monta asignados al caballo en la ficha final: el backend ya los cuenta en peso_sin_jinete/
  peso_cargado; la ficha ahora refleja ese cálculo autoritativo (no cuentan como peso personal).
- Avisos de tienda: EquipmentManagerModal YA avisaba (silla+bridas para montar, alforjas para cargar,
  excepción de razas). Añadido el MISMO aviso en TiendaD100 (tienda de ubicación) al comprar una montura
  (utils/mountUsage.getMountUsageStatus).
- Sobrecarga en rojo: DistributionView ya lo hace (getRingColor rojo a >=95%, toast "no puede cargar más peso").

## Iter 140 — FIX 404 al guardar ubicación (paso 9) y en viajes/rutas (Jun 2026)
- CAUSA RAÍZ: /data/locations serializa `id`=str(_id) (ObjectId), pero las búsquedas hacían
  find_one({"_id": <string>}) que NUNCA casa con un ObjectId, ni {"id": <string>} (el campo id
  propio es "loc_002"). Resultado: 404 "Ubicación no encontrada" al guardar el paso 9 y en
  detalle de ubicación / cálculo de rutas.
- FIX: nuevo helper utils/locations.find_location(db, id) que prueba `id`, `_id` string y
  ObjectId(id). Aplicado en: character/drafts.py (step9), character/core.py, character/chests.py,
  travel_data_routes.py (get_location, calculate-route x2), travel_routes.py (4 sitios).
- Verificado: PATCH step9 guarda ubicacion_actual OK; GET /data/locations/{oid} 200 (antes 404);
  calculate-route 200. Backend reinicia limpio.

## Iter 141 — Asignación de profesiones POR ÍTEM (varios a la vez) (Jun 2026)
- Precios de Equipo: nuevo botón "Por ítem" en cada bloque (data-testid bulk-prof-toggle-{cat}) que abre
  un modal (bulk-prof-modal) para asignar profesiones a varios ítems concretos a la vez.
- Flujo: 1) seleccionar ítems (checkbox + buscar + todos/ninguno), 2) acción (Asignar/reemplaza,
  Añadir a las actuales, Volver a heredar del bloque), 3) elegir profesiones. Aplica con PUT
  /data/equipment/{cat}/{nombre} {profesiones:[...]} por cada ítem. Ej: Posadero vende solo
  Caballo de caminos y Poni robusto, no todas las monturas.
- Verificado por captura: modal renderiza y funciona. Backend endpoint ya existía (merge de campos).
