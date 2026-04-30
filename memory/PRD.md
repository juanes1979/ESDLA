# LOTR 5e RPG - Product Requirements Document

## Current State (2026-04-30)

### ✅ Iteración 93 — todo el reparto entre TODOS los viajeros (con papel + acompañantes)

Mis disculpas: en iter92 toqué sólo `travelPrint.js` (la copia para imprimir), no la app en vivo. Ahora repaso TODO el flujo de fin de viaje:

1. **`ResultsView.jsx` (panel "Puntos de Experiencia Ganados" en la app)**
   - Antes filtraba `config.miembros.filter(m => m.papeles?.length > 0)` → divisor = 4.
   - Ahora `[...config.miembros, ...config.acompanantes]` → divisor = 7. La tabla muestra los 7 con etiqueta "Acompañante" cuando no hay papel; reciben PX viaje pero PX tiradas = 0.

2. **`EnhancedTravelSystem.jsx → applyPXToCharacters`** (el botón "Finalizar Viaje y Repartir PX")
   - Antes `membersWithRoles.length` como divisor y sólo aplicaba PX a esos 4.
   - Ahora reparte el PX base entre los 7 y llama al endpoint con la lista completa. Acompañantes reciben PX viaje (sin PX tiradas).

3. **`EnhancedTravelSystem.jsx → calculateFatigueResults`** (panel "Tiradas de Fatiga" + sección del print "FATIGA DEL VIAJE")
   - Antes iteraba sólo `config.miembros` (4) → en imagen 1 sólo aparecían 2 visibles + en imagen 3 (PDF) sólo 4.
   - Ahora itera `[...config.miembros, ...config.acompanantes]` → tira CD-CON para los 7. Etiqueta "Acompañante" si no tiene papel.

4. **`travelPrint.js`** (mantenido de iter92): La Compañía + tabla PX + Resumen ya cuentan a los 7.

---

### ✅ Iteración 92 — 4 fixes (PX, mini-mapa, CD fatiga +2, Cambiar categoría desde listado)

1. **PX del viaje se reparten entre TODOS los viajeros (no sólo los con papel)** — `travelPrint.js`: el reparto del PX base del trayecto ahora cuenta `[...miembros, ...acompañantes]`. La tabla del print incluye una fila por cada uno; los acompañantes muestran "acompañante" como papel y reciben sólo PX viaje (las PX por tirada siguen requiriendo papel). La sección "La Compañía" del informe también lista a los 7.

2. **LocationWidget — fórmula corregida con aspect ratio del mapa**
   El error era usar `top: 50% − (100−y)*4%` asumiendo que la imagen tenía altura 400% del contenedor. Pero al ser `width:400% / height:auto`, la altura efectiva es `400 / (W/H) ≈ 305.86%`. Nueva fórmula: `top: 50% − screenY × IMG_HEIGHT_PCT/100` donde `IMG_HEIGHT_PCT = 400 / (19791/15133)`.

3. **CD fatiga +2 al fallar Percance — ahora se aplica en vivo**
   Antes el HUD se quedaba en CD fatiga 10.0 hasta el final del viaje. Ahora `EnhancedTravelSystem.jsx` actualiza `globalFatigaCD` y el `activeJourney` localmente al fallar Percance, y persiste mediante el nuevo endpoint `PATCH /api/travel/journey/{id}/fatigue-cd?delta=2&reason=…` (añadido a `travel_routes.py`).

4. **"Cambiar categoría" desde el botón "Editar" del listado de Reglas → Equipo**
   El botón estaba sólo en `RulesPage.jsx` pero el "Editar" del listado abre `EquipmentSection.ItemEditorModal`. Añadido el botón ahí también, con su propio diálogo y handler. Llama a `/equipment-catalog/move-item` con `replace=true` (sólo conserva nombre, precio, moneda, peso_kg, comentarios, nivel_asentamiento, regiones_disponibles).

---

### ✅ Iteración 91 — 4 fixes en bloque (pensado antes de tocar)
**(Smoke + curl: LocationWidget centrado en Bree ✓; move-item/replace=true preserva sólo 4 campos comunes ✓)**

1. **LocationWidget — fórmula CSS background-position era incorrecta**
   Causa real: `background-position: X% Y%` NO centra el bg en el punto (X%, Y%). Para un bg de 400% y centrar en bg-point Q%, la fórmula correcta es `P = (Q − 12.5) × 4/3` (sólo aplica a 400%). Solución: reemplazar el truco de `background-image` por un `<img>` posicionado explícitamente con `width: 400%`, `left: 50% − x*4%`, `top: 50% − (100−y)*4%`. Ahora Bree (35.6, 71.4) aparece exactamente debajo del marcador rojo.

2. **Desventaja por estación → desventaja por clima adverso**
   `EnhancedTravelSystem.jsx`: `desventaja_salvacion: esExtremo` (en vez de `!!data.desventaja_estacion`). Etiquetas en `DayByDayView` y `GlobalJourneyView` cambiadas a "Clima adverso → Desventaja en TS y prueba". Si el día es despejado en otoño → sin desventaja; si hay tormenta/ventisca/nieve fuerte → desventaja.

3. **Eventos en el Mapa del Viaje colocados por arc-length**
   `JourneyMiniMap.jsx`: pre-cómputo de distancias acumuladas a lo largo de `naturalPath` y nueva función `pointAtProgress(p)` que coloca cada evento en el punto donde la distancia recorrida = `casilla / casillaTotal × distancia_total`. Antes se usaba `pathIndex = floor(p × N)`, lo que amontonaba eventos en curvas con muchos puntos de control.

4. **"Cambiar categoría" en Reglas → Equipo (Editar)**
   `RulesPage.jsx`: nuevo botón "Cambiar categoría" en la cabecera del editor de items. Abre un diálogo con un select de las 24 categorías. Al confirmar, llama al endpoint `move-item` con `replace=true` (nuevo flag añadido a `MoveItemRequest` en `data_routes.py`), preservando sólo los campos comunes (`nombre, precio, moneda, peso_kg, comentarios, nivel_asentamiento, regiones_disponibles`). Tras mover, el editor reabre el item en la nueva categoría para que el usuario rellene los campos específicos. Verificado por curl: tras mover un item de `consumibles` a `herramientas`, sólo quedan 4 campos (sin `es_comida`, `porcentaje_racion`).

---

### ✅ Iteración 90 — 3 fixes en bloque (zoom-overlay, LocationWidget Y-flip, botones edit-categoría)
**(Smoke test: zoom 300% en MapPickDialog → overlay rojo perfectamente encajado sobre Mar de Belegaer + cordilleras de las Montañas Nubladas individuales)**

1. **MapPickDialog — overlay desplazado al hacer zoom**
   - Causa: `transform: scale()` en CSS no dispara `ResizeObserver` (el layout-box no cambia, sólo el rect post-transform).
   - Fix: nuevo `useEffect` en `[zoom, pan, open]` con `requestAnimationFrame(measure)` para re-anclar el SVG y el marcador después del commit del DOM.

2. **LocationWidget — mini-mapa descuadrado en la ficha**
   - Causa: el mismo bug Y-invertido de iter89. `backgroundPosition: '${x}% ${y}%'` interpretaba `y` con convención de pantalla (Y=0 arriba) cuando el DB usa Y=0 abajo.
   - Fix: `backgroundPosition: '${x}% ${100 - y}%'`. Ahora el mini-mapa muestra la zona correcta del mapa cuando el personaje está en Bree (35.6, 71.4 → 35.6%, 28.6% pantalla).

3. **EquipmentManagerModal — botones "📁" no deben editar categorías**
   - Eliminado el botón `<FolderOpen>` con `data-testid="edit-item-…"` (líneas 1339–1359). La edición de categorías ahora SÓLO se hace en la hoja de Reglas → Equipo, como pidió el usuario.

---

### ✅ Iteración 89 — Map Picker: corrección crítica del eje Y invertido
**(Smoke test: click en Eriador (24.1, 64.9) → región "Eriador" + overlay rojo perfectamente alineado sobre Mar de Belegaer, Montañas Nubladas, etc.)**

**Bug crítico encontrado** — el sistema tiene una convención **Y-axis invertida** (Y=0 en el FONDO del mapa, Y=100 en lo ALTO) — confirmado en `JourneyMiniMap.jsx:138` (`Y: 0% = bottom, 100% = top`). Mi MapPickDialog leía `yPct = imgY/height*100` (Y=0 arriba), provocando:
1. Click arriba (Eriador) → DB `y=18.6` → realmente caía en agua de Harad/Sur (donde DB y=18.6 corresponde).
2. La ubicación más cercana se calculaba con coords cruzadas → "Andrast · Gondor" (sur) cuando el usuario clicaba en Eriador (norte).
3. Pathfinder fallaba porque el origen estaba en agua del sur.
4. El overlay SVG renderizaba los polígonos al revés (de ahí "está volteada").

**Fix:**
1. `onMouseUp`: `yPct = 100 - (imgY/rect.height)*100` para alinear con la convención del proyecto.
2. SVG overlay: envuelto en `<g transform="scale(1, -1) translate(0, -100)">` para flip vertical en pantalla.
3. Marcador: `py = top + ((100 - picked.y)/100) * height` para mostrar en la posición correcta de pantalla.
4. Comentarios explicativos referenciando `JourneyMiniMap.jsx` para evitar regresiones futuras.

**Verificado** (`pathfinding._get_terrain_at_point`):
- Antes: click superior → `(32.7, 18.6)` → `terrain=agua, nearest=Andrast (Gondor)` ❌
- Ahora: click superior → `(32.7, 81.4)` → `terrain=moderado, nearest=Colinas de Evendim (Eriador)` ✅

---

### ✅ Iteración 88 — Map Picker: overlay rojo de zonas infranqueables + bloqueo de clic
**(Smoke test: clic en tierra válida (50.2, 50.2) → marcador OK + región "Rohan"; clic en agua/montañas → bloqueado con toast)**

**Origen del bug** — El usuario reportó "No se pudo encontrar una ruta válida" tras hacer clic en un punto que él creía Eriador (32.7, 18.6). Investigación: ese punto cae sobre un polígono de tipo `agua` (sin que la imagen del mapa lo deje claro). El pathfinder funcionaba correctamente; el problema era que el origen estaba en agua.

**Fix (continuación de iter87)**
1. `MapPickDialog`: nueva capa SVG superpuesta con polígonos rojos translúcidos sobre **todas** las zonas `agua` + `infranqueable` del catálogo `/api/data/terrain-polygons`.
2. **ResizeObserver** + `onLoad` re-anclan el overlay al rect real de la imagen, manteniendo la alineación cuando cambia zoom/pan/tamaño de ventana.
3. **Click bloqueado**: ray-casting `pointInPolygon` rechaza con `toast.error("No puedes elegir ese punto: está sobre agua/zona infranqueable")` antes de fijar el marcador.
4. Texto explicativo en el header del diálogo: "Las zonas en rojo son infranqueables (agua / barreras) y no se pueden seleccionar."

---

### ✅ Iteración 87 — Map Picker: clic en cualquier punto del mapa (sin snap a ubicaciones)
**(Backend curl PASS para `calculate-journey` y `compare-routes` con coords custom)**

**Bug reportado** — El usuario clicaba en un punto cualquiera del mapa pero el marcador SALTABA a la ubicación más cercana (ej. "Más cercano: Andrast · Gondor"). El usuario pidió: «se puede elegir cualquier parte del mapa con la única salvedad de las zonas infranqueables».

**Fix completo**
1. `MapPickDialog.jsx` reescrito: el marcador se coloca **EXACTAMENTE** donde se hace clic (sin snap). Etiqueta cambiada a `Coordenadas: 45.2, 67.8 · región: Eriador`. Cursor de canvas pasado a `crosshair`.
2. La región del clic se hereda silenciosamente de la ubicación más cercana (solo para clima/terreno).
3. `JourneyConfig` y `RouteComparisonRequest` (backend) ahora aceptan `origen_x/y, destino_x/y` opcionales. Si el id empieza por `custom:` o se mandan coords, se construye una location virtual con la región heredada y se ejecuta el pathfinder con esas coords.
4. `EnhancedTravelSystem.jsx` y `ConfigView.jsx`: nuevos campos en `config` (`origenX/Y, destinoX/Y`); se envían a los 3 endpoints (`calculate-journey`, `compare-routes`, `journey/start`); se resetean a `null` cuando el usuario elige desde el dropdown clásico.

**Verificación**
- `curl /api/travel/calculate-journey` con coords custom → ruta calculada (40 km, 2 casillas, terrain "facil").
- `curl /api/travel/compare-routes` con coords custom → linea_recta + ruta_caminos OK.

---

### ✅ Iteración 86 — 3 bugs reportados con vídeos: checkbox admin, edit-item, montura no detectada
**(Backend testing agent 61/61 PASS — 100% incl. regresión de iter66/67/68/69, frontend lint OK)**

**Bug 1 — Admin checkbox "marcar/desmarcar todos" no toggle**
- En `/app/frontend/src/components/rules/EquipmentSection.jsx`, el `Checkbox` Radix se intentaba poner indeterminate vía `ref.indeterminate` (no funciona en Radix).
- Fix: pasamos `checked={isIndeterminate ? 'indeterminate' : allItemsAvailable}` (Radix soporta el string) y el `onCheckedChange` ahora flippea siempre: si **algo** está marcado → desmarca todo, si nada está marcado → marca todo. Ya no se queda atascado en indeterminado.

**Bug 2 — Editar / cambiar de bloque un item**
- Nuevo endpoint `PATCH /api/characters/{id}/equipment/edit-item` con `{item_index, source, nueva_categoria, nueva_posicion, nuevo_nombre}`. Soporta `source ∈ {inventario, equipo, equipo_ocupacion}`. Validaciones 400/404.
- En `EquipmentManagerModal`, nuevo botón 📁 (FolderOpen, azul) en cada item movible que abre AlertDialog con `<select>` de categoría (Equipo General / Herramientas / Ropa / **Consumibles** / Comida en Posadas / Hierbas / Venenos / Accesorios de Montura / Transporte). Cuando la nueva categoría es 'ropa', aparece un segundo `<select>` para la posición.
- Caso del usuario: ahora puede mover "Raciones (1 día) (Paquete de 10)" del bloque General a Consumibles directamente desde la ficha.

**Bug 3 — Caballo de caminos no detectado como montura**
- El personaje tenía el caballo en `equipo_ocupacion` (legado de la creación) y `monturas[]` estaba vacío → `PATCH /equipment/carry` rechazaba con 400 "El personaje no tiene montura".
- **Fix múltiple**:
  1. `POST /equipment/add` con `item_category='monturas'` ahora puebla TANTO `character.montura` (legacy mirror) **como** `character.monturas[]` (lista nueva con id, nombre_original, capacidad, velocidad).
  2. `PATCH /equipment/carry` ahora detecta monturas en cualquier fuente (`inventario`, `equipo_ocupacion`, `equipo_nivel_vida`, `equipo_trasfondo`) por keywords (caballo/pony/poni/mula/burro/corcel/yegua/potro/asno).
  3. **Auto-promoción**: si detecta una montura fuera de `monturas[]`, la promociona automáticamente a `monturas[]` con datos del catálogo + sus campos guardados, y la elimina del array original.
  4. **Ajuste de índice**: si el usuario pidió mover un item del mismo source de la montura promocionada, su `item_index` se decrementa para no apuntar al item equivocado.
  5. `_current_list(src)` helper que lee de `update` primero (lista ya trimada) → evita el bug HIGH detectado en iter69 donde el horse aparecía duplicado.

**Tests**
- `/app/test_reports/iteration_69.json` — 18/19 (1 HIGH detectado).
- `/app/test_reports/iteration_70.json` — **61/61 PASS, 100%**, 0 issues críticos. Regresión completa iter66-69 verde.
- Test files: `test_mount_autopromote_edit_it69.py` (mantenido para retest).

**Comentarios del testing agent (no críticos, llevan repitiéndose 4 iteraciones)**
- 🛠️ `character_routes.py` ya supera **2692 líneas** — pendiente split en `character_equipment_routes.py` / `character_mount_routes.py` / `character_location_routes.py`.
- Constante `mount_keywords` duplicada en 2 lugares — extraer a módulo.

**Pendiente (backlog) — siguen tras estos fixes**
- Filtro real de tienda por región (hoy aviso)
- Filtro real para usar montura (Alforjas / Bocado+Brida+Silla)
- P0 Login + RBAC + Sistema de Campañas
- P1 Pantalla DJ (incl. transferir inventario entre personajes)
- P1 Subida de mapas/aventuras
- Refactor `character_routes.py`

### ✅ Iteración 85 — Ubicación del personaje (C-5) + "Indicar en mapa" para viajes (C-6)
**(Backend testing agent 31/31 PASS — 100%, frontend lint OK, smoke OK)**

**C-5 — Ubicación del personaje**
- Nuevo campo `character.ubicacion_actual = {id, nombre, region, tipo, x, y, tipo_tierra, terreno}` (denormalizado al guardar para evitar joins).
- **Creación de personaje** (Step8Details): bloque "Ubicación inicial" con buscador + lista agrupada por región (filtrada a tipos de asentamiento: ciudad / pueblo / aldea / fortaleza / refugio …). Es **obligatorio** para finalizar el personaje.
- **Endpoint** `PATCH /api/characters/{id}/ubicacion` con `{location_id, force}`. Si `character.campaign_id` está fijado y `force=false` → **403** (sólo el DJ con `force=true` puede cambiarla cuando RBAC esté listo).
- **Finalize** del draft copia `ubicacion_actual` al personaje creado.
- Validaciones: 404 si la ubicación no existe (tanto en `PATCH /ubicacion` como en `step9`).
- **Widget "Estás aquí"** (`LocationWidget.jsx`) en la cabecera de la ficha:
  - Mini-mapa cuadrado (96 px) recortado a la zona del asentamiento usando `background-image` + `background-position` con las coords del location (zoom 4×) y un dot rojo central.
  - Texto: región + nombre + tipo.
  - Botón **"Cambiar"** abre dialog con búsqueda y lista; **deshabilitado con icono de candado** cuando el personaje está asignado a campaña.
- (Backlog) Filtro real de tienda por región se queda para la siguiente iteración: `regiones_disponibles` ya está en los items del catálogo, sólo hay que aplicar el filtro al render.

**C-6 — "Indicar en el mapa"**
- Nuevo botón `📍 Indicar en mapa` junto a las etiquetas Origen y Destino del viajador.
- `MapPickDialog.jsx`: dialogo full-screen (96 vw × 90 vh) con la imagen `mapa_jugadores.jpg` **vacía** (sin etiquetas ni iconos).
- Controles: arrastrar para pan, rueda del ratón para zoom (1×–6×, paso 25 %), botón Centrar.
- Al hacer click en un punto, se calcula la ubicación más cercana por distancia euclídea sobre las coords (x, y) en %; se muestra un dot rojo grande sobre el mapa y un texto "Más cercano: X · Región".
- Al confirmar → `setConfig({origenId|destinoId})` con el id de la ubicación elegida.

**Tests**
- `/app/test_reports/iteration_68.json` — **31/31 PASS** (100%) incl. regresión de C-5 + iter67 (eventos por terreno + carry equipo_ocupacion).
- Test file: `/app/backend/tests/test_ubicacion_it68.py`.

**Pendiente (backlog)**
- Filtro real (no aviso) de tienda por región usando `character.ubicacion_actual.region` y `item.regiones_disponibles`.
- Filtro real para usar montura (Alforjas / Bocado+Brida+Silla) — hoy es solo aviso.
- Refactor `character_routes.py` (≥ 2530 líneas) → split en `character_equipment_routes.py`, `character_mount_routes.py`, `character_location_routes.py`.
- P0 RBAC + Sistema de Campañas (CAMPAIGN_ARCHITECTURE.md).
- P1 Pantalla del DJ + subida de mapas.

### ✅ Iteración 84 — Bugs (Bloque A) + Avisos compra montura (B) + Reorg Comida (B) + Tabla Eventos (C-7)
**(Backend testing agent 26/26 PASS — 100%, frontend lint OK, smoke OK)**

**Bloque A — Bugs reportados**
- **Armas/armaduras de `equipo_ocupacion` ahora son MOVIBLES y con toggle "activa"**.
  El bug era que las armas/armadura del trasfondo viven en `character.equipo_ocupacion[]` (no en `armas[]`/`armadura`).
  - Frontend: `getAllEquipment()` ahora marca `canMove=true` y `canToggleActive=true` con `apiSource='equipo_ocupacion'`.
  - Backend: `PATCH /equipment/carry` y `/equipment/toggle-active` aceptan `source='equipo_ocupacion'`.
  - `weight-summary` itera ahora `equipo_ocupacion` y aplica `portado_por=montura` correctamente.
  - `delete_mount` reasigna también items de `equipo_ocupacion`.
- **Inconsistencia provisiones del viaje** (header "130.2/114 raciones OK" vs alerta predictiva "Faltan 48").
  - `JourneyForecastCard` recibe ahora `provisionsCheck` desde el contenedor → ambas vistas usan la **misma fuente** (logic incl. asentamiento conocido + diasComidaTotal por masa).
  - Display unificado con 1 decimal (`130.2/114`).

**Bloque B — Avisos al comprar montura + Reorg comida en creación**
- Nuevo helper `/app/frontend/src/utils/mountUsage.js`: detecta si el personaje tiene Alforjas / Bocado y bridas / Silla de monta; flag `puedeMontarSinSilla` para Elfos / Rohirrim / Dúnedan.
- Al comprar `monturas` (cualquier item del catálogo): toast warnings:
  - Sin Alforjas → "NO podrás cargarla sin Alforjas".
  - Sin Bocado+Bridas+Silla → "Para montarla necesitas: Bocado y bridas / Silla de monta (excepto Elfo, Rohirrim, Dúnedan)".
  - Si la cultura permite montar a pelo, mensaje informativo en lugar de warning.
- Filtro real (no permitir cargar/montar) → se aplicará al implementar Bloque C-5 (ubicación) según el flujo del usuario.
- **Step7Equipment** (creación de personaje):
  - Categoría "Comida" renombrada a **"Consumibles"** y limitada a `consumibles` (sin `comida_posadas`).
  - Nueva categoría **"Ropa"** disponible en la tienda de creación.
  - `comida_posadas` queda fuera de la creación; sigue accesible en el modal de equipo durante la partida (lo filtraremos por ubicación en C-5).

**Bloque C-7 — Tabla de eventos de viaje correcta**
- **CD por terreno**: `gran_camino`/`camino_*`/`sendas` → CD 10; `campo_abierto` → CD 15; `muy_dificil`/`desalentador` → CD 20.
- `POST /api/travel/generate-event` devuelve nuevos campos: `terreno_categoria`, `cd_prueba`, `desventaja_estacion` (true en otoño/invierno).
- Frontend (`generateEventAtPosition`) propaga `desventaja_salvacion` y `terreno_categoria` a `currentEvent.resolucion`.
- **Shadow saves correctos** (pre-existente solo aplicaba Sombra automáticamente):
  - **Desesperanza** (fallo de prueba): tira 1d3 → cada miembro hace **TS CARISMA vs CD del evento**; sólo los que fallan reciben los puntos.
  - **Decisiones erróneas** (fallo): el OBJETIVO hace **TS SABIDURÍA vs CD del evento**; sólo si falla recibe 1 punto Sombra.
  - **Terrible desgracia** (fallo): TS DESTREZA con desventaja en otoño/invierno; éxito → pierde mitad de PG máximos, fallo → 0 PG.
- En todas las TS: si `desventaja_salvacion=true` (otoño/invierno) → tira 2d20 y se queda con el menor.
- UI: nuevos badges en `DayByDayView` que muestran "Terreno: Camino (CD 10)" / "Otoño/Invierno → Desventaja en TS y prueba".

**Tests**
- `/app/test_reports/iteration_67.json` — **26/26 PASS** (100%).
- Test files: `test_event_cd_terrain_it67.py`.

**Pendiente para próxima sesión**
- Bloque C-5: Ubicación del personaje (creación + ficha + lock en campaña + filtro tienda)
- Bloque C-6: "Indicar en el mapa" para origen/destino del viaje (mapa vacío, zoom + pan, click fija punto)
- (Backlog) Filtro real (no solo aviso) para usar montura sin accesorios

### ✅ Iteración 83 — Ropa, Multi-montura y Consumo proporcional de comida
**(Fases 1 + 2 + 3 completas en una sola sesión — backend 100% testing agent 11/11)**

**FASE 1 — Categoría Ropa, armas/armaduras movibles, activa, tirar al camino**
- Nueva categoría **`ropa`** en `equipment_catalog` con 24 items migrados
  desde `equipo_general` (botas, capas, mudas, túnicas, vestidos, capucha).
  Cada item tiene campo `posicion ∈ {cabeza, cuerpo, piernas, brazos, pies}`.
  Migración: `/app/backend/migrations/migrate_ropa_category.py`.
- Campo **`activa` bool** en ropa, armas y armaduras. Permite múltiples piezas
  activas por posición (el usuario eligió la opción "varias", no "una").
- Nuevo endpoint `PATCH /api/characters/{id}/equipment/toggle-active` con
  source ∈ {inventario, armadura, armadura_piezas, armas}.
- `PATCH /api/characters/{id}/equipment/carry` ahora acepta `source` y
  `mount_id`. **Armas y armaduras** pueden moverse a la montura; mover a
  la montura **auto-desactiva** el item (`activa=False`).
- Nuevo campo `ca_bonus` en piezas de armadura (brazaletes +1 CA, grebas, etc.).
  Las piezas secundarias (posicion != cuerpo o ca_bonus>0) van a
  `character.armadura_piezas[]`; la principal sigue en `character.armadura`.
- **CA dinámica** en `/app/frontend/src/utils/armorClass.js`: recalcula al
  vuelo desde las piezas activas. `CombatStatsCard` la muestra directa.
- Helpers `isNaked`, `isBarefoot`, `getActiveClothingByPosition` en
  `/app/frontend/src/utils/clothingState.js`.
- **Avisos contextuales** (toasts + badges en la hoja):
  - Sin ninguna ropa activa cubriendo cuerpo → *"Vas desnud@…"* (rojo).
  - Sin ropa activa cubriendo pies → *"Vas descalzo… (tirada CON/hora al viajar)"*.
  - Arma activa → montura → *"Has retirado un arma… turnos perdidos"*.
  - Pieza de armadura → *"CA recalculada"*.
- **"Tirar al camino"** con `AlertDialog` (confirmación + resumen de
  consecuencias) reemplaza el antiguo `confirm()` del navegador.
- `weight-summary` pasa a considerar `portado_por=montura` también para
  armas, armadura principal y piezas de armadura.

**FASE 2 — Multi-montura con nombres**
- Migración `/app/backend/migrations/migrate_multi_mount.py` consolida
  `character.montura` (objeto único) + ponis del inventario en un único
  array `character.monturas[]`. Cada montura tiene
  `{id, nombre_original, nombre_personalizado, especie, capacidad_carga,
  velocidad, constitucion, equipo, es_jinete_activo}`.
- Endpoints nuevos:
  - `POST /api/characters/{id}/monturas` (crear)
  - `PATCH /api/characters/{id}/monturas/{mount_id}` (renombrar/ajustar)
  - `DELETE /api/characters/{id}/monturas/{mount_id}` (elimina y reasigna
    los items que lo tenían a `personaje`)
- `PATCH /api/characters/{id}/mounted` admite ahora `mount_id` opcional
  para elegir qué montura monta el jinete; actualiza `es_jinete_activo`.
- `weight-summary` devuelve `monturas_detalle[]` con peso/capacidad por
  montura y flag `sobrecargada`/`lleva_jinete`.
- `EquipmentManagerModal` reemplaza el bloque único de montura por un
  panel con TODAS las monturas: rename inline, botón "+ Añadir", checkbox
  "montado aquí" por montura, botón eliminar. Al mover un item a la
  montura con >1 monturas disponibles se muestra un `AlertDialog` picker
  para elegir cuál la carga.

**FASE 3 — Consumo proporcional de comida**
- Nuevo campo derivado **`dias_comida = peso_kg × cantidad / 0.5`** que
  se muestra en la pestaña de gestión para cualquier item de comida
  (consumibles + comida_posadas + raciones).
- `inventoryProvisions.summarizeProvisions` extendido: devuelve también
  `diasComidaTotal` y `totalFoodMassKg` (suma todos los food items por
  masa, no solo raciones clásicas). `checkProvisionsForJourney` y la
  inicialización de `partyProvisions` ahora usan `diasComidaTotal`.
- Nuevo helper `/app/frontend/src/components/travel/proportionalFoodConsumption.js`:
  `consumeProportionalFood(inventario, gramos)` resta N gramos de comida
  **proporcionalmente por masa** a TODOS los food items. Soporta
  `cantidad` fraccionaria (`Math.round(×100)/100` → 2 decimales) y
  elimina items con cantidad ≤ 0.005.
- `persistProvisionsToInventory` (al terminar viaje) ahora usa
  `consumeProportionalFood` en vez de restar solo raciones. El agua sigue
  drenándose de los odres como antes.

**Migraciones ejecutadas**
- `migrate_ropa_category`: 24 items → categoría ropa; 34 personajes
  actualizados con metadatos (categoria=ropa, posicion, activa=true).
- `migrate_multi_mount`: 5 personajes migrados a `monturas[]`.

**Testing**
- Testing agent `/app/test_reports/iteration_66.json` — **11/11 PASS**
  (Ropa catalog, ropa flow, toggle-active, carry+deactivate, multi-mount
  CRUD, weight-summary per-mount, mounted with mount_id, regresión de
  /rest/short, /rest/long, /travel/calculate-journey).
- Test file creado: `/app/backend/tests/test_equipment_multi_mount_ropa_it66.py`.

**Archivos clave nuevos/modificados**
- `/app/backend/routes/character_routes.py` (nuevos modelos, endpoints,
  weight-summary extendido)
- `/app/backend/routes/data_routes.py` (ropa en all_keys)
- `/app/backend/migrations/migrate_ropa_category.py`, `migrate_multi_mount.py`
- `/app/frontend/src/components/character-sheet/EquipmentManagerModal.jsx`
- `/app/frontend/src/components/character-sheet/summary/CombatStatsCard.jsx`
- `/app/frontend/src/utils/clothingState.js`, `armorClass.js`
- `/app/frontend/src/components/travel/proportionalFoodConsumption.js`
- `/app/frontend/src/components/travel/inventoryProvisions.js`
- `/app/frontend/src/pages/EnhancedTravelSystem.jsx`

### ✅ Iteración 82 — Hotfix crash + dropdown completo + auto-recalc velocidad
- **Bug crítico (crash "ALGO SE HA ROTO EN EL VIAJE")**: al togglear "a
  pie / a caballo" en los Papeles de Viaje saltaba
  `TypeError: m.monturaPropia.constitucion.match is not a function`.
  Causa: el campo `montura.constitucion` viene como `int` (13) tras la
  migración del Poni de Bree, pero el código asumía string. Fix en
  `updateMemberMount`: ahora soporta string ("13", "13 (+1)"), número
  (13 → mod = (13-10)/2 = 1) y prioriza `constitucion_mod` si existe.
- **Dropdown de personajes recortado**: el `SelectContent` del selector
  de papeles y de añadir acompañante no tenía `max-h` explícito → al
  haber 30+ personajes, sólo veías los primeros sin scroll visible.
  Fix: `max-h-[60vh]` en ambos `<SelectContent>` para forzar scroll
  interno y respetar siempre la altura de la ventana.
- **Auto-recalc de velocidad al togglear "Va montado" en marcha**:
  nuevo `useEffect` que vigila cambios en `characters[*].montado`
  durante un viaje activo. Cuando alguien monta/desmonta:
  - Calcula la **nueva velocidad efectiva del grupo** en cliente con
    la misma lógica del backend (incluyendo -33% por sobrecarga del
    animal, peso jinete + equipo si va montado).
  - Lanza un toast: "🐎 Darnric ha montado: el grupo va ahora a 9.0
    m/turno" o "👣 ha desmontado: 9.0 m/turno", duración 5 s.
  - Helper `computeMemberSpeed(char)` incluido para reutilizar.

### ✅ Iteración 81 — Toggle "Va montado" + carga real del jinete sobre la montura
- **Nuevo campo `montado: bool`** en personaje (default false). Indica si
  el jinete va sobre la montura en este instante.
- **Nuevo endpoint** `PATCH /api/characters/{id}/mounted` body
  `{montado: bool}` para alternar el estado.
- **Backend `weight-summary`**: cuando `montado=True`,
  `peso_total_montura = peso_montura (items) + peso_corporal (jinete) +
  peso_personaje (equipo del jinete)`. Cuando `montado=False`, sólo
  contabiliza items explícitamente cargados en el animal. Devuelve
  además `montado` y `montura_sobrecargada` para que la UI no recalcule.
- **EquipmentManagerModal**: nuevo toggle "Va montado" debajo del
  recuadro de la montura. Llama a `handleToggleMounted`. La etiqueta
  del peso ahora muestra "(jinete + equipo)" o "(sólo carga)" según
  el estado, y resalta en rojo "⚠️ SOBRECARGADO" si supera la cap.
- **Frontend `calculateJourney`** (`EnhancedTravelSystem`): cuando el
  personaje va `montado`, el payload `montura_carga_actual_kg` incluye
  ya el peso corporal + el equipo del jinete + lo cargado en el animal,
  para que el backend de viaje aplique correctamente el -33% si supera
  la capacidad.
- **JourneyPartyPanel**: el chip "🐎 X/Y kg" ahora muestra el peso
  REAL (incluyendo jinete + equipo si va montado) y añade el badge
  "·jinete" cuando el jugador está montado. Sin carga + sin estar
  montado → tooltip recordando el toggle.
- **Verificación E2E**: Darnric Camposol (peso corporal 48.6 kg + equipo
  20.76 kg = 69.36 / 101 kg en poni) → no sobrecargado, restante
  31.64 kg. Toggle aplicado vía curl.

### ✅ Iteración 80 — Velocidad de montura realista (LOTR 5e house rule)
- **Cambio de regla**: la velocidad efectiva al ir montado ahora es la
  **velocidad de la montura** directamente, no el antiguo
  `velocidad_personaje × 1.4`. Si no hay `montura_velocidad` definida,
  fallback al cálculo antiguo (compat. retroactiva).
- **Penalización del 33% por sobrecarga**: si la carga sobre el animal
  supera su `capacidad_carga`, se le resta el 33% a la velocidad de la
  montura (12 m → 8.04 m para el Poni de Bree con 120/101 kg).
- **TravelPartyMember** nuevo:
  - `montura_capacidad_kg` (default 0)
  - `montura_carga_actual_kg` (default 0)
  - `velocidad_efectiva()` ahora devuelve `Dict` con `velocidad`,
    `montura_sobrecargada`, `carga_pct`, `monta`. El bucle de
    `calculate_journey` adaptado.
- **Frontend (`calculateJourney`)**: calcula la carga real sobre la
  montura del personaje (items con `portado_por='montura'` +
  `montura.equipo[]`) y la envía al backend junto con la capacidad.
- **Default de `montura_velocidad`** corregido: 60 (feet legacy) → 12
  (metros, valor canónico del Poni de Bree).
- **Hint UX**: cuando un personaje tiene poni y aún no le carga nada,
  el chip "🐎 0/101 kg (sin carga)" aparece en azul con tooltip que
  recuerda al jugador entrar en "Gestionar equipo → En montura".
- **Tests actualizados**: 5/5 tests de `TestVelocidadEfectiva` pasando,
  incluido el nuevo `test_mount_overload_applies_33pct_penalty` y el
  `test_mount_zero_speed_falls_back_to_base_times_1_40` (compat.).

### ✅ Iteración 79 — Fix tienda + forecast + poni sobrecargado + heridos
**Bugs:**
- **Forecast vs panel desfasado**: `JourneyForecastCard.sumProvisions` no
  parseaba "Pack de N raciones" → contaba 2 packs como 2 raciones en
  vez de 20. Fix: usar `summarizeProvisions` de `inventoryProvisions.js`
  (la misma helper que usa el panel y la tienda) → todos los contadores
  ahora coinciden.
- **Tienda de provisiones bloqueada**: tras pulsar "Comprar todo el grupo"
  los botones se quedaban marcados "Comprado" aunque el usuario subiera
  manualmente packs/odres. Fix:
  - Tras cada compra exitosa se limpia el override del personaje para
    recalcular sugerencias con el inventario actualizado.
  - El botón pasa a "Comprar más" si packs/odres > 0, "Comprado" sólo
    si no queda nada por comprar.
  - "Comprar todo el grupo" se rehabilita mientras alguien tenga packs
    u odres pendientes (no depende ya del flag `resultados`).
  - `comprarTodos` itera por filas con `necesitaAlgo` real.

**Mejoras:**
- **Aviso de poni sobrecargado** en `JourneyPartyPanel`: nueva chip
  "🐎 X/Y kg" por viajero con montura. Color verde ≤ 80%, ámbar >80%,
  rojo + pulse cuando supera el tope (`capacidad_carga`). Suma items
  con `portado_por='montura'` + `montura.equipo[]`.
- **Heridos integrados en la narrativa final**: `JourneySummaryRequest`
  acepta lista `heridos`. El system prompt instruye a la IA a narrar
  explícitamente quién cayó, dónde y cómo lo cargaron sus compañeros.
  El frontend detecta automáticamente personajes con PG ≤ 0 al final
  del viaje y los envía con día y nombre del evento (Terrible Desgracia).
- **Mini-recap visual en `ResultsView`**: tarjeta destacada en rojo
  "💀 Heridos al llegar a {destino}" antes de la crónica, con lista
  de inconscientes y el evento que los tumbó.

### ✅ Iteración 78 — Bugfix Poni de Bree + visibilidad montura
- **Bug crítico**: el endpoint `finalize` NO copiaba `montura` desde el draft
  al personaje creado, así que la virtud "Poni de Bree" se perdía. Fix:
  añadido `"montura": draft.get('montura') or {}` en `finalize`.
- **Mejora**: al asignarse la virtud "Poni de Bree" en `step5`, también se
  añade el poni al `inventario` (categoría `monturas`, `peso_kg=0`,
  `capacidad_carga_kg=101`, `es_montura=True`, `ganado_via_virtud=True`)
  para que aparezca en el "Equipo Completo" y se pueda gestionar
  (cargar equipo en él) desde la ficha vía `EquipmentManagerModal`.
- **CharacterSummary**: nueva tarjeta "🐎 Montura (vía virtud)" antes de
  Dinero que muestra nombre, tipo, tamaño, velocidad y capacidad.
- **Migración**: aplicada a 2 personajes existentes (Xalan Fuenteoscura,
  Darnric Camposol) + 1 draft con virtud "Poni de Bree" pero sin
  `montura` en BD. Idempotente: no duplica si ya existe.
- **Carga de equipo en la montura**: ya estaba soportado en el backend
  (`PATCH /characters/{id}/equipment/carry` con `carried_by='montura'`)
  y en el frontend (`EquipmentManagerModal` muestra "En montura/Sin
  montura" por ítem). El cálculo de peso ya excluye lo cargado en la
  montura al estimar el estorbo del jinete.

### ✅ Iteración 77 — Clima → CD del evento + Aviso de inconsciencia
- **Clima del día aplicado al evento de su casilla** (`generateEventAtPosition`
  + bucle de Viaje Global): se busca `journeyWeather[posicion-1]` y se
  ajusta la **CD de resolución** del evento:
  - "tormenta", "vendaval", "nieve fuerte", "ventisca", "niebla densa",
    "extremo", "helada" → **+2 CD** (bandera `desventaja_clima`).
  - "despejado", "soleado", "templado", "suave", "agradable" → **-1 CD**
    (bandera `ventaja_clima`).
  - El resto: 0. La UI muestra "Base X +Y (clima)" y el clima del día.
- **Aviso de inconsciente** (`JourneyPartyPanel`):
  - Nueva columna de PG (corazón) con color crítico/inconsciente.
  - Badge "Inconsciente" + ring rojo + animación pulse cuando PG ≤ 0.
  - Toast destacado "💀 Inconsciente — necesita curación" cuando una
    Terrible Desgracia tira a un personaje a 0 PG.
  - También se loguea en la bitácora del día como `mecanicas[]`.

### ✅ Iteración 76 — Sistema de Descansos 5e + Mecánicas de eventos + Zoom mapa
**Bugs/Features cerrados en esta sesión:**

- **Descanso Corto (D&D 5e)** (`POST /api/characters/{id}/rest/short`):
  - Body `{dice_to_spend: int}` → tira N×1d{HD}+CON, suma curación,
    actualiza `puntos_golpe_actual` (cap a `puntos_golpe_max`),
    incrementa `dados_golpe_gastados`. Limita al máximo disponible
    (`nivel - gastados`). Mínimo 1 PG por dado (regla 5e variante).
  - Validado con 16/16 tests (`/app/backend/tests/test_rest_endpoints_it65.py`).
- **Descanso Largo (D&D 5e + house rule LOTR)** (`POST /api/characters/{id}/rest/long`):
  - PG al máximo, recupera `floor(level/2)` dados de golpe (mín 1), reduce
    fatiga -1 (mín 0). Devuelve `dados_recuperados` y `curacion_total`.
- **Frontend**:
  - `RestDialogBody` (en `DayByDayView.jsx`): selector de Dados de Golpe a
    gastar por personaje en descanso corto, muestra PG/DG actual,
    visualiza tiradas y curación al confirmar. UI integrado en el rest
    dialog existente.
  - `performRest` (en `EnhancedTravelSystem.jsx`): llama a los endpoints
    backend, sincroniza estado local de PG/DG/fatiga, conserva la TS de
    CON para reducir fatiga (si falla, no aplica -1).
- **Mecánicas de los 7 eventos de viaje** (en `resolveCurrentEvent`):
  - Terrible Desgracia (FALLO) → TS de DES auto-rolada; éxito = pierde
    mitad PG max, fallo = 0 PG. Aplica vía `PATCH /characters/{id}/hp`.
  - Desesperanza (FALLO) → 1d3 puntos de Sombra a TODA la compañía
    (`PATCH /shadow`). Toast + bitácora.
  - Decisiones erróneas (FALLO) → 1 punto de Sombra al objetivo.
  - Atajo (ÉXITO) → toast/bitácora "-1 día".
  - Percance (FALLO) → mensaje "+1 día y +2 CD" (la `fatiga_cd_increase`
    ya se suma en otra parte del flujo).
  - Vista agradable (ÉXITO) → toast "Inspiración para la compañía".
  - `dailySummaries` ahora incluye campo `mecanicas[]` para mostrarlas.
- **Mapa final del viaje** (`JourneyMiniMap.jsx`):
  - Padding reducido de 30%/15% a 15%/4%, margen de aspect ratio
    relajado de 1.3×/0.7× a 1.5×/0.55×. Resultado: el viewBox SVG se
    ajusta más al recorrido real en vez de mostrar Tierra Media completa.

### ✅ Iteración 75 — Encumbrance hook + Bree Pony + AI Portrait fixes
**Resumen anterior:** Ver historial implícito. Se extrajo `useEncumbrance`
para evitar saltos de velocidad al cambiar de pestaña; AI Portrait crash
HTTP 422 (`peso_kg` int→float) resuelto; Bree Pony virtud step mapping
arreglado; AI Name Moderation relajada para nombres Tolkien-friendly.

### ✅ Iteración 65 — Cierre Oleada 3 (peso real + sincronización PDF)
**Bugs cerrados de la sesión anterior:**

- **Peso transportado calculaba 0.0 kg** (`ExtendedCards.jsx`):
  - El cargador de pesos (`cargarPesos`) sólo extraía la PRIMERA lista del
    `equipment-catalog`. Ahora colecta TODAS las categorías
    (armas_*, armaduras_*, equipo_general, herramientas, consumibles…).
  - `WeightEncumbranceCard` también suma `equipo_ocupacion` (espadas, cota
    de anillas, escudo, …) que vivía aparte del inventario.
  - `normalizar()` ahora también limpia el sufijo `— Mod. 100%` para que
    los packs comprados en la tienda (`Pack de Raciones de viaje (10
    raciones) — Mod. 100%`) se mapeen contra el catálogo.
  - Soporta items en string o en objeto.
  - Validado con personajes reales: Dáinlor (FUE 14, mediano) → 106.6 kg
    transportado, umbralCargado=35 kg, umbralMuyCargado=70 kg → "Muy
    cargado, -66% movimiento". Regred (FUE 14, hobbit, montura carga
    equipo) → 10.2 kg, "Sin estorbo".

- **Sincronización PDF (Ficha Oficial)**:
  - `SheetPage1.jsx`:
    - `salvaciones_competencia` (nuevo) tiene prioridad sobre el legacy
      `salvaciones_competentes` y `competencias.tiradas_salvacion`.
    - `nombre_jugador` se muestra en el campo "Nombre del jugador" si
      `jugador` no está fijado.
    - Iniciativa = DEX mod + `iniciativa_bonus` (campo nuevo).
    - `competencias_herramientas` (lista nueva) se incluye en la lista
      de idiomas/herramientas.
  - `SheetPage2.jsx`:
    - `mecenas` ahora soporta TANTO el objeto nuevo
      `{nombre, tipo, descripcion, ...}` como el string legacy y el
      campo `patron_nombre`.
    - `descripcion_mecenas` y `ventaja_mecenas` leen primero del objeto
      `mecenas.*` y luego de los campos legacy.
    - `puntos_comunidad` lee del objeto `mecenas.puntos_comunidad`
      cuando el flat field está vacío.
    - El bloque "descripción de la Sombra" añade `Maldición: …` y
      `Cicatrices: …` desde los campos nuevos.

**Validación**:
  - Pytest backend `test_ol3_iter62.py` 3/3 PASS (persistencia de los 12
    nuevos campos + travel encumbrance bonus_fatiga +5).
  - Smoke-test visual de Ficha Oficial Hoja 1 con personaje real Regred:
    Sexo, Nombre del jugador, Iniciativa +5 (=DES+3 + bonus 2), Salvaciones
    Fuerza +4(x), Destreza +5(x), Estorbo -3/-6 — todo renderizado.

### ✅ Iteración 64 — TTS narrador clásico + Alerta predictiva
- TTS `/api/travel/tts/narrative` (`tts-1-hd` con auto-degradación a
  `tts-1` para textos >2000 chars), voz `onyx`, velocidad 0.95.
- `JourneyForecastCard.jsx` predice fatiga media, raciones/agua, día más
  duro y avisos críticos antes de iniciar el viaje.

### ✅ Iteración 63 — Reglas de fatiga
1. CD 10 base, +1/día sin comida, +2/día sin agua.
2. Bonus +5 a la salvación para miembros sin estorbo cuando otro frena al grupo.
3. Skip de la salvación en la 2.ª acampada consecutiva (recupera -1 sin tirar).
4. Salvación EXTRA en clima extremo / tierras de la sombra.
5. Banner descanso obligatorio en fatiga ≥ 5 (2 días).
6. Fatiga 6 = inconsciente (1 semana, transporte sólo en carro/montura).

### ✅ Iteración 62 — Oleada 3 (ficha completa) + integración estorbo
- Reorganización en pestañas (Resumen · Atributos · Combate · Equipo ·
  Comunidad · Sombra · Trasfondo · Historia).
- Subir nivel con gate de PX 5e estándar.
- 9 tarjetas extendidas (HeaderInfo, SavingThrows, DeathSaves,
  WeightEncumbrance, Tools, ShadowExtended, Patron, ProfessionSpecials,
  History).
- Backend acepta los 12 campos nuevos vía PATCH `/characters/{id}`.
- `velocidad_efectiva()` aplica el estorbo en metros; el grupo va a la
  velocidad del más lento; los demás reciben +5 a salvación contra
  cansancio.

### ✅ Iteración 61 — Bloque A
- PDF Ficha Oficial centrado A4.
- Mapa de resultados `h-[480px]` con letterbox.
- Panel del grupo durante el viaje (`JourneyPartyPanel`).
- Notas privadas del jugador (`PrivateNotesCard`).

### ✅ Iteraciones 56-60 — sistema de viaje + clima + provisiones
Ver CHANGELOG implícito arriba (refactor de `EnhancedTravelSystem.jsx` a
~2100 líneas, Sistema de Clima 18×12, packs de provisiones, automatización
de viaje con Ojo de Sauron, fix crítico del cálculo de días).

### 🏗️ NEXT MAJOR PHASE — Sistema de Campañas (post Auth)

Decisiones acordadas (`/app/memory/CAMPAIGN_ARCHITECTURE.md`):
- Roles: Maestro (admin global ÚNICO), Director de Juego, Maestro del
  saber (consulta + crea campañas), Jugador.
- Aislamiento híbrido "branching": BD global con reglas + una BD por
  campaña (`lotr5e_campaign_{id}`).
- Reglas globales se propagan en vivo; DJs pueden hacer overrides locales.
- Mapas/aventuras: JPEG y PDF en object storage.
- Selector de campaña en panel del DJ; un personaje no puede estar en dos
  campañas a la vez.
- **Bloqueador previo**: implementar P0 Auth + Roles antes de campañas.
- 28 puntos abiertos restantes en CAMPAIGN_ARCHITECTURE.md.

### 📊 Tamaño actual de la BD
- Total: ~20 MB (970 docs / 59 colecciones).
- Estimación campaña típica: 50 KB → 700 KB (sin mapas) → 2-5 MB con
  mapas en object storage.

---

## Pending Tasks

### P0 — Próximo
1. **Auth + RBAC + Aprobación del Maestro**
   (Maestro / DJ / Maestro del saber / Jugador, JWT, hCaptcha, dashboard
   de aprobación). Antes de tocar código, obligatorio pasar por
   `integration_playbook_expert_v2`.
2. **Sistema de Campañas con aislamiento por BD**
   (`/app/memory/CAMPAIGN_ARCHITECTURE.md`).

### P1
- Game Master Screen (dashboard en vivo: salud / fatiga / inventario).
- Uploads de mapas/aventuras (JPEG + PDF) por campaña.
- Aplicar el clima del día concreto al evento que se rueda en esa casilla.
- Exportar Diario en Markdown.

### P2
- Terminar Undo/Redo en TerrainEditor.
- Refactor de PRD.md → CHANGELOG.md / ROADMAP.md cuando supere 700 líneas.
- AI TTS — explorar voces alternativas a Onyx para variar narrador por
  campaña.

---

## Technical Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── character_routes.py
│   │   ├── travel_routes.py
│   │   ├── moderation_routes.py
│   │   └── admin_routes.py
│   ├── tests/
│   │   └── test_ol3_iter62.py  (3/3 PASS — persist + estorbo +5)
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   ├── character-sheet/
        │   │   ├── SheetPage1.jsx (PDF — sincronizado Oleada 3)
        │   │   ├── SheetPage2.jsx (PDF — sincronizado Oleada 3)
        │   │   ├── SheetPage3.jsx
        │   │   └── summary/
        │   │       ├── ExtendedCards.jsx (peso real + reglas FUE×8/2.5/5)
        │   │       └── PrivateNotesCard.jsx
        │   └── travel/ (modular: ConfigView, DayByDayView,
        │       GlobalJourneyView, ResultsView, JourneyPartyPanel,
        │       JourneyForecastCard, NarrativeTTSPlayer, …)
        └── pages/
            ├── EnhancedTravelSystem.jsx
            ├── CharacterSheetPage.jsx
            └── InteractiveCharacterSheet.jsx
```

---

## 3rd Party Integrations
- OpenAI GPT-4o (texto, narrativa) — Emergent LLM Key
- OpenAI TTS-1 / TTS-1-HD (onyx) — Emergent LLM Key

## User's Preferred Language: Español
