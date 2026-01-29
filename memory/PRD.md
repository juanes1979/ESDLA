# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

## What's Been Implemented (2026-01-29)

### Phase 1: Database & Backend ✅
- MongoDB with 19 cultures, 114 backgrounds, 6 occupations, 100+ virtues
- Full data extraction from Excel with all rules

### Phase 2: Character Creator ✅ (Major Refactoring)

**Step 1: Culture**
- 19 cultures with Nivel de Vida (Frugal/Común/Próspero)
- Automatic name generation from Excel prefixes/suffixes
- Physical attributes (eyes, skin, hair)

**Step 2: Background**  
- Filtered by culture
- 2 personality traits (rasgos) per background
- History from background description

**Step 3: Occupation** ✅ REFACTORED
- 6 occupations: Buscador de tesoros, Campeón, Capitán, Erudito, Guardian, Mensajero
- Sub-steps:
  1. Select occupation
  2. Choose skills (4 for Buscador, 2-3 for others)
  3. Choose armor (Option A or B)
  4. Choose weapons (3-4 sequential questions with A/B options)
  5. Choose expertise (ONLY for Buscador de tesoros - 2 skills)

**Step 4: Attributes**
- Dice rolling with 3 block options
- Standard array alternative
- Characteristic assignment

**Step 5: Virtue** (Conditional)
- ONLY for: Hombres del lago, Hombres de Bree, Beórnidas
- Other cultures skip this step

**Step 6: Skills**
- Skill bonuses calculated

**Step 7: Equipment**
- Automatic based on Nivel de Vida
- Additional weapon/armor from occupation

**Step 8: Details** ✅ FIXED
- Shows BOTH personality traits from background
- History from background description
- Competencies display

### Phase 3: PDF Export ✅ NEW
- 3-page PDF matching user's templates
- Page 1: Attributes, Combat, Skills, Equipment, Shadow
- Page 2: Community Points, Virtues, Background
- Page 3: Story History (long texts)

## Key Game Rules Implemented
1. **Virtudes nivel 1:** Solo 3 culturas específicas
2. **Equipo por Nivel de Vida:** Frugal/Común/Próspero
3. **Pericia:** Solo Buscador de tesoros (2 habilidades x2)
4. **Armas/Armaduras:** Preguntas A/B según ocupación
5. **Rasgos:** 2 por trasfondo, automáticos

## Upcoming Tasks (P1)
- [ ] Interactive Character Sheet page
- [ ] Draft listing/management
- [ ] Full skill list with calculated bonuses

## Future Tasks (P2)
- Game Master (DM) Screen
- Online Gameplay (Map, Chat, Dice)
- AI Integration (Emergent LLM Key - confirmed)

## Technical Stack
- Backend: FastAPI, Motor, MongoDB
- Frontend: React, Tailwind, Shadcn UI
- PDF: jsPDF

## Key Files
- `/app/backend/data_extractor.py` - Excel parsing with occupation questions
- `/app/frontend/src/components/character-creator/steps/Step3Occupation.jsx` - Multi-step with A/B
- `/app/frontend/src/utils/characterPDF.js` - 3-page PDF generator
