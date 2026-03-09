# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### FEATURE: Sistema de Velocidad de Grupo ✅
**Requerimiento:** Antes de calcular el viaje, el sistema debe considerar las velocidades de los personajes y sus monturas. El grupo viaja a la velocidad del miembro más lento.

**Implementación:**
- `TravelPartyMember` ahora tiene método `velocidad_efectiva()`:
  - Si tiene montura → usa `montura_velocidad`
  - Si no tiene montura → usa `velocidad_base`
- Frontend envía `velocidad_base` y `montura_velocidad` de cada miembro
- Backend calcula velocidad del grupo = `min(velocidades_efectivas)`
- `km_por_dia = (velocidad_pies / 30) * 36`

**Respuesta API incluye `velocidad_grupo`:**
```json
{
  "velocidad_grupo": {
    "velocidad_pies": 25,
    "km_por_dia": 30.0,
    "miembro_mas_lento": "Frodo",
    "desglose_velocidades": [
      {"nombre": "Frodo", "velocidad_base": 25, "montura_velocidad": 0, "velocidad_efectiva": 25},
      {"nombre": "Aragorn", "velocidad_base": 30, "montura_velocidad": 60, "velocidad_efectiva": 60}
    ],
    "monturas_permitidas": true
  }
}
```

**Ejemplos de cálculo:**
| Personaje | Vel Base | Montura | Vel Efectiva | Km/día |
|-----------|----------|---------|--------------|--------|
| Frodo a pie | 25 | - | 25 | 30 |
| Aragorn montado | 30 | 60 | 60 | 72 |
| **Grupo mixto** | - | - | **25** | **30** |

**Testing:** 100% (9/9 tests passed) - `/app/test_reports/iteration_37.json`

---

#### BUG FIX P0: Pathfinding Algorithm Logic Fixed ✅
**Problema:** El algoritmo A* elegía la ruta más corta en lugar de la "mejor" ruta.

**Solución:** Nuevo sistema de multiplicadores de costo:
- `Cost = distance_km × road_mult × terrain_mult × land_mult`
- Mejores caminos → multiplicador más bajo → costo menor

**Testing:** 100% (8/8 tests passed) - `/app/test_reports/iteration_36.json`

---

### ✅ Previous Sessions Summary

#### Travel System - Complete
- Sistema de viajes con pathfinding A*
- Cálculo de distancia, días, PX por segmento
- Eventos de viaje con tiradas d20
- Modo jornada a jornada
- Narrativa con IA (GPT-4o)
- Comparación de rutas (segura vs directa)

#### Map System - Complete
- Mapa del Maestro y Mapa del Jugador
- 210+ ubicaciones de la Tierra Media
- Editor de caminos, ríos, barreras
- Editor de terreno (zonas pintables)

#### Character System - Complete
- Creador de personajes multi-paso
- Hoja de personaje interactiva
- Sistema de equipamiento con monturas
- Gestión de peso y estorbo

---

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Implementar opción "Evitar Caminos"** - Para escenarios de huida
2. **Etapas de Viaje y Descansos** - Sistema de descanso durante viajes
3. **Piezas móviles en Editor de Terreno** - Mover iconos en el mapa

### P2 - Medium Priority
1. **Consumo de Comida/Agua**
2. **Control de acceso por roles** (Admin/Maestro/Jugador)
3. **Refactorizar componentes grandes**

### P3 - Future Tasks
- Sistema de Autenticación completo
- Backup/Restore de base de datos
- Pantalla del DM
- Interfaz de juego online

---

## Code Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   └── travel_routes.py  # TravelPartyMember with velocidad_efectiva()
│   ├── utils/
│   │   └── pathfinding.py    # A* with cost multipliers
│   └── server.py
└── frontend/
    └── src/
        └── pages/
            └── EnhancedTravelSystem.jsx  # Group speed display
```

## Key Technical Concepts

### Group Speed Calculation
```python
class TravelPartyMember:
    def velocidad_efectiva(self) -> int:
        if self.tiene_montura and self.montura_velocidad > 0:
            return self.montura_velocidad
        return self.velocidad_base

# Group travels at slowest member's speed
velocidad_grupo = min(m.velocidad_efectiva() for m in miembros)
km_por_dia = (velocidad_grupo / 30) * 36
```

### A* Pathfinding Cost System
```python
Cost = distance_km * road_mult * terrain_mult * land_mult * river_mult

ROAD_MULT = {'grande': 0.1, 'mayor': 0.25, 'menor': 0.45, 'senda': 0.65, 'ninguno': 1.0}
TERRAIN_MULT = {'facil': 0.5, 'moderado': 1.0, 'dificil': 2.0, 'muy_dificil': 4.0, 'desalentador': 8.0}
LAND_MULT = {'tierras_libres': 0.2, 'fronterizas': 0.5, 'salvajes': 1.0, 'sombra': 5.0, 'oscuras': 10.0}
```

---

## Testing Results
- `/app/test_reports/iteration_37.json` - Group Speed: 100% (9/9)
- `/app/test_reports/iteration_36.json` - Pathfinding: 100% (8/8)
- `/app/backend/tests/test_group_speed.py` - Unit tests

---

## 3rd Party Integrations
- **OpenAI GPT-4o:** Narrativa de viajes (via emergentintegrations)
- **jspdf & html2canvas:** Generación de PDF
- **lucide-react:** Iconos
- **shapely:** Operaciones geométricas (backend)
