# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-05)

### ✅ COMPLETED: Admin CRUD System for Game Rules (P0)
- **User Context with Auto-Admin** - DONE
  - Created `/app/frontend/src/contexts/UserContext.jsx`
  - Admin user "Maestro" active by default (no login required during development)
  - Crown icon and username visible in header when admin is active
  
- **CRUD for Races** - DONE
  - Backend endpoints: GET/POST/PUT/DELETE `/api/data/races`
  - Frontend: RaceEditor modal, Create Race button, Edit/Delete buttons on each race
  - 5 races seeded: Elfos, Enanos, Hombres, Hobbits, Medio Elfos
  
- **CRUD for Cultures** - DONE
  - Backend endpoints: GET/POST/PUT/DELETE `/api/data/cultures`
  - Frontend: CultureEditor modal with full form (nombre, raza, características físicas, bonificadores, idiomas, competencias, rasgos)
  - Copy culture feature available
  - 19 cultures with edit/delete buttons
  
- **CRUD for Backgrounds (Trasfondos)** - DONE
  - Backend endpoints: GET/POST/PUT/DELETE `/api/data/backgrounds`
  - Frontend: BackgroundEditor modal
  - Copy background feature available
  - 114 backgrounds with edit/delete buttons
  
- **CRUD for Occupations (Ocupaciones)** - DONE
  - Backend endpoints: GET/POST/PUT/DELETE `/api/data/occupations`
  - Frontend: OccupationEditor modal with all fields (vocación, dado de golpe, características, salvaciones, competencias armas/armaduras, habilidades especiales 1-6, maldición sombra)
  - Copy occupation feature available
  - 6 occupations with edit/delete buttons

### ✅ COMPLETED: PDF Generation (P1)
- **PDF Download Button** - DONE
  - Added "Descargar PDF" button on character sheet header
  - Uses html2canvas and jsPDF libraries
  - Generates 3-page PDF with all character data
  - Auto-captures each page at scale 1 for best quality
  - Downloads as `{character_name}_ficha.pdf`

### Previous Completed Work

### ✅ COMPLETED: Character Sheet Refactoring & Multi-line Fields
- Split `InteractiveCharacterSheet.jsx` into smaller components:
  - `SheetPage1.jsx` - Page 1 rendering
  - `SheetPage2.jsx` - Page 2 rendering
  - `SheetPage3.jsx` - Page 3 rendering
- Multi-line text fields working (descripcion_sombra, descripcion_trasfondo, rasgos_distintivos)
- Page navigation between pages 1-3
- Cultural tool proficiencies correctly displayed

### ✅ COMPLETED: Data Extraction & Database
- 19 Cultures with complete data
- 114 Backgrounds with trait descriptions
- 6 Occupations with weapon/armor proficiencies correctly separated
- 100 Virtues with all bonuses
- 19 Name sets for character name generation
- Full equipment catalog (29 armas, 9 armaduras, 17 herramientas, 114 equipo general)

### ✅ COMPLETED: Rules Page Enhancement
- "Precios de Equipo" section with searchable equipment list
- Expandable occupation cards with full details
- Expandable culture cards with full details
- **NEW**: Admin buttons for CRUD operations

### ✅ COMPLETED: Character Sheet Features
- Weapon/armor proficiencies correctly separated
- All 19 skills with modifiers
- Equipment items 1-28 across pages
- Currency display (mp, mo, me, mc)
- Shadow path with description

## 📋 PENDING TASKS

### P0 - High Priority
1. **Full User Authentication System** (DEFERRED by user request)
   - Currently: Admin user "Maestro" active by default for development
   - Future: Login, registration, password management
   - Roles: "Director de juego" (Admin) / "Usuario" (User)
   - Admin credentials: Maestro / 123456

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

## Key Files (Updated 2026-02-05)
- `/app/frontend/src/contexts/UserContext.jsx` - Admin user context (NEW)
- `/app/frontend/src/pages/RulesPage.jsx` - Rules page with full CRUD UI
- `/app/frontend/src/components/admin/` - Editor components (RaceEditor, CultureEditor, BackgroundEditor, OccupationEditor)
- `/app/frontend/src/pages/InteractiveCharacterSheet.jsx` - Character sheet with PDF generation
- `/app/backend/routes/data_routes.py` - Backend CRUD endpoints for all game data
- `/app/frontend/src/components/character-sheet/` - Sheet page components

## Key DB Schema
- **races:** Base race definitions (Elfos, Enanos, Hombres, Hobbits, Medio Elfos)
- **cultures:** Specific culture data with all attributes
- **culture_names:** Name components for each culture
- **backgrounds:** Background/origin data
- **occupations:** Occupation/class data
- **characters:** Finalized character data
- **virtues, mecenas, equipment_catalog:** Other game data

## Key API Endpoints (Updated 2026-02-05)
### CRUD Endpoints (Admin)
- `GET/POST/PUT/DELETE /api/data/races`
- `GET/POST/PUT/DELETE /api/data/cultures`
- `POST /api/data/cultures/{id}/copy`
- `GET/POST/PUT/DELETE /api/data/backgrounds`
- `POST /api/data/backgrounds/{id}/copy`
- `GET/POST/PUT/DELETE /api/data/occupations`
- `POST /api/data/occupations/{id}/copy`

### Read Endpoints
- `GET /api/data/cultures` - All cultures
- `GET /api/data/names` - All name components
- `GET /api/data/equipment-catalog` - Full equipment with prices
- `GET /api/data/sheet-positions` - Character sheet layouts

## Test Reports
- `/app/test_reports/iteration_10.json` - Admin CRUD tests (100% pass)
- `/app/backend/tests/test_crud_admin.py` - Backend CRUD test suite

## Session Changelog (2026-02-05)
1. Created UserContext with Maestro admin user active by default
2. Implemented full CRUD UI for Races on RulesPage
3. Implemented full CRUD UI for Cultures with CultureEditor modal
4. Implemented full CRUD UI for Backgrounds with BackgroundEditor modal
5. Implemented full CRUD UI for Occupations with OccupationEditor modal
6. Added PDF generation to character sheet using html2canvas + jsPDF
7. Added edit/delete buttons to all data cards (cultures, backgrounds, occupations)
8. Added "Razas Base" section showing races with admin controls
9. All tests passed: 16/16 backend, 100% frontend
