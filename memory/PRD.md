# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2025-12-19)

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

#### P2: Exportar Equipamiento a PDF 🖨️
- **Modal de selección de categorías** en sección de Precios de Equipo:
  - 7 categorías seleccionables: Armas, Armaduras, Equipo/Herramientas, Consumibles, Hierbas/Venenos, Monturas/Transporte, Construcción
  - Opción "Seleccionar Todas" para exportar todo
  - Indicador del número de tablas por categoría
- **PDF generado con especificaciones del usuario:**
  - Formato A4 vertical
  - Fuente tamaño 10 (Calibri/Helvetica)
  - Tablas organizadas por secciones
  - Encabezados repetidos en cada página
  - Numeración de páginas y fecha de generación

#### Sistema de Edición y Disponibilidad de Equipamiento 🛠️
- **Botones de editar/eliminar** en cada fila de equipamiento (visible al pasar el ratón)
- **Modal de edición completo** con:
  - Campos editables: nombre, precio, moneda, peso, daño, CA, etc.
  - Selector de disponibilidad por asentamiento (Aldea, Pueblo, Villa, Ciudad, Capital, Especial)
- **Endpoints backend nuevos:**
  - `POST /equipment/batch-update-prices` - Actualizar precios masivamente
  - `POST /equipment/set-availability` - Configurar disponibilidad
  - `POST /equipment/batch-set-availability` - Configurar disponibilidad masiva
- **Precios actualizados** según especificaciones del usuario:
  - Monturas: Burro 5mp, Caballo de guerra 40mp, etc.
  - Accesorios: Alforjas 5mc, Silla de monta 2mp, etc.
  - Transporte terrestre y marítimo con nuevos precios
  - Hierbas: Aceite regenerador 157mp, Ungüentos enanos, etc.
- **Disponibilidad inicial configurada** para 485 items:
  - Items básicos: disponibles en aldeas
  - Armas marciales: desde pueblo
  - Armaduras pesadas: solo ciudades/capitales
  - Caballos de guerra: ciudades/capitales
  - Navíos de guerra: especial

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

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Sistema de Autenticación** (Maestro > Admin > Jugador)
2. **Backup/Restore de base de datos**

### P2 - Medium Priority
1. **Integrar componentes refactorizados en MiddleEarthMap.jsx** - Los componentes están creados, falta importarlos y usarlos en el archivo principal
2. **Pantalla del DM** - Vista centralizada para el director de juego

### P3 - Future Tasks
- Interfaz de juego online
- Integración IA para historias de NPCs
- Refactorización completa de RulesPage.jsx

## Database Collections
- `locations`: 182+ documentos con coordenadas x/y, terreno, tipo_tierra, peligro, refugio
- `regions`: 48 documentos con jerarquía parent_id para regiones/sub-regiones
- `recompensas`: Documento con mejoras, niveles, bendiciones, armas_con_nombre
- `backgrounds`: 114 documentos agrupables por raza/cultura
- `viajes_guardados`: Viajes generados y guardados por los usuarios

## Testing
- `/app/test_reports/iteration_21.json` - 100% pass rate
