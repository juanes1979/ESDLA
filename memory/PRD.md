# LOTR 5e RPG - Product Requirements Document

## Current State (2026-12-09)

### ✅ COMPLETED This Session

#### 1. Sistema de Modificadores de Habilidad Corregido
**Problema:** Los modificadores de habilidad no se aplicaban correctamente (ej: +6 en Viajar).

**Reglas LOTR 5e (Corregido):**
- **Base:** Modificador del atributo (ej: Sabiduría +2)
- **Competencia:** +bonus_competencia (nivel 1 = +2)
- **Pericia (Expertise):** +bonus_competencia ADICIONAL (x2 total)

**Ejemplo:** +6 en Viajar = +2 (Sabiduría) + 4 (Pericia x2)

**Implementación:**
```javascript
// Calcular modificador con pericia
const calcModHabilidad = (char, habilidad, atributo) => {
  let mod = puntuaciones[habilidad] || modAtributo;
  if (tieneCompetenciaEn(char, habilidad)) mod += bonusCompetencia;
  if (tienePericia(char, habilidad)) mod += bonusCompetencia; // x2 total
  return mod;
};
```

#### 2. Refugios Seguros en Ruta
**Regla:** Solo se puede descansar en refugios seguros cuando se pasa cerca (~30km).

**Implementación:**
- Backend detecta refugios dentro de 1.5 unidades del path
- Excluye el destino final de la lista
- Calcula casilla/km de cada refugio

**Ejemplo (Hobbiton → Esgaroth):**
- Los Gamos: casilla 2
- Bree: casilla 10
- Rivendel: casilla 28 (solo si es paso, no destino)

#### 3. Mejora Captura de Mapa para PDF
**Problema:** El mapa aparecía negro en el PDF.

**Solución:** Convertir imagen SVG a base64 antes de html2canvas:
- Clona el elemento del mapa
- Convierte `<image href="...">` a base64
- Captura con html2canvas

---

## 📋 PRÓXIMAS TAREAS

### P1 - Próximo
- **Sistema de descanso cada 7-10 días** (acumular CD fatiga si no descansa)
- **Opción "Evitar Caminos"** para huidas
- **Piezas móviles** en Editor de Terreno

### P2 - Medio plazo
- Consumo de Comida/Agua
- Control de acceso por roles

---

## Cálculo de Velocidad (Sistema Métrico)
```
Dúnedain:       10m = 40 km/día
Elfos/Hombres:   9m = 36 km/día
Enanos/Hobbits:  7m = 28 km/día
Caballo:        18m = 72 km/día
```

## Refugios en Ruta (Backend)
```python
# Detectar refugios dentro de ~30km del path
for loc in all_locations:
    if loc.get('nombre') == config.destino_nombre:
        continue  # Excluir destino
    if min_dist_to_path < 1.5:
        refugios_en_ruta.append({...})
```
