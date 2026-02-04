# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-04)

### ✅ COMPLETED: Character Sheet Refactoring & Multi-line Fields (P0)
- **Component Refactoring** - DONE
  - Split `InteractiveCharacterSheet.jsx` (1122 lines) into smaller components
  - Created `/app/frontend/src/components/character-sheet/SheetPage1.jsx` - Page 1 rendering
  - Created `/app/frontend/src/components/character-sheet/SheetPage2.jsx` - Page 2 rendering
  - Main component now only handles navigation and state management
- **Multi-line Text Fields** - FIXED
  - `descripcion_sombra` - Displays full shadow path description with text wrapping
  - `descripcion_trasfondo` - Ready for display (existing characters may not have data)
  - `descripcion_rasgos_distintivos_1/2` - Already working with height and multiline props
- **Page 2 Data Display** - FIXED
  - Now correctly displays: nombre, senda_sombra, descripcion_sombra, trasfondo_nombre
  - Shows puntos_comunidad, heredero, inversion, mecenas fields
  - Equipment items 9-28 for overflow from page 1
- **Page Navigation** - VERIFIED WORKING
  - Chevron buttons navigate between pages 1, 2, 3
  - Page indicator updates correctly
- **Cultural Tool Proficiency (P1)** - VERIFIED WORKING
  - `getIdiomasHerramientasRows()` correctly gathers tools from:
    - competencia_herramienta_cultura
    - herramienta_elegida_cultura
    - competencia_herramienta_1
    - competencias.herramientas
    - herramientas_elegidas_ocupacion

### Previous Completed Work (2026-01-30)

### ✅ COMPLETED: Data Extraction & Database (UPDATED)
- **Data Extractor** (`/app/backend/data_extractor_complete.py`) - FIXED
  - Corrected occupation proficiencies extraction (rows 9-11 for weapons, 12-15 for armors)
  - Added occupation descriptions and shadow curses (rows 16-19)
  - Added complete equipment catalog with prices and weights
  - **FIXED Dunedain**: Corrected to +1 FUE, +1 CON, +1 SAB, +1 to choice
- **Database Seeder** (`/app/backend/seed_database_complete.py`) - UPDATED
  - Added `equipment_catalog` collection with full pricing data
  - Added `bonificador_a_eleccion` field for Dunedain
- Successfully extracted and seeded:
  - 19 Cultures with complete data (including Dunedain fix)
  - 114 Backgrounds with trait descriptions
  - 6 Occupations with CORRECTLY separated weapon/armor proficiencies
  - 100 Virtues with all bonuses
  - 19 Name sets for character name generation
  - Full equipment catalog (29 armas, 9 armaduras, 17 herramientas, 114 equipo general)

### ✅ COMPLETED: Rules Page Enhancement (P1)
- **Precios de Equipo** section - NEW
  - Sistema Monetario display (me, mc, mp, mo, mm)
  - Searchable equipment list with prices, weights, damage/AC
  - Four categories: Armas, Armaduras, Herramientas, Equipo General
- **Ocupaciones** section - IMPROVED
  - Expandable cards showing full occupation details
  - Correctly separated weapon and armor proficiencies
  - Shadow curse information displayed
  - Occupation traits and features shown
- **Culturas** section - IMPROVED
  - Expandable cards with full culture details
  - Characteristic bonuses, languages, cultural traits
  - Virtue indicator for cultures with level 1 virtue

### ✅ COMPLETED: Character Sheet Page Fixes (P0)
- **Proficiencies display** - FIXED
  - Now shows weapon proficiencies correctly separated
  - Now shows armor proficiencies correctly separated
  - Fallback to occupation data for old characters
- **Skills list** - Already showing all 19 skills with modifiers
- **Competencia/Pericia indicators** - Working

### ✅ COMPLETED: Dunedain Free Characteristic Bonus (P0)
- Corrected bonuses: +1 FUE, +1 CON, +1 SAB (fixed from Excel error)
- Added `bonificador_a_eleccion: true` field
- UI shows "Mejora de Característica Libre (Dúnedain)" panel with 6 options
- User can choose any characteristic for the additional +1

### ✅ COMPLETED: Guardian ab_complex Weapon Selection (P0)
- Fixed weapon type `ab_complex` handling in Step3Occupation.jsx
- Option A: Shows martial weapon selection + automatic "Escudo"
- Option B: Shows two selection panels (martial + simple weapons)
- All weapon options from API displayed correctly

### ✅ COMPLETED: API Routes
- `/api/data/cultures` - Returns complete culture data
- `/api/data/backgrounds` - Returns backgrounds filtered by culture
- `/api/data/occupations` - Returns occupations with correct proficiencies
- `/api/data/virtues` - Returns virtues filtered by culture/type
- `/api/data/equipment-lists` - Returns instruments and games lists
- `/api/data/equipment-catalog` - **NEW** Returns full equipment with prices/weights
- `/api/data/trait-descriptions` - Returns personality trait descriptions
- `/api/characters/draft/*` - Character draft CRUD operations

## 📋 PENDING TASKS

### P0 - High Priority
1. **User Authentication System** (NOT STARTED)
   - Login, registration, password management
   - Roles: "Director de juego" (Admin) / "Usuario" (User)
   - Admin user: Maestro / 123456
   - Page for viewing created characters
   - Email notification on registration
   - LOTR-themed captcha

2. **PDF Generation** (NOT STARTED)
   - Implement "Descargar PDF (3 hojas)" button
   - Use jspdf and html2canvas

### P1 - Medium Priority
1. **Phase 2 (Background)** - Partial implementation exists
   - Needs traits with descriptions display
   - Tool selection sub-menus

2. **Phase 4 (Virtue)** - Needs complete implementation
   - Only for specific cultures at level 1
   - Filter by culture + COMMON

### P2 - Lower Priority
1. Refactor `Step1Culture.jsx` (1500+ lines) into sub-components
2. Fix data extractor for remaining edge cases

## 📋 FUTURE/BACKLOG TASKS
- Game Master (DM) Screen
- Online Gameplay Interface (Map, Chat, Dice)
- AI Integration for story/NPC generation

## ⚠️ CRITICAL RULES
1. Weapons DO NOT repeat across blocks
2. Skill competencies DO NOT repeat across phases
3. Tool competencies DO NOT repeat
4. Expertise ONLY from already-competent skills
5. Instruments/Games trigger sub-selection
6. Save ALL data including descriptions
7. Virtues filter by culture + COMMON
8. Virtues exclude existing competencies

## Technical Stack
- **Backend:** FastAPI, Motor, MongoDB
- **Frontend:** React, Tailwind, Shadcn UI
- **PDF:** jsPDF, html2canvas
- **Data:** openpyxl for Excel parsing

## Key Files
- `/app/backend/data_extractor_complete.py` - Main data extractor
- `/app/backend/seed_database_complete.py` - Database seeder
- `/app/backend/routes/data_routes.py` - API routes for game data
- `/app/data/extracted_data_complete.json` - Extracted JSON data
- `/app/frontend/src/pages/RulesPage.jsx` - Rules page with equipment pricing
- `/app/frontend/src/pages/CharacterSheetPage.jsx` - Character sheet display
- `/app/frontend/src/components/character-creator/` - Wizard components

## Test Reports
- `/app/test_reports/iteration_5.json` - Equipment catalog and occupation proficiencies tests
- `/app/backend/tests/test_equipment_occupations.py` - Backend API tests

## Session Changelog (2026-01-30)
1. Fixed data extractor for occupation proficiencies (rows 9-11 weapons, 12-15 armors)
2. Added equipment catalog extraction with prices and weights in metric (kg)
3. Added `/api/data/equipment-catalog` endpoint
4. Enhanced RulesPage.jsx with "Precios de Equipo" section
5. Improved occupation display in RulesPage with expandable cards
6. Fixed CharacterSheetPage.jsx proficiencies display with occupation fallback
7. All tests passing (16/16 backend, 100% frontend)

## Session Changelog (2026-01-31)
### Bug Fixes Verified by Testing Agent:
1. **Sheet Editor X/Y Position Editing** - FIXED
   - Added editable X and Y number inputs for each field position
   - Location: `/app/frontend/src/pages/SheetPositionEditor.jsx` lines 506-526

2. **Sheet Editor Save Without Export** - FIXED
   - Added "Guardar" button to save positions to localStorage
   - Added "Cargar JSON" button to load positions from file
   - Location: `/app/frontend/src/pages/SheetPositionEditor.jsx` lines 69-73, 299-308

3. **Wealth Level Money Addition** - FIXED
   - Common (Común): Now adds 15mp 
   - Prosperous (Próspero): Now adds 20mp
   - Location: `/app/frontend/src/components/character-creator/steps/Step7Equipment.jsx` lines 45, 66

4. **Background Equipment (Games/Instruments)** - FIXED
   - Selected tools (cartas de Barliman, instruments) now added to equipo_trasfondo
   - Location: `/app/frontend/src/components/character-creator/steps/Step2Background.jsx` lines 89-103
   - Backend: `/app/backend/routes/character_routes.py` line 320

5. **Missing 'me' (Tin Coins) in Currency** - FIXED
   - Added 'me' field to all dinero models in backend
   - CharacterSummary displays all 4 currency types: mp, mo, me, mc
   - Location: `/app/backend/routes/character_routes.py` lines 157, 184, 678

6. **Skills Duplicate on Back Navigation** - ADDRESSED
   - Added draft refresh on back navigation to prevent accumulation
   - Location: `/app/frontend/src/components/character-creator/CharacterCreatorWizard.jsx` lines 92-110

### Test Report
- `/app/test_reports/iteration_7.json` - All 5 bugs verified fixed
- Backend: 100% (4/4 tests passed)
- Frontend: 100% (all UI verifications passed)

### Interactive Character Sheet - Field Structure Update
Based on user requirements, added support for:

1. **Monedas separadas** - 4 campos individuales:
   - `monedas_estano`, `monedas_cobre`, `monedas_plata`, `monedas_oro`

2. **Equipo en 8 filas** - De y:1725 a y:2037:
   - `equipo_1` a `equipo_8` (spacing ~39px)

3. **Idiomas/Herramientas en 6 filas** - De y:1836 a y:2043:
   - `idioma_herr_1` a `idioma_herr_6` (spacing ~41px)

4. **Puntos de golpe** - 3 campos separados:
   - `pg_max`, `pg_actual`, `pg_temp`

5. **Competencias de habilidades** - Checkboxes (x=competencia, P=pericia):
   - `comp_hab_acertijos`, `comp_hab_acrobacias`, etc. (19 habilidades)

6. **Competencias de salvaciones** - Checkboxes (x si competente):
   - `comp_salvacion_fue`, `comp_salvacion_des`, etc. (6 salvaciones)

7. **Editor mantiene proporción DIN A4** - La hoja no se deforma al reducir ventana

Files updated:
- `/app/frontend/src/pages/SheetPositionEditor.jsx` - New field suggestions
- `/app/frontend/src/pages/InteractiveCharacterSheet.jsx` - Complete rewrite with PAGE1_FIELDS from user JSON

### Session Update (2026-01-31 - Afternoon)
1. **Nuevas imágenes de hoja de personaje** - Extraídas del PDF proporcionado por el usuario
   - `/app/frontend/public/assets/sheets/sheet_page1_web.png` (1701x2197)
   - `/app/frontend/public/assets/sheets/sheet_page2_web.png` (1701x2197)
   - `/app/frontend/public/assets/sheets/sheet_page3_web.png` (1654x2339)

2. **Campos de equipo expandidos** - 20 filas (equipo_1 a equipo_20)
   - Excluye automáticamente armas del listado de equipo
   - Incluye todo el equipo del nivel de vida, trasfondo, ocupación

3. **Campos de armas** - 5 filas con subcampos:
   - `arma_X_nombre`, `arma_X_dano`, `arma_X_herida`, `arma_X_distancia` (X = 1 a 5)
   - Filtrado automático de armas vs equipo general
   - Lista de armas conocidas: bastón, espada, hacha, arco, daga, etc.

4. **Sugerencias de campos actualizadas en editor**

### Session Update (2026-02-02)
**Bug Fixes Verified by Testing Agent (iteration_8.json):**

1. **Datos de Armas con Herida y Distancia** - FIXED (P0)
   - El extractor de datos ahora parsea las columnas "Herida" (col 20) y "DISTANCIA" (col 21)
   - Location: `/app/backend/data_extractor_complete.py` lines 692-713
   - 29 armas tienen ahora campos `herida` (12-20) y `distancia` (C/C o rango como 3/15)
   - El frontend carga el catálogo de armas desde `/api/data/equipment-catalog` para stats precisos

2. **Error de Sintaxis Crítico** - FIXED
   - Había una llave `}` extra en línea 547 que impedía la compilación del frontend
   - Location: `/app/frontend/src/pages/InteractiveCharacterSheet.jsx`
   - El error causaba "return outside of function" en línea 661

3. **Competencia de Herramientas Culturales** - FIXED (P1)
   - La función `getIdiomasHerramientasRows()` ahora incluye:
     - `competencia_herramienta_cultura`
     - `herramienta_elegida_cultura`
     - `competencia_herramienta_1`
     - `competencias.herramientas_cultura`
   - Eliminación de duplicados con `Set`

4. **Campos de Equipo Expandidos** - UPDATED (P2)
   - 25 campos de equipo disponibles (equipo_1 a equipo_25)
   - 8 campos para página 1, 17 campos disponibles para página 2
   - Función `getEquipmentRows()` devuelve 25 elementos

**Test Results:**
- Backend: 100% (12/12 tests passed)
- Frontend: 100% (Homepage, Sheet Editor, Character Creation Wizard all load correctly)

**Files Updated:**
- `/app/backend/data_extractor_complete.py` - Añadidas columnas herida y distancia
- `/app/frontend/src/pages/InteractiveCharacterSheet.jsx` - Corregida sintaxis, carga de catálogo de armas, corregido doble /api/api/ en URL
- `/app/frontend/src/pages/SheetPositionEditor.jsx` - Añadidos campos equipo_21 a equipo_25

### Session Update (2026-02-02 - Tarde)
**Bug Fix: "Personaje no encontrado" en Ficha Oficial**

- **Causa:** La URL del API tenía doble prefijo `/api/api/data/equipment-catalog`
- **Fix:** Cambiado `api.get('/api/data/equipment-catalog')` a `api.get('/data/equipment-catalog')`
- **Location:** `/app/frontend/src/pages/InteractiveCharacterSheet.jsx` línea 307
- **Resultado:** La ficha de personaje ahora carga correctamente con todos los datos

### Session Update (2026-02-04)
**Aplicación de JSON de Posiciones de Página 1**

- **Tarea completada:** Aplicar JSON actualizado del usuario con 134 campos de posiciones para página 1
- **Cambios realizados:**
  1. Actualizada la colección `sheet_positions` en MongoDB con las nuevas coordenadas
  2. Actualizado `PAGE1_FIELDS` en `/app/frontend/src/pages/InteractiveCharacterSheet.jsx`
  3. Agregado campo `senda_sombra_descripcion` (x:1182, y:560) en el JSON para uso futuro
  
- **Campos actualizados (ejemplos de cambios):**
  - `nombre`: y:171 → y:184
  - `sexo`: y:254 → y:261
  - Valores de atributos: ajustes menores en posición Y
  - Modificadores de atributos: ajustes menores
  - `percepcion_pasiva`: y:1674 → y:1679
  - Monedas: ajustes de 2-3 píxeles
  - `descripcion_rasgos_distintivos_1/2`: fontSize:22 → fontSize:31
  
- **Total campos:** 134 (incluye nuevo `senda_sombra_descripcion`)
- **Verificación:** Screenshot tomado mostrando posiciones correctas
