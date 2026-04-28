# LOTR 5e RPG - Product Requirements Document

## Current State (2026-02-28)

### ✅ Travel System Logic Overhaul (Batch 2) — COMPLETO
- **Modo único interactivo "Jornada a Jornada"**: eliminado el toggle entre
  "Viaje Global" y "Día a Día" en ConfigView. El botón "Iniciar Viaje" siempre
  arranca el modo interactivo (orientación → días vacíos resumidos en bitácora
  → parada en evento → resolución → siguiente orientación).
- **Bitácora del viaje** (`dailySummaries`): nueva tarjeta en GlobalJourneyView
  que registra cada día con icono y color según tipo (partida, antecedente,
  orientación, marcha, evento, campamento, forrajeo, descanso). Incluye clima
  por día.
- **Acciones de parada**: nueva tarjeta visible solo cuando hay parada
  (orientación pendiente o evento activo) con botones Acampar / Forrajear /
  Comprar provisiones. Se oculta durante la animación del Viaje global.
- **Tirada de orientación al inicio del día 1**: ya garantizada
  (`awaitingOrientationCheck=true` tras `startGlobalJourney`).
- **Viaje global (auto-run)**: sigue como botón dentro del modo interactivo;
  reescrito en iteración 58 (sin atasco). Ahora también acumula bitácora.
- Validado E2E al 100% por el agente de testing (7/7 criterios,
  `/app/test_reports/iteration_59.json`).

### ✅ Iteración anterior (58)
- Fix "Atasco detectado" en automateJourney.
- Rediseño visual del Ojo de Sauron (máscara radial + 3 capas de fuego).
- Fatiga inicial heredada de la ficha + override con justificación obligatoria.

### 🏗️ NEXT MAJOR PHASE — Sistema de Campañas (post-fork)

Decisiones de arquitectura ya acordadas con el usuario (ver detalle completo en
`/app/memory/CAMPAIGN_ARCHITECTURE.md`):

- **Roles**: Maestro (admin global ÚNICO — el usuario), Director de Juego,
  Maestro del saber (consulta + crea campañas), Jugador.
- **Aislamiento**: híbrido "branching" — BD global con reglas (sólo Maestro
  edita) + **una BD por campaña** (`lotr5e_campaign_{id}`) con datos de juego.
- **Reglas globales**: cambios del Maestro **se propagan en vivo** a todas las
  campañas (decisión técnica del agente, a confirmar). DJs pueden hacer overrides
  locales si necesitan congelar algo.
- **Mapas/aventuras**: JPEG y PDF únicamente, en object storage.
- **Selector de campaña** dentro del panel del DJ. Un personaje no puede estar
  en dos campañas a la vez.
- **Bloqueador previo**: implementar primero **P0 Auth + Roles** antes de campañas.
- 28 puntos abiertos restantes en `CAMPAIGN_ARCHITECTURE.md`.

### 📊 Tamaño actual de la BD (baseline para estimaciones)
- **Total: 20.23 MB** (970 docs / 59 colecciones).
- Mapa/terreno: ~13.7 MB (68% — `terrain_zones` 13.4 MB es el grande).
- Personajes: ~5.5 MB (50 fichas, ≈110 KB cada una con retratos base64).
- Reglas: ~750 KB. Datos de juego activos: <30 KB.
- Estimación campaña típica: 50 KB vacía → 700 KB media → 2-5 MB con mapas si
  los mapas viven en object storage. **Object storage es prácticamente obligatorio**.

### ✅ COMPLETED This Session

#### 20. Iteración 67 — Sistema de Moderación Inteligente IA + Métricas BD (2026-02-26)

**Backend** (`/app/backend/routes/moderation_routes.py`):
- `POST /api/moderation/check-name` → IA valida texto (nombre personaje, apellido,
  jugador, ubicación, campaña). Filtro duro local (banlist + heurísticos) corta sin
  coste IA; lo sutil va a GPT-4o-mini con prompt estricto en JSON.
- `GET /api/moderation/alerts` (token Maestro) → listado + stats por categoría/contexto.
- `DELETE /api/moderation/alerts` → limpiar log.
- Categorías: profanity, sexual, political, insult, nonsense, other.
- Fail-open si la IA cae (no bloquea flujo de usuario).
- Verificado por curl: 8 casos (Tolkien-style en personaje OK, Tolkien en jugador KO,
  palabrota dura, sexual con banlist, política contemporánea, vacío, spam, normales).

**Frontend** (`/app/frontend/src/components/character-creator/steps/Step1Culture.jsx`):
- Validación on-blur en los campos Nombre / Apellido / Jugador.
- Indicadores visuales: spinner mientras valida, ✅ verde si OK, ⚠ rojo si bloqueado.
- Contador de intentos por campo: a los 2 intentos inapropiados consecutivos →
  campo se **bloquea**, se rellena con un nombre clásico generado (excepto el del
  jugador, que se vacía y obliga a admin).
- Reconoce los nombres auto-generados por subcultura como "baseline" — no los
  valida si el usuario no los modifica (cero coste IA en flujo normal).
- Validación final también en `handleSubmit` antes de avanzar a Step 2.

**Helpers**: `/app/frontend/src/utils/moderation.js` (cliente axios reutilizable).

Lint ✅ Python y JS. Backend probado con 8 casos curl.

### 🎙️ Acordado para futuro (post-Sistema de Campañas)

**TTS narrador clásico** para el modo "Viaje global" automatizado:
- Al terminar el viaje, generar un mini-podcast (~30s) con OpenAI TTS leyendo la
  narrativa épica con voz de "narrador clásico".
- **Reproducción manual**: el DJ pulsa Play, NO suena automáticamente.
- Integrado como botón en la pantalla de resultados al lado del PDF de la crónica.
- Necesita integration_playbook_expert_v2 para configurar OpenAI TTS via Emergent LLM Key.
- Decisión técnica: precachear el audio durante la generación de la narrativa para
  evitar latencia al pulsar Play.

### 📌 Pendientes para próxima sesión (post-fork campañas)
- 26 puntos abiertos en `CAMPAIGN_ARCHITECTURE.md` (auth, sincronización, etc.).
- P0 Auth + Roles → P0 Modelo Campaña → P0 Enrutado de queries → P0 Object Storage.
- P1 Cola de aprobación de ubicaciones del DJ (checkbox "solicitar al Maestro").
- P1 Panel del Maestro para incidentes de moderación (la colección `moderation_alerts`
  ya almacena los datos, solo falta la UI).
- P2 Terminar Undo/Redo en TerrainEditor.

### ✅ COMPLETED Earlier This Session

#### 19. Iteración 66 — Pathfinding Debugger arreglado + Piezas movibles en Editor de Terrenos (2026-02-26)

**🔍 #3 — Pathfinding Debugger** (`/path-debugger`):
- **Bug**: el endpoint `/api/travel/debug-pathfinding` implementaba una heurística greedy paso-a-paso totalmente distinta del A* del sistema real → los caminos visualizados nunca coincidían con la ruta calculada.
- **Fix** (`/app/backend/routes/travel_routes.py`): el endpoint ahora usa el mismo `MiddleEarthPathfinder.find_path()` que `/calculate-journey`. Cada segmento del path resultado se anota con terreno, tipo de tierra, road, river_crossing y coste, y se devuelve en la misma estructura `{configuracion, resumen, pasos}` que ya consume el frontend (sin cambios en la UI).
- Verificado por curl: Hobbiton → Bree devuelve 8 pasos, 136.6 km, exito=true, con coste y road info correctos.

**🎯 #4 — Piezas movibles en Editor de Terrenos** (`/terrain-editor`):
- **Nuevo modo "Mover"**: botón en la toolbar (junto a Dibujar Zona / Borrar) con icono `Move`.
- Al activarlo: arrastra cualquier polígono pintado para reposicionarlo. El polígono que se mueve se resalta con borde dorado.
- Toda la geometría del polígono se traslada por el delta del cursor (todos los puntos se desplazan junto al drag).
- Los modos polígono / borrar / mover son mutuamente excluyentes — al activar uno, los otros se apagan.
- Toast informativo al activar y al soltar; recordatorio "Recuerda Guardar para persistirlo".
- Pan con click izquierdo se desactiva en modo mover (sí sigue activo con clic derecho/medio).
- `data-testid="terrain-move-mode-btn"` y `data-testid="terrain-polygon-{id}"` añadidos para testing.

Lint ✅ Python y JS. Verificado por screenshot del editor (191 polígonos cargados).

#### 18. Iteración 65 — Backup / Restore de la base de datos (2026-02-26)

**🎯 Objetivo**: que el Maestro pueda exportar TODA la base de datos a un archivo JSON antes de un cambio importante, y poder restaurar en caso de error.

**Backend** (`/app/backend/routes/admin_routes.py`):
- `GET /api/admin/backup` → snapshot completo (59 colecciones, ~970 docs en BD actual). Sanitiza ObjectId / datetime para JSON. Incluye `counts` por colección.
- `POST /api/admin/restore?mode=replace|merge` → restaura un JSON. `replace` borra cada colección antes de insertar; `merge` upsertea por `_id`.
- `POST /api/admin/verify-token` → endpoint ligero para que la UI compruebe el token sin acción destructiva.
- Protegido por `X-Admin-Token` header. Token configurable en `backend/.env` como `ADMIN_BACKUP_TOKEN`.

**Frontend** (`/app/frontend/src/pages/AdminBackupPage.jsx` en `/admin/backup`):
- Login con token (persistido en localStorage tras verificación).
- Card de descarga: botón "Descargar copia ahora" → genera y baja `lotr5e_backup_{timestamp}.json`. Muestra resumen con contadores por colección.
- Card de restauración: input file + selector modo (replace / merge) + confirmación + tabla de resumen (insertados / actualizados por colección).
- Card de recomendaciones (consejos de uso).

**Token actual** (test): `lotr5e_admin_2026` — guardado en `/app/memory/test_credentials.md`.

Lint ✅ backend y frontend. Verificado por screenshot: login con token correcto, panel completo, descarga funciona (devuelve 59 colecciones × 970 docs).

#### 17. Iteración 64 — Zoom natural en el Mapa del Maestro (2026-02-26)

**🎯 Bug**: el zoom con la rueda saltaba abruptamente (10% por click) y el zoom no se centraba donde apuntaba el ratón.

**Causa raíz**:
1. `transformOrigin: 'center center'` en el `<svg>` no encajaba con la matemática del handler (que asume origen `(0,0)`).
2. Factor de zoom discreto (0.9/1.1) → muy brusco, especialmente en trackpad.

**Fix** (`MiddleEarthMap.jsx`):
- `transformOrigin: '0 0'` (top-left) — coherente con el cálculo `mapX = (mouseX - panX) / zoom`.
- Factor exponencial `Math.exp(-deltaY * 0.0015)` con clamp `[0.5, 2]` por evento — suave en trackpad y rueda.
- Mantiene el "zoom-to-cursor" correctamente: el punto del mapa bajo el cursor permanece fijo al hacer zoom.

**Verificado por screenshot**: el zoom subió a 125% tras 3 wheel events suaves sin saltos visibles.

#### 16. Iteración 63 — Inventario real para provisiones (2026-02-26)

**🎯 Objetivo del usuario**: que las raciones/agua se descuenten directamente del inventario de cada personaje, en lugar de un pool global. Que la tienda detecte lo que ya tienen y solo proponga comprar lo que falta.

**Cambios:**

1. **Nuevo helper `inventoryProvisions.js`** — detecta raciones (incluyendo packs `(N raciones)`), odres llenos/vacíos/parciales (`litros_actuales`) y agua suelta del inventario. Funciones:
   - `summarizeProvisions(inventario)` → `{raciones, odres[], aguaSuelta, totalLitros}`
   - `computeShortfall(inventario, dias)` → `{packsRaciones, odres, racionesFaltantes, litrosFaltantes}`
   - `consumeOneDay(prov)`, `refillAllOdres(prov)` para gestión por jornada

2. **Tienda (ProvisionsShopDialog) — totalmente revisada:**
   - Ahora muestra el **inventario actual** de cada viajero (raciones, litros).
   - Calcula **lo que le falta** y propone comprar solo eso (con sobrantes en packs/odres).
   - Inputs editables por persona (`packs raciones` / `odres llenos`) — el jugador puede comprar más si quiere.
   - Botón "Comprar" muestra **"No necesita"** cuando el inventario ya cubre el viaje.
   - Banner del grupo: `Comida: X / Y necesarias` con ✓/✗.

3. **`checkProvisionsForJourney`**: ahora usa `summarizeProvisions` (en vez del catálogo `foodWaterItems`). Detecta packs por nombre. Soporta acompañantes.

4. **Auto-rellenado de odres**: si el origen del viaje es una **ubicación conocida** (aldea/pueblo/ciudad/refugio/santuario/asentamiento/fortaleza/castillo/hostal/posada o ubicaciones sin tipo declarado), todos los odres del grupo parten **llenos a 10 L** sin coste. Toast informativo "Odres rellenados gratis en X".

5. **Persistencia al final del viaje (`persistProvisionsToInventory`)**:
   - Al pulsar "Finalizar Viaje y Repartir PX", se actualiza el inventario **REAL** de cada viajero.
   - Reduce raciones (gestionando packs: si se consume parcialmente un pack, el resto se guarda como "Raciones sueltas").
   - Vacía odres (los completamente vacíos quedan como "Odre vacío" en el inventario; los parciales como "Odre semilleno (X L)").
   - Llamada `PATCH /characters/{id}` con el nuevo `inventario`.
   - Toast: "Inventarios actualizados: raciones consumidas restadas a N viajero(s)".

6. **Acompañantes**: incluidos en todos los cálculos y en la persistencia (igual que miembros).

**Lint** ✅ en todos los archivos. **Captura de prueba**: la página `/travel` carga estable.

**⚠️ Limitaciones honestas (no implementadas en esta iteración):**
- El consumo durante el viaje sigue siendo un POOL global (`partyProvisions`), no individualizado. La descomposición individual por personaje en tiempo real sería un cambio mayor de arquitectura. Como compromiso, al **finalizar** el viaje se reparte el consumo total de forma uniforme entre los viajeros y se persiste a sus inventarios. Esto produce el resultado pedido por el usuario (cada uno termina con lo que le sobra) sin reescribir el motor de fatiga.
- El rellenado de odres parciales mid-journey (al pasar por aldea) **no** se hace automáticamente — solo en el origen al iniciar.

#### 15. Iteración 62 — Sistema de packs + Acompañantes + Forrajear extendido (2026-02-26)

**Tienda de provisiones — sistema por packs (reemplaza el cobro día×persona):**
- **Pack Raciones de viaje**: 5 mc → 10 raciones (10 días/persona). Sobrante visible.
- **Odre lleno**: 2 mc → 10 L (5 días/persona, a 2 L/día). Sobrante visible.
- **Forraje montura**: 1 me/día/animal (antes 1 mp/día → ajustado al catálogo del usuario).
- **Agua animal**: 5 me/día (sólo en sombra/oscuras o muy difícil).
- Cada miembro/acompañante compra automáticamente `ceil(días/10)` packs y `ceil((días×2)/10)` odres. El dueño de la montura paga el forraje y agua animal si el terreno lo exige.
- Modificadores Región × Asentamiento × Relación × Contexto se aplican al total final.
- Soporta acompañantes en el mismo flujo (compran su propio pack + odre).
- Mostrado por separado: "Persona: X · Montura: Y" y total grupo abajo.

**Forrajear ampliado:**
- Cambiado a **2d4 raciones + 3d4 L** (antes 1d4 + 1d4).
- CD según terreno (helper `getForageCD`):
  - Camino/fácil: 10 · Moderado/colinas/bosque: 15 · Difícil: 20 · Muy difícil/desalentador/pantano/montañas: 25
- **Añadido botón "Forrajear" dentro del CampDialog** (selector de forrajeador, muestra resultado en línea). El usuario puede acampar Y forrajear en la misma acción.
- Sigue disponible como botón aparte en la barra de "Provisiones" del modo Jornada a Jornada.

**Acompañantes (NUEVO):**
- Bloque dedicado en la preparación del viaje: hasta **10 personajes** sin papel asignado.
- Selector excluye automáticamente a quien ya tiene papel de viaje (y viceversa).
- Cada acompañante se carga con velocidad base, montura del equipo (si la tiene), modificador Sab.
- Switch "A caballo" si tiene montura propia. Botón quitar individual.
- **Influyen en el cálculo del backend**: se añaden al payload de `miembros` (con `papel: null`) para que `min(velocidad)` los considere y se aplique la velocidad de su montura si la tiene.
- **Influyen en el consumo diario**: `consumeDailyProvisions` y `checkProvisionsForJourney` ahora suman `miembros + acompanantes`.
- **NO** participan en eventos, orientación ni fatiga (siguen siendo sólo `miembros`).
- **DayByDayView** y **ResultsView** actualizados para mostrar provisiones de TODO el grupo (miembros + acompañantes).

**Otros:**
- `numeroAnimales` ya no se pasa manualmente: se deriva de los miembros + acompañantes que tengan `tieneMontura` activo. Eliminado del API pública del dialog.

Lint ✅ en los 9 archivos modificados. Verificado por screenshot: la nueva sección "Acompañantes 0/10" se muestra entre "Papeles de Viaje" y "Modo de Viaje".

#### 14. Iteración 61 — Refactor fase 2 COMPLETO de EnhancedTravelSystem.jsx (2026-02-26)
- **🟢 Refactor monolito completado**: el archivo principal pasó de **5942 → 2108 líneas** (~3834 líneas / **64.5% reducción**) y se distribuyó en 8 módulos auto-contenidos en `components/travel/`.
- **Nuevos módulos creados en esta fase**:
  - `travelPrint.js` (402 lns) — `printJourneyDocument`, `exportDebugJson`, `captureMapImage`, `generateMapPlaceholder`. Genera el HTML completo de la crónica del viaje y abre la ventana de impresión.
  - `views/ConfigView.jsx` (1148 lns) — Vista inicial: Origen/Destino, configuración del viaje, papeles, miembros, montura, mapa preview, comparador de rutas, inicio del viaje.
  - `views/GlobalJourneyView.jsx` (462 lns) — Modo Global: progreso, tirada de orientación, evento actual, tiradas d20, automatización del viaje.
  - `views/DayByDayView.jsx` (663 lns) — Modo Jornada a Jornada: cabecera, progreso, provisiones (comprar/acampar/descansar/forrajear), evento actual, registro diario, diálogo de descanso.
  - `views/ResultsView.jsx` (649 lns) — Vista final: mapa, diario IA, resumen, distribución de PX, fatiga, provisiones consumidas, registro de eventos, crónica narrativa, impresión y exportación.
- **Bugs colaterales del refactor (resueltos sobre la marcha)**:
  - `Compass is not defined`, `Users is not defined`, `Play is not defined` → faltaban imports de lucide-react en cada vista nueva. Añadidos.
  - `calcModHabilidad is not defined` → faltaba el import desde `travelHelpers` en ConfigView. Añadido.
- Lint frontend: ✅ 0 issues en los 9 archivos. La página `/travel` carga correctamente y muestra los 244 ubicaciones, los 4 papeles y todos los controles. Verificado por screenshot.
- **Resultado**: arquitectura modular, mantenible y mucho más fácil de testear/extender. Cada vista vive en su propio archivo y recibe el estado vía props explícitas.

**⚠️ Nota para el usuario**: el refactor tocó MUCHO código JSX. Recomendado un test manual del flujo completo (calcular ruta → iniciar viaje global → resolver eventos → finalizar → ver resultados) o llamar al testing agent antes de cerrar definitivamente.

#### 13. Iteración 60 — Refactor parcial de EnhancedTravelSystem.jsx (2026-02-26)
- **🟢 Refactor P0 (fase 1)**: el archivo monolítico `pages/EnhancedTravelSystem.jsx` pasó de **5942 → 5221 líneas** (~720 líneas extraídas, ~12% de reducción). Arquitectura más limpia y reutilizable.
- **Nuevos módulos creados**:
  - `components/travel/travelConstants.jsx` (~110 líneas): `MESES_ELFICOS`, `SeasonIcon`, `ROLE_ICONS`, `ROLE_INFO`, `hasMultipleRoles`, `hasPenalty`, `MULTI_ROLE_PENALTY`, `MAX_ROLES_PER_CHARACTER`, `PLAYER_MAP_URL`, `MAP_PIXEL_WIDTH/HEIGHT`.
  - `components/travel/travelHelpers.js` (~190 líneas): puro JS sin React. `REST_TYPES`, `ROLE_MODIFIER_KEY`, `SKILL_ATTRIBUTES`, `calcBonusCompetencia`, `tieneCompetenciaEn`, `tienePericia`, `getModAtributo`, `calcModHabilidad`, `getFatigueBaseCD`, `calculateRollXP`, `calculateGroupMultiplier`.
  - `components/travel/JourneyMiniMap.jsx` (~430 líneas): componente SVG del mini-mapa de viaje con `createNaturalPath` / `createSmoothPath` internos.
- **Bug colateral resuelto**: tras limpiar imports de lucide-react quedaron `<Compass>` y `<Leaf>` referenciados sin importar → `ReferenceError: Compass is not defined`. Corregido restaurando ambos en el import.
- Lint frontend: ✅ 0 issues. Página `/travel` carga estable con 244 ubicaciones, papeles de viaje y sistema completo.
- **Lo que NO se extrajo (pendiente fase 2)**: `printJourneyDocument` (~430 líneas), las 4 vistas de render (`renderConfig` ~1100 lns, `renderGlobalJourney` ~440 lns, `renderDayByDay` ~650 lns, `renderResults` ~625 lns). Son extraíbles pero requieren paso de muchas props/handlers — mejor en una iteración dedicada.

**Testing**: ✅ Lint pasa. ✅ Smoke test visual: home + `/travel` cargan sin errores tras el refactor.

#### 12. Iteración 59 — Hot-fix crítico de Calcular Ruta + clima dominante (2026-02-25)
- **🔴 BUG CRÍTICO arreglado**: la pantalla se quedaba en negro / "0 ubicaciones" al pulsar "Calcular Ruta". Causa: un `useEffect(() => { modeRef.current = mode; }, [mode])` declarado ANTES de `const modeRef = useRef('config')`. Aunque la closure capturaba el binding tarde, en algunos paths de re-render React detectaba el problema y desmontaba el árbol. Movido al lugar correcto (junto a los demás refs sync). Verificado: la app carga 244 ubicaciones y permanece estable tras editar campos.
- **🟢 Clima previsto realista**: revertido el muestreo aleatorio. Ahora `_icon_for_month` calcula el estado **dominante** del mes ponderando los % de la región (lluvia, tormenta, nieve, niebla, calima, despejado, nublado) y elige el de mayor peso. Verificado: Eriador en julio → Despejado, en marzo → Lluvia, sin nieve falsa. Eriador todo el año coherente con el clima atlántico templado de la tradición tolkien.
- **🟢 Imagen del Ojo de Sauron** sigue en `/app/frontend/public/ojo_sauron.png`. El componente `SauronEyeOverlay.jsx` es **reutilizable** — cualquier flujo de automatización futuro (compra masiva, generación batch, etc.) lo puede invocar pasando `visible`, `percent`, `message`, `subtitle`.

**Testing**: 25/25 pytest backend (todos pasando incluido los nuevos del comportamiento dominante). Frontend verificado por screenshot tool: app render estable, 244 ubicaciones cargadas.

#### 11. Iteración 58 — Polish round (Ojo correcto, mapa con eventos, narrativa natural, clima previsto realista, botón comprar) (2026-02-25)
- **Imagen del Ojo de Sauron corregida** (`ojo_sauron.png`) con `clip-path: circle(50%)` + `mix-blend-mode: screen` para fundir el fondo gris.
- **Mapa del Diario muestra TODOS los eventos**: ahora interpola posición sobre la línea recta cuando no hay path detallado, con offset radial cuando varios eventos caen en la misma casilla y numeración 1..N para verlos claros (verde/rojo según éxito/fracaso).
- **Narrativa IA mejorada**:
  - Solo nombre de pila ("Folgo se adelantó", no "Folgo Rizocastaño, nuestro vigía…").
  - Tono cercano tipo Tolkien pero NATURAL — sin "épico", "glorioso", "valeroso".
  - Descripciones de regiones BASADAS en la obra de Tolkien (Comarca = praderas+smials, Cardolan = ruinas del antiguo Reino del Norte, etc.). Prompt explícito.
  - Cada evento en el PDF muestra el clima del día concreto (icono, temp, viento) en una pequeña tarjeta antes de la narrativa.
  - El clima usado es el rodado por la cadena de Markov al iniciar el viaje (almacenado en `journeyWeather`), no inventado.
- **Bug del "Clima previsto" siempre lluvia/nublado**: el endpoint `/api/climate/icon/location/{loc}` ahora **muestrea probabilísticamente** desde la distribución de la región/mes con seed determinista (location+mes+dia). Esto da variedad realista (☀️ algunos días, ⛅ otros, 🌦️ ocasional) en lugar de colapsar siempre al estado más probable.
- **Mensaje de provisiones insuficientes** ahora muestra el botón "Comprar provisiones" al lado de "Continuar de todos modos".

**Testing**: 25/25 pytest backend (3 nuevos: variabilidad, determinismo, regression). Verificado vía curl: día 1=☀️, día 5=☀️, día 10=🌦️, día 15=☀️, día 20=☀️, día 25=🌦️ en Cermië/Eriador. Crónica ejemplo con Aragorn/Folgo/Theodric: tono natural, solo nombres, mención breve del clima, referencias a Cardolan ("ecos de viejos reyes que alguna vez habitaron esas tierras").

#### 10. Iteración 57 — Sistema de Clima Vivo + Bug-fix Automatización + Provisiones avanzadas + Modificadores editables (2026-02-25)

**Bug crítico arreglado — Automatizar Viaje:**
- Antes: 200 iteraciones, no llegaba al final, sin feedback. Ahora: `safety = min(200, casillas*3+10)`, `modeRef === 'results'` → break inmediato, `stuck-counter` aborta tras 8 iter sin avance.
- Nuevo `SauronEyeOverlay.jsx`: Ojo de Sauron rotando + barra de progreso porcentual + mensaje dinámico (`"Tirada de orientación – Casilla 3 de 13"`, `"Resolviendo Bandidos al amanecer…"`) + botón "Detener automatización".
- Verificado end-to-end por testing agent: render correcto, sin cuelgues, stuck-detection con toast claro al usuario.

**Sistema de Clima Vivo (POST /api/weather/simulate):**
- Cadena de Markov con inercia α=0.65 + matriz de transición fija (10 estados) + probabilidades base derivadas de los % de la región/mes.
- 5% prob. de día anómalo (usa `ext_min/ext_max`).
- Región del día = secuencia explícita por casilla/día (con fallback lineal origen→destino).
- Output: estado, icono, temp_min/max/dia, viento, precipitación mm, horas_sol_efectivas, efectos automáticos (fatiga_extra, ventaja/desventaja, vel_modificador), `log_line` compacto y `aviso` legible.
- Integración con la crónica IA (`generate-full-chronicle` recibe `weather_log`):
  - Prompt actualizado: el clima es **ambientación de fondo, no protagonista**, sin cifras (✅ "lluvia fina", ❌ "15mm").
  - Response incluye `weather_log` (líneas técnicas compactas para mostrar bajo la crónica).
- 8 tests pytest pasando (`test_weather.py`).

**Compra de Provisiones avanzada (`ProvisionsShopDialog.jsx` reescrito):**
- 4 selects: Región (auto desde origen) / Asentamiento / Relación con vendedor / Contexto histórico.
- Precio efectivo = (ración + agua) × Mes × Reg × Asent × Relac × Contexto, multiplicado por días de viaje.
- Bloque de animales con lógica:
  - Terreno difícil → necesitan comida.
  - Terreno muy difícil / tierras de sombra / oscuras → comida + agua siempre.
  - Resto → no es necesario comprar nada para los animales (pastan/beben por el camino).
- Calculadora visual del modificador total (`115% × 100% × 95% × 110% = 120%`), con flecha ↑ caro / ↓ barato.

**Modificadores de Precio editables:**
- `PriceModifiersSection.jsx` reescrito con edición inline (nombre, %, descripción), Save/Delete por fila, Add row por categoría, todo bajo `isAdmin`.
- Verificado vía curl: PUT `/api/data/modificadores-precio/region/0` actualiza correctamente y persiste.

#### 9. Iteración 56 — Sistema de Clima estático (regiones × meses × campos) (2026-02-25)
**Backend (15/15 nuevos pytest pasando):**
- `/api/climate/seed` carga las **18 regiones × 12 meses × 16 campos** desde `/app/memory/clima_data.json` con jerarquía (KHAND→HARAD, ERED NIMRAIS→GONDOR, etc.).
- CRUD completo: `GET/POST/PUT/DELETE /api/climate/regions[/{id}]`, `PUT /api/climate/regions/{id}/months/{mes}` (parcial por mes).
- Overrides granulares por ubicación: `GET/PUT/DELETE /api/climate/locations/{loc}/override` y por celda `DELETE /…/override/{mes}/{field}`.
- Resolución con herencia: `GET /api/climate/effective/{loc}?mes=…` devuelve base+override merged + icono auto-calculado.
- Endpoint ligero `GET /api/climate/icon/location/{loc}?mes=…` para el visor del viaje. Acepta meses tanto en formato élfico ("Súlimë") como abreviado ("Feb").
- Iconos meteorológicos (☀️ ☁️ 🌧 ❄️ 🌫️ ⛈️) calculados desde porcentajes de nieve/lluvia/tormenta/calima/niebla/horas-sol + temp_max.

**Frontend:**
- Nueva pestaña **"Clima"** en Reglas con 2 sub-tabs:
  - **Regiones (Plantillas)**: Sidebar jerárquico (parent→child indentado), matriz central editable 12×16 por región, vista en vivo del icono que cambia con los % al editar, edición de keywords (qué `region` de las ubicaciones se mapean aquí), botón "Recargar datos del Excel" para re-seedear.
  - **Overrides por Ubicación**: Buscador, lista de ubicaciones, matriz override granular (campo a campo). Las celdas con override se ven en azul y permiten "×" para revertir solo esa celda. Botón "Limpiar todos" para revertir 100% de la herencia.
- Nuevo `WeatherIndicator.jsx` reutilizable: muestra icono + temp + viento + tooltip. Mapea meses élficos→abreviados.
- Integración en `EnhancedTravelSystem.jsx`:
  - **Vista previa del clima** en la configuración: panel "Clima previsto" con icono+stats para origen y destino del mes elegido.
  - **Banner meteorológico** en la pantalla de Resultados: 2 indicadores grandes con clima de origen y destino.

**Testing:** 15/15 pytest backend (`/app/backend/tests/test_climate.py`) + 7/7 flujos frontend (Iteration 56 testing agent — todas las celdas, tabs, overrides, búsqueda, integración con viaje verificadas).

#### 8. Iteración 55 — Crónica unificada + velocidades nuevas + compra provisiones + auto-viaje (2026-02-24)
**Backend (57/57 pytest passing):**
- `POST /api/travel/generate-full-chronicle` nuevo: genera **un único texto narrativo continuo** del viaje, con transiciones ("al tercer día…", "en la quinta jornada…", "por fin vislumbramos…"). Integra orgánicamente las notas del Maestro ya introducidas durante cada tirada.
- Nueva tabla de velocidades (2026): `BASE_KM_DAY=22.5`, `KM_PER_METER_SPEED=2.5`, `DISTANCIA_BASE_KM = 17.5/22.5/27.5` (a pie).
- `velocidad_efectiva(mount_allowed)` aplica **+40%** a la velocidad del personaje cuando va montado Y el terreno lo permite (no en montaña/pantano/ciénaga). Antes sustituía por la velocidad del caballo.
- **Ritmo Rápido parcial**: ya no se rechaza en tierras_salvajes/sombra/oscuras; se aplica un factor intermedio (promedio de Normal y Rápido) — documentado en el código como aproximación MVP.
- Fix crítico del testing agent: `UnboundLocalError` en `casillas` resuelto.

**Frontend:**
- `JourneyDiary.jsx` **reescrito** a modo "crónica unificada": un solo botón "Generar Crónica" → textarea editable → descarga .txt. Auto-hereda notas del Maestro de cada tirada (sin input manual duplicado).
- PDF Crónica: **reemplazada la sección por-día** con el texto narrativo único continuo.
- Bug fix: PDF "a cada miembro" → "al total de la compañía, a repartir entre los N viajeros (M PX por cabeza antes de bonificaciones)".
- `ProvisionsShopDialog.jsx` nuevo — compra pack ración + agua por día (0.45 kg + 3.79 L), precio configurable por región (pp/día), descuenta monedas del PJ, añade peso al inventario vía `/characters/{id}/equipment/add`.
- Botón "Comprar" nuevo en la sección Provisiones del viaje.
- Botón **"Automatizar viaje"** junto a "Realizar Tirada de Orientación": simula tiradas de orientación + eventos en bucle hasta destino; **pausa automáticamente si algún PJ alcanza fatiga 5** con aviso al DJ.
- Selector de ritmo actualiza labels: 15-20 / 20-25 / 25-30 km/día.

#### 7. Iteración 54 — Diario del Viaje con IA (2026-02-24)
**Backend (41/41 pytest passing):**
- Nuevo endpoint `POST /api/travel/generate-day-log` que recibe datos agrupados por jornada (orientación, eventos, notas del Maestro, tiradas de fatiga, acampada, clima) y genera **un párrafo narrativo único** por día usando GPT-4o.
- Clima **integrado orgánicamente** en la narrativa (no "llueve" a secas; sino "la lluvia que lleva cayendo desde el mediodía ha embarrado el camino…").
- Preparado para conectar con el futuro sistema de clima: acepta `clima` y `notas_maestro_dia` opcionales.

**Frontend:**
- Nuevo componente `/app/frontend/src/components/travel/JourneyDiary.jsx`.
- Aparece en la pantalla de Resultados, agrupa datos por jornada (1 entrada por tirada de orientación).
- Botones: "Generar Diario Completo" (todas las jornadas) y regenerar individual por día.
- Cada jornada permite añadir **clima manual** y **notas globales del día** antes de generar.
- Narrativa editable en `<Textarea>` — el DM puede retocar el texto.
- Botón "Descargar" exporta el diario a `.txt` (listo para integrar en el PDF existente).

#### 5. Iteración 53 — Fatiga corregida, PX ajustados, Notas del Maestro (2026-02-24)
**Backend (37/37 pytest passing):**
- `/travel/fatigue-save` reescrito: ahora +1 nivel exacto en fallo (no escala por margen). Acepta `penalizacion_multiples_papeles` (-5 a la tirada).
- `/travel/journey/start` inicializa `fatiga_cd_total` según terreno: 10 (caminos/fácil), 15 (campo abierto/moderado), 20 (terreno difícil/montaña/pantano).
- `/travel/generate-narrative` acepta `notas_maestro` y `clima` opcionales; si vienen datos, la IA los integra en la narrativa.

**Frontend:**
- Tabla PX reducida a **0/2/5/10/15** (CD 5-10/11-14/15-19/20-24/25+).
- `calculateFatigueResults` usa CD base por terreno, pasa penalización de múltiples papeles, aplica automáticamente +1 a `fatiga` del personaje en BD si falla.
- Nuevo textarea **"Notas del Maestro"** en la tirada de orientación y en la resolución de eventos. Se guarda con la tirada y se envía al endpoint de narrativa.

#### 4. Fase A — Modificadores correctos + Día del Mes (2026-02-24)
- `rollEventDice` y las tarjetas pre-tirada ahora usan el modificador precalculado del miembro según su papel (`modViajar/modCaza/modPercepcion/modExplorar`). Fin del bug "+2 siempre".
- Incluye penalización por múltiples papeles (-5) y muestra desglose (habilidad + atributo).
- Tirada de orientación ahora muestra PX generados junto al resultado (`data-testid=orientation-xp-display`).

#### 3. Fase B — Día del Mes en Configuración (2026-02-24)
- Nuevo input `Día del Mes` (1-30, `data-testid=journey-day-input`) junto al selector de Mes.
- Se guarda en `config.diaMes` listo para el futuro sistema de clima.

#### 4. Fase C — Nueva Tabla de PX (2026-02-24)
- Tabla 1: CD 5-10→2 | 11-14→5 | 15-19→10 | 20-24→20 | 25+→35. Crítico nat20: +20. Pifia nat1: -10.
- Tabla 2 (multiplicador global): 0-20%→×1.0, 20-40%→×1.3/×0.7, >40%→×1.6/×0.4.
- Redondeo hacia abajo. **PX mínimos por personaje = 0** (no negativos).
- Aplicado tanto en el resumen de PX como en `applyPXToCharacters`.

#### 1. Sistema de Acampar + Fatiga Acumulativa (2026-02-23)
**Backend:**
- `/api/characters/{id}/fatigue` acepta valores decimales (0.5 steps), clamp 0-6
- `ActiveJourney.fatiga_cd_total` ahora es `float` para soportar 11.5, 10.5, etc.
- Nuevo endpoint `POST /api/travel/journey/{id}/camp` que reduce CD Fatiga por 0.5 (mínimo 10)

**Frontend:**
- Nuevo `PartyFatiguePanel.jsx` visible durante jornadas día-a-día con barra individual por personaje (0-6 niveles, colores progresivos, efectos 5e)
- Nuevo `CampDialog.jsx` con reglas:
  - Selección de centinela (recibe mitad de recuperación)
  - Tirada CON CD10: -1 automático, nat20 → -2
  - Consume 1 ración + 1 agua por miembro
  - Eventos nocturnos según región (1 / 2 / 3)
  - Tirada de Sabiduría (Percepción) CD12 del centinela
  - Decrementa CD Fatiga del viaje en 0.5
- Botón "Acampar" flotante junto a "Descansar" y "Forrajear"
- Display CD Fatiga muestra decimales correctamente

**Testing:** 16/16 pytest pasaron (100% backend coverage). Ver `/app/backend/tests/test_camp_fatigue.py`.

### ✅ Previous Sessions
#### 2. Integración IA (Historias de Ubicación + Retratos de Personajes) - COMPLETADO
- `/api/names/generate-history` — textos estilo Tolkien con gpt-4o-mini
- `/api/portraits/generate` — retratos medievales con GPT Image 1
- Integrados en Creador de Personajes (paso final) y Mapa (Crear Ubicación)
- Visualización en Character Sheet, Character Summary, Characters List

#### 3. Editor de Trasfondos Mejorado - COMPLETADO
- Selector de cultura al crear trasfondo
- Modal "Copiar Trasfondos" para duplicar entre subculturas

---

## Pending Tasks

### P0 - Próximo
- **Verificación manual del usuario**: el bug del Automatizar Viaje + el flujo Provisions + el log meteorológico bajo la crónica del Diario.
- **Auth + RBAC + Campañas (Copy-on-Write)** con JWT, hCaptcha y chat interno para reset de contraseña.

### P1
- Aplicar los `efectos.fatiga_extra` y `efectos.vel_modificador` del clima al motor del viaje (hoy se proponen, pero la lógica de aplicación pendiente).
- Aplicar el clima del día concreto al evento que se rueda en esa casilla (la cadena ya está; falta consumirla).
- Exportar Diario en Markdown (Obsidian/Notion).
- Game Master Screen (dashboard en vivo).

### P2
- **REFACTOR URGENTE**: `EnhancedTravelSystem.jsx` ya en 5793 líneas — extraer `automateJourney`, `renderGlobalJourney`, `renderDayByDay` a módulos.
- Pathfinding debugger fix.
- Mouse wheel zoom smoothing (Master Map).
- Database backup/restore.

---

## Technical Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── character_routes.py    # Float fatigue support
│   │   ├── data_routes.py
│   │   ├── name_generator.py      # AI location histories
│   │   ├── portrait_routes.py     # AI character portraits
│   │   ├── storage_routes.py
│   │   ├── trading_routes.py
│   │   └── travel_routes.py       # + /journey/{id}/camp endpoint
│   ├── tests/
│   │   └── test_camp_fatigue.py   # 16/16 passing
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   ├── character-creator/
        │   ├── character-sheet/
        │   ├── map/
        │   ├── rules/
        │   ├── travel/              # NEW
        │   │   ├── CampDialog.jsx
        │   │   └── PartyFatiguePanel.jsx
        │   └── ui/
        └── pages/
            ├── EnhancedTravelSystem.jsx   # + camp button, fatigue panel
            ├── CharacterSheetPage.jsx
            ├── CharactersListPage.jsx
            └── MiddleEarthMap.jsx
```

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Location history generation
- **OpenAI GPT Image 1**: Character portrait generation
- **Emergent LLM Key**: Universal key

---

## User's Preferred Language: Español

