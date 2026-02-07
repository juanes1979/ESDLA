# LOTR 5e RPG - Product Requirements Document

## Original Problem Statement
Build a comprehensive web application to play a modified version of the "Lord of the Rings 5e" tabletop role-playing game based on the Excel file `utumno.xlsm`.

**User's preferred language**: Español

## Current State (2025-12-19)

### ✅ COMPLETED This Session

#### P0: Sistema Completo de NPCs/Bestiario
1. **Nuevo Modelo de Datos Estructurado para NPCs**
   - Separación de `especiales` como lista de objetos `{nombre, descripcion}`
   - `armas` estructuradas con `{nombre, tipo, bonificador_impacto, alcance_metros, dano, tipo_dano, efecto}`
   - `acciones` y `reacciones` como listas estructuradas
   - Soporte para resistencias, inmunidades_dano, inmunidades_estados, vulnerabilidades
   - Campo `historia` preparado para IA futura

2. **Extracción de Datos de PDFs**
   - Procesados 4 PDFs de adversarios del usuario
   - 30 NPCs cargados con datos completos:
     - 26 Malignos (Atracador, Orcos, Trolls, Espectros, etc.)
     - 4 Especiales (Balrog de Moria, Morlhoss, Cauthlin, Daegûr)
   - Script `/app/backend/load_npcs_v2.py` con toda la data estructurada

3. **Endpoints CRUD Completos**
   - `GET /api/data/npcs` - Listado agrupado por categoría con búsqueda
   - `GET /api/data/npcs/{id}` - NPC individual
   - `POST /api/data/npcs` - Crear nuevo NPC
   - `PATCH /api/data/npcs/{id}` - Actualizar NPC
   - `DELETE /api/data/npcs/{id}` - Eliminar NPC
   - `POST /api/data/npcs/{id}/copy` - Copiar NPC con nuevo nombre

4. **NPCEditor.jsx - Editor Visual de NPCs**
   - Modal completo con 7 pestañas:
     - **Básico**: Nombre, categoría, tipo, tamaño, descripción, CA, PG, velocidad, PX
     - **Atributos**: Los 6 atributos principales con modificadores calculados
     - **Defensa**: Resistencias, inmunidades (daño/estados), vulnerabilidades
     - **Especiales**: Lista de habilidades especiales con nombre y descripción
     - **Armas**: Ataques estructurados con todos los campos de combate
     - **Acciones**: Otras acciones y reacciones
     - **Historia**: Campo preparado para generación IA futura

5. **NPCsSection.jsx - Vista del Bestiario**
   - 4 categorías con contadores: Malignos(26), PNJ, Animales, Especiales(4)
   - Búsqueda por nombre, tipo, descripción
   - Vista expandida con:
     - Estadísticas de combate (CA, PG, velocidad, PX, percepción)
     - Atributos con modificadores
     - Sentidos e idiomas
     - Resistencias/inmunidades con badges de colores
     - Habilidades especiales estructuradas
     - Armas con todos los datos de combate
     - Acciones, reacciones, acciones legendarias
   - Botones de Editar, Copiar, Eliminar

#### Sesiones Anteriores (resumen)
- Generador de Viajes (`/travel`) - Completo con cálculo de fatiga, eventos, clima
- Sistema de Level Up con modal y selección de virtudes/artes
- Secciones de reglas: Fase de Comunidad, Artes, Recompensas, Salarios, Combate
- RulesPage refactorizado en componentes separados
- Creador de personajes con ficha PDF de 3 páginas
- 100 Virtudes con campos de elección
- Catálogo de Equipo (21 categorías)

## 📋 UPCOMING TASKS

### P1 - Next Priority
1. **PDF Export for Travel Generator**
   - Exportar logs de viaje generados a PDF

### P2 - Medium Priority
1. **Sistema de Autenticación Completo**
   - Login, registro, roles (Maestro > Admin > Jugador)
2. **Gestión de Base de Datos**
   - Backup y restore de datos del juego
3. **Animales en el Bestiario**
   - Añadir NPCs de tipo animal (caballos, lobos comunes, etc.)

### P3 - Future Tasks
- Pantalla del Director de Juego (DM Screen)
- Interfaz de juego online (mapas, chat, tiradas)
- **Integración IA para generación de historias de NPCs** (campo `historia` ya preparado)
- Limpiar funciones antiguas `render...` de RulesPage.jsx

## Key API Endpoints

### NPCs/Bestiario
- `GET /api/data/npcs` - Listado agrupado (malignos, pnj, animales, especiales)
- `GET /api/data/npcs?categoria=malignos&search=orco` - Filtrado
- `POST /api/data/npcs` - Crear NPC con datos estructurados
- `PATCH /api/data/npcs/{id}` - Actualizar NPC
- `DELETE /api/data/npcs/{id}` - Eliminar NPC

### Otros
- `GET /api/data/artes` - 8 artes con descripciones completas
- `GET /api/data/recompensas` - mejoras, niveles_recompensa, bendiciones
- `GET /api/data/comunidad` - Fase de comunidad, empresas, Yule
- `PATCH /api/characters/{id}` - Actualizar personaje (level up)

## Key Files
- `/app/backend/routes/data_routes.py` - Todos los endpoints de datos incluidos CRUD de NPCs
- `/app/backend/load_npcs_v2.py` - Script para cargar NPCs desde datos extraídos de PDFs
- `/app/frontend/src/components/rules/NPCsSection.jsx` - Vista del bestiario
- `/app/frontend/src/components/rules/NPCEditor.jsx` - Editor visual de NPCs
- `/app/frontend/src/pages/RulesPage.jsx` - Página principal con 13 categorías

## Data Model - NPC

```json
{
  "_id": "uuid",
  "nombre": "string",
  "categoria": "malignos|pnj|animales|especiales",
  "descripcion": "string",
  "tipo": "Humanoide Mediano (orco)",
  "tamanio": "Mediano",
  "clase_armadura": 15,
  "descripcion_armadura": "cota de mallas",
  "puntos_golpe": 52,
  "dados_golpe": "7d8 + 21",
  "velocidad": 9,
  "velocidades_especiales": {"volar": 15},
  "atributos": {"fuerza": 16, "destreza": 12, ...},
  "percepcion_pasiva": 12,
  "sentidos": ["Visión en la oscuridad 36 m"],
  "idiomas": ["Lengua negra", "orco"],
  "resistencias": ["frío", "necrótico"],
  "inmunidades_dano": ["fuego", "veneno"],
  "inmunidades_estados": ["asustado", "hechizado"],
  "vulnerabilidades": ["radiante"],
  "desafio": "3 (700 PX)",
  "experiencia": 700,
  "especiales": [
    {"nombre": "Agresividad", "descripcion": "Como acción adicional..."}
  ],
  "armas": [
    {
      "nombre": "Espada Llameante",
      "tipo": "cuerpo a cuerpo",
      "bonificador_impacto": 14,
      "alcance_metros": "3 m",
      "dano": "2d8 + 8 + 4d8 fuego",
      "tipo_dano": "cortante",
      "efecto": "Salvación de Fuerza CD 20..."
    }
  ],
  "ataque_multiple": "Lleva a cabo dos ataques...",
  "acciones": [
    {"nombre": "Aura de Oscuridad", "descripcion": "..."}
  ],
  "reacciones": [
    {"nombre": "Contraconjuro", "descripcion": "..."}
  ],
  "historia": "" // Preparado para IA
}
```

## Testing
- `/app/test_reports/iteration_20.json` - 100% pass rate
- `/app/backend/tests/test_npcs_crud.py` - 19 tests de backend
