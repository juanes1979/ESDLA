# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2026-02-06)

### ✅ COMPLETED: Virtudes Completas Extraídas del Excel
Se extrajeron 100 virtudes con TODA la información de la hoja "Virtudes":
- **Fila 2**: Nombre de la virtud
- **Fila 3**: Descripción
- **Fila 4**: Rasgos a indicar en la hoja PJ
- **Filas 5-10**: Aumentos directos de característica (si hay X)
- **Filas 12-17**: Elegir +1 en una característica
- **Filas 19-24**: Elegir competencia en tirada de salvación
- **Fila 26**: Bonus de puntos de golpe
- **Fila 27**: Bonus de puntos de comunidad
- **Fila 28**: Bonus de clase de armadura
- **Filas 30-48**: Elegir competencia en habilidad (sin repetir las existentes)
- **Filas 50-68**: Elegir competencia en herramienta (sin repetir las existentes)

### ✅ Campos de Virtud en MongoDB
```javascript
{
  nombre: "Forjadores de la Edad de las Estrellas",
  cultura: "Elfos Noldor",
  es_comun: false,
  descripcion: "...",
  rasgos: "...",
  // Aumentos directos
  aumenta_fuerza: false,
  aumenta_destreza: false,
  // etc.
  // Elecciones
  elegir_caracteristica: ["INTELIGENCIA", "SABIDURÍA"],
  elegir_salvacion: null,
  elegir_habilidad: null,
  elegir_herramienta: ["Herramientas de herrería", "Herramientas de joyería", "Suministros de carpintería"],
  // Bonus
  bonus_puntos_golpe: null,
  bonus_ca: null,
  bonus_comunidad: null
}
```

### ✅ Frontend Actualizado
- Página de Reglas > Virtudes muestra TODA la información:
  - Descripción y rasgos
  - Aumentos directos (FUE, DES, CON, INT, SAB, CAR)
  - Opciones de característica a elegir
  - Opciones de salvación a elegir
  - Bonus de PG, CA, Comunidad
  - Opciones de habilidad a elegir
  - Opciones de herramienta a elegir

### ✅ API Actualizada
- `GET /api/data/virtudes` - Devuelve 100 virtudes con campos completos
- `GET /api/data/cultures/{id}/virtues` - Mapea campos a formato frontend

### ✅ COMPLETED (Sesión anterior): Monturas Actualizadas
- 15 monturas con columnas: Carga, Constitución, Velocidad, Pequeño, Mediano

### ✅ COMPLETED (Sesión anterior): Editor de Equipo
- 21 categorías con campos dinámicos

### ✅ COMPLETED (Sesión anterior): Secciones de Reglas
- Sombra (Pavor, Avaricia, Fechorías, Estados, Sendas)
- Artes (8 items)
- Recompensas (Mejoras, Niveles, Bonificadores)

## 📋 PENDING TASKS

### P0 - Próximo paso
1. **Selectores de virtud en el creador**
   - Cuando el usuario elige una virtud con `elegir_caracteristica`, mostrar selector
   - No repetir opciones que el PJ ya tiene (competencias en tiradas de salvación, habilidades, herramientas)
   - Guardar las elecciones en el draft

### P1 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)

## 📋 FUTURE/BACKLOG TASKS
- Pantalla del Director de Juego
- Interfaz de juego online
- Integración IA

## Key Files
- `/app/backend/extract_virtues_complete.py` - Script de extracción de virtudes
- `/app/backend/routes/data_routes.py` - Endpoints de virtudes con mapeo
- `/app/frontend/src/pages/RulesPage.jsx` - Visualización de virtudes completas
- `/app/frontend/src/components/character-creator/steps/Step5Virtue.jsx` - Selección de virtud

## Key API Endpoints
- `GET /api/data/virtudes` - 100 virtudes con datos completos
- `GET /api/data/cultures/{id}/virtues` - Virtudes mapeadas para frontend
- `POST /api/data/virtudes` - Crear virtud
- `PUT /api/data/virtudes/{id}` - Actualizar virtud
- `DELETE /api/data/virtudes/{id}` - Eliminar virtud

## Test Reports
- `/app/test_reports/iteration_15.json` - Tests anteriores (100% pass)

## Session Changelog (2026-02-06)
1. Extraídas 100 virtudes con TODOS los campos del Excel
2. Campos: elegir_caracteristica, elegir_salvacion, elegir_habilidad, elegir_herramienta
3. Campos: bonus_puntos_golpe, bonus_ca, bonus_comunidad
4. Frontend muestra toda la información de virtudes
5. Endpoint /cultures/{id}/virtues mapea campos a formato frontend
6. Actualizado tiene_virtud_inicial=True en todas las culturas
