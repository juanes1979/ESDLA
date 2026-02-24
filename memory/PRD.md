# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-02-24)

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
- `/app/frontend/src/pages/MiddleEarthMap.jsx` - Sistema completo de dibujo de ríos y barreras

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Algoritmo de Pathfinding para Travel Generator** - Usar datos de ríos y barreras para calcular rutas que eviten terreno infranqueable y crucen ríos correctamente
2. **Refactorizar `MiddleEarthMap.jsx`** (~3500 líneas) - Los componentes modulares están creados en `/components/map/`, falta mover la lógica del archivo principal
3. **Refactorizar `RulesPage.jsx`** (~4000+ líneas) - Extraer componentes para mejorar mantenibilidad

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
