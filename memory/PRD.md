# LOTR 5e RPG - Product Requirements Document

## Current State (2026-02-23)

### ✅ COMPLETED This Session

#### 2. Fase A — Modificadores correctos en tiradas + PX en orientación (2026-02-24)
- `rollEventDice` y las tarjetas pre-tirada ahora usan el modificador precalculado del miembro según su papel (`modViajar/modCaza/modPercepcion/modExplorar`). Fin del bug "+2 siempre".
- Incluye penalización por múltiples papeles (-5) y muestra desglose (habilidad + atributo).
- Tirada de orientación ahora muestra PX generados junto al resultado (`data-testid=orientation-xp-display`).

#### 3. Fase B — Día del Mes en Configuración (2026-02-24)
- Nuevo input `Día del Mes` (1-30, `data-testid=journey-day-input`) junto al selector de Mes.
- Se guarda en `config.diaMes` listo para el futuro sistema de clima.

#### 4. Fase C — Nueva Tabla de PX (2026-02-24)
- Tabla 1: CD 5-10→2 | 11-14→5 | 15-19→10 | 20-24→20 | 25+→35. Crítico nat20: +20. Pifia nat1: -10.
- Tabla 2 (multiplicador global): 0-20%→×1.0, 20-40%→×1.3/×0.7, >40%→×1.6/×0.4.
- Redondeo hacia abajo. **PX mínimos por personaje = 0** (no negativos).
- Aplicado tanto en el resumen de PX como en `applyPXToCharacters`.

#### 1. Sistema de Acampar + Fatiga Acumulativa (2026-02-23)
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

### 🟢 En Barbecho (dependen de otros sistemas)
- **Texto narrativo IA al acampar** (depende de sistema de clima)
- **Selector Campaña + Código en Papeles de Viaje** (depende de sistema de Campañas)
- **Sistema de Clima por región + efectos en tiradas y narrativa** (tras Fase A concluida ✅)

### P0 - Próximo
- **Punto 7 — Automatizar todo el viaje**:
  - Botón "Automatizar todo el viaje" al inicio de las tiradas de orientación
  - Tira todo hasta destino aplicando reglas auto de acampada (por cada 2 niveles fatiga → 2 días descanso para recuperar 1, incluso vigía)
  - Si fatiga ≥ 5 → acampa hasta recuperar 4 niveles
  - Si algún PJ *pudiera morir* → **pausa + aviso al DJ** con opciones (repetir auto, convertir a manual, ir de posada en posada)
  - Listado final completo (pifias, éxitos, acampadas)
- **Sistema Auth + RBAC + Campañas (Copy-on-Write)**:
  - JWT custom email+password + "Solicitar Acceso" con hCaptcha + aprobación del Maestro
  - Roles: Maestro / Director de Juego / Jugador
  - Recuperación de contraseña vía chat interno
  - Aislamiento de DB por Campaña: copy-on-write

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

