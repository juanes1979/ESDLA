# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application for a modified "Lord of the Rings 5e" tabletop RPG.

**User's preferred language**: Español

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### 1. Modificadores de Habilidad para Papeles de Viaje ✅
**Problema:** Los modificadores de habilidad no se aplicaban (ej: +6 en Viajar para Guía).

**Solución:**
- Helper `calcBonusCompetencia(nivel)` - calcula bonificación por nivel
- Helper `tieneCompetenciaEn(char, habilidad)` - verifica competencias
- Al añadir miembro se calculan:
  - `modViajar`, `modCaza`, `modPercepcion`, `modExplorar`
  - `bonusCompetencia`, `competenciaViajar`, etc.
- Se envían correctamente al backend para tiradas

#### 2. Refugios Seguros en Ruta ✅
**Problema:** Los refugios estaban hardcodeados y ofrecían descanso en el destino final.

**Solución:**
- Backend detecta refugios que la ruta pasa (<30km de distancia)
- Calcula casilla/km de cada refugio
- **Excluye el destino final** de la lista
- Frontend usa `journeyCalc.ruta.refugios_en_ruta`

**Ejemplo (Hobbiton → Esgaroth):**
```
Los Gamos: casilla 2, km 40
Bree: casilla 10, km 171
Rivendel: casilla 28, km 456  ← Solo aparece si es punto de paso
Las Estancias del Rey Elfo: casilla 55, km 887
```

#### 3. Sistema Métrico Completo ✅
Todas las velocidades en metros:
- Dúnedain: 10m = 40 km/día
- Elfos/Hombres: 9m = 36 km/día
- Enanos/Hobbits: 7m = 28 km/día

#### 4. Filtro de Caminos ✅
Solo muestra caminos con >30km o >5% de la ruta total.

---

### 🔴 PENDIENTE: Mapa en PDF/Crónica
**Problema:** El mapa aparece negro en la vista de resultados y en el PDF.
**Causa probable:** `html2canvas` no captura correctamente imágenes dentro de SVG.
**Estado:** Requiere investigación adicional.

---

## 📋 UPCOMING TASKS

### P0 - Inmediato
- Arreglar visualización del mapa en PDF/crónica

### P1 - Próximo
- Sistema de descanso cada 7-10 días (acumular CD fatiga)
- Implementar "Evitar Caminos" para huida
- Piezas móviles en Editor de Terreno

### P2 - Medio Plazo
- Consumo de Comida/Agua
- Control de acceso por roles

---

## Key Technical Concepts

### Modificadores de Viaje
```javascript
// Calcular bonificación por nivel
const calcBonusCompetencia = (nivel) => {
  if (nivel >= 17) return 6;
  if (nivel >= 13) return 5;
  if (nivel >= 9) return 4;
  if (nivel >= 5) return 3;
  return 2;
};

// Modificador total = mod_atributo + (competencia ? bonus : 0)
modViajar = modSabiduria + (competenciaViajar ? bonusCompetencia : 0)
```

### Refugios en Ruta (Backend)
```python
# Detectar refugios dentro de 1.5 unidades (~30km) del path
for loc in all_locations:
    if loc.get('nombre') == config.destino_nombre:
        continue  # Excluir destino
    
    # Calcular distancia mínima al path
    for px, py in path_points:
        dist = ((loc_x - px)**2 + (loc_y - py)**2)**0.5
        if dist < 1.5:
            refugios_en_ruta.append({...})
```

---

## API Response Example
```json
{
  "ruta": {
    "refugios_en_ruta": [
      {"nombre": "Bree", "casilla": 10, "km": 171.7},
      {"nombre": "Rivendel", "casilla": 28, "km": 455.7}
    ]
  }
}
```

---

## Testing Done
- Refugios en ruta Hobbiton→Rivendel: ✅ Rivendel excluido (es destino)
- Refugios en ruta Hobbiton→Esgaroth: ✅ Rivendel incluido (es paso)
- Modificadores de habilidad: ✅ Se calculan y envían correctamente
