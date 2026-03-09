# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### BUG FIX P0: Pathfinding Algorithm Logic Fixed ✅
**Problema:** El algoritmo A* elegía la ruta más corta en lugar de la "mejor" ruta según las reglas del juego. Esto causaba rutas ilógicas (ej: ir al norte desde Hobbiton en lugar de al este hacia el Camino del Este).

**Causa Raíz:** 
- El sistema anterior usaba puntos negativos como costo (`cost = -total_points + distance * 0.01`)
- Esto rompía la coherencia del A* porque `g_cost` era negativo pero `h_cost` (heurística) era positivo
- El resultado era rutas absurdamente largas (8084 km para una línea recta de 741 km)

**Solución Implementada:**
- Reescrito `_calculate_move_cost()` en `/app/backend/utils/pathfinding.py`
- Nuevo sistema de **multiplicadores de costo** donde:
  - `Cost = distance_km * road_mult * terrain_mult * land_mult * river_mult`
  - Mejores caminos = multiplicador más bajo = menor costo
  - Terreno peligroso = multiplicador más alto = mayor costo
- Heurística ajustada para ser admisible: `h_cost = distance * COORD_TO_KM * 0.01`

**Multiplicadores del Sistema:**
| Factor | Mejor | ... | Peor |
|--------|-------|-----|------|
| **Camino** | grande(0.1) | mayor(0.25) → menor(0.45) → senda(0.65) | ninguno(1.0) |
| **Terreno** | fácil(0.5) | moderado(1.0) → difícil(2.0) → muy_difícil(4.0) | desalentador(8.0) |
| **Tipo Tierra** | libres(0.2) | fronterizas(0.5) → salvajes(1.0) | sombra(5.0), oscuras(10.0) |

**Modos de Pathfinding:**
1. **Ruta Segura (default):** Usa todos los multiplicadores, evita tierras peligrosas
2. **Ruta Directa:** Reduce penalización de tierras peligrosas a 10% (`land_mult * 0.1`)
3. **Evitar Caminos:** Penaliza uso de caminos (`road_mult = 5.0`)

**Resultados Verificados (Hobbiton → Esgaroth):**
- Línea recta: 741.7 km
- Ruta con caminos: 916 km, 27 días, 9 caminos usados ✅
- Ruta directa: 879 km, 22 días ✅
- **Dirección: ESTE** (como especificó el usuario) ✅
- **"Camino del Este" incluido** en ambas rutas ✅

**Optimización de Performance:**
- `GRID_RESOLUTION` aumentado de 0.5 a 1.0
- Tiempo de respuesta reducido de ~60s a ~8-17s para rutas largas
- Rutas cortas responden en ~1-3s

**Testing Results (iteration_36.json):**
- **Backend:** 100% (8/8 tests passed)
- F1: Ambas rutas retornadas ✅
- F2: Ruta va hacia el ESTE ✅
- F3: Distancias razonables ✅
- F4: Sistema de penalizaciones funciona ✅
- F5: "Camino del Este" usado ✅

---

### ✅ COMPLETED Previous Session - Comparación de Rutas

#### FEATURE: Modo de Comparación de Rutas ✅
**Endpoint:** `POST /api/travel/compare-routes`

**Funcionalidad:**
- Compara "Ruta por Caminos" vs "Ruta Directa"
- Muestra línea recta teórica para referencia
- Ambas rutas NUNCA atraviesan terreno infranqueable

**UI implementada:**
- Panel de comparación lado a lado
- Desvío vs línea recta (km y %)
- Desglose de terreno

---

## Previous Sessions Summary

### Travel System - Complete ✅
- Sistema completo de viajes con pathfinding A*
- Cálculo de distancia, días, PX por segmento
- Eventos de viaje con tiradas d20
- Modo jornada a jornada
- Narrativa con IA (GPT-4o)
- Impresión de crónica en PDF

### Map System - Complete ✅
- Mapa del Maestro y Mapa del Jugador separados
- 210+ ubicaciones de la Tierra Media
- Editor de caminos, ríos y barreras
- Editor de terreno (zonas pintables)
- Pathfinding A* integrado

### Character System - Complete ✅
- Creador de personajes multi-paso
- Hoja de personaje interactiva
- Sistema de equipamiento con monturas
- Recompensas y mejoras
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
3. **Refactorizar componentes grandes** (EnhancedTravelSystem, MiddleEarthMap, TerrainEditor)

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
│   │   └── travel_routes.py  # Endpoints de viaje, compare-routes
│   ├── utils/
│   │   └── pathfinding.py    # A* con sistema de multiplicadores
│   └── server.py
└── frontend/
    └── src/
        ├── pages/
        │   ├── MiddleEarthMap.jsx      # Mapa interactivo
        │   └── EnhancedTravelSystem.jsx # Sistema de viajes
        └── components/
            └── travel/
```

## Key Technical Concepts

### A* Pathfinding - Cost Multiplier System
```python
Cost = distance_km * road_mult * terrain_mult * land_mult * river_mult

# Lower multiplier = better path
ROAD_MULT = {'grande': 0.1, 'mayor': 0.25, 'menor': 0.45, 'senda': 0.65, 'ninguno': 1.0}
TERRAIN_MULT = {'facil': 0.5, 'moderado': 1.0, 'dificil': 2.0, 'muy_dificil': 4.0, 'desalentador': 8.0}
LAND_MULT = {'tierras_libres': 0.2, 'fronterizas': 0.5, 'salvajes': 1.0, 'sombra': 5.0, 'oscuras': 10.0}
```

### Direct Mode
En modo directo, las penalizaciones de tierras peligrosas se reducen al 10%:
```python
if self.direct_mode:
    land_mult = max(0.5, land_mult * 0.1)
```

---

## Database Collections
- `locations`: 210+ documentos con coordenadas, terreno, tipo_tierra
- `roads`: Caminos con puntos de coordenadas
- `rivers`: Ríos con tipo (vadeable/profundo/infranqueable)
- `barriers`: Barreras infranqueables
- `terrain_polygons`: Zonas de terreno pintadas

---

## Testing
- `/app/test_reports/iteration_36.json` - 100% pass rate (Pathfinding fix)
- `/app/backend/tests/test_pathfinding_compare_routes.py` - Tests del sistema

---

## 3rd Party Integrations
- **OpenAI GPT-4o:** Narrativa de viajes (via emergentintegrations, Emergent LLM Key)
- **jspdf & html2canvas:** Generación de PDF
- **lucide-react:** Iconos
- **shapely:** Operaciones geométricas (backend)
