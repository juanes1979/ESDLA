# PLAN DE CORRECCIONES - LOTR 5e RPG

## PROBLEMAS IDENTIFICADOS

### 1. RASGOS DE PERSONALIDAD
- **Problema:** Solo muestra 1 rasgo, pero hay 2 por trasfondo
- **Solución:** Mostrar ambos rasgos del array `rasgos[]`

### 2. HISTORIA PERSONAL
- **Problema:** La historia debe venir del trasfondo, no ser input del usuario
- **Solución:** Mostrar la descripción del trasfondo como historia

### 3. HABILIDADES CON NÚMEROS
- **Problema:** No se muestra el listado de habilidades con bonificadores y competencias
- **Solución:** Calcular y mostrar todas las habilidades con sus modificadores

### 4. PERICIA EXPLORADOR
- **Problema:** Si selecciona Explorador, debe elegir 2 habilidades como pericia (x2 bonus)
- **Solución:** Agregar selección de pericia para Explorador (Fila 194-195 de Ocupaciones)

### 5. SELECCIÓN DE ARMAS/ARMADURAS
- **Problema:** No hace las preguntas correctas ni ofrece opciones A/B
- **Solución:** Implementar el sistema de preguntas con opciones según ocupación

## ESTRUCTURA DE OCUPACIONES (Hoja Excel)

| Columna | Ocupación |
|---------|-----------|
| B (2) | Buscador de tesoros |
| C (3) | Campeón |
| D (4) | Capitán |
| E (5) | Erudito |
| F (6) | Guardian |
| G (7) | Mensajero |

## PREGUNTAS POR PASO (según instrucciones del usuario)

### PASO OCUPACIÓN - Armaduras (Fila 60)
- **Pregunta:** "Durante tu preparación te has provisto de un pequeño equipo de protección. Elige el que más te convenga:"
- **Opción A:** Filas 61-64
- **Opción B:** Filas 65-70

### PASO OCUPACIÓN - Armas

#### Arma 1 (Fila 95)
- **Pregunta:** "Armas… siempre a punto para la aventura. Elige una de estas:"
- **Cantidad:** Fila 96
- **Opciones:** Filas 97-102

#### Arma 2 (Fila 104)
- **Pregunta:** "Que bonito es el reflejo de la luna en una buena espada…"
- **Cantidad:** Fila 105
- **Opciones:** Filas 106-107

#### Arma 3 (Fila 109)
- **Pregunta:** "Elige entre (A) un arco y un carcaj con 20 flechas o (B) X armas sencillas"
- **Opción A:** Filas 111-113 (arco, carcaj, flechas)
- **Cantidad B:** Fila 115
- **Opciones B:** Filas 116-121

### PASO OCUPACIÓN - Habilidades (Fila 44)
- **Pregunta:** "La ocupación elegida durante tu preparación, te ha otorgado unas habilidades..."
- **Cantidad a elegir:** Fila 45
- **Opciones:** Filas 46-57

### PASO OCUPACIÓN - Pericia Explorador (Fila 194)
- **Solo Buscador de tesoros (columna B)**
- **Cantidad:** 2 habilidades (Fila 195)
- **Opciones:** Filas 196-199+ (habilidades donde ya tiene competencia)

## IMPLEMENTACIÓN

### Fase 1: Corregir extractor de ocupaciones
- [ ] Extraer preguntas y opciones de armas
- [ ] Extraer preguntas y opciones de armaduras
- [ ] Extraer habilidades a elegir por ocupación
- [ ] Extraer pericia para Explorador

### Fase 2: Corregir Step3Occupation
- [ ] Mostrar habilidades disponibles a elegir
- [ ] Mostrar selección de armaduras (opción A/B)
- [ ] Mostrar selección de armas (preguntas secuenciales)
- [ ] Mostrar selección de pericia si es Explorador

### Fase 3: Corregir Step8Details
- [ ] Mostrar ambos rasgos de personalidad
- [ ] Mostrar historia del trasfondo (no input)

### Fase 4: Implementar PDF 3 páginas
- [ ] Página 1: Atributos, combate, habilidades, equipo
- [ ] Página 2: Puntos comunidad, rasgos, equipo tradicional
- [ ] Página 3: Historias y textos largos
