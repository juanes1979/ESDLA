# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### FEATURE: Sistema de Velocidad por Raza (Sistema Métrico) ✅
**Requerimiento:** La velocidad de los personajes debe afectar los días de viaje. Enanos/Hobbits son más lentos que Dúnedain.

**Implementación:**
- Velocidades en METROS (no pies):
  - Dúnedain: 10m = 40 km/día
  - Elfos/Hombres: 9m = 36 km/día
  - Enanos/Hobbits: 7m = 28 km/día
  - Caballo: 18m = 72 km/día
- Fórmula: `km_por_dia = velocidad_metros × 4`
- El grupo viaja a la velocidad del miembro más lento

**Ejemplo Verificado (Hobbiton → Rivendel, 458 km):**
| Grupo | Velocidad | Días |
|-------|-----------|------|
| Solo Aragorn (Dúnedain) | 40 km/día | 9 |
| Aragorn + Gimli (Enano) | 28 km/día | 13 |

---

#### BUG FIX: Lista de Caminos Mostraba Rutas Incorrectas ✅
**Solución:** Filtro de distancia mínima (>30km o >5% del total)

**Resultado:**
- Antes: 9 caminos (incluyendo cruces breves)
- Después: 4 caminos principales

---

#### BUG FIX P0: Pathfinding Algorithm ✅
Sistema de multiplicadores de costo implementado.

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

---

## Key Technical Concepts

### Velocidades por Cultura (Sistema Métrico)
```
Dúnedain:       10m = 40 km/día
Elfos/Hombres:   9m = 36 km/día  
Enanos/Hobbits:  7m = 28 km/día
Caballo:        18m = 72 km/día
```

### Cálculo de Velocidad del Grupo
```python
# El grupo viaja a la velocidad del más lento
velocidad_grupo = min(m.velocidad_efectiva() for m in miembros)
km_por_dia = velocidad_grupo * 4  # 1m de velocidad = 4 km/día
```

---

## Testing Results
- Velocidad Dúnedain vs Enano: ✅ Diferencia de 4 días verificada
- Sistema métrico: ✅ Todo en metros/km

---

## 3rd Party Integrations
- **OpenAI GPT-4o:** Narrativa de viajes
- **jspdf & html2canvas:** Generación de PDF
- **lucide-react:** Iconos
- **shapely:** Operaciones geométricas
