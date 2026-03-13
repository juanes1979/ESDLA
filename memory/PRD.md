# LOTR 5e RPG - Product Requirements Document

## Current State (2025-03-12)

### ✅ COMPLETED This Session

#### 1. Integración IA para Generación de Historia - COMPLETADO
- Corregido el endpoint `/api/names/generate-history` usando el playbook de integración
- Implementación correcta de `emergentintegrations` con OpenAI gpt-4o-mini
- Genera historias breves estilo Tolkien para ubicaciones del mapa

#### 2. Generador de Nombres Integrado en "Crear Ubicación" - COMPLETADO
- Integrado directamente en el panel "Crear Nueva Ubicación" del mapa
- Selectores de Región y Raza para generar nombres
- Botón "Generar Nombre" que llena automáticamente el campo
- Botón "Generar con IA" para crear historia/descripción automática
- Archivo modificado: `/app/frontend/src/components/map/CreateLocationPanel.jsx`

#### 3. Generador de Retratos de Personajes con IA - COMPLETADO
**Requisitos implementados:**
- Nuevo endpoint `/api/portraits/generate` usando OpenAI GPT Image 1
- Genera retratos en blanco y negro, estilo fotorealista medieval LOTR
- Usa datos del personaje: raza, cultura, ocupación, trasfondo, edad, ojos, pelo, etc.
- Botón "Generar Retrato IA" en el último paso del creador (Resumen)
- Opción de regenerar si no gusta
- La imagen se guarda en el personaje y se muestra en:
  - Resumen del creador de personajes
  - Hoja de personaje (CharacterHeader)
  - Lista de personajes

**Archivos creados/modificados:**
- `/app/backend/routes/portrait_routes.py` - Nuevo endpoint de generación
- `/app/backend/routes/character_routes.py` - Campo portrait_image en finalize
- `/app/frontend/src/components/character-creator/CharacterSummary.jsx` - UI de generación
- `/app/frontend/src/components/character-sheet/summary/CharacterHeader.jsx` - Mostrar retrato
- `/app/frontend/src/pages/CharactersListPage.jsx` - Mostrar retrato en lista

---

## Core Features Implemented

### Character Creation System
- 9-step wizard for character creation
- Culture, background, occupation, attributes, virtue selection
- Equipment shop with starting funds
- AI-generated character portraits (NEW)

### Interactive Character Sheet
- Modular components for easy maintenance
- Equipment management with mount support
- HP and Shadow point tracking
- PDF export (3 pages)
- Portrait display

### Map System (Mapa del Maestro)
- Interactive Middle-earth map
- Location creation/editing with terrain types
- Name generator with prefix+root+suffix structure (by region/race)
- AI history generation for locations (NEW)
- Pathfinding and route planning

### Travel System
- Resource consumption (food/water)
- Fatigue mechanics
- Foraging rules
- Group speed calculations

### Treasure System
- Configurable treasure generation
- Famous weapons/armor creator
- Magic item generation

### GM Tools
- Rules editor for all game parameters
- NPC management
- Trading system configuration

---

## Pending Tasks

### P1 - High Priority
- Implement role-based access control (Admin/Maestro/Player)
- Verify mount weight calculations edge cases

### P2 - Medium Priority
- Fix flawed pathfinding logic in debugger
- Improve mouse wheel zoom on master map

### Future Tasks
- Moveable pieces in Terrain Editor
- Refactor large components (EnhancedTravelSystem, MiddleEarthMap, TreasureSystem)
- Database backup/restore feature
- DM Screen and online gameplay interface
- Full authentication system with roles

---

## Technical Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── character_routes.py   # Character CRUD, drafts, finalize
│   │   ├── data_routes.py        # Game data (cultures, occupations, etc.)
│   │   ├── name_generator.py     # Name generation with AI history
│   │   ├── portrait_routes.py    # AI portrait generation (NEW)
│   │   ├── storage_routes.py     # File storage
│   │   ├── trading_routes.py     # Trading system
│   │   └── travel_routes.py      # Travel calculations
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   ├── character-creator/  # Wizard steps
        │   ├── character-sheet/    # Modular sheet components
        │   ├── map/               # Map panels and controls
        │   ├── rules/             # Rules editor sections
        │   └── ui/                # Shadcn components
        └── pages/
            ├── CharacterSheetPage.jsx
            ├── CharactersListPage.jsx
            ├── MiddleEarthMap.jsx
            └── ...
```

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Location history generation
- **OpenAI GPT Image 1**: Character portrait generation
- **Emergent LLM Key**: Universal key for all AI integrations
- **jspdf & html2canvas**: PDF generation
- **lucide-react**: Icons
- **shapely**: Geometric operations (backend)

---

## User's Preferred Language: Español
