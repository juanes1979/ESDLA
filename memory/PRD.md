# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2025-12-19)

### ✅ COMPLETED This Session

#### P0: Sistema Completo de NPCs/Bestiario

**1. Nuevo Modelo de Datos Estructurado para NPCs**
- Separación de `especiales` como lista de objetos `{nombre, descripcion}`
- `armas` estructuradas con `{nombre, tipo, bonificador_impacto, alcance_metros, dano, tipo_dano, efecto}`
- `acciones` y `reacciones` como listas estructuradas
- Soporte para resistencias, inmunidades_dano, inmunidades_estados, vulnerabilidades
- Campo `historia` preparado para IA futura

**2. Extracción de Datos de PDFs y Excel**
- Procesados 4 PDFs de adversarios (Adversarios.pdf, elfos, moria, gusano)
- Procesado nuevo PDF "Adversarios Bosque Negro" - Convertido de formato "The One Ring" a 5e
- Procesado Excel `pnj.xlsx` para PNJ y animales

**3. Total de NPCs en Base de Datos: 71**
| Categoría | Cantidad | Descripción |
|-----------|----------|-------------|
| Malignos | 29 | Orcos, trolls, espectros, humanos malignos, arañas, trasgos |
| PNJ | 9 | Frontero, Guardia, Cazador, Jinete de Rohan, Montaraz, etc. |
| Animales | 18 | Lobo, Caballo, Huargo, Oso, Águila, Araña gigante, etc. |
| Especiales | 15 | Balrog, Nazgûl, Vástagos de Ella-Laraña, Smaug, Ent, etc. |

**4. Criaturas del Bosque Negro (Convertidas a 5e)**
- Lugarteniente de Dol Guldur - CA 15, 95 PG, Desafío 5
- Fantasma del Bosque - CA 14, 78 PG, Desafío 4
- Mensajero de Mordor - CA 14, 78 PG, Desafío 4
- Araña Cazadora - CA 14, 39 PG, Desafío 2
- Espectro del Bosque - CA 15, 54 PG, Desafío 3
- Trasgo del Bosque - CA 13, 10 PG, Desafío 1/4
- Sarqin, la Madre de Todas - CA 16, 150 PG, Desafío 10
- Tauler el Cazador - CA 17, 95 PG, Desafío 7
- Tyulqin la Tejedora - CA 16, 95 PG, Desafío 8

**5. Endpoints CRUD Completos**
- `GET /api/data/npcs` - Listado agrupado por categoría con búsqueda
- `POST /api/data/npcs` - Crear nuevo NPC
- `PATCH /api/data/npcs/{id}` - Actualizar NPC
- `DELETE /api/data/npcs/{id}` - Eliminar NPC
- `POST /api/data/npcs/{id}/copy` - Copiar NPC

**6. Editor Visual de NPCs (NPCEditor.jsx)**
- Modal con 7 pestañas: Básico, Atributos, Defensa, Especiales, Armas, Acciones, Historia

### Sesiones Anteriores (resumen)
- Generador de Viajes (`/travel`) - Completo
- Sistema de Level Up con modal
- Secciones de reglas: Fase de Comunidad, Artes, Recompensas, etc.
- Creador de personajes con ficha PDF
- 100 Virtudes, Catálogo de Equipo

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **PDF Export for Travel Generator**
2. **Más animales** (faltan muchos del Excel original)

### P2 - Medium Priority
1. **Sistema de Autenticación** (Maestro > Admin > Jugador)
2. **Backup/Restore de base de datos**

### P3 - Future Tasks
- Pantalla del DM
- Interfaz de juego online
- **Integración IA para historias de NPCs**
- Limpieza de código obsoleto

## Key Files
- `/app/backend/routes/data_routes.py` - Endpoints CRUD de NPCs
- `/app/backend/load_npcs_v2.py` - Script original de NPCs (30 criaturas de PDFs)
- `/app/backend/load_npcs_new.py` - Script con PNJ, Animales, Bosque Negro (41 criaturas)
- `/app/frontend/src/components/rules/NPCsSection.jsx` - Vista del bestiario
- `/app/frontend/src/components/rules/NPCEditor.jsx` - Editor visual de NPCs

## Testing
- `/app/test_reports/iteration_20.json` - 100% pass rate
