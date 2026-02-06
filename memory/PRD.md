# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Nuevas Secciones de Reglas
- **Sombra**: Pavor (4), Avaricia (4), Fechorías (5), Estados (3), Sendas de la Sombra (24 defectos)
- **Artes**: 8 artes con descripciones completas
- **Recompensas**: Mejoras de equipo (6), niveles de recompensa, bonificadores por competencia

### ✅ COMPLETED: Virtudes Completas
- 100 virtudes con toda la información
- Descripción, rasgos, aumentos de estadísticas
- Botón "Nueva Virtud" para admin

### ✅ COMPLETED: Monturas Actualizadas
- 15 monturas con todos los campos de la imagen del usuario
- Columnas: Nombre, Precio, Carga, Constitución, Velocidad, Pequeño (✓/-), Mediano (✓/-)
- Incluye: Burro, Caballo de caminos, Caballo de carga, Caballo de guerra, Caballo de Lothlórien, Caballo de monta, Caballo de Rohan, Caballo Variag, Camello, Elefante, Gran caballo de Rohan, Mastín, Poni, Poni de montaña, Poni robusto

### ✅ COMPLETED: Editor de Equipo
- Modal "Crear Equipo" con selector de 21 categorías
- Campos dinámicos según el tipo de equipo seleccionado
- Categorías: Armas (sencillas/marciales, CC/distancia), Armaduras (ligeras/medias/pesadas), Escudos, Equipo general, Herramientas, Juegos, Instrumentos, Consumibles, Comida en posadas, Hierbas, Venenos, Monturas, Accesorios, Transporte terrestre/marítimo, Construcción

### ✅ COMPLETED (Previous): Catálogo de Equipo Completo (21 categorías)
- Armas separadas por tipo (sencillas/marciales) y alcance (CC/distancia)
- Armaduras separadas por peso (ligeras/medias/pesadas)
- Hierbas y venenos con preparación y efectos

### ✅ COMPLETED (Previous): Step2Background funcional
- Sub-selección de instrumentos musicales y juegos

### ✅ COMPLETED (Previous): Sistema CRUD de Admin
- Razas, Culturas, Trasfondos, Ocupaciones

## 📋 PENDING TASKS

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Director de juego / Usuario)
   - Jerarquía: Maestro > Admin > Jugador

### P2 - Lower Priority
1. Refactorizar `Step1Culture.jsx` (1500+ líneas)

## 📋 FUTURE/BACKLOG TASKS

### Sistema de Usuarios (Documentado)
- **Maestro**: Admin absoluto
- **Admin**: Copia propia de BD (máx 100 fichas, 25 jugadores)
- **Jugador**: Solo sus personajes (máx 10 fichas)
- Panel de configuración con límites editables

### Otras funcionalidades
- Pantalla del Director de Juego
- Interfaz de juego online
- Integración IA

## Technical Stack
- **Backend:** FastAPI, Motor, MongoDB
- **Frontend:** React, Tailwind, Shadcn UI
- **PDF:** jsPDF, html2canvas

## Key Files
- `/app/backend/routes/data_routes.py` - Endpoints para sombra, artes, recompensas, virtudes, equipment CRUD
- `/app/backend/update_game_data.py` - Script de extracción de monturas, sombra, artes, recompensas
- `/app/frontend/src/pages/RulesPage.jsx` - Secciones de reglas completas
- `/app/frontend/src/components/admin/EquipmentEditor.jsx` - Modal de creación de equipo

## Key API Endpoints
- `GET /api/data/sombra` - Reglas de sombra (pavor, avaricia, fechorías, estados, sendas)
- `GET /api/data/artes` - Artes (8 items)
- `GET /api/data/recompensas` - Recompensas (mejoras, niveles, bonificadores)
- `GET /api/data/virtudes` - Virtudes completas (100 items)
- `GET /api/data/equipment-catalog` - Catálogo completo (21 categorías)
- `POST /api/data/equipment` - Crear nuevo equipo
- `GET /api/data/equipment-categories` - Metadatos de categorías

## Test Reports
- `/app/test_reports/iteration_15.json` - Todas las nuevas secciones (100% pass)
- `/app/test_reports/iteration_14.json` - Catálogo de equipo (100% pass)

## Session Changelog (2026-02-06)
1. Añadidas secciones: Sombra, Artes, Recompensas
2. Virtudes con información completa (descripción, rasgos, aumentos)
3. Monturas actualizadas con 15 items y columnas Pequeño/Mediano
4. Editor de equipo con 21 categorías y campos dinámicos
5. Endpoints CRUD para virtudes y equipo
6. Tests 100% passed (26 backend, todas las UI)

## Data Collections
- `sombra_rules` - Reglas de corrupción
- `artes` - 8 artes
- `recompensas` - Mejoras y bonificadores
- `virtues` - 100 virtudes
- `equipment_catalog` - 21 categorías de equipo
