# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Página 3 - Campo descripcion_ocupacion
- Campo multilínea en posición (x:723, y:259, width:882, height:150, fontSize:35)
- Muestra la descripción corta de la ocupación (fila 16 hoja Ocupaciones)
- Se guarda automáticamente en el personaje durante el paso 3 y finalización

### ✅ COMPLETED: Editor de Culturas Ampliado
**Nueva sección: Trasfondos de la Cultura**
- Checkbox múltiple para seleccionar trasfondos asociados
- Campo `trasfondos_ids` guardado en la cultura

**Nueva sección: Configuración de Virtudes** (aparece cuando "Virtud al nivel 1" está activado)
- **Copiar virtudes de otra cultura**: Dropdown para seleccionar otra cultura de la cual copiar virtudes
- **Permite elegir virtudes comunes**: Checkbox para permitir acceso a virtudes comunes
- **Virtudes propias de esta cultura**: Lista de checkboxes para seleccionar virtudes específicas
- **Vista previa**: Muestra las virtudes disponibles para el jugador según la configuración

### ✅ COMPLETED: Visualización de Virtudes en RulesPage
- Nueva sección "Virtudes Disponibles (Nivel 1)" para culturas con `tiene_virtud_inicial=true`
- Muestra grid de 2 columnas con nombre, descripción y rasgos de cada virtud
- Carga automática de virtudes al expandir la cultura via API

### ✅ COMPLETED: Nuevo Endpoint API
- `GET /api/data/cultures/{culture_id}/virtues`
- Devuelve las virtudes disponibles según configuración:
  - Virtudes propias de la cultura
  - Virtudes copiadas de otra cultura
  - Virtudes comunes (si está permitido)
- Elimina duplicados automáticamente

## Completed Work (Previous Sessions)

### ✅ Sistema CRUD de Admin
- **Razas**: CRUD completo con 5 razas base
- **Culturas**: CRUD completo con editor extendido
- **Trasfondos**: CRUD completo con 114 trasfondos
- **Ocupaciones**: CRUD completo con 6 ocupaciones

### ✅ Generación de PDF
- Botón "Descargar PDF" en hoja de personaje
- Genera PDF de 3 páginas con todos los datos

### ✅ Hoja de Personaje (3 páginas)
- Página 1: Datos básicos, características, competencias
- Página 2: Inventario, equipamiento, habilidades
- Página 3: Ocupación con descripción corta (NUEVO) y habilidades especiales

### ✅ Usuario Admin por Defecto
- Usuario "Maestro" activo automáticamente sin login
- Indicador visual en header con icono de corona

## 📋 PENDING TASKS

### P0 - High Priority
1. **Implementar selección de Virtud en creador de personajes**
   - Cuando la cultura tiene `tiene_virtud_inicial=true`
   - Mostrar virtudes disponibles según configuración de la cultura
   - Guardar virtud seleccionada con todos sus datos:
     - Nombre, descripción, rasgos
     - Aumentos de características directos y a elegir
     - Competencias en salvaciones adicionales
     - PG extra, puntos de comunidad, CA extra
     - Competencias a elegir adicionales

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, gestión de contraseñas
   - Roles: Director de juego (Admin) / Usuario
   - Admin credentials: Maestro / 123456

2. **Completar Paso 2 (Trasfondo)** del creador
3. **Completar Paso 4 (Virtud)** del creador

### P2 - Lower Priority
1. Refactorizar `Step1Culture.jsx` (1500+ líneas)

## 📋 FUTURE/BACKLOG TASKS

### Sistema de Usuarios (Pendiente - Documentado)
- **Maestro**: Admin absoluto, crea Admins
- **Admin**: Copia propia de BD, crea Jugadores (máx 100 fichas, 25 jugadores)
- **Jugador**: Solo sus personajes (máx 10 fichas)
- Panel de configuración para Maestro con límites editables
- Sistema de backup/restauración de BD inicial

### Otras funcionalidades
- Pantalla del Director de Juego
- Interfaz de juego online (Mapa, Chat, Dados)
- Integración IA para historias/NPCs

## Technical Stack
- **Backend:** FastAPI, Motor, MongoDB
- **Frontend:** React, Tailwind, Shadcn UI
- **PDF:** jsPDF, html2canvas

## Key Files (Updated 2026-02-06)
- `/app/frontend/src/components/character-sheet/SheetPage3.jsx` - Campo descripcion_ocupacion multilínea
- `/app/frontend/src/components/admin/CultureEditor.jsx` - Secciones de Trasfondos y Virtudes
- `/app/frontend/src/pages/RulesPage.jsx` - Visualización de virtudes disponibles
- `/app/backend/routes/data_routes.py` - Endpoint cultures/{id}/virtues
- `/app/backend/routes/character_routes.py` - Guardar descripcion_corta

## Key API Endpoints (Updated 2026-02-06)
- `GET /api/data/cultures/{culture_id}/virtues` - Virtudes disponibles para una cultura
- `PATCH /api/draft/{draft_id}/step3` - Ahora guarda descripcion_corta
- `POST /api/draft/{draft_id}/finalize` - Incluye descripcion_corta

## Key DB Schema (Updated)
**cultures** - Nuevos campos:
- `trasfondos_ids`: Lista de IDs de trasfondos asociados
- `virtudes_propias`: Lista de IDs de virtudes específicas
- `copiar_virtudes_de`: ID de cultura de la cual copiar virtudes
- `permite_virtudes_comunes`: Boolean

**characters** - Nuevos campos:
- `descripcion_corta`: Descripción corta de la ocupación

## Test Reports
- `/app/test_reports/iteration_11.json` - Culture virtues features (100% pass)

## Session Changelog (2026-02-06)
1. Añadido campo `descripcion_ocupacion` multilínea en SheetPage3
2. Extendido CultureEditor con sección "Trasfondos de la Cultura"
3. Extendido CultureEditor con sección "Configuración de Virtudes"
4. Añadido endpoint GET /api/data/cultures/{id}/virtues
5. Actualizado RulesPage para mostrar virtudes disponibles
6. Actualizado step3 y finalize para guardar descripcion_corta
7. Tests 100% passed: Backend 13/13, Frontend UI verificado
