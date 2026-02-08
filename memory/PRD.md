# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game.

**User's preferred language**: Español

## Current State (2025-12-19)

### ✅ COMPLETED This Session

#### P0: Trasfondos Reorganizados por Raza/Cultura
- Nuevo endpoint `GET /api/data/backgrounds/grouped/by-race` 
- Componente `BackgroundsSection.jsx` con tabs por raza (Elfos, Enanos, Hobbits, Hombres)
- 114 trasfondos organizados en culturas colapsables

#### P1: Sistema de Recompensas de Equipamiento
- Datos completos extraídos del PDF `Recompensas.pdf`
- 6 mejoras detalladas con efectos, restricciones y reglas de "El Anillo Único"
- Información de bendiciones, niveles de recompensa, y tradiciones de armas con nombre

#### P1: Sistema de Ubicaciones del Mapa - COMPLETO 🗺️
**182 ubicaciones de la Tierra Media cargadas desde 4 mapas:**

| Mapa | Ubicaciones |
|------|-------------|
| Gondor/Rohan | 60 |
| Mordor | 28 |
| Eriador | 49 |
| Rhovanion | 28 |

**Por Región:**
- Eriador: 50 (La Comarca, Bree, Rivendel, Moria, Angmar...)
- Rhovanion: 33 (Erebor, Valle, Bosque Negro, Lothlórien...)
- Gondor: 32 (Minas Tirith, Osgiliath, Dol Amroth...)
- Mordor: 25 (Barad-dûr, Orodruin, Minas Morgul...)
- Rohan: 15 (Edoras, Helm's Deep, Isengard...)

**Por Tipo de Terreno:**
- Fácil: 52
- Moderado: 37
- Difícil: 35
- Muy Difícil: 18
- Infranqueable: 12
- Desalentador: 11

**Por Tipo de Tierra:**
- 🟢 Tierras Libres: 65
- 🟠 Tierras Salvajes: 36
- 🟡 Fronterizas: 28
- 🔴 Tierras de Sombra: 19
- ⚫ Tierras Oscuras: 17

**Escala:** 1 hexágono = 4 millas = 6.4 km

#### P1: Integración de Ubicaciones en el Generador de Viajes ✅
- Endpoint `GET /api/data/locations/calculate-route/{origin}/{dest}` calcula:
  - Distancia en km, millas y hexágonos
  - Días de viaje estimados
  - Terreno y tipo de tierra
  - Nivel de peligro
  - Dirección cardinal
- Frontend actualizado con:
  - Selectores de ubicación agrupados por región
  - Cálculo automático de ruta al seleccionar origen/destino
  - Panel de información con distancia, días, peligro, terreno
  - Indicadores de refugio y nombres sindarin

## Key Files Modified This Session
- `/app/backend/routes/data_routes.py` - Endpoints de backgrounds, recompensas, locations, calculate-route
- `/app/backend/load_gondor_locations.py` - Carga mapa Gondor/Rohan (60 locs)
- `/app/backend/load_mordor_locations.py` - Carga mapa Mordor (28 locs)
- `/app/backend/load_eriador_locations.py` - Carga mapa Eriador (49 locs)
- `/app/backend/load_rhovanion_locations.py` - Carga mapa Rhovanion (28 locs)
- `/app/frontend/src/components/rules/BackgroundsSection.jsx` - Nuevo componente
- `/app/frontend/src/pages/TravelGenerator.jsx` - Integración de ubicaciones
- `/app/frontend/src/pages/RulesPage.jsx` - Sección Recompensas actualizada

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **Aplicar recompensas al equipamiento** - Botón en la hoja de personaje para mejorar items

### P2 - Medium Priority
1. **PDF Export for Travel Generator**
2. **Sistema de Autenticación** (Maestro > Admin > Jugador)
3. **Backup/Restore de base de datos**

### P3 - Future Tasks
- Pantalla del DM
- Interfaz de juego online
- Integración IA para historias de NPCs
- Refactorización completa de RulesPage.jsx
- Visualización de mapa interactivo con las coordenadas

## Database Collections
- `locations`: 182 documentos con coordenadas x/y, terreno, tipo_tierra, peligro, refugio
- `recompensas`: Documento con mejoras, niveles, bendiciones, armas_con_nombre
- `backgrounds`: 114 documentos agrupables por raza/cultura

## Testing
- `/app/test_reports/iteration_21.json` - 100% pass rate
