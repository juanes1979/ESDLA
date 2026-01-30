# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

## Current State (2026-01-30)

### ✅ COMPLETED: Data Extraction & Database
- **New Complete Extractor** (`/app/backend/data_extractor_complete.py`) - WORKING
- **New Database Seeder** (`/app/backend/seed_database_complete.py`) - WORKING
- Successfully extracted and seeded:
  - 19 Cultures with complete data (bonificadores, rasgos físicos, idiomas, etc.)
  - 114 Backgrounds with trait descriptions
  - 6 Occupations with full weapon/armor/skill selection data
  - 100 Virtues with all bonuses and selection options
  - 19 Name sets for character name generation
  - Equipment lists (instruments, games)

### ✅ COMPLETED: Frontend Step 1 - Culture
- Category selection (Elfos, Enanos, Hombres, Hobbits)
- Culture list with new data structure (using `raza` field)
- Characteristic bonuses displayed correctly (bonificadores_caracteristicas)
- Name generation working
- Physical attributes (edad, altura, peso using IMC formula)

### ✅ COMPLETED: API Routes
- `/api/data/cultures` - Returns complete culture data
- `/api/data/backgrounds` - Returns backgrounds filtered by culture
- `/api/data/occupations` - Returns occupations with weapon/armor data
- `/api/data/virtues` - Returns virtues filtered by culture/type
- `/api/data/equipment-lists` - Returns instruments and games lists
- `/api/data/trait-descriptions` - Returns personality trait descriptions
- `/api/characters/draft/*` - Character draft CRUD operations

## 🔶 IN PROGRESS: Frontend Refactor

### Step 2 - Background (Needs Update)
- Currently shows backgrounds but needs:
  - Auto competencies display
  - Skills to choose selection
  - Tool selection (Instruments/Games sub-selection)
  - Traits with descriptions

### Step 3 - Occupation (MAJOR REFACTOR NEEDED)
Following the user's detailed plan:
1. Select occupation
2. Choose skills (quantity per occupation)
3. Choose armor (Option A or B)
4. Choose weapons (3-5 sequential blocks, some A/B)
5. Choose expertise (ONLY for Buscador de tesoros)

### Step 4 - Attributes
- Working but needs virtue bonus integration

### Step 5 - Virtue (Conditional)
- ONLY for: Hombres del lago, Hombres de Bree, Beórnidas
- Needs complete rewrite per plan

### Steps 6-8 - Skills, Equipment, Details
- Need updates to use new data structure

## 📋 MASTER PLAN (User Approved)

### PHASE 1: CULTURE (30 fields)
- Race → Subculture → Description → Age/Height/Weight → Physical traits
- Speed/Rest/Size/Level of life → Name generation
- Characteristic bonuses → Noldor improvement → Skills/Competencies
- Cultural traits → Languages → Tool competencies

### PHASE 2: BACKGROUND (10 fields)
- Background selection → Description → Auto competencies
- Skills to choose → Tools (Instruments/Games sub-selection)
- 2 Traits with descriptions

### PHASE 3: OCCUPATION (30 fields)
- Occupation selection → Hit die → HP → Saves → Weapon/Armor competencies
- Skills selection (variable quantity) → Armor A/B selection
- 5 Weapon blocks (simple or A/B) → NO REPEAT WEAPONS
- Special features (Expertise for Explorer) → Occupation traits
- Future paths (level 3) → Favored skills

### PHASE 4: VIRTUE (Conditional)
- Only for 3 cultures at level 1, or on level up
- Filter by culture + COMMON
- Fixed and selectable bonuses
- Exclude already-owned competencies

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
- `/app/data/extracted_data_complete.json` - Extracted JSON data
- `/app/frontend/src/components/character-creator/` - Wizard components

## Next Priority Tasks
1. **P0:** Refactor Step3Occupation.jsx for complete weapon/armor flow
2. **P0:** Implement Step5Virtue.jsx for virtue selection
3. **P1:** Update Step2Background.jsx for trait descriptions
4. **P1:** Implement PDF generation in characterPDF.js
5. **P2:** Add full skill list display with calculated bonuses

## Future Features
- Interactive Character Sheet Page
- Character Listing (Drafts & Completed)
- Game Master Screen
- Online Gameplay (Map, Chat, Dice)
- AI Integration (Emergent LLM Key)
