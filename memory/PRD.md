# LOTR 5e RPG - Product Requirements Document

## Current State (2026-03-10)

### ✅ COMPLETED This Session (Fork #39-41)

#### 1. P0: Sistema de Descanso, Fatiga, Comida y Agua - COMPLETADO

**Funcionalidades implementadas:**

1. **Pestaña "Comida" en CONFIG. VIAJES**
   - Muestra items marcados como comida/agua
   - Integración con FoodWaterEditor modal para edición en lote
   - Muestra porcentaje de ración y litros por item

2. **Editor de Comida/Agua (FoodWaterEditor)**
   - Marcar items como comida/agua
   - Configurar `porcentaje_racion` (cuánto de una ración representa)
   - Configurar `litros` de agua por unidad
   - Edición en lote por categoría

3. **Verificación de Provisiones Pre-Viaje**
   - Calcula provisiones necesarias según días y personas
   - Muestra advertencia si hay insuficientes
   - Detalles: raciones y litros disponibles vs necesarios

4. **Panel de Provisiones Durante Viaje (Día a Día)**
   - Indicadores de comida (raciones) y agua (litros) disponibles
   - Días restantes de provisiones
   - Código de colores: verde (suficiente), rojo (insuficiente)

5. **Consumo Diario Automático**
   - 1 ración de comida por persona/día
   - 2 litros de agua por persona/día
   - Advertencias cuando escasean las provisiones

6. **Sistema de Forrajeo**
   - Botón "Forrajear" en panel de provisiones
   - Tirada de Supervivencia CD 15
   - Éxito: encuentra 1d4 raciones + 1d4 litros
   - Costo: 1 día adicional en la etapa

7. **Sistema de Descanso (3 tipos)**
   - **Corto (1 hora):** Recupera uso de habilidades
   - **Largo (8 horas):** -1 fatiga con tirada CON exitosa (CD 10 + modificadores)
   - **Santuario (1+ días):** Elimina toda fatiga sin tirada (requiere refugio)

8. **Fatiga por Falta de Provisiones**
   - Sin comida: +1 nivel de fatiga por día
   - Sin agua: +2 niveles de fatiga por día
   - Tracking por personaje

9. **Endpoint de Fatiga**
   - `PUT /api/characters/{id}/fatigue`
   - Actualiza fatiga directamente (clamp 0-6)

#### 2. Sistema de Interacciones con Objetos - COMPLETADO

Sistema interactivo para romper puertas, cofres, cerrojos y otros objetos:

**Clase de Armadura por Material:**
| Material | CA |
|----------|-----|
| Tela, papel, cuerda | 11 |
| Cristal, vidrio, hielo | 13 |
| Madera, hueso | 15 |
| Piedra | 17 |
| Hierro, acero | 19 |
| Mithril | 21 |
| Adamantina | 23 |

**Puntos de Golpe por Tamaño:**
| Tamaño | Frágil | Resistente |
|--------|--------|------------|
| Diminuto | 1d4 (~2) | 2d4 (~5) |
| Pequeño | 1d6 (~3) | 3d6 (~10) |
| Mediano | 1d8 (~4) | 4d8 (~18) |
| Grande | 1d10 (~5) | 5d10 (~27) |

**Estados que modifican CA y PG:**
- **Ruinoso:** -4 CA, ×0.5 PG
- **Desgastado:** -2 CA, ×0.75 PG
- **Normal:** +0 CA, ×1 PG
- **Reforzado:** +2 CA, ×1.25 PG
- **Obra maestra:** +4 CA, ×1.5 PG

**Reglas especiales:**
- **1 Natural (Pifia):** Fallo automático. 50% de dañar el arma.
- **20 Natural (Crítico):** Impacto automático con daño doble.

**Objetos predefinidos:** Cerrojo común, Cerrojo reforzado, Cofre de madera, Puerta vieja, Puerta de castillo, Portón de hierro, Cadenas, Ventana de vidrio, Barril, Estatua de piedra, Puerta de Mithril

**Vulnerabilidades y Resistencias por Tipo de Daño:**
| Material | Vulnerable (×2) | Resistente (×0.5) | Inmune (×0) |
|----------|-----------------|-------------------|-------------|
| Tela | Fuego, Cortante | - | - |
| Cristal | Contundente, Trueno | - | Perforante |
| Madera | Fuego | Contundente | - |
| Piedra | Trueno | Cortante, Perforante, Fuego | - |
| Hierro | Ácido | Cortante, Perforante | Fuego |
| Mithril | - | Todos físicos + Fuego, Frío | Ácido |
| Adamantina | - | Todos físicos + Fuego, Frío, Rayo | Ácido, Trueno |

**Editor de Materiales:** Permite añadir/modificar materiales con sus vulnerabilidades y resistencias.

#### 3. Sistema de Tesoros - COMPLETADO

Sistema completo de generación de tesoros, objetos mágicos, joyas y arte:

**Niveles de Tesoro:**
| Nivel | Valor Base | Tiradas Mágicas | CD Sombra |
|-------|------------|-----------------|-----------|
| Menor | 9 + 2d8 po | 1d20 | 10 |
| Mayor | 16 + 3d10 po | 2d20 | 15 |
| Maravilloso | 26 + 4d12 po | 3d20 | 20 |

**Tabla de Tesoro Mágico (d20):**
- 1-14: Ningún tesoro mágico (Sombra: 1d4-2)
- 15-17: Artefacto maravilloso con 1 bendición (Sombra: 1d6-3)
- 18-19: Objeto extraordinario con 2 bendiciones (Sombra: 1d8-4)
- 20: Arma o armadura famosa (Sombra: 1d8-4)

**20 Bendiciones** (d20): Acertijos, Acrobacias, Atletismo, Cazar, Engaño, Explorar, Interpretación, Intimidación, Investigación, Juego de manos, Medicina, Naturaleza, Percepción, Perspicacia, Persuasión, Saber antiguo, Sigilo, Trato con animales, Viajar, Tira dos veces

**9 Maldiciones:** Debilidad, Oscurecedor, Perseguido, Mala suerte, Mal augurio, Maligno, Adueñado, Marcado por la Sombra, Debilitante

**Generador de Joyas:** Con formas (anillo, broche, collar, diadema, corona, cinturón), materiales (oro, plata, bronce, platino, mithril), gemas (perla, zafiro, rubí, amatista, diamante, esmeralda) y manufacturas.

**~50 Objetos de Arte:** Gemas preciosas, máscaras, cálices, estatuillas, tapices, joyas decoradas, instrumentos, coronas, etc.

---

### ✅ COMPLETED Previous Session (Fork #38)

#### Mapa en PDF/Crónica - RESUELTO
El mapa que aparecía como caja negra ahora renderiza correctamente.

#### Modificadores de Habilidad - VERIFICADO
Los modificadores de habilidad se calculan correctamente incluyendo competencia + pericia.

#### Botón "Descargar PDF (3 hojas)" - MOVIDO
- Quitado del creador de personajes
- Añadido a la página de "HOJA DE PERSONAJE"

#### Nombres de Caminos Actualizados
- **Gran Camino** - CD 8, ×1.5 vel
- **Camino Mayor** - CD 10, ×1.25 vel
- **Camino Menor** - CD 12, ×1.1 vel
- **Sendas** - CD 14, ×1 vel
- **Campo Abierto** - CD 15, ×1 vel

#### Sistema de Cálculo de PX - IMPLEMENTADO
Fórmula: `PX final = PX base × diferencia × terreno × peligrosidad`

---

## 📋 PRÓXIMAS TAREAS

### P1 - Próximo
- **Piezas móviles** en Editor de Terreno
- **Rellenado automático de agua** cerca de ríos/ciudades durante viaje
- **Opción "Evitar Caminos"** para huidas

### P2 - Medio plazo
- Control de acceso por roles (Maestro, Admin, Jugador)
- Refactorizar componentes grandes (EnhancedTravelSystem, MiddleEarthMap)

### Backlog
- Sistema completo de autenticación de usuarios
- Backup/restauración de base de datos
- Pantalla del DM e interfaz de juego online

---

## Cálculo de Velocidad (Sistema Métrico)
```
Dúnedain:       10m = 40 km/día
Elfos/Hombres:   9m = 36 km/día
Enanos/Hobbits:  7m = 28 km/día
Caballo:        18m = 72 km/día
```
