# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED This Session

#### Nuevas Secciones de Reglas
1. **Artes** - 8 artes con descripciones completas extraídas del Excel
   - Arte de la fabricación, medicina, oratoria, runas, bosques, armas, bestias, canciones
   - Descripciones formateadas con párrafos y listas

2. **Recompensas** - Sistema completo
   - Mejoras de Equipo: 6 mejoras (Afilada, Cruel, Dolorosa, Ajustada, Hábilmente fabricada, Reforzado)
   - Niveles de Recompensa: Nivel 3, 5, 7, 9
   - **Bendiciones**: Descripción completa + tabla de dados por nivel (1d4 a 1d12)

3. **Salarios** - Nueva sección completa
   - 4 categorías de trabajadores (No cualificados, Cualificados, Nobles/Guerreros, Razas Especiales)
   - Columnas: Ocupación, Modificador, Salario Bajo/Medio/Alto, Diario, Notas
   - Modificadores: Por región, asentamiento, relación, contexto histórico

4. **Reglas Varias** - Nueva sección
   - **Pruebas de Habilidad**: Habilidades por característica + Tabla de dificultad (CD 5-30)
   - **Ventaja/Desventaja**: +5/-5 con visual verde/rojo
   - **Cansancio**: 6 niveles con consecuencias
   - **Inspiración**: Cómo obtener y usar
   - **Ojo de Mordor**: Puntuación inicial, durante juego, La Caza
   - **Más Allá del Nivel 10**: Límite de nivel

5. **Combate** - Nueva sección
   - Estructura: 4 fases (Posiciones, Sorpresa, Iniciativa, Turnos)
   - Acciones: 10 acciones disponibles
   - Atacar: 5 pasos + críticos (20/1)
   - Muerte e Inconsciencia: Tiradas de salvación, estabilizar

6. **Sombra** - Mejoras
   - Admin (Maestro) puede eliminar sendas de sombra
   - Botón de eliminar visible junto a cada senda

### ✅ COMPLETED (Sesiones anteriores)
- P0: OccupationEditor.jsx completo con todos los bloques de equipo
- P1: Sub-selecciones de instrumentos/juegos en Step2Background
- 100 Virtudes con campos de elección
- Catálogo de Equipo (21 categorías)
- Sección de Sombra con 8 subsecciones

## 📋 UPCOMING TASKS

### P1 - Medium Priority
1. **Virtue/Art Selection Levels in Character Creator**: 
   - Implementar selección de virtud/arte por nivel en sistema de subida de nivel

### P2 - Low Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)
2. **Gestión de Base de Datos**
   - Backup y restore de datos del juego

### P3 - Future Tasks
- Pantalla del Director de Juego (DM Screen)
- Interfaz de juego online (mapas, chat, tiradas)
- Integración IA para generación de historias/NPCs

## Key API Endpoints (NEW)
- `GET /api/data/artes` - 8 artes con descripciones completas
- `GET /api/data/recompensas` - mejoras, niveles_recompensa, bendiciones
- `GET /api/data/salarios` - 4 categorías de trabajadores + modificadores
- `GET /api/data/varios` - pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja
- `GET /api/data/combate` - estructura, acciones, atacar, muerte_e_inconsciencia
- `DELETE /api/data/sombra/sendas/{senda_name}` - Eliminar senda (admin only)

## Key Files
- `/app/backend/routes/data_routes.py` - Todos los endpoints de datos
- `/app/frontend/src/pages/RulesPage.jsx` - Página principal con 13 categorías
- `/app/backend/update_rules_data.py` - Script de actualización de datos

## Test Reports
- `/app/test_reports/iteration_17.json` - P0/P1 completion (100% pass)
- `/app/test_reports/iteration_18.json` - New rules features (100% pass - 28 backend + 17 frontend tests)

## Session Changelog (2026-02-06)
1. Agregados endpoints: salarios, varios, combate
2. Actualizados endpoints: artes (descripciones completas), recompensas (bendiciones)
3. Agregada funcionalidad DELETE para sendas de sombra
4. Nuevas categorías en frontend: Combate, Salarios, Reglas Varias
5. Tests 100% - 28 backend + 17 frontend

## Database Collections
- `artes` - 8 documentos
- `recompensas` - 1 documento (mejoras, bendiciones)
- `salarios` - 1 documento (categorias, modificadores)
- `varios_rules` - 1 documento (pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja)
- `combate_rules` - 1 documento (estructura, acciones, atacar, muerte_e_inconsciencia)
