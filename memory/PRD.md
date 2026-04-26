# LOTR 5e RPG - Product Requirements Document

## Current State (2026-02-25)

### ✅ COMPLETED This Session

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

