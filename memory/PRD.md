# LOTR 5e RPG - Product Requirements Document

## Current State (2025-12-20)

### ✅ COMPLETED This Session

#### Tienda de Equipo en Creador de Personajes - COMPLETADO (2025-12-20)

**Funcionalidad implementada en Step7Equipment.jsx:**

1. **Tienda Integrada en Paso 5 (Equipo)**
   - Botón "Comprar Equipo" abre/cierra la tienda
   - Usa precios base sin modificadores de región
   - Se accede desde el creador de personajes

2. **11 Categorías de Equipo (717 items totales):**
   - **Armas (29):** Sencillas CC, Sencillas Distancia, Marciales CC, Marciales Distancia
   - **Armaduras (8):** Ligeras, Medias, Pesadas, Escudos  
   - **Herramientas (35):** Herramientas, Juegos, Instrumentos musicales
   - **General (108):** Equipo general
   - **Comida (107):** Consumibles, Comida/Posadas
   - **Monturas (24):** Monturas, Accesorios de monturas
   - **Transporte (20):** Terrestre, Marítimo
   - **Hierbas (87):** Hierbas medicinales y especiales
   - **Venenos (15):** Venenos y toxinas
   - **Gemas (232):** Preciosas, Semipreciosas
   - **Construcción (52):** Materiales de construcción

3. **UI de 2 Filas de Categorías:**
   - Fila 1: Armas, Armaduras, Herramientas, General, Comida, Monturas
   - Fila 2: Transporte, Hierbas, Venenos, Gemas, Construcción

3. **Buscador de Items:**
   - Campo de búsqueda con filtrado en tiempo real
   - Filtra por nombre y categoría

4. **Sistema de Carrito:**
   - Añadir/quitar items con botones +/-
   - Badge muestra cantidad de cada item
   - Resumen del carrito con precio total
   - Toast de confirmación al añadir

5. **Balance de Dinero:**
   - Dinero inicial = Nivel de Vida + Ocupación
   - Sistema de conversión: 10 me = 1 mc, 10 mc = 1 mp, 100 mp = 1 mo
   - Balance actualizado en tiempo real
   - Items deshabilitados si no hay suficiente dinero

6. **Persistencia:**
   - Equipo comprado se guarda con el borrador del personaje
   - Se incluye en el inventario final al finalizar creación

**Endpoint usado:** `/api/data/equipment-catalog` (precios base)

**Testing:** Backend 100% verificado. Frontend código verificado.

**Archivos modificados:**
- `/app/frontend/src/components/character-creator/steps/Step7Equipment.jsx`

---

#### Sistema de Tesoros - Mejoras Completadas

**1. Multiplicadores de Manufactura Corregidos:**
| Manufactura | Multiplicador |
|-------------|---------------|
| Númenóreana (Oesternesse) | ×5 |
| Élfica (Eregion) | ×4 |
| Élfica (Beleriand) | ×6 |
| Enana (Khazad-dûm) | ×3 |
| Enana (Erebor) | ×3 |
| Enana (Nogrod/Belegost) | ×4 |

**2. Generador de Nombres:**
- Botón con icono de varita (Wand2) junto al campo nombre
- Genera nombres según manufactura usando prefijos/raíces/sufijos culturales
- Estructura: 1-3 en d6 = prefijo+sufijo, 4-6 = prefijo+raíz+sufijo
- 5% probabilidad de doble prefijo
- Ejemplos: "Khazdurgundar" (enano), "Celebrondil" (élfico), "Arangaldor" (númenóreano)

**3. Cualidades Encantadas con Descripciones:**
- Armas: Afilada, Aplastante, Cruel, Dolorosa, Rasgadora, Cruel Mayor, Dolorosa Mayor, Exterminadora, Afilada Mayor, Dardo Hiriente, Luminiscencia, Arma Rúnica, Llama de Esperanza, Resplandor de Terror, Trayectoria Recta, Acero Hueco
- Armaduras: Ajustada, Hábilmente Fabricada, Armadura Rúnica, Ajustada por los Antiguos, Hábilmente Fabricada por los Antiguos, Armadura de Mithril
- Escudos: Reforzado, Escudo Rúnico, Reforzado Mayor (Enano/Élfico/Númenóreano)
- Cada cualidad muestra su descripción al seleccionarla

**4. Fórmula de Cálculo de Precio:**
```
Precio = (Precio Base × Multiplicador Manufactura × Multiplicadores Cualidades) + Coste Perdiciones
Ejemplo: Espada larga (20 mp) × Enana Khazad-dûm (×3) × Aplastante (×4) = 240 mp
```

**Archivos modificados:**
- `/app/frontend/src/components/rules/sections/TreasureSystemSection.jsx`

**Testing:** 100% - Todas las funcionalidades verificadas

---

## Previous State (2025-12-20)

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

#### 4. Armas y Armaduras Famosas - COMPLETADO

Sistema completo para crear armas legendarias con cualidades encantadas:

**Manufacturas (6 tipos):**
- Númenóreana (Oesternesse) - 2 perdiciones, ×1.1 precio
- Élfica (Eregion) - 1 perdición, ×1.05 precio
- Élfica (Beleriand) - 1 perdición, ×1.1 precio
- Enana (Khazad-dûm) - cualidades rúnicas, ×1.1 precio
- Enana (Erebor/Beleriand) - cualidades rúnicas, ×1.0 precio

**Perdiciones (Banes):**
- **Élficas:** Destroza orcos (+3 mo), Perseguidora de lobos (+2 mo), Destripa arañas (+4 mo), Exterminadora de todos (+5 mo)
- **Númenóreanas:** Letal contra orcos (+3 mo), Exterminadora de troles (+4 mo), Cazadora de lobos (+2 mo), Pesadilla de hombres malignos (+3 mo), Rompe espíritus impuros (+4 mo), Exterminadora de todos (+5 mo)

**23 Cualidades de Arma:** Afilada, Aplastante, Cruel, Dolorosa, Rasgadora, Afilada Mayor, Cruel Mayor, Dolorosa Mayor, Exterminadora de Enemigos, Arma Rúnica, Dardo Hiriente, Luminiscencia, Llama de Esperanza, Resplandor de Terror, Trayectoria Recta, Acero Hueco, etc.

**6 Cualidades de Armadura:** Ajustada (+320 mp), Hábilmente Fabricada (+320 mp), Armadura Rúnica (+400 mp), Ajustada por los Antiguos (+600 mp), Hábilmente Fabricada por los Antiguos (+1200 mp), Armadura de Mithril (+30 mp)

**5 Cualidades de Escudo:** Reforzado (×300%), Rúnico (×360%), Reforzado Mayor enano (×900%), Reforzado Mayor élfico (×750%), Reforzado Mayor númenóreano (×850%)

**Latencia por Nivel:** 
- Nivel 1-4: 1 cualidad visible
- Nivel 5-8: 2 cualidades visibles
- Nivel 9+: 3 cualidades visibles

#### 5. Índice de Tesoros del DM - COMPLETADO

Sistema para pre-crear objetos mágicos específicos para la campaña:
- CRUD completo (crear, ver, eliminar)
- Persistencia en MongoDB vía `/api/data/treasure-index`
- 50% probabilidad de aparecer cuando se genera "Arma/Armadura Famosa" en el generador
- Muestra nombre, tipo, manufactura, cualidades, perdiciones, precio e historia

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
- **Control de acceso por roles** - Restringir "Mapa del Maestro" y páginas de editor a Admin/Maestro
- **Rellenado automático de agua** cerca de ríos/ciudades durante viaje
- **Opción "Evitar Caminos"** para huidas

### P2 - Medio plazo
- Sistema completo de autenticación de usuarios (Maestro, Admin, Jugador)
- Refactorizar componentes grandes (EnhancedTravelSystem, MiddleEarthMap, TreasureSystemSection)
- Mejorar lógica de pathfinding en debugger

### Backlog / Tareas Futuras
- **Piezas móviles** en Editor de Terreno (pendiente definir requisitos)
- Backup/restauración de base de datos
- Pantalla del DM e interfaz de juego online
- Ajustar sensibilidad del zoom con rueda en Master Map

---

## Cálculo de Velocidad (Sistema Métrico)
```
Dúnedain:       10m = 40 km/día
Elfos/Hombres:   9m = 36 km/día
Enanos/Hobbits:  7m = 28 km/día
Caballo:        18m = 72 km/día
```
