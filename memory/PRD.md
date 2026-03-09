# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### BUG FIX: Lista de Caminos Mostraba Rutas Incorrectas ✅
**Problema:** La lista de "Caminos utilizados" mostraba caminos que no se recorrían realmente (Annúminas, Fornost, Bree) cuando la ruta iba hacia el Este.

**Causa:** 
- El umbral de detección de caminos (1.5 unidades) era muy permisivo
- Caminos que apenas se cruzaban aparecían en la lista
- No había filtro por distancia mínima recorrida sobre cada camino

**Solución:**
1. Reducido umbral de detección: `tolerance = 0.6 * GRID_RESOLUTION`
2. Añadido filtro de distancia mínima: solo caminos con >30km o >5% de la ruta total
3. Los caminos ahora se ordenan por primera aparición en la ruta

**Resultado:**
- **Antes:** 9 caminos (incluyendo Annúminas, Fornost, Bree)
- **Después:** 4 caminos principales (Camino del Este, Paso Alto, Camino del Viejo Vado, Sendero Elfo)

---

#### FEATURE: Sistema de Velocidad de Grupo ✅
**Requerimiento:** El grupo viaja a la velocidad del miembro más lento.

**Implementación:**
- `TravelPartyMember.velocidad_efectiva()` devuelve velocidad de montura o base
- `km_por_dia = (velocidad_pies / 30) * 36`
- Respuesta incluye `velocidad_grupo` con desglose por miembro

**Testing:** 100% (9/9 tests passed) - `/app/test_reports/iteration_37.json`

---

#### BUG FIX P0: Pathfinding Algorithm Logic ✅
**Problema:** A* elegía la ruta más corta en lugar de la "mejor".

**Solución:** Sistema de multiplicadores de costo:
- `Cost = distance × road_mult × terrain_mult × land_mult`

**Testing:** 100% (8/8 tests passed) - `/app/test_reports/iteration_36.json`

---

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Implementar opción "Evitar Caminos"** - Para escenarios de huida
2. **Etapas de Viaje y Descansos** - Sistema de descanso durante viajes
3. **Piezas móviles en Editor de Terreno**

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
│   │   └── travel_routes.py
│   ├── utils/
│   │   └── pathfinding.py  # Road detection with min distance filter
│   └── server.py
└── frontend/
    └── src/
        └── pages/
            └── EnhancedTravelSystem.jsx
```

## Key Technical Concepts

### Road Detection Filter
```python
# Only include roads with significant usage
min_road_distance = max(30, total_distance * 0.05)  # 30km or 5%
significant_roads = {name: dist for name, dist in roads_distances.items() 
                     if dist >= min_road_distance}
```

### Group Speed Calculation
```python
velocidad_efectiva = montura_velocidad if tiene_montura else velocidad_base
velocidad_grupo = min(m.velocidad_efectiva() for m in miembros)
km_por_dia = (velocidad_grupo / 30) * 36
```

---

## Testing Results
- `/app/test_reports/iteration_37.json` - Group Speed: 100% (9/9)
- `/app/test_reports/iteration_36.json` - Pathfinding: 100% (8/8)

---

## 3rd Party Integrations
- **OpenAI GPT-4o:** Narrativa de viajes (via emergentintegrations)
- **jspdf & html2canvas:** Generación de PDF
- **lucide-react:** Iconos
- **shapely:** Operaciones geométricas (backend)
