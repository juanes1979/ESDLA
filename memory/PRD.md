# LOTR 5e RPG - Product Requirements Document

## Overview
Comprehensive web application for playing a modified "Lord of the Rings 5e" tabletop RPG based on user-provided Excel data (Utumno FINAL.xlsm).

## Core Features

### 1. Character Creator (P0 - In Progress)
- Multi-step wizard for character creation
- 9 steps: Culture → Background → Occupation → Attributes → Virtue → Skills → Equipment → Patron → Final Details
- Data-driven from Excel files

### 2. Character Sheet (P1 - Future)
- Complete digital character sheet
- Evolves with character progression

### 3. Game Master Screen (P2 - Future)
- Player management
- Adversary tracking
- Map management
- Event/story progression

### 4. Online Gameplay (P2 - Future)
- Hexagonal grid maps with fog of war
- Player/enemy tokens
- Chat system (general, P2P, P2DM)
- Dice rolling
- Session logs

### 5. AI Integration (P3 - Future)
- Story generation
- NPC responses
- Random events
- DM retains full control

### 6. Data Management (P3 - Future)
- CRUD for all game data
- DM can add/edit cultures, occupations, items, etc.

## Technical Stack
- **Backend**: FastAPI + Python
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Database**: MongoDB
- **Theme**: Dark, Tolkien-esque (Lord of the Rings)

---

## Implementation Status

### ✅ COMPLETED - Phase 1: Database (Dec 2025)

### ✅ COMPLETED - Phase 2: Character Creator Frontend (Dec 2025)

#### Components Created
- **HomePage.jsx**: Landing page with dark tavern theme, "Tierras Medias" title
- **CharacterCreatorWizard.jsx**: Main wizard component managing 9-step flow
- **StepIndicator.jsx**: Visual progress indicator for 9 steps
- **Step1Culture.jsx**: Culture selection with automatic name generator
- **Step2Background.jsx**: Background selection by culture
- **Step3Occupation.jsx**: Occupation/class selection with icons
- **Step4Attributes.jsx**: Attribute assignment (standard array, point buy, random)
- **Step5Virtue.jsx**: Cultural and common virtue selection
- **Step6Skills.jsx**: Skill competency selection
- **Step7Equipment.jsx**: Weapons, armors, and equipment selection
- **Step8Patron.jsx**: Optional patron/mecenas selection
- **Step9Details.jsx**: Personality traits, motivations, history
- **CharacterSummary.jsx**: Final review before character creation

#### Visual Theme Implemented
- Dark tavern atmosphere (Poney Pisador style)
- Gold/amber primary colors (torch light)
- Blue magical accents
- Cinzel + Crimson Text fonts (Tolkien-esque)
- Torch glow effects and animations
- Parchment-style cards with shadows

#### Features Working
- ✅ 9-step wizard navigation
- ✅ Culture category filtering (Elfos, Enanos, Hombres, Hobbits)
- ✅ Automatic name generator based on culture
- ✅ Physical attributes auto-generated from culture (age, height, weight)
- ✅ Characteristic modifiers applied from culture
- ✅ All data fetched from MongoDB via API

#### Test Results (iteration_1.json)
- Backend: 100% (18/18 tests passed)
- Frontend: 100% (all wizard flows working)

---

### ✅ COMPLETED - Phase 1 (earlier): Database (Dec 2025)

#### Data Extraction
- Created `data_extractor.py` to parse Excel files
- Extracted data from `utumno.xlsm`, `clima.xlsx`, `pnj.xlsx`, `tesoro.xlsx`

#### MongoDB Collections Seeded
| Collection | Count | Description |
|------------|-------|-------------|
| cultures | 19 | Player cultures (Elves, Dwarves, Men, Hobbits) |
| backgrounds | 114 | Character backgrounds by culture |
| occupations | 6 | Character classes/occupations |
| virtues | 100 | Cultural and common virtues |
| arts | 8 | Magic/special abilities |
| patrons | 7 | Mecenas (patrons) |
| equipment | 37 | General equipment items |
| weapons | 32 | Weapons |
| armors | 12 | Armor pieces |
| shadow_rules | 1 | Shadow/corruption mechanics |
| culture_names | 8 | Name generation data |

#### API Endpoints Created
**Game Data Routes** (`/api/data/`):
- `GET /cultures` - List cultures (filter by categoria)
- `GET /cultures/{id}` - Get single culture
- `GET /backgrounds` - List backgrounds (filter by culture)
- `GET /occupations` - List occupations
- `GET /virtues` - List virtues (filter by culture, include common)
- `GET /arts` - List arts
- `GET /patrons` - List patrons
- `GET /equipment` - General equipment
- `GET /weapons` - Weapons
- `GET /armors` - Armors
- `GET /shadow-rules` - Shadow mechanics
- `GET /names/{cultura}` - Name generation data

**Character Routes** (`/api/characters/`):
- `POST /draft` - Create new character draft
- `GET /draft/{id}` - Get draft state
- `PATCH /draft/{id}/step1-9` - Update each wizard step
- `POST /draft/{id}/finalize` - Convert draft to character
- `GET /` - List characters
- `GET /{id}` - Get character
- `DELETE /{id}` - Soft delete character
- `PATCH /{id}/hp` - Update HP
- `PATCH /{id}/shadow` - Update shadow points
- `PATCH /{id}/xp` - Add experience

---

## Upcoming Tasks

### 🔴 P0 - Complete Wizard Testing & Polish
1. Test full 9-step flow end-to-end
2. Add validation messages
3. Improve mobile responsiveness

### 🟠 P1 - Character Sheet View
1. Display complete character information
2. HP/Shadow tracking
3. Equipment management
4. Level-up mechanics

### 🟡 P2 - Game Master Screen
1. Campaign management
2. Player tracking
3. NPC management

### 🔵 P3 - Online Gameplay
1. Map system
2. Chat integration
3. Dice roller
4. AI integration (Emergent LLM Key)

---

## Data Sources
- `/app/data/utumno.xlsm` - Main game data
- `/app/data/clima.xlsx` - Climate data
- `/app/data/pnj.xlsx` - NPC data
- `/app/data/tesoro.xlsx` - Treasure tables

## File Structure
```
/app/
├── backend/
│   ├── server.py           # Main FastAPI app
│   ├── models.py           # Pydantic models
│   ├── data_extractor.py   # Excel parsing
│   ├── seed_database.py    # Database seeder
│   └── routes/
│       ├── data_routes.py      # Game data API
│       └── character_routes.py # Character API
├── frontend/
│   └── src/
└── data/
    ├── utumno.xlsm
    ├── clima.xlsx
    ├── pnj.xlsx
    ├── tesoro.xlsx
    └── extracted_data.json
```

## AI Integration Notes
- Will use Emergent LLM Key for AI features
- User prefers seamless integration without rate limits
- To be implemented in Phase 3
