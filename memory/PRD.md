# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-03-05)

### ✅ COMPLETED This Session (2026-03-05 - Travel System)

#### P0: Sistema de Viajes Mejorado - Backend ✅ (NEW)
Se creó un sistema completo de reglas de viaje con datos editables desde la UI.

**Nuevo archivo: `/app/backend/routes/travel_routes.py`**
- **Endpoints de Configuración (CRUD):**
  - `GET/PUT /api/travel/config/events` - Tabla de acontecimientos de viaje (d20)
  - `GET/PUT /api/travel/config/objectives` - Objetivos de acontecimientos (d3)
  - `GET/PUT /api/travel/config/terrains` - Configuración de terrenos
  - `GET/PUT /api/travel/config/land-types` - Tipos de tierra con PX
  - `GET/PUT /api/travel/config/rules` - Reglas generales de fatiga, orientación, velocidad

- **Endpoints de Viaje:**
  - `POST /api/travel/calculate-journey` - Calcula viaje completo
  - `POST /api/travel/generate-event` - Genera acontecimiento con tiradas
  - `POST /api/travel/resolve-event` - Resuelve acontecimiento
  - `POST /api/travel/fatigue-save` - Tirada de fatiga final

- **Endpoints de Modo Jornada a Jornada:**
  - `POST /api/travel/journey/start` - Inicia viaje día a día
  - `GET /api/travel/journey/{id}` - Estado del viaje activo
  - `POST /api/travel/journey/{id}/advance-day` - Avanza un día
  - `POST /api/travel/journey/{id}/add-event` - Añade evento al día
  - `POST /api/travel/journey/{id}/complete` - Completa viaje

**Datos por defecto incluidos:**
- 7 tipos de acontecimientos (Terrible desgracia → Vista agradable)
- 3 objetivos de acontecimientos (Explorador, Vigía, Cazador)
- 3 tipos de terreno (Difícil, Camino, Campo abierto)
- 5 tipos de tierra (Libres, Fronterizas, Salvajes, Sombra, Oscuras)

#### P1: Sección de Configuración de Viajes en RulesPage ✅ (NEW)
**Nuevo componente: `/app/frontend/src/components/rules/sections/TravelRulesSection.jsx`**

Interfaz con 4 pestañas editables:
1. **Acontecimientos** - Tabla d20 con rangos, CD fatiga, consecuencias
2. **Terrenos** - CD prueba, modificador velocidad, permite montura
3. **Tipos de Tierra** - PX por tipo de terreno, ventaja/desventaja, ritmo rápido
4. **Reglas** - CD base fatiga, orientación, velocidad, modificadores estacionales

**Integración en RulesPage:**
- Nueva categoría "Config. Viajes" añadida al menú de reglas
- Icono de engranaje (Settings)
- Todas las tablas son editables y se guardan en MongoDB

### ✅ COMPLETED Previous Session (2026-03-05)

#### P0: Verificación de Lógica de Pathfinding "Pasos de Montaña" ✅
La lógica de pathfinding que permite que los caminos crucen barreras infranqueables (creando "pasos") **ya estaba implementada**.

**Funciones clave en `/app/backend/utils/pathfinding.py`:**
- `_check_barrier_crossing()` - Verifica si un segmento cruza una barrera
- `_road_crosses_barrier_at_segment()` - Detecta si un camino cruza la misma barrera, creando un paso transitable
- `_get_intersection_point()` - Calcula el punto exacto de intersección

**Pruebas verificadas:**
- Hobbiton → Erebor: 395.5 km, 10.6 días, usando "Paso Alto"
- Rivendel → Lothlórien: 110.4 km, 5.2 días, usando "Camino del Este"

#### P1: Refactorización Adicional de MiddleEarthMap.jsx ✅ (NEW)
Se continuó la modularización del archivo, integrando componentes ya creados:

**Componentes integrados:**
- **EditLocationPanel.jsx** - Panel de edición de ubicaciones (reemplazó `renderEditPanel()`)
- **CreateLocationPanel.jsx** - Panel de creación de ubicaciones (reemplazó `renderCreatePanel()`)

**Resultado:**
- Archivo reducido de **2815 a 2376 líneas** (~439 líneas adicionales, **-16%**)
- Total reducción desde inicio: de ~3552 a 2376 líneas (**-33%**)
- 2 funciones render adicionales eliminadas
- Componentes ahora reutilizables y testables

**Index actualizado (`/app/frontend/src/components/map/index.js`):**
- Ahora exporta 10 componentes del mapa

### ✅ COMPLETED Previous Session (2026-03-05)

#### P0: Refactorización de RulesPage.jsx ✅
Se extrajeron múltiples secciones del archivo monolítico `RulesPage.jsx` (~4700 líneas) a componentes independientes:

**Nuevos componentes creados (`/app/frontend/src/components/rules/`):**
1. **EquipmentSection.jsx** - Tablas de equipamiento con todas las categorías, modal PDF, y editores
2. **PriceModifiersSection.jsx** - Visualización de modificadores de precio
3. **RegionsSection.jsx** - Gestión CRUD de regiones con terreno y peligro
4. **CulturesSection.jsx** - Cards expandibles de culturas con detalles completos
5. **OccupationsSection.jsx** - Cards expandibles de ocupaciones/clases

**Impacto:** RulesPage.jsx ahora usa 20+ componentes refactorizados, mejorando mantenibilidad.

#### P1: Sistema de Archivos GridFS ✅
Sistema completo de almacenamiento persistente usando MongoDB GridFS.

**Backend (`/app/backend/routes/storage_routes.py`):**
- Endpoints para listar, subir, descargar, eliminar archivos
- Gestión de campañas, jugadores, personajes
- Estadísticas de almacenamiento

**Frontend:**
- **FileManager.jsx** - Explorador jerárquico con búsqueda, upload y creación de campañas
- **StoragePage.jsx** - Nueva ruta `/storage` para acceso al sistema de archivos

#### P2: Integración GridFS con Character Sheets ✅ (NEW)
Se integró el sistema GridFS con la generación de fichas de personaje.

**Cambios en `InteractiveCharacterSheet.jsx`:**
- Función `generatePDF` ahora acepta parámetro `saveToStorage`
- Nuevo botón "Guardar en Almacén" que genera el PDF y lo sube a GridFS
- Los PDFs se guardan en la carpeta `character_sheets` con el ID del personaje

#### P2: Refactorización de MiddleEarthMap.jsx - COMPLETA ✅
Se crearon componentes base y se integaron completamente en el mapa:

**Componentes creados (`/app/frontend/src/components/map/`):**
1. **mapConstants.js** - Constantes compartidas (colores, tipos de ubicación, iconos, tipos de caminos/ríos/barreras)
2. **RoadsPanel.jsx** - Panel de gestión de caminos (integrado)
3. **RiversPanel.jsx** - Panel de gestión de ríos (integrado)
4. **BarriersPanel.jsx** - Panel de gestión de barreras (integrado)
5. **LocationInfoPanel.jsx** - Panel de información de ubicación (integrado)
6. **RoutePanel.jsx** - Panel de ruta calculada (integrado) (NEW)
7. **MapControls.jsx** - Controles de zoom, filtros y opciones de vista

**Resultado Final:**
- Archivo reducido de **3552 a 2814 líneas** (~738 líneas menos, **-21%**)
- 5 funciones render eliminadas y convertidas a componentes
- Constantes compartidas en `mapConstants.js`
- Mapa del Maestro funcionando correctamente con todos los paneles

#### P2: Acceso directo al Almacén desde HomePage ✅
- Añadido nuevo medallón "Almacén de Archivos" en la HomePage
- Generada imagen personalizada del cofre del tesoro medieval
- Reemplazó el medallón "Juego en Línea" (no implementado) por acceso funcional al almacén
- Link a `/storage` funcionando correctamente

#### P2: Lógica de Creación de Personajes - VERIFICADA ✅
La lógica de dinero/equipo inicial ya está implementada en `Step7Equipment.jsx`:
- Equipo automático según Nivel de Vida (Frugal, Común, Próspero)
- Dinero inicial combinando Nivel de Vida + Ocupación
- Sistema funcionando correctamente en el wizard de creación

### ✅ COMPLETED Previous Session (2026-03-04)

#### P0: Sistema "Compra-Venta Dinámica" ✅ (NEW)
Sistema completo de comercio dinámico con generación de diálogos de NPC usando IA.

**Backend (`/app/backend/routes/trading_routes.py`):**
- **Endpoints de Configuración:**
  - `GET /api/trading/config` - Configuración completa del sistema
  - `PUT /api/trading/config` - Actualizar configuración
  - `POST /api/trading/config/reset` - Restablecer a valores por defecto
  
- **Endpoints de Cálculo:**
  - `POST /api/trading/calculate` - Calcular precio justo y reacción del NPC
  - `POST /api/trading/calculate-with-dialogue` - Calcular + generar diálogo con LLM

- **Endpoints de NPCs:**
  - `GET /api/trading/npcs` - Listar NPCs comerciantes
  - `POST /api/trading/npcs` - Crear NPC
  - `POST /api/trading/npcs/generate` - Generar NPC aleatorio
  - `PUT /api/trading/npcs/{id}` - Actualizar NPC
  - `DELETE /api/trading/npcs/{id}` - Eliminar NPC
  
- **Endpoints de Relaciones:**
  - `GET /api/trading/relationships` - Listar relaciones PJ-NPC
  - `POST /api/trading/relationships` - Crear/actualizar relación

**Sistema de Cálculo de Precios:**
1. Precio base del artículo
2. × Modificador de bendición (+15% a +50%)
3. × Factor de región (configurable por zona)
4. × Factor de asentamiento (configurable por tipo)
5. × Factor de contexto histórico (guerra, prosperidad, hambruna, etc.)
6. = Precio de mercado
7. × Factor de relación (Hostil a Hermandad)
8. × Factor de perfil del comerciante (Normal, Codicioso, Honorable, Desesperado, etc.)
9. = **Precio Justo Final**

**Sistema de Reacción del NPC:**
- Tirada d100 modificada por relación y contexto
- **Resultados:** Acepta, Rechaza, Contraoferta, Enfado (leve/moderado/severo)
- Cada resultado afecta la relación futura

**Integración LLM (OpenAI GPT-4o):**
- Genera diálogos narrativos inmersivos en español
- Refleja personalidad del NPC y resultado de la negociación
- Indicador "Generado con IA" en la UI
- Fallback a diálogos pregenerados si LLM falla

**Frontend (`/app/frontend/src/components/rules/TradingSystemSection.jsx`):**
- **4 Tabs:**
  1. **Calculadora:** Selector de artículo, modificadores, oferta, botón calcular
  2. **Configuración:** Editar todos los modificadores del sistema
  3. **PNJs:** Listar, crear, editar, eliminar, generar aleatorios
  4. **Relaciones:** Ver historial de relaciones PJ-NPC
  
- **Resultado de Cálculo:**
  - Desglose completo del precio
  - Tirada de d100 con bonificadores
  - Resultado visual (verde=acepta, rojo=rechaza, amarillo=contraoferta)
  - Diálogo del NPC generado por IA

**Nueva categoría en RulesPage:** "Compra-Venta" con icono de monedas

#### Gemas Añadidas al Catálogo de Equipo ✅ (NEW)
- **102 Gemas Preciosas:** Alejandrita, Rubí, Esmeralda, Zafiro, Diamantes (varios), etc.
- **130 Gemas Semipreciosas:** Turquesa, Lapislázuli, Malaquita, Obsidiana, etc.
- Cada gema con nombre, precio y tipo de moneda (mp, mo, mb, mc)
- Visible en sección "Precios de Equipo" > "💎 GEMAS"

---

#### P0: Actualización de Posiciones de Campos de la Hoja de Personaje ✅
- **Base de datos actualizada:** 182 campos totales (146 page1, 32 page2, 4 page3) con las nuevas coordenadas proporcionadas por el usuario
- **Código fuente sincronizado:**
  - `SheetPage1.jsx`: Actualizado `peso_transportado` (y: 377→369) y `peso_montura` (x: 1130→1186, y: 428→421, width: 160→116)
  - `SheetPage2.jsx`: Actualizado `sombra` (y: 418→411), `descripcion_sombra` (y: 465→462), renombrado `rasgos_culturales_2` → `rasgos_personalidad`
- **Endpoint utilizado:** `PUT /api/data/sheet-positions`
- **Verificación:** Screenshot de la hoja interactiva confirmando que los campos se renderizan correctamente

#### P0: Editor de Lógica de Creación de Personajes ✅ (NEW)
**Backend (`/app/backend/routes/data_routes.py`):**
- Nueva colección `character_creation_config` en MongoDB
- Endpoints CRUD:
  - `GET /api/data/character-creation-config` - Obtener configuración completa
  - `PUT /api/data/character-creation-config` - Actualizar configuración completa
  - `PUT /api/data/character-creation-config/wealth-levels` - Actualizar niveles de vida
  - `PUT /api/data/character-creation-config/occupation-bonuses` - Actualizar bonificaciones por ocupación
  - `POST /api/data/character-creation-config/reset` - Restablecer a valores por defecto
  - Endpoints individuales para editar niveles/ocupaciones específicas
- **Valores por defecto:**
  - 5 niveles de vida: Pobre (5mc), Frugal (2mp+10mc), Común (10mp+20mc), Próspero (2mo+20mp), Rico (10mo+50mp)
  - 6 ocupaciones con bonificaciones de dinero y equipo

**Frontend:**
- Nuevo componente `CharacterCreationSection.jsx` (`/app/frontend/src/components/rules/`)
- Nueva categoría "Lógica de Creación" en `RulesPage.jsx` (RULE_CATEGORIES)
- **Características UI:**
  - Panel colapsable para cada nivel de vida con colores diferenciados
  - Edición de descripción, dinero inicial (oro/plata/cobre/estaño), equipo adicional
  - Panel de bonificaciones por ocupación con dinero extra y equipo
  - Botones: Guardar, Restablecer, Añadir nueva ocupación, Eliminar ocupación
  - Caja informativa explicando cómo funciona el sistema
- **Verificación:** Screenshots confirmando funcionamiento correcto de toda la UI

#### Sistema de Mapas Separados (Maestro/Jugador) ✅ (NEW)
**Estructura de rutas:**
- `/map` - Página de selección de mapas (MapSelectionPage.jsx)
- `/map/master` - Mapa del Maestro con todas las funcionalidades (MiddleEarthMap.jsx)
- `/map/player` - Mapa del Jugador simplificado (PlayerMap.jsx)

**Página de Selección (`MapSelectionPage.jsx`):**
- Dos tarjetas estilizadas: Maestro (dorado) y Jugador (azul)
- Lista de características de cada mapa
- Indicador visual de "Solo Maestro" con icono de candado (sin efecto aún)
- Nota explicativa sobre cálculo de viajes

**Mapa del Jugador (`PlayerMap.jsx`):**
- Nuevo mapa simplificado sin nombres de ubicaciones
- Imagen: `Mapa jugadores.png` de los artifacts del usuario
- Funcionalidades: Pan, Zoom, Reset de vista
- Preparado para mostrar rutas de viaje calculadas
- Sistema de conversión de coordenadas Master→Player

**Mapa del Maestro:**
- Actualizado header: "MAPA DEL MAESTRO"
- Botón "← Mapas" que vuelve a la selección
- Mantiene todas las funcionalidades existentes

#### Herramienta de Corrección de Terreno ✅ (NEW)
**Componente:** `TerrainCorrectionTool.jsx` (`/app/frontend/src/components/rules/`)
**Categoría en Reglas:** "Terrenos"

**Características:**
- Lista de 216 ubicaciones con terreno y tipo de tierra
- Detecta 20 ubicaciones con problemas (valores faltantes o inconsistentes)
- **Filtros:** Búsqueda, región, tipo de terreno, tipo de tierra, solo problemas
- **Leyenda visual:** Colores para dificultad (Fácil→Infranqueable) y tipo (Tierras Libres→Oscuras)
- **Selectores editables** para cada ubicación (solo admin)
- **Botón "Auto-corregir"** que normaliza valores inconsistentes:
  - `severo` → `desalentador`
  - `tierras_de_la_sombra` → `tierras_sombra`
  - `tierras_fronterizas` → `fronterizas`
  - Valores faltantes → valores por defecto
- **Indicadores de estado:** ✓ verde (OK), ⚠️ naranja (problemas), 💾 verde (cambios pendientes)
- **Guardado por lotes** de todos los cambios

---

## Previous State (2026-02-24)

### ✅ COMPLETED This Session (2026-02-24)

#### Sistema de Dibujo de Ríos en el Mapa ✅ (NEW)
**Backend:**
- Nuevos endpoints CRUD para ríos: `/api/data/rivers`
- Modelo `River` con: nombre, tipo, descripcion, puntos (coordenadas)
- Colección `rivers` en MongoDB
- **3 tipos de ríos:**
  - `vadeable`: Cruzable con montura (color azul claro #4A90D9)
  - `profundo`: Solo nadando, sin monturas (color azul medio #2E5A8B)
  - `infranqueable`: Solo barcaza o puente (color azul oscuro #1A3A5C)

**Frontend (MiddleEarthMap.jsx):**
- Botón "🌊 Dibujar Río" en modo edición
- Selector de tipo de río (Vadeable, Profundo, Infranqueable)
- Campo para nombre del río
- Renderizado de ríos en el SVG con colores según tipo
- Panel de "Gestión de Ríos" con lista de ríos guardados
- Opciones de Ver, Editar y Eliminar para cada río
- Contador de ríos por tipo en el footer del panel

#### Sistema de Dibujo de Barreras/Líneas Infranqueables en el Mapa ✅ (NEW)
**Backend:**
- Nuevos endpoints CRUD para barreras: `/api/data/barriers`
- Modelo `Barrier` con: nombre, tipo, descripcion, puntos (coordenadas)
- Colección `barriers` en MongoDB
- **3 tipos de barreras:**
  - `montana`: Cordillera infranqueable (color marrón #8B4513, línea punteada)
  - `acantilado`: Pared vertical (color marrón oscuro #654321)
  - `frontera`: Barrera mágica/peligrosa (color rojo oscuro #4A0000)

**Frontend (MiddleEarthMap.jsx):**
- Botón "⛰️ Dibujar Barrera" en modo edición
- Selector de tipo de barrera (Montaña, Acantilado, Frontera Oscura)
- Campo para nombre de la barrera
- Renderizado de barreras en el SVG con líneas punteadas según tipo
- Panel de "Barreras Infranqueables" con lista de barreras guardadas
- Opciones de Ver, Editar y Eliminar para cada barrera
- Contador de barreras por tipo en el footer del panel

#### Algoritmo de Pathfinding A* ✅ (NEW)
**Backend (/app/backend/utils/pathfinding.py):**
- Implementación completa del algoritmo A* para calcular rutas óptimas
- Consideraciones del algoritmo:
  - **Terreno:** facil (×1.0), moderado (×1.33), dificil (×2.0), muy_dificil (×3.0), desalentador (×4.0), infranqueable (×∞)
  - **Caminos:** ninguno (×1.0), sendero (×0.85), secundario (×0.7), real (×0.5)
  - **Ríos:** vadeable (×1.5, montura permitida), profundo (×3.0, sin montura), infranqueable (×∞)
  - **Barreras:** Completamente infranqueables, la ruta las evita
- Velocidad base: 36 km/día

**Endpoints:**
- `POST /api/data/pathfinding/calculate` - Calcula ruta entre coordenadas o IDs de ubicación
- `GET /api/data/pathfinding/between/{start_id}/{end_id}` - Shortcut para rutas entre ubicaciones

**Respuesta del pathfinding:**
```json
{
  "success": true,
  "path": [[x, y], ...],  // Waypoints de la ruta
  "total_distance_km": 195.1,
  "estimated_days": 5.3,
  "roads_used": ["Camino del Este"],
  "rivers_crossed": [],
  "terrain_summary": {"dificil": 161.6, "moderado": 27.2, "muy_dificil": 6.4},
  "warnings": ["📍 Hobbiton → Rivendel"]
}
```

**Frontend (TravelGenerator.jsx):**
- Nuevo panel "Ruta Óptima Calculada (A*)" cuando se selecciona origen/destino
- Muestra: km total, días estimados, waypoints, caminos usados
- Desglose de terreno atravesado con badges de colores
- Lista de ríos a cruzar (si aplica)

**Frontend (MiddleEarthMap.jsx):**
- Renderizado de ruta calculada como línea cyan sobre el mapa
- Marcadores de inicio (verde) y fin (rojo)
- Flecha de dirección en el punto medio
- Panel de ruta muestra información del pathfinding

**Datos de prueba verificados:**
- Hobbiton → Rivendel: 195.1 km, 5.3 días, usando Camino del Este, 29 waypoints

#### Sistema de Dibujo de Caminos en el Mapa ✅ (Previous)
**Backend:**
- Nuevos endpoints CRUD para caminos: `/api/data/roads`
- Modelo `Road` con: nombre, tipo (sendero/secundario/real), descripcion, puntos (coordenadas)
- Colección `roads` en MongoDB

**Frontend (MiddleEarthMap.jsx):**
- Modo de dibujo de caminos con puntos conectados
- Botón "🛤️ Dibujar Camino" en modo edición
- Selector de tipo de camino (Sendero, Secundario, Real)
- Campo para nombre del camino
- Visualización de caminos con colores por tipo:
  - Sendero: marrón (#8B7355), línea punteada
  - Secundario: beige (#C4A574), línea sólida
  - Real: dorado (#FFD700), línea gruesa
- Puntos de control verdes durante el dibujo
- Doble clic para terminar el camino

#### Sistema Completo de Cálculo de Viajes ✅
**Backend (endpoints nuevos):**
- `POST /api/data/travel/calculate` - Calcula km/día con todas las reglas
- `GET /api/data/travel/options` - Opciones para poblar selectores
- `POST /api/data/travel/find-route` - Busca rutas alternativas por pasos de montaña

**Frontend (TravelGenerator.jsx) - Integrado:**
- **Selector de Ritmo**: Lento 24km, Normal 36km, Rápido 48km
- **Selector de Tipo de Camino**: Sin camino, Sendero, Secundario, Real
- **Selector de Horas de Marcha Forzada**: 0-4 horas con CD dinámico
- **Calculadora en vivo**: Muestra km/día con fórmula desglosada
- **Advertencias automáticas**: Ritmo rápido prohibido en regiones peligrosas, montura no disponible en terreno difícil
- **CD de marcha forzada dinámico**: Incluye modificadores por región

**Reglas implementadas:**
- Terreno moderado en sendero = ×1 (anula penalización)
- Tierras de la Sombra reduce bonus de camino 50%
- Tierras Oscuras anula bonus de camino
- Montura ×1.5 (no aplica en terreno muy difícil+)
- Infranqueable = 0 km (requiere paso de montaña)

#### Sistema de Tipos de Terreno y Clases de Peligro ✅
**Backend:**
- Nuevos campos `tipo_terreno` y `clase_region` añadidos a regiones y ubicaciones
- Script `analyze_map_terrain.py` que analiza los colores del mapa y asigna automáticamente:
  - Tipos de terreno basados en colores: Fácil (#d3ba84), Moderado (#948c4d), Difícil (#c38d4f), Muy Difícil (#a57044), Desalentador (#af4b27), Infranqueable (#664540)
  - Clases de peligro basadas en lore: Tierras Libres, Fronterizas, Salvajes, de la Sombra, Oscuras
- Campo `es_paso_montana` para identificar pasos de montaña que permiten atravesar terreno infranqueable
- Módulo `travel_config.py` con multiplicadores y cálculos para el generador de viajes

**Frontend (RulesPage.jsx):**
- Selectores de tipo de terreno y clase de región para cada región y subregión
- Badges de colores que muestran visualmente la dificultad y peligro
- Leyenda explicativa con multiplicadores de tiempo de viaje y porcentajes de encuentros

**Datos actualizados:**
- 211 ubicaciones con tipo de terreno y clase de peligro
- 100 regiones con tipo de terreno y clase de peligro
- Pasos de montaña identificados: Moria, Paso de Caradhras, Paso Alto, Morannon, etc.

#### Campo MonturaPeso en Hoja de Personaje ✅
- Nuevo campo `montura_peso` que muestra "MONTURA, PesoCargadoKg/PesoMaxKg"
- Cálculo incluye: peso equipo montura + peso equipo personaje + peso del jinete

---

## Previous Session (2026-02-23)

### ✅ COMPLETED Previous Session (2026-02-23)

#### P0: Sistema de Peso de Montura y Gestión de Equipo Completado ✅
- **`SheetPage1.jsx`** - Sistema de cálculo de peso implementado:
  - `calcularPesoMontura()` - Calcula peso de items llevados por la montura
  - `calcularPesoTransportado()` - Excluye peso de items en la montura
  - Campo `peso_montura` muestra "(M:X.XX)" junto al peso transportado
  - La montura aparece en la lista de equipo con su capacidad

- **`EquipmentManagerModal.jsx`** - Gestión completa de equipamiento:
  - Muestra resumen: dinero, peso personaje, peso/capacidad montura
  - Procesa `equipo_ocupacion` para mostrar armas, armaduras y equipo
  - Categorización automática: armas, armaduras, escudos, equipo ocupación
  - Muestra mejoras aplicadas en items (ej: "Espada corta [AFILADA]")
  - Botones para mover items entre personaje y montura
  - Total de 18 items mostrados para personaje de prueba

#### P1/P2: Modificadores de Precio en RulesPage ✅
- **Nueva categoría** "Modificadores de Precio" con icono Coins
- **Función `renderPriceModifiers()`** que muestra 4 tablas:
  - Por Región (14 regiones: Eriador, Bosque Negro, Mordor, etc.)
  - Por Asentamiento (10 tipos: Aldea pequeña, Ciudad, Capital, etc.)
  - Por Relación con Vendedor (8 tipos: Amigo, Enemigo, etc.)
  - Por Contexto Histórico (8 tipos: Guerra activa, Paz, etc.)
- **Colores intuitivos**: verde para descuentos, rojo para aumentos
- **Ejemplo de cálculo** con fórmula explicada

---

## Previous Session (2025-02-23)

### ✅ COMPLETED Previous Session

#### Sistema Completo de Gestión de Equipamiento ✅
- **Nuevo modal `EquipmentManagerModal.jsx`:**
  - Pestaña "Añadir Equipo": Navegar catálogo por categorías, búsqueda, seleccionar cantidad
  - Pestaña "Gestionar": Ver todo el equipamiento, eliminar items, mover entre personaje/montura
  - Tipo de adquisición: "Comprar" (deduce dinero) o "Regalo/Tesoro" (gratis)
  - Sistema de conversión de monedas (mo > mp > me > mc)
  - Validación de dinero suficiente antes de comprar
  - Soporte completo para monturas con capacidad de carga
  - Visualización de peso y estado de estorbo en tiempo real

- **Nuevos endpoints backend:**
  - `POST /api/characters/{id}/equipment/add` - Añadir equipo (compra o regalo)
  - `DELETE /api/characters/{id}/equipment/remove` - Eliminar equipo
  - `PATCH /api/characters/{id}/equipment/carry` - Mover equipo entre personaje y montura
  - `GET /api/characters/{id}/weight-summary` - Resumen de peso y estorbo

- **Lógica de peso implementada:**
  - Armas y armaduras SIEMPRE las lleva el personaje
  - Items del inventario pueden asignarse a la montura
  - Peso en montura no cuenta para estorbo del personaje
  - Capacidad de carga de montura se actualiza en tiempo real

#### P1: Lógica Completa de Aplicar Recompensas ✅
(Completado anteriormente en esta sesión)

---

## Previous State (2025-12-19)

### ✅ COMPLETED This Session

#### P0: Sistema de Gestión de Regiones Dinámico 🗺️
- **Backend CRUD completo** para regiones en `/api/data/regions`:
  - `GET /regions` - Lista jerárquica de regiones principales con sub-regiones
  - `GET /regions/flat` - Lista plana para dropdowns simples
  - `POST /regions` - Crear nueva región (principal o sub-región)
  - `PUT /regions/{id}` - Actualizar nombre de región
  - `DELETE /regions/{id}` - Eliminar región (y sub-regiones si es principal)
  - `POST /regions/seed` - Poblar con 48 regiones iniciales de la Tierra Media
- **Interfaz de gestión en RulesPage**:
  - Nueva categoría "Regiones" con icono MapPin
  - Vista jerárquica: regiones principales con sus sub-regiones
  - CRUD completo: crear, editar, eliminar regiones y sub-regiones
  - Botón para cargar regiones iniciales si la colección está vacía
- **Integración en el Mapa**:
  - El selector de regiones ahora carga datos dinámicos del backend
  - Fallback a jerarquía estática si no hay datos
  - Usado tanto en crear como en editar ubicaciones

#### P1: Sistema de Recompensas al Equipamiento ⚔️
- **Modal `EquipmentRewardsModal.jsx`** en la hoja de personaje:
  - Selección de equipamiento (armas, armaduras, escudos)
  - Lista de mejoras aplicables filtradas por tipo de equipo
  - Aplicación de mejoras con persistencia en la base de datos
  - Visualización de mejoras ya aplicadas en cada equipo
- **Botón "Recompensas"** añadido al header de InteractiveCharacterSheet

#### P2: Exportar Viajes a PDF 📄
- **Función `exportToPDF`** en TravelGenerator:
  - Genera PDF con jsPDF
  - Incluye: origen/destino, resumen del viaje, días, casillas, terreno
  - Lista de eventos con tiradas, CD, y consecuencias
  - Formato estilizado con colores según éxito/fracaso
- **Botón "Exportar PDF"** añadido junto a "Guardar Viaje"

#### P2: Exportar Equipamiento a PDF con Filtros 🖨️
- **Modal mejorado** con filtros:
  - **Filtrar por Asentamiento:** dropdown para mostrar solo items disponibles en ese tipo
  - **Filtrar por Región:** dropdown jerárquico con todas las regiones/subregiones
  - Indicador visual cuando hay filtros activos
- **7 categorías** en grid de 2 columnas
- **PDF generado** respetando los filtros seleccionados

#### Sistema de Edición y Disponibilidad de Equipamiento 🛠️
- **Botones de editar/eliminar** en cada fila de equipamiento (visible al pasar el ratón)
- **Modal de edición completo** con:
  - Campos editables: nombre, precio, moneda, peso, daño, CA, etc.
  - Selector de disponibilidad por asentamiento (Aldea, Pueblo, Villa, Ciudad, Capital, Especial)
  - **Selector de disponibilidad por región** con jerarquía completa:
    - Checkboxes para cada región principal y sus subregiones
    - Botones "Todas" y "Ninguna" para selección rápida
    - Si no hay selección = disponible en todas las regiones
- **Precios actualizados y disponibilidad regional configurada:**
  - Caballos de Rohan: solo en Rohan y Gondor
  - Caballos de Lothlórien: Lothlórien, Rhovanion, Eriador
  - Camellos/Elefantes: Harad, Rhûn
  - Transporte marítimo: solo regiones costeras (Gondor, Belfalas, Umbar, Lindon)
  - Venenos: Mordor, Angmar, Harad, Rhûn
  - Hierbas raras: ciudades principales

#### P2: Refactorización del Mapa 🗺️
- **Nuevos componentes modulares en `/components/map/`**:
  - `MapControls.jsx` - Controles de zoom, switches de vista
  - `MapFilters.jsx` - Filtros de región, tipo, búsqueda
  - `LocationInfoPanel.jsx` - Panel de información de ubicación
  - `EditLocationPanel.jsx` - Formulario de edición
  - `CreateLocationPanel.jsx` - Formulario de creación
  - `RouteInfoPanel.jsx` - Información de ruta calculada
  - `index.js` - Exportaciones centralizadas

#### Mejoras de Navegación
- **Botón "Inicio"** añadido al mapa para volver a la página principal

### ✅ COMPLETED Previous Sessions

#### P0: Trasfondos Reorganizados por Raza/Cultura
- Nuevo endpoint `GET /api/data/backgrounds/grouped/by-race` 
- Componente `BackgroundsSection.jsx` con tabs por raza (Elfos, Enanos, Hobbits, Hombres)
- 114 trasfondos organizados en culturas colapsables

#### P1: Sistema de Recompensas de Equipamiento
- Datos completos extraídos del PDF `Recompensas.pdf`
- 6 mejoras detalladas con efectos, restricciones y reglas de "El Anillo Único"
- Información de bendiciones, niveles de recompensa, y tradiciones de armas con nombre

#### P1: Sistema de Ubicaciones del Mapa - COMPLETO 🗺️
**182 ubicaciones de la Tierra Media cargadas desde 4 mapas:**

| Mapa | Ubicaciones |
|------|-------------|
| Gondor/Rohan | 60 |
| Mordor | 28 |
| Eriador | 49 |
| Rhovanion | 28 |

**Por Región:**
- Eriador: 50 (La Comarca, Bree, Rivendel, Moria, Angmar...)
- Rhovanion: 33 (Erebor, Valle, Bosque Negro, Lothlórien...)
- Gondor: 32 (Minas Tirith, Osgiliath, Dol Amroth...)
- Mordor: 25 (Barad-dûr, Orodruin, Minas Morgul...)
- Rohan: 15 (Edoras, Helm's Deep, Isengard...)

**Por Tipo de Terreno:**
- Fácil: 52
- Moderado: 37
- Difícil: 35
- Muy Difícil: 18
- Infranqueable: 12
- Desalentador: 11

**Por Tipo de Tierra:**
- 🟢 Tierras Libres: 65
- 🟠 Tierras Salvajes: 36
- 🟡 Fronterizas: 28
- 🔴 Tierras de Sombra: 19
- ⚫ Tierras Oscuras: 17

**Escala:** 1 hexágono = 4 millas = 6.4 km

#### P1: Integración de Ubicaciones en el Generador de Viajes ✅
- Endpoint `GET /api/data/locations/calculate-route/{origin}/{dest}` calcula:
  - Distancia en km, millas y hexágonos
  - Días de viaje estimados
  - Terreno y tipo de tierra
  - Nivel de peligro
  - Dirección cardinal
- Frontend actualizado con:
  - Selectores de ubicación agrupados por región
  - Cálculo automático de ruta al seleccionar origen/destino
  - Panel de información con distancia, días, peligro, terreno
  - Indicadores de refugio y nombres sindarin

## Key Files Modified This Session
- `/app/backend/routes/data_routes.py` - Endpoints de backgrounds, recompensas, locations, calculate-route
- `/app/backend/load_gondor_locations.py` - Carga mapa Gondor/Rohan (60 locs)
- `/app/backend/load_mordor_locations.py` - Carga mapa Mordor (28 locs)
- `/app/backend/load_eriador_locations.py` - Carga mapa Eriador (49 locs)
- `/app/backend/load_rhovanion_locations.py` - Carga mapa Rhovanion (28 locs)
- `/app/frontend/src/components/rules/BackgroundsSection.jsx` - Nuevo componente
- `/app/frontend/src/pages/TravelGenerator.jsx` - Integración de ubicaciones
- `/app/frontend/src/pages/RulesPage.jsx` - Sección Recompensas actualizada

## Key Files Modified This Session (2026-02-24 Rivers & Barriers)
- `/app/backend/routes/data_routes.py` - Nuevos endpoints CRUD para rivers y barriers

## Key Files Modified This Session (2026-02-24 Pathfinding A*)
- `/app/backend/utils/pathfinding.py` - NUEVO: Módulo de pathfinding A* completo
- `/app/backend/routes/data_routes.py` - Nuevos endpoints pathfinding/calculate y pathfinding/between
- `/app/frontend/src/pages/TravelGenerator.jsx` - Estado pathfindingResult, panel de ruta óptima
- `/app/frontend/src/pages/MiddleEarthMap.jsx` - calculatedPath state, renderRoute mejorado para rutas A*

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Refactorizar `MiddleEarthMap.jsx`** (~3600 líneas) - Los componentes modulares están creados en `/components/map/`, falta mover la lógica del archivo principal
2. **Refactorizar `RulesPage.jsx`** (~4000+ líneas) - Extraer componentes para mejorar mantenibilidad

### P2 - Medium Priority
1. **Tool para revisar/corregir datos de terreno** - UI para corregir asignaciones incorrectas del script analyze_map_colors.py
2. **Sistema de Autenticación** (Maestro > Admin > Jugador)
3. **Backup/Restore de base de datos**
4. **Pantalla del DM** - Vista centralizada para el director de juego

### P3 - Future Tasks
- Interfaz de juego online
- Integración IA para historias de NPCs
- Creador de personajes multi-fase completo

## Database Collections
- `locations`: 182+ documentos con coordenadas x/y, terreno, tipo_tierra, peligro, refugio
- `regions`: 48 documentos con jerarquía parent_id para regiones/sub-regiones
- `roads`: Caminos dibujados en el mapa (nombre, tipo, puntos)
- `rivers`: Ríos dibujados en el mapa (nombre, tipo: vadeable/profundo/infranqueable, puntos)
- `barriers`: Barreras/líneas infranqueables dibujadas en el mapa (nombre, tipo: montana/acantilado/frontera, puntos)
- `recompensas`: Documento con mejoras, niveles, bendiciones, armas_con_nombre
- `backgrounds`: 114 documentos agrupables por raza/cultura
- `viajes_guardados`: Viajes generados y guardados por los usuarios

## Testing
- `/app/test_reports/iteration_23.json` - 100% pass rate (Rivers & Barriers feature)
- `/app/test_reports/iteration_24.json` - 100% pass rate (Pathfinding A* feature)
