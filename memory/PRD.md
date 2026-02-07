# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2025-12-19)

### ✅ COMPLETED This Session

#### P0: Trasfondos Reorganizados por Raza/Cultura
- Nuevo endpoint `GET /api/data/backgrounds/grouped/by-race` agrupa 114 trasfondos
- Componente `BackgroundsSection.jsx` con tabs por raza:
  - Elfos: 5 culturas, 30 trasfondos
  - Enanos: 4 culturas, 24 trasfondos
  - Hobbits: 3 culturas, 18 trasfondos
  - Hombres: 7 culturas, 42 trasfondos
- Culturas colapsables dentro de cada tab
- Trasfondos expandibles con competencias, herramientas y rasgos

#### P1: Sistema de Recompensas de Equipamiento
- Datos completos extraídos del PDF `Recompensas.pdf`
- Endpoint actualizado `GET /api/data/recompensas` con:
  - `info_general`: Reglas de cuándo elegir, aplicación, interpretación, inmunidad argumental, préstamo
  - `niveles_recompensa`: Niveles 3, 5, 7, 9 con descripciones
  - `mejoras`: 6 mejoras detalladas (AFILADA, AJUSTADA, CRUEL, DOLOROSA, HÁBILMENTE FABRICADA, REFORZADO)
  - `bendiciones`: Descripción y tabla de dados por nivel
  - `armas_con_nombre`: Tradiciones por cultura (Elfos, Hombres, Dúnedain, Hobbits, Enanos)
- UI actualizada con cards detalladas mostrando efectos, restricciones y reglas de "El Anillo Único"

#### P1: Sistema de Ubicaciones del Mapa
- Creada colección `locations` con 37 ubicaciones de la Tierra Media
- Ubicaciones organizadas por región:
  - Eriador: 8 (La Comarca, Bree, Rivendel, Puertos Grises, etc.)
  - Rhovanion: 5 (Erebor, Valle, Esgaroth, etc.)
  - Gondor: 5 (Minas Tirith, Osgiliath, Dol Amroth, etc.)
  - Rohan: 3 (Edoras, Abismo de Helm, Fangorn)
  - Mordor: 3 (Barad-dûr, Monte del Destino, Morannon)
  - Y más regiones...
- Endpoints:
  - `GET /api/data/locations` - Lista completa con filtros
  - `GET /api/data/locations/for-travel` - Agrupado para generador de viajes
  - `GET /api/data/locations/regions` - Lista de regiones
  - CRUD completo (POST, PUT, DELETE)
- Cada ubicación tiene: nombre, nombre_sindarin, región, tipo, coordenadas x/y, peligro, refugio

### Sesiones Anteriores (resumen)
- Sistema completo de NPCs/Bestiario (71 NPCs)
- Generador de Viajes (`/travel`)
- Sistema de Level Up con modal
- Secciones de reglas: Fase de Comunidad, Artes, Criaturas sin Nombre
- Creador de personajes con ficha PDF
- 100 Virtudes, Catálogo de Equipo

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Integrar ubicaciones en el Generador de Viajes** - Usar el endpoint `/locations/for-travel` para los dropdowns
2. **Añadir más ubicaciones del mapa** - El usuario proporcionará imágenes de mapas para extraer más lugares

### P2 - Medium Priority
1. **PDF Export for Travel Generator**
2. **Sistema de Autenticación** (Maestro > Admin > Jugador)
3. **Backup/Restore de base de datos**

### P3 - Future Tasks
- Pantalla del DM
- Interfaz de juego online
- **Integración IA para historias de NPCs**
- Refactorización completa de RulesPage.jsx

## Key Files
- `/app/backend/routes/data_routes.py` - Endpoints CRUD de backgrounds, recompensas, locations
- `/app/backend/create_locations.py` - Script de carga inicial de ubicaciones
- `/app/backend/update_recompensas.py` - Script de actualización de recompensas
- `/app/frontend/src/components/rules/BackgroundsSection.jsx` - Nuevo componente con tabs
- `/app/frontend/src/pages/RulesPage.jsx` - renderRecompensas actualizado

## Testing
- `/app/test_reports/iteration_21.json` - 100% pass rate (29/29 backend, all frontend)
- Bug arreglado: rasgos_descripciones ahora maneja strings y objetos

## Database Collections
- `locations`: 37 documentos con coordenadas x/y para mapa
- `recompensas`: Documento único con mejoras, niveles, bendiciones, armas_con_nombre
- `backgrounds`: 114 documentos agrupables por raza/cultura
