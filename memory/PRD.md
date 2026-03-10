# LOTR 5e RPG - Product Requirements Document

## Current State (2026-03-10)

### ✅ COMPLETED This Session (Fork #38)

#### 1. P0 FIX: Mapa en PDF/Crónica - RESUELTO
El mapa que aparecía como caja negra ahora renderiza correctamente.
Ver sección "3. Mapa en PDF/Crónica" para detalles técnicos.

#### 2. Modificadores de Habilidad - VERIFICADO
Los modificadores de habilidad se calculan correctamente incluyendo competencia + pericia.

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

#### 3. Mapa en PDF/Crónica - CORREGIDO (2026-03-10)
**Problema:** El mapa aparecía como caja negra en el PDF generado.

**Causa:** `html2canvas` no puede renderizar correctamente SVGs con imágenes externas (`<image href="/mapa_jugadores.jpg">`), incluso con `useCORS: true`.

**Solución FINAL:** Renderizar SVG directamente a Canvas (sin html2canvas):
```javascript
const captureMapImage = async () => {
  // 1. Obtener viewBox del SVG para conocer la región visible
  // 2. Crear canvas de 800px de ancho (proporcional)
  // 3. Cargar imagen del mapa y dibujar solo la región visible
  // 4. Dibujar path (ruta) parseando el atributo 'd'
  // 5. Dibujar marcadores (círculos, líneas X)
  // 6. Dibujar etiquetas de texto (origen/destino)
  return outputCanvas.toDataURL('image/png', 0.9);
};
```

**Resultado:** El mapa ahora aparece correctamente con:
- Fondo de mapa (región visible del viewBox)
- Ruta en rojo (#c43c3c)
- Marcador origen: círculo verde (#2d5016)
- Marcador destino: X rojo (#8b1a1a)
- Etiquetas de ubicaciones

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
