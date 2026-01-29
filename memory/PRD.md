# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game. The core of the application is based on a detailed Excel file (`utumno.xlsm`) containing all game rules and data.

## Core Requirements
1. **Character Creator:** Multi-step wizard for creating player characters
2. **Character Sheet:** Digital character sheet with PDF export (3 pages)
3. **Game Master (DM) Screen:** Dedicated interface for DM
4. **Online Gameplay:** Map Display, Chat, Dice Rolling, Session Log
5. **AI Integration:** Story/NPC generation using Emergent LLM Key
6. **Data Management:** CRUD operations on game data

## What's Been Implemented

### Phase 1: Database & Backend (Complete)
- ✅ MongoDB database seeded with data from Excel files
- ✅ 19 cultures with characteristics (Nivel de Vida, modifiers)
- ✅ 114 backgrounds with rasgos (personality traits)
- ✅ 6 occupations (classes)
- ✅ 100+ virtues (cultural and common)
- ✅ Equipment: 32 weapons, 12 armors, 37 general items
- ✅ FastAPI routes for all game data

### Phase 2: Character Creator Wizard (Complete - 2026-01-29)
- ✅ 8-step wizard (Patron step removed per user requirement)
- ✅ Step 1: Culture selection with Nivel de Vida display
- ✅ Step 2: Background selection with automatic filtering by culture
- ✅ Step 3: Occupation selection
- ✅ Step 4: Attribute assignment (dice rolling + standard array)
- ✅ Step 5: Virtue selection (ONLY for Hombres del lago, Hombres de Bree, Beornidas)
- ✅ Step 6: Skills selection
- ✅ Step 7: AUTOMATIC equipment based on Nivel de Vida (Frugal/Común/Próspero)
- ✅ Step 8: Personality details from Background rasgos + custom history

### Key Game Rules Implemented
1. **Virtudes al Nivel 1:** Solo 3 culturas (Hombres del lago, Hombres de Bree, Beórnidas)
2. **Equipo Inicial por Nivel de Vida:**
   - Frugal: Mochila, Petate, Utensilios cocina, Lata yesca, 10 raciones, 15mp
   - Común: + Antorchas, Odre, Cuerda cáñamo 15m, 15mp
   - Próspero: + Linterna sorda, 3 Aceite, Cram, Cuerda seda, Tienda, 20mp
3. **Rasgos de Personalidad:** Automáticos del trasfondo (ej: "Animoso", "Señorial")

## Upcoming Tasks (P1)
- [ ] PDF export of character sheet (3 pages)
  - Page 1: Attributes, combat, skills, equipment
  - Page 2: Community points, patron/heir, virtues, traditional equipment
  - Page 3: Long text (occupations, backgrounds, history)
- [ ] Interactive Character Sheet page (`CharacterSheetPage.jsx`)
- [ ] Draft listing/management system (`CharactersListPage.jsx`)

## Future Tasks (P2)
- [ ] Game Master (DM) Screen
- [ ] Online Gameplay Interface (Map, Tokens, Fog of War, Chat)
- [ ] AI Integration for story/NPC generation (using Emergent LLM Key)
- [ ] Game Rule Engines (Combat, Travel, etc.)

## Technical Stack
- **Backend:** FastAPI, Motor (async MongoDB), Pydantic
- **Frontend:** React, Tailwind CSS, Shadcn UI
- **Database:** MongoDB
- **Data Source:** Excel files (openpyxl parsing)

## Key Files
- `/app/backend/data_extractor.py` - Excel parsing
- `/app/backend/seed_database.py` - Database seeding
- `/app/backend/routes/character_routes.py` - Character API
- `/app/backend/routes/data_routes.py` - Game data API
- `/app/frontend/src/components/character-creator/CharacterCreatorWizard.jsx` - Main wizard
- `/app/frontend/src/components/character-creator/steps/` - Step components

## Testing
- Backend: 16 tests passing (100%)
- Frontend: All UI flows verified
- Test reports: `/app/test_reports/iteration_3.json`

## User Preferences
- Language: Español
- Theme: Dark LOTR tavern aesthetic
- AI Provider: Emergent LLM Key (confirmed)
