# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED This Session

#### P0: Level Up System & Refactorization
1. **Level Up Modal Enhancement**
   - LevelUpButton ahora visible en la ficha de personaje junto al nivel
   - Modal carga datos de ocupación desde la BD cuando no están en el personaje
   - Parsea `virtudes_texto` para determinar niveles de selección de virtudes/artes
   - Soporta campos `ocupacion` y `vocacion_nombre` para compatibilidad
   - Endpoint PATCH `/api/characters/{id}` para actualizar personaje al subir de nivel

2. **RulesPage Refactorization**
   - Creados 6 componentes separados en `/app/frontend/src/components/rules/`:
     - `SombraSection.jsx` - Pavor, Avaricia, Fechorías, Estados, Sendas
     - `CombateSection.jsx` - Estructura, Acciones, Atacar, Muerte
     - `SalariosSection.jsx` - 4 categorías de trabajadores
     - `VariosSection.jsx` - Pruebas, Ventaja, Cansancio, Inspiración, Ojo de Mordor
     - `ViajeSection.jsx` - Papeles, Secuencia, Fatiga, Duración, Acontecimientos
     - `ComunidadSection.jsx` - Fase de Comunidad, Yule, 10 Empresas
   - Index file para fácil importación: `/app/frontend/src/components/rules/index.js`
   - Mejora significativa en mantenibilidad del código

3. **Nueva Sección: Fase de Comunidad**
   - Introducción y límites narrativos
   - Estructura de 4 pasos (Duración, Destino, Recuperación espiritual, Empresas)
   - Yule con fórmula de PX adicionales
   - 10 Empresas: 7 ordinarias + 3 de Yule
   - Tabla de reducción de Sombra por impacto de acciones

#### Sesiones Anteriores (resumen)
- Generador de Viajes (`/travel`) - Completo con cálculo de fatiga, eventos, clima
- Secciones de reglas: Artes, Recompensas, Salarios, Combate, Reglas Varias
- OccupationEditor completo
- Sub-selecciones de instrumentos/juegos en trasfondos
- 100 Virtudes con campos de elección
- Catálogo de Equipo (21 categorías)
- Sistema de Sombra con eliminación de sendas

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **PDF Export for Travel Generator**
   - Exportar logs de viaje generados a PDF

### P2 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)
2. **Gestión de Base de Datos**
   - Backup y restore de datos del juego

### P3 - Future Tasks
- Pantalla del Director de Juego (DM Screen)
- Interfaz de juego online (mapas, chat, tiradas)
- Integración IA para generación de historias/NPCs

## Key API Endpoints
- `GET /api/data/artes` - 8 artes con descripciones completas
- `GET /api/data/recompensas` - mejoras, niveles_recompensa, bendiciones
- `GET /api/data/salarios` - 4 categorías de trabajadores + modificadores
- `GET /api/data/varios` - pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja
- `GET /api/data/combate` - estructura, acciones, atacar, muerte_e_inconsciencia
- `GET /api/data/comunidad` - introduccion, limites_narrativos, estructura, yule, empresas
- `GET /api/data/npcs` - Malignos, PNJ, Animales, Especiales (108 entradas)
- `DELETE /api/data/sombra/sendas/{senda_name}` - Eliminar senda (admin only)
- `PATCH /api/characters/{id}` - Actualizar personaje (level up, etc.)

## Key Files
- `/app/backend/routes/data_routes.py` - Todos los endpoints de datos
- `/app/backend/routes/character_routes.py` - Endpoints de personajes (incluye PATCH)
- `/app/frontend/src/pages/RulesPage.jsx` - Página principal con 13 categorías
- `/app/frontend/src/components/rules/` - Componentes refactorizados (5 secciones)
- `/app/frontend/src/components/LevelUpModal.jsx` - Modal de subida de nivel
- `/app/backend/update_rules_data.py` - Script de actualización de datos

## Test Reports
- `/app/test_reports/iteration_17.json` - P0/P1 completion (100% pass)
- `/app/test_reports/iteration_18.json` - New rules features (100% pass - 28 backend + 17 frontend tests)
- `/app/test_reports/iteration_19.json` - Level Up System & Refactorization (100% pass)

## Session Changelog (2026-02-06 - Latest)
1. Implementado sistema de Level Up completo con LevelUpButton en ficha de personaje
2. LevelUpModal carga datos de ocupación desde BD cuando no están en personaje
3. Refactorizada RulesPage.jsx en 7 componentes separados
4. Corregido bug en VariosSection.jsx (estructura de datos API)
5. Agregado endpoint PATCH /api/characters/{id} para actualizaciones
6. **NUEVA SECCIÓN: Fase de Comunidad** con estructura, Yule y 10 empresas
7. **MEJORA: Generador de Viajes**
   - Origen y Destino ahora son dropdowns separados (no rutas cerradas)
   - Papeles de viaje ahora seleccionan personajes de la BD
   - **NUEVO: Muestra bonificadores de habilidad** (+2, SAB +2) al seleccionar personajes
   - Sistema métrico en lugar de imperial (velocidad en metros)
   - Detección automática de rutas conocidas
8. **NUEVO: Bestiario** - 108 NPCs cargados desde Excel
   - 20 Malignos (Orcos, Trolls, Nazgûl...)
   - 9 PNJ (Personajes no jugadores)
   - 64 Animales (Águilas, Caballos, Lobos...)
   - 15 Especiales (Espectros, Drakes...)
   - Vista expandible con stats completos, atributos, sentidos, habilidades especiales y acciones
9. Tests 100% - Todas las secciones refactorizadas funcionando

## Database Collections
- `artes` - 8 documentos
- `recompensas` - 1 documento (mejoras, bendiciones)
- `salarios` - 1 documento (categorias, modificadores)
- `varios_rules` - 1 documento (pruebas_habilidad, cansancio, inspiracion, ojo_de_mordor, ventaja)
- `combate_rules` - 1 documento (estructura, acciones, atacar, muerte_e_inconsciencia)
