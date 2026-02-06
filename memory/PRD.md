# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Selector de Competencia Adicional
- Nuevo selector por categorías en CultureEditor (reemplaza el campo de texto)
- 4 categorías: **Herramientas**, **Juegos**, **Instrumentos musicales**, **Pipa**
- Al seleccionar Herramientas/Juegos/Instrumentos → aparece segundo selector con items específicos
- Al seleccionar **Pipa** → confirmación directa "✓ Competencia en Pipa" sin segundo selector
- "Pipa" añadida a la lista ALL_TOOLS

### ✅ COMPLETED: Selección de Virtud en Creador de Personajes
**Step5Virtue.jsx completamente reescrito:**
- Usa `draft.tiene_virtud_inicial` para determinar si mostrar selección de virtudes
- Usa endpoint `/api/data/cultures/{id}/virtues` para obtener virtudes según configuración de cultura
- Muestra grid de virtudes con indicadores de bonificaciones (Características, PG, CA, Competencias)
- Al seleccionar virtud, muestra detalle completo con todos los bonuses

**Datos de Virtud guardados (12 campos):**
- `virtud_id`, `virtud_nombre`, `virtud_descripcion`, `virtud_rasgos`
- `virtud_caracteristicas_fijas` (bonificadores directos)
- `virtud_caracteristicas_elegir` (características a elegir)
- `virtud_salvaciones_elegir` (salvaciones adicionales)
- `virtud_pg_extra`, `virtud_comunidad_extra`, `virtud_ca_extra`
- `virtud_habilidades_elegir`, `virtud_herramientas_elegir`

### ✅ COMPLETED (Previous): Editor de Culturas Ampliado
- Sección "Trasfondos de la Cultura" con checkbox múltiple
- Sección "Configuración de Virtudes" (cuando tiene_virtud_inicial=true):
  - Copiar virtudes de otra cultura
  - Permitir virtudes comunes
  - Selección de virtudes propias
  - Vista previa de virtudes disponibles

### ✅ COMPLETED (Previous): Página 3 - Campo descripcion_ocupacion
- Campo multilínea en posición (x:723, y:259, width:882, height:150, fontSize:35)
- Muestra la descripción corta de la ocupación (fila 16 hoja Ocupaciones)

### ✅ COMPLETED (Previous): Sistema CRUD de Admin
- **Razas**: CRUD completo con 5 razas base
- **Culturas**: CRUD completo con editor extendido
- **Trasfondos**: CRUD completo con 114 trasfondos
- **Ocupaciones**: CRUD completo con 6 ocupaciones
- **Usuario Admin "Maestro"** activo por defecto sin login

### ✅ COMPLETED (Previous): Generación de PDF
- Botón "Descargar PDF" en hoja de personaje
- Genera PDF de 3 páginas con todos los datos

## 📋 PENDING TASKS

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, gestión de contraseñas
   - Roles: Director de juego (Admin) / Usuario
   - Admin credentials: Maestro / 123456

2. **Completar Paso 2 (Trasfondo)** del creador - Necesita mejorar
3. **Mostrar virtud seleccionada en la hoja de personaje** - En la ficha resumen

### P2 - Lower Priority
1. Refactorizar `Step1Culture.jsx` (1500+ líneas)
2. Implementar sub-selecciones cuando se elige Instrumentos o Juegos en el creador

## 📋 FUTURE/BACKLOG TASKS

### Sistema de Usuarios (Documentado - Pendiente)
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
- `/app/frontend/src/components/admin/CultureEditor.jsx` - Selector de competencia adicional por categorías
- `/app/frontend/src/components/character-creator/steps/Step5Virtue.jsx` - Selección de virtud completa
- `/app/backend/routes/character_routes.py` - Endpoint step5 con todos los campos de virtud

## Key API Endpoints
- `GET /api/data/cultures/{culture_id}/virtues` - Virtudes disponibles para una cultura
- `PATCH /api/draft/{draft_id}/step5` - Guarda todos los datos de la virtud seleccionada
- `POST /api/draft/{draft_id}/finalize` - Incluye todos los campos de virtud

## Test Reports
- `/app/test_reports/iteration_12.json` - Competencia adicional + Step5Virtue (100% pass)

## Session Changelog (2026-02-06)
1. Añadido "Pipa" a lista de herramientas
2. Cambiado "Competencia Adicional" por selector de categorías (Herramientas/Juegos/Instrumentos/Pipa)
3. Reescrito Step5Virtue para usar tiene_virtud_inicial y endpoint de virtudes
4. Actualizado modelo CharacterCreateStep5 con 12 campos de virtud
5. Actualizado endpoint step5 para guardar todos los datos de virtud
6. Actualizado finalize para incluir todos los campos de virtud
7. Tests 100% passed: Backend 11/11, Frontend UI verificado
