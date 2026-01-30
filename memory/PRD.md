# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-01-30)

### ✅ COMPLETED: Data Extraction & Database (UPDATED)
- **Data Extractor** (`/app/backend/data_extractor_complete.py`) - FIXED
  - Corrected occupation proficiencies extraction (rows 9-11 for weapons, 12-15 for armors)
  - Added occupation descriptions and shadow curses (rows 16-19)
  - Added complete equipment catalog with prices and weights
- **Database Seeder** (`/app/backend/seed_database_complete.py`) - UPDATED
  - Added `equipment_catalog` collection with full pricing data
- Successfully extracted and seeded:
  - 19 Cultures with complete data
  - 114 Backgrounds with trait descriptions
  - 6 Occupations with CORRECTLY separated weapon/armor proficiencies
  - 100 Virtues with all bonuses
  - 19 Name sets for character name generation
  - **NEW:** Full equipment catalog (29 armas, 9 armaduras, 17 herramientas, 114 equipo general)

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
