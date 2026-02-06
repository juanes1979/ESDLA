# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Catálogo de Equipo Completo (21 categorías)
Extraído del Excel `utumno.xlsm` y organizado en 7 secciones:

**⚔️ Armas** (separadas por tipo)
- Armas Sencillas Cuerpo a Cuerpo (8 items)
- Armas Sencillas a Distancia (5 items)
- Armas Marciales Cuerpo a Cuerpo (14 items)
- Armas Marciales a Distancia (2 items)

**🛡️ Armaduras** (por peso)
- Armaduras Ligeras (2), Medias (2), Pesadas (3), Escudos (1)

**🎒 Equipo y Herramientas**
- Equipo General (108), Herramientas (19), Juegos (6), Instrumentos Musicales (10)

**🍖 Consumibles y Alimentación**
- Consumibles (71), Comida en Posadas (36)

**🌿 Hierbas y Venenos**
- Hierbas Medicinales y Pociones (87), Venenos (15)
- Incluyen: preparación y efectos

**🐴 Monturas y Transporte**
- Monturas (8), Accesorios (9), Transporte Terrestre (10), Transporte Marítimo (10)

**🏗️ Elementos de Construcción** (52 items)

### ✅ COMPLETED: Step2Background funcional
- Filtra trasfondos por cultura
- Sub-selección de instrumentos musicales cuando el trasfondo otorga esa competencia
- Sub-selección de juegos cuando corresponde
- Endpoint `/api/data/equipment-lists` devuelve listas de juegos e instrumentos

### ✅ COMPLETED (Previous): Virtud en Hoja de Personaje (Página 3)
- Campo "★ VIRTUD: {nombre}" y rasgos

### ✅ COMPLETED (Previous): Sistema CRUD de Admin
- Razas, Culturas, Trasfondos, Ocupaciones

### ✅ COMPLETED (Previous): Generación de PDF
- Botón "Descargar PDF" - 3 páginas

## 📋 PENDING TASKS

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Director de juego / Usuario)
   - Admin credentials: Maestro / 123456

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
- `/app/backend/routes/data_routes.py` - equipment-catalog endpoint (21 categorías)
- `/app/backend/update_equipment_catalog.py` - Script de extracción de datos
- `/app/frontend/src/pages/RulesPage.jsx` - Visualización del catálogo de equipo
- `/app/frontend/src/components/character-creator/steps/Step2Background.jsx` - Selección de trasfondo
- `/app/frontend/src/components/character-sheet/SheetPage3.jsx` - Virtud mostrada

## Key API Endpoints
- `GET /api/data/equipment-catalog` - Catálogo completo (21 categorías)
- `GET /api/data/equipment-lists` - Listas de juegos e instrumentos
- `GET /api/data/backgrounds?cultura={name}` - Trasfondos filtrados por cultura
- `GET /api/data/cultures/{culture_id}/virtues`
- `PATCH /api/draft/{draft_id}/step2`

## Test Reports
- `/app/test_reports/iteration_14.json` - Catálogo de equipo (100% pass)
- `/app/test_reports/iteration_13.json` - Virtud en hoja (100% pass)

## Session Changelog (2026-02-06)
1. Extraídas 21 categorías del Excel a MongoDB (update_equipment_catalog.py)
2. Actualizado endpoint equipment-catalog para devolver todas las categorías
3. Corregido endpoint equipment-lists (faltaba función)
4. Frontend RulesPage actualizado con 7 secciones organizadas
5. Step2Background verificado funcional con sub-selección de instrumentos/juegos
6. Tests 100% passed (backend y frontend)
