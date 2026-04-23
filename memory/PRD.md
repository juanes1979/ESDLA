# LOTR 5e RPG - Product Requirements Document

## Current State (2026-02-23)

### ✅ COMPLETED This Session

#### 1. Sistema de Acampar + Fatiga Acumulativa - COMPLETADO (2026-02-23)
**Backend:**
- `/api/characters/{id}/fatigue` acepta valores decimales (0.5 steps), clamp 0-6
- `ActiveJourney.fatiga_cd_total` ahora es `float` para soportar 11.5, 10.5, etc.
- Nuevo endpoint `POST /api/travel/journey/{id}/camp` que reduce CD Fatiga por 0.5 (mínimo 10)

**Frontend:**
- Nuevo `PartyFatiguePanel.jsx` visible durante jornadas día-a-día con barra individual por personaje (0-6 niveles, colores progresivos, efectos 5e)
- Nuevo `CampDialog.jsx` con reglas:
  - Selección de centinela (recibe mitad de recuperación)
  - Tirada CON CD10: -1 automático, nat20 → -2
  - Consume 1 ración + 1 agua por miembro
  - Eventos nocturnos según región (1 / 2 / 3)
  - Tirada de Sabiduría (Percepción) CD12 del centinela
  - Decrementa CD Fatiga del viaje en 0.5
- Botón "Acampar" flotante junto a "Descansar" y "Forrajear"
- Display CD Fatiga muestra decimales correctamente

**Testing:** 16/16 pytest pasaron (100% backend coverage). Ver `/app/backend/tests/test_camp_fatigue.py`.

### ✅ Previous Sessions
#### 2. Integración IA (Historias de Ubicación + Retratos de Personajes) - COMPLETADO
- `/api/names/generate-history` — textos estilo Tolkien con gpt-4o-mini
- `/api/portraits/generate` — retratos medievales con GPT Image 1
- Integrados en Creador de Personajes (paso final) y Mapa (Crear Ubicación)
- Visualización en Character Sheet, Character Summary, Characters List

#### 3. Editor de Trasfondos Mejorado - COMPLETADO
- Selector de cultura al crear trasfondo
- Modal "Copiar Trasfondos" para duplicar entre subculturas

---

## Pending Tasks

### P0 - Próximo (decisiones del usuario confirmadas, esperando implementación)
- **Sistema Auth + RBAC + Campañas (Copy-on-Write)**:
  - JWT custom (email + password)
  - Roles: Maestro / Director de Juego / Jugador
  - "Solicitar Acceso" con captcha gratuito (hCaptcha o matemático)
  - Aprobación del Maestro
  - Recuperación de contraseña vía mensajes internos (chat Maestro/Director ↔ Jugador)
  - Aislamiento de DB por Campaña: copy-on-write (lee de global, copia al editar)

### P1
- Game Master Screen (dashboard en vivo: jugadores conectados, HP, fatiga, dados, encuentros)
- Live Session Connectivity (códigos/links para unirse)

### P2
- Moveable pieces in Terrain Editor
- Pathfinding debugger fix
- Mouse wheel zoom smoothing (Master Map)
- Database backup/restore
- Refactor: `EnhancedTravelSystem.jsx` (>5300 líneas), `MiddleEarthMap.jsx` (>2500), `TreasureSystemSection.jsx`

---

## Technical Architecture

```
/app/
├── backend/
│   ├── routes/
│   │   ├── character_routes.py    # Float fatigue support
│   │   ├── data_routes.py
│   │   ├── name_generator.py      # AI location histories
│   │   ├── portrait_routes.py     # AI character portraits
│   │   ├── storage_routes.py
│   │   ├── trading_routes.py
│   │   └── travel_routes.py       # + /journey/{id}/camp endpoint
│   ├── tests/
│   │   └── test_camp_fatigue.py   # 16/16 passing
│   └── server.py
└── frontend/
    └── src/
        ├── components/
        │   ├── character-creator/
        │   ├── character-sheet/
        │   ├── map/
        │   ├── rules/
        │   ├── travel/              # NEW
        │   │   ├── CampDialog.jsx
        │   │   └── PartyFatiguePanel.jsx
        │   └── ui/
        └── pages/
            ├── EnhancedTravelSystem.jsx   # + camp button, fatigue panel
            ├── CharacterSheetPage.jsx
            ├── CharactersListPage.jsx
            └── MiddleEarthMap.jsx
```

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Location history generation
- **OpenAI GPT Image 1**: Character portrait generation
- **Emergent LLM Key**: Universal key

---

## User's Preferred Language: Español

