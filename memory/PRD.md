# LOTR 5e RPG - Product Requirements Document

## Current State (2026-04-29)

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
