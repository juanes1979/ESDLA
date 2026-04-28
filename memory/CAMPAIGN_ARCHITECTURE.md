# Sistema de Campañas — Arquitectura Acordada (pre-fork)

> Este documento captura las decisiones de arquitectura tomadas con el usuario ANTES del fork
> que implementará el sistema de campañas. NO es la especificación final: hay puntos abiertos
> al final del documento que deben resolverse antes de programar.

## 📊 Tamaño actual de la BD (medido el 2026-02-26)

```
BD 'test_database': 20.23 MB datos / 18.21 MB storage / 2.61 MB índices.
59 colecciones · 970 documentos.
```

| Categoría | Colecciones | Tamaño |
|-----------|-------------|--------|
| **Mapa/terreno** | terrain_zones (13.4 MB!), terrain_polygons (152 KB), locations (167 KB), roads/regions/rivers/barriers | ~13.7 MB (≈68% del total) |
| **Personajes** | characters (50 fichas, 5.39 MB), character_drafts (14 KB), npcs (131 KB) | ~5.5 MB (≈110 KB por ficha — incluye retratos en base64) |
| **Reglas globales** | cultures, backgrounds, occupations, climate_regions, virtues, equipment_*, weapons, armors, viaje_*, sombra_*, etc. | ~750 KB total |
| **Datos de juego** | active_journeys (3.5 KB), travel_*, viajes_guardados | <30 KB |
| **Otros** | sheet_positions, lotr_files (GridFS) | <20 KB |

**Estimación para futuras campañas**: una campaña vacía ≈ 50 KB; una campaña media (5 fichas
clonadas en su BD + 20 ubicaciones extra + 10 viajes activos + 100 eventos) ≈ 700 KB; una
campaña pesada con mapas/aventuras subidos en imágenes/PDF ≈ 2-5 MB **si los mapas viven en
object storage** (URL en BD), o 10-50 MB si se guardan en base64 dentro de MongoDB. ⇒ Usar
object storage para mapas/PDFs es prácticamente obligatorio.

## Roles del sistema

| Rol | Puede |
|-----|-------|
| **Maestro** (admin global, único — el usuario) | Editar TODAS las reglas globales: culturas, trasfondos, regiones, terreno, ríos, caminos, clima, modificadores de precios, parámetros de viaje, hoards, plantillas de tesoros, objetos. Ver/borrar TODO en cualquier campaña. |
| **Director de Juego (DJ)** | Crear/modificar fichas de jugadores. Crear ubicaciones nuevas (sólo dentro de su campaña, con checkbox opcional "solicitar al Maestro incorporarla al mapa general"). Crear/listar campañas. **Consultar (NO modificar) reglas globales, mapa, regiones, etc.** |
| **Maestro del saber** | Igual que DJ (mismos permisos de consulta + creación de campañas). |
| **Jugador** | Registrarse, crear personajes propios, jugar dentro de campañas a las que es invitado. |

## Aislamiento de datos — Híbrido "Branching" (1c + 2c + 5)

- **BD principal global** (`test_database` actual):
  - Sólo el **Maestro** puede modificarla.
  - Contiene reglas: culturas, trasfondos, regiones, terreno global, ríos, caminos, clima base,
    modificadores de precios, parámetros de viaje, hoards y plantillas de tesoros, objetos, etc.
  - DJs, Maestros del saber y Jugadores la **consultan en sólo lectura**.
  - El Maestro modifica reglas → **se propaga en vivo** a todas las campañas (por simplicidad
    técnica y porque las reglas son la BD del juego, no del DJ). Si una regla rompe una campaña,
    el DJ puede crear un override local. *(decisión técnica del agente — confirmar con usuario)*

- **BD por campaña** (`lotr5e_campaign_{id}`, una BD por campaña creada):
  - Se crea cuando un DJ inicia una campaña nueva.
  - Contiene **datos generados/modificados durante la partida**:
    - Personajes asignados a la campaña (un personaje no puede estar en dos campañas a la vez).
    - Viajes activos (`active_journeys`) y crónicas.
    - Ubicaciones añadidas por el DJ (overlay sobre las globales).
    - Mapas/aventuras subidos por el DJ (object storage; sólo metadatos en BD).
    - Polígonos de terreno extra que el DJ haya pintado para su campaña.
    - Overrides de clima por ubicación específicos de la campaña.
    - Inventario/dinero/PX/provisiones consumidas de los personajes en juego.
    - Hoards generados, loot, eventos.
  - **NO duplica** las reglas globales — sigue consultándolas en lectura desde la BD global.

## Modelo de campaña (entidad propia)

- La campaña es un "ente" propio, creado por DJ/Maestro del saber/Maestro.
- Al crear, el creador la marca como **pública** o **privada**.
- Puede ser **reutilizada**: si un DJ la hace pública, otros DJs pueden "arrancar" su propia
  instancia de la misma campaña — cada instancia tiene su propio ID de juego (BD propia).
- Sólo al **"Comenzar campaña"** se entra a la pantalla de juego y empieza a haber estado mutable.
- Una campaña tiene metadatos (nombre, descripción, año TE, portada, sistema horario, mapas,
  aventuras subidas).

## Mapas / aventuras subidos (5)

- Formatos permitidos: **JPEG y PDF** (cerrado: forzamos al usuario a usar uno de estos dos).
- Almacenamiento: **object storage** (S3-compatible). MongoDB sólo guarda URL/key/metadatos.
  → Necesitará integración con `integration_playbook_expert_v2` cuando se implemente.
- Tamaño máximo (recomendación): JPEG 5 MB, PDF 20 MB por archivo.

## Selector de campaña

- La selección NO es global en cabecera; sucede **dentro del panel del Director de Juego**.
- Una vez el DJ entra en una campaña, **todo lo que haga queda ligado a esa campaña**.
- Un personaje **no puede estar en dos campañas a la vez**.

## Portal de juego — flujo UX (definido por el usuario)

1. Login obligatorio al entrar.
2. Según rol, distintos accesos.
3. DJs / Maestros del saber / Maestro: ven reglas, sus fichas, mapas, etc. — **sólo consulta**
   sobre lo global. Pueden añadir ubicaciones (con checkbox **"Solicitar al Maestro que se
   incorpore al mapa general"** — desmarcado por defecto).
4. Botón "Crear Campaña" + listado de campañas.
5. Pieza central: **Portal de Juego**. Selección de campaña → personajes / código público para
   que los jugadores se unan / etc.

## Notificaciones al Maestro (módulo cross-cutting)

Cada vez que un usuario o DJ intente algo no permitido (modificar reglas globales, usar
nombres inapropiados, etc.) → se registra un incidente en `moderation_alerts` (ya
implementado para nombres). El Maestro tendrá un panel para ver estadísticas:
- Top usuarios con incidentes.
- Distribución por categoría (palabrota / política / sexual / nonsense / ...).
- Distribución por contexto (nombre de personaje / jugador / ubicación / campaña).

## Backup (decisión pendiente)

- Backup global ya existe (`/api/admin/backup` — sólo Maestro).
- Backup por campaña: el usuario lo desea **si no ocupa mucho espacio**. Dado que una campaña
  típica pesa <2 MB sin mapas (los mapas van a object storage con su propia política), un
  backup JSON por campaña es viable. Pendiente de implementar tras P0 Campañas.

---

## ⚠️ Puntos abiertos que faltan por definir antes de programar

### Auth y roles
1. ✅ ~~¿Hay un único Maestro o pueden existir varios?~~ → **Único** (el usuario).
2. ¿Cómo se promociona a un usuario a Director de Juego? (auto-registro pendiente de aprobación
   del Maestro, código de invitación, asignación manual…)
3. ¿Cómo se asigna un Jugador a una campaña? (DJ invita por email/usuario, código de campaña,
   lista manual de jugadores autorizados…)
4. ¿Un usuario puede tener varios roles? (¿un DJ también puede ser Jugador en otra campaña?)
5. ¿Qué diferencia exactamente "Director de Juego" de "Maestro del saber"? ¿Son el mismo rol
   con dos nombres, o el Maestro del saber sólo consulta y NO puede crear campañas?

### Modelo de campaña
6. ✅ ~~Campañas privadas/públicas~~ → confirmado, atributo en la creación.
7. Estados de la campaña: ¿activa / pausada / archivada / terminada? ¿el DJ puede archivar?
8. ¿El DJ puede **clonar/duplicar** una campaña? ¿exportarla / importarla?
9. ✅ ~~El Maestro puede entrar a cualquier campaña~~ → SÍ.
10. ¿Una campaña pública la puede usar otro DJ "arrancando" una instancia separada o se juega
    todos en la misma instancia? → según el usuario: **arrancan instancias separadas** (cada
    "Comenzar campaña" = nueva BD).

### Datos visibles en la campaña
11. Cuando el DJ crea una **ubicación propia** con check "Solicitar al Maestro" → ¿flujo
    concreto? (cola de aprobación, vista en panel del Maestro, notificación, etc.)
12. ¿El DJ puede **ocultar** ubicaciones globales en su campaña (sin borrarlas)?
13. Los **polígonos de terreno** propios del DJ: ¿son una capa que se superpone al terreno
    global o sustituyen completamente?
14. ¿El DJ puede definir **overrides de clima** sólo para sus ubicaciones nuevas, o también
    para regiones/ubicaciones globales dentro de su campaña?
15. ✅ ~~Personajes huérfanos permitidos~~ → SÍ.

### Sincronización con la BD global
16. Si el Maestro **modifica una regla global** mientras hay campañas activas:
    - ✅ Decidido (sugerencia del agente, a confirmar): **se propaga en vivo**, y el DJ puede
      hacer override local en su BD si necesita congelar algo.
17. ¿El Maestro puede **borrar** reglas globales que están en uso por una campaña activa?
    ¿Datos huérfanos / advertencia?

### Mapas / aventuras subidos
18. ✅ Formato: JPEG + PDF.
19. Almacenamiento: object storage (a integrar con `integration_playbook_expert_v2` cuando toque).
20. Límites de tamaño / cantidad por campaña.

### Backup/Restore por campaña
21. ✅ Aceptable si no ocupa mucho. → Implementar tras P0 Campañas.

### UX
22. Nombre del "panel del DJ" (Pantalla de juego, Mesa de juego, Sala del Director).
23. ✅ Hay pantalla portal listando las campañas a las que tienes acceso.
24. ✅ El selector de campaña pasa a "fijar" la campaña en la pantalla de juego.

### Sistema de viajes y eventos
25. ¿Varios viajes activos en paralelo dentro de la misma campaña?
26. ✅ Provisiones, dinero, PX, inventario → en BD de campaña, NO sincronizan a la ficha global.

### Tesoros y objetos
27. ✅ Hoards generados → en BD de campaña como historial de loot.
28. ✅ Plantillas de tesoros → globales (rules).

---

## Estado de implementación previa relacionada

- `EnhancedTravelSystem.jsx` ya está refactorizado en módulos.
- `AdminBackupPage.jsx` y `/api/admin/backup` ya existen para backup global.
- **Moderación inteligente IA de nombres ya implementada** (Iter 67):
  - Backend `/api/moderation/check-name`, `/alerts`, `/alerts (DELETE)`.
  - Filtro duro local + GPT-4o-mini para casos sutiles.
  - Integrada en creador de personajes (campos Nombre / Apellido / Jugador).
  - Sistema de 2 intentos + bloqueo + autorelleno con nombre clásico.
  - Colección `moderation_alerts` lista para futuro panel del Maestro.
- No existe todavía sistema de Auth — debe ser lo primero del próximo fork.
- `TerrainEditor.jsx` tiene Undo/Redo a medio implementar (pospuesto).

## Orden recomendado tras el fork

1. **P0 Auth + Roles** (Maestro / DJ / Maestro del saber / Jugador) — bloqueante.
2. **P0 Modelo Campaña**: schema, creación pública/privada, listado, "Comenzar campaña" → BD nueva.
3. **P0 Helper de enrutado**: queries van a BD global (lectura) + BD de campaña activa (escritura).
4. **P0 Capa "global + overlay"** para ubicaciones, terreno, clima.
5. **P0 Object Storage** para mapas/PDFs subidos por DJs.
6. **P1 Pantalla del Director de Juego** con panel de control + checkbox "solicitar al Maestro".
7. **P1 Cola de aprobación de ubicaciones** del Maestro.
8. **P1 Panel de incidentes de moderación** del Maestro.
9. **P1 Backup por campaña** (export/import JSON).
10. **P2 Auditoría del Maestro** sobre campañas existentes.
11. **P2 Terminar Undo/Redo en TerrainEditor**.

