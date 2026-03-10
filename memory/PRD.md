# LOTR 5e RPG - Product Requirements Document

## Current State (2026-03-10)

### ✅ COMPLETED This Session (Fork #38)

#### 1. P0 FIX: Mapa en PDF/Crónica - RESUELTO
El mapa que aparecía como caja negra ahora renderiza correctamente.
Ver sección "3. Mapa en PDF/Crónica" para detalles técnicos.

#### 2. Modificadores de Habilidad - VERIFICADO
Los modificadores de habilidad se calculan correctamente incluyendo competencia + pericia.

#### 3. Botón "Descargar PDF (3 hojas)" - MOVIDO
- Quitado del creador de personajes (antes de crear)
- Añadido a la página de "HOJA DE PERSONAJE" junto a "Ficha Oficial"

#### 4. Nombres de Caminos Actualizados
- **Gran Camino** (antes: Camino Real) - CD 8, ×1.5 vel
- **Camino Mayor** (antes: Senda) - CD 10, ×1.25 vel
- **Camino Menor** (antes: Sendero) - CD 12, ×1.1 vel
- **Sendas** (nuevo) - CD 14, ×1 vel, sin montura
- **Campo Abierto** - CD 15, ×1 vel

#### 5. Sistema Métrico - ACTUALIZADO
- Velocidad en metros (m) en lugar de pies
- Labels en Config. Viajes actualizados: "Umbral Lento (m)", "Umbral Rápido (m)"

#### 6. Sistema de Cálculo de PX - IMPLEMENTADO
Fórmula: `PX final = PX base × diferencia × terreno × peligrosidad`

**Tablas añadidas a la sección VIAJES:**

1. **PX Base según CD:**
   | CD  | Dificultad | Éxito | Fallo |
   |-----|------------|-------|-------|
   | 10  | Muy fácil  | +1    | 0     |
   | 12  | Fácil      | +2    | −1    |
   | 14  | Moderada   | +3    | −1    |
   | 16  | Difícil    | +4    | −2    |
   | 18  | Muy difícil| +5    | −2    |
   | 20+ | Extrema    | +6    | −3    |

2. **Modificador por diferencia:**
   - +10 o más: ×2
   - +5 a +9: ×1.5
   - +1 a +4: ×1.2
   - 0: ×1
   - −1 a −3: ×1
   - −4 a −6: ×1.2
   - −7 o más: ×1.5

3. **Multiplicador por terreno:**
   - Fácil: ×0.8
   - Moderado: ×1
   - Difícil: ×1.2
   - Muy Difícil: ×1.5
   - Desalentador: ×1.8

4. **Multiplicador por tierras:**
   - Libres: ×0.8
   - Fronterizas: ×1
   - Salvajes: ×1.2
   - Sombra: ×1.5
   - Oscuras: ×1.8

**Límite:** máximo ±12 PX por tirada

#### 7. Refugios Seguros en Ruta
**Regla:** Solo se puede descansar en refugios seguros cuando se pasa cerca (~30km).

**Implementación:**
- Backend detecta refugios dentro de 1.5 unidades del path
- Excluye el destino final de la lista
- Calcula casilla/km de cada refugio

#### 8. Mapa en PDF/Crónica - CORREGIDO (2026-03-10)
**Problema:** El mapa aparecía como caja negra en el PDF generado.

**Solución FINAL:** Renderizar SVG directamente a Canvas (sin html2canvas).

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
