# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Sección de Sombra Completa
Añadidas las secciones que faltaban de la hoja "Sombra":
- **🔮 HECHICERÍA** (filas 33-35): Se reciben puntos de sombra cuando un servidor maligno tiene conocimientos de magia oscura...
- **💪 FORTALECER LA VOLUNTAD** (filas 37-40): Antes de que la sombra llegue a los puntos de sabiduría, puede elegirse recibir una cicatriz...
- **☠️ CÓMO SUCUMBIR ANTE LA SOMBRA** (fila 59): La siguiente vez que su puntuación de Sombra alcanza la de su Sabiduría, no quedan angustiados, sino que se les retira del juego.

### ✅ COMPLETED: Editor de Ocupaciones Completo
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

### ✅ COMPLETED (Sesión anterior): Virtudes Completas
100 virtudes con elegir_caracteristica, elegir_salvacion, elegir_habilidad, elegir_herramienta

### ✅ COMPLETED (Sesión anterior): Catálogo de Equipo (21 categorías)
Monturas con capacidad_pequeno/capacidad_mediano

## 📋 PENDING TASKS

### P0 - Pendientes del Editor de Ocupaciones
1. **Bloques adicionales de equipo** (mencionados por usuario):
   - Opción A o B (armaduras/armas)
   - Armas disponibles + número a elegir
   - Opción A o B con armas en B
   - Opción A (armas + escudo) o B (2 bloques de armas)

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)

## 📋 FUTURE/BACKLOG TASKS
- Pantalla del Director de Juego
- Interfaz de juego online
- Integración IA

## Key Files
- `/app/backend/routes/data_routes.py` - Endpoints sombra, sombra/sendas
- `/app/frontend/src/pages/RulesPage.jsx` - renderSombra con 8 secciones
- `/app/frontend/src/components/admin/OccupationEditor.jsx` - Editor completo

## Key API Endpoints
- `GET /api/data/sombra` - Retorna 8 secciones: pavor, avaricia, fechorias, estados, sendas_sombra, hechiceria, fortalecer_voluntad, como_sucumbir
- `POST /api/data/sombra/sendas` - Guarda defectos de ocupación en sombra_rules
- `POST /api/data/occupations` - Crear ocupación con todos los campos

## Test Reports
- `/app/test_reports/iteration_16.json` - Sombra + OccupationEditor (100% pass)

## Session Changelog (2026-02-06)
1. Añadidas secciones Hechicería, Fortalecer voluntad, Cómo sucumbir a Sombra
2. Creado OccupationEditor completo con validaciones (max 2/2/3)
3. Senda de sombra con 4 defectos obligatorios
4. Caminos de profesión con 2 especialidades
5. Sincronización de defectos a sombra_rules
6. Bug fixed: OccupationEditor maneja ocupaciones existentes sin arrays
7. Tests 100% (16 backend + 11 frontend)
