# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Virtud Mostrada en Hoja de Personaje (Página 3)
- Nuevo campo **"★ VIRTUD: {nombre}"** en coordenadas (723, 375)
- Nuevo campo **rasgos de virtud** en coordenadas (1150, 375) con multiline
- Renderizado condicional: solo aparece si `character.virtud_nombre` existe
- Posicionado debajo de la descripción corta de ocupación

### ✅ COMPLETED: Selector de Competencia Adicional
- 4 categorías: Herramientas, Juegos, Instrumentos musicales, Pipa
- "Pipa" confirmación directa sin segundo selector
- "Pipa" añadida a lista de herramientas

### ✅ COMPLETED: Selección de Virtud en Creador de Personajes
- Step5Virtue usa `tiene_virtud_inicial` del draft
- Usa endpoint `/api/data/cultures/{id}/virtues`
- Guarda 12 campos de datos de virtud

### ✅ COMPLETED (Previous): Editor de Culturas Ampliado
- Sección "Trasfondos de la Cultura"
- Sección "Configuración de Virtudes"

### ✅ COMPLETED (Previous): Sistema CRUD de Admin
- Razas, Culturas, Trasfondos, Ocupaciones
- Usuario Admin "Maestro" activo por defecto

### ✅ COMPLETED (Previous): Generación de PDF
- Botón "Descargar PDF" - 3 páginas

## 📋 PENDING TASKS

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Director de juego / Usuario)
   - Admin credentials: Maestro / 123456

2. **Completar Paso 2 (Trasfondo)** del creador
3. **Sub-selecciones** cuando se elige Instrumentos o Juegos en el creador

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
- `/app/frontend/src/components/character-sheet/SheetPage3.jsx` - Virtud mostrada
- `/app/frontend/src/components/character-creator/steps/Step5Virtue.jsx` - Selección de virtud
- `/app/frontend/src/components/admin/CultureEditor.jsx` - Selector competencia adicional

## Key API Endpoints
- `GET /api/data/cultures/{culture_id}/virtues`
- `PATCH /api/draft/{draft_id}/step5`

## Test Reports
- `/app/test_reports/iteration_13.json` - Virtud en hoja (100% pass)

## Session Changelog (2026-02-06)
1. Añadida virtud a página 3 de hoja de personaje (nombre y rasgos)
2. Renderizado condicional (solo muestra si virtud_nombre existe)
3. Tests 100% passed
