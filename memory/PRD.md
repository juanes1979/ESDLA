# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: P0 - Editor de Ocupaciones Completo
Nuevo OccupationEditor con TODOS los campos:

**Limitaciones de selección:**
- **Características Principales**: Máximo 2 (contador X/2)
- **Tiradas de Salvación**: Máximo 2 (contador X/2)
- **Habilidades Favorecidas**: Máximo 3 (contador X/3)

**Senda de la Sombra:**
- Nombre de la senda (ej: "Atracción de los secretos")
- Descripción de la senda
- **4 Defectos obligatorios**: Nombre, descripción, efecto en el juego
- Los defectos se sincronizan a `sombra_rules` vía POST `/api/data/sombra/sendas`

**Equipo Inicial (múltiples bloques):**
- Herramientas/juegos/instrumentos a elegir + cantidad
- Habilidades con competencia a elegir + cantidad
- Herramienta fija (sin elegir)
- Herramientas a elegir + cantidad
- Armas disponibles a elegir + cantidad
- Armas a elegir + cantidad
- Opción A o B: Armaduras y Armas
- Opción A o B: Solo Armas
- Opción A o B: Armas + Escudo

**Caminos de la Profesión:**
- Nombre de especialidad (ej: "Especialidad de Explorador")
- Nivel de especialización (ej: nivel 3)
- 2 especialidades (ej: Saqueador y Espía)
- Cada especialidad: nombre, descripción, 3 características

**Niveles de Virtudes y Artes:**
- Niveles para virtudes (ej: "4, 6, 8")
- Descripción de virtudes
- Niveles para artes (ej: "6")
- Descripción de artes

### ✅ COMPLETED: P1 - Sub-selecciones en Step2Background
Cuando un trasfondo tiene como herramienta "Instrumento musical" o "Juegos":
- Se muestra un grid con opciones específicas
- **Instrumentos**: 10 opciones (Acordeón, Arpa, Clarinete, etc.)
- **Juegos**: 6 opciones (Bolos, Cartas de Barliman, Dados, etc.)
- UI mejorada con bordes de colores y título "Elige uno:"

### ✅ COMPLETED (Sesión anterior): Virtudes Completas
100 virtudes con elegir_caracteristica, elegir_salvacion, elegir_habilidad, elegir_herramienta

### ✅ COMPLETED (Sesión anterior): Catálogo de Equipo (21 categorías)
Monturas con capacidad_pequeno/capacidad_mediano

### ✅ COMPLETED (Sesión anterior): Sección de Sombra Completa
8 secciones: PAVOR, AVARICIA, FECHORÍAS, HECHICERÍA, FORTALECER LA VOLUNTAD, CÓMO SUCUMBIR, ESTADOS, SENDAS

## 📋 FUTURE/BACKLOG TASKS

### P1 - Medium Priority
1. **Virtue/Art Selection Levels in Character Creator**: 
   - El OccupationEditor captura a qué niveles puede elegir virtud/arte
   - Implementar esta lógica en el sistema de subida de nivel

### P2 - Low Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)
2. **Gestión de Base de Datos**
   - Backup y restore de datos del juego

### P3 - Future Tasks
- Pantalla del Director de Juego (DM Screen)
- Interfaz de juego online (mapas, chat, tiradas)
- Integración IA para generación de historias/NPCs

## Key Files
- `/app/backend/routes/data_routes.py` - Endpoints sombra, sombra/sendas, equipment-lists
- `/app/frontend/src/pages/RulesPage.jsx` - Página principal de reglas
- `/app/frontend/src/components/admin/OccupationEditor.jsx` - Editor completo de ocupaciones
- `/app/frontend/src/components/character-creator/steps/Step2Background.jsx` - Selección de trasfondo con sub-selecciones

## Key API Endpoints
- `GET /api/data/sombra` - Retorna 8 secciones de sombra
- `POST /api/data/sombra/sendas` - Guarda defectos de ocupación
- `GET /api/data/equipment-lists` - Retorna juegos (6) e instrumentos (10)
- `GET /api/data/equipment-catalog` - Retorna 21 categorías de equipo
- `POST /api/data/occupations` - Crear ocupación con todos los campos

## Test Reports
- `/app/test_reports/iteration_16.json` - Sombra + OccupationEditor initial (100% pass)
- `/app/test_reports/iteration_17.json` - P0 Equipment + P1 Sub-selections (100% pass)

## Session Changelog (2026-02-06)
1. Verificado OccupationEditor completo con todos los bloques de equipo
2. Mejorado Step2Background con sub-selecciones para instrumentos/juegos
3. Tests 100% - 13 backend + 18 frontend
