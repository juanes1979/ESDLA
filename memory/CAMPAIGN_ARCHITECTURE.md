# Sistema de Campañas — Arquitectura Acordada (pre-fork)

> Este documento captura las decisiones de arquitectura tomadas con el usuario ANTES del fork
> que implementará el sistema de campañas. NO es la especificación final: hay puntos abiertos
> al final del documento que deben resolverse antes de programar.

## Roles del sistema

| Rol | Puede |
|-----|-------|
| **Maestro** (admin global, único) | Editar TODAS las reglas globales: culturas, trasfondos, regiones, terreno, ríos, caminos, clima, modificadores de precios, parámetros de viaje, etc. Acceso total a la BD principal. |
| **Director de Juego (DJ)** | **Consultar** (no modificar) reglas globales. Crear/modificar fichas de jugadores. Crear ubicaciones nuevas **que sólo existen dentro de su campaña**. Crear campañas. Subir mapas/aventuras propios visibles sólo en su campaña. |
| **Jugador** | (Pendiente de definir en detalle) |

## Aislamiento de datos — Híbrido "Branching" (1c + 2c + 5)

- **BD principal global** (`lotr5e_global` o el actual `DB_NAME`):
  - Sólo el **Maestro** puede modificarla.
  - Contiene reglas: culturas, trasfondos, regiones, terreno, ríos, caminos, clima, modificadores de precios, parámetros de viaje, hoards y plantillas de tesoros, objetos, etc.
  - Los DJs y Jugadores la **consultan en sólo lectura**.

- **BD por campaña** (`lotr5e_campaign_{campaign_id}`, una BD por campaña):
  - Se crea cuando un DJ inicia una campaña nueva.
  - Contiene **datos generados/modificados durante la partida**:
    - Personajes asignados a la campaña (un personaje no puede estar en dos campañas a la vez).
    - Viajes activos (`active_journeys`) y crónicas.
    - Ubicaciones añadidas por el DJ (sólo visibles en esta campaña).
    - Mapas/aventuras subidos por el DJ (sólo en esta campaña).
    - Polígonos de terreno extra que el DJ haya pintado para su campaña.
    - Overrides de clima por ubicación específicos de la campaña.
    - Inventario/dinero/PX/provisiones consumidas de los personajes en juego.
    - Estado de viajes, eventos, descansos, raciones, etc.
  - **NO duplica** las reglas globales — sigue consultándolas en lectura desde la BD global.
  - Las modificaciones del Maestro a la BD global **se propagan en tiempo real** a todas las campañas (a confirmar — ver puntos abiertos).

## Selector de campaña (4)

- La selección NO es global en cabecera; sucede **dentro del panel del Director de Juego**.
- Una vez el DJ entra en una campaña, **todo lo que haga queda ligado a esa campaña**:
  - Selección de personaje → asignación a la campaña.
  - Creación de ubicación → guardada en BD de la campaña.
  - Subida de mapa/aventura → guardado en BD de la campaña.
  - Compra de provisiones, gastos, viajes, etc.
- Un personaje **no puede estar en dos campañas a la vez**.

## Autenticación (3)

- **Bloqueador**: el sistema de campañas **espera a P0 Auth + Roles**.
- Sin Auth+Roles primero no podemos distinguir Maestro / DJ / Jugador, ni asignar dueños a campañas.
- Por tanto el orden es: **P0 Auth → P0 Campañas**.

## Migración de datos existentes

- Los datos actuales (personajes, viajes, etc.) se mantendrán en la BD global como están.
- Cuando se introduzca el sistema de campañas, decidiremos si se migran a una "Campaña Global por Defecto" o se mantienen como sandbox del Maestro (a definir).

---

## ⚠️ Puntos abiertos que faltan por definir antes de programar

### Auth y roles
1. ¿Hay **un único Maestro** en todo el sistema (cuenta semilla) o pueden existir varios?
2. ¿Cómo se promociona a un usuario a Director de Juego? (auto-registro pendiente de aprobación del Maestro, código de invitación, asignación manual…)
3. ¿Cómo se asigna un Jugador a una campaña? (DJ invita por email/usuario, código de campaña, lista manual de jugadores autorizados…)
4. ¿Un usuario puede tener varios roles? (¿un DJ también puede ser Jugador en otra campaña?)

### Modelo de campaña
5. Estados de la campaña: ¿activa / pausada / archivada / terminada? ¿el DJ puede archivar?
6. ¿El DJ puede **clonar/duplicar** una campaña? ¿exportarla / importarla?
7. ¿El Maestro puede entrar a cualquier campaña como auditor/soporte?
8. ¿Una campaña tiene metadatos (nombre, descripción, año en el calendario de la T.E., portada, sistema horario)?

### Datos visibles en la campaña
9. Cuando el DJ crea una **ubicación propia**, ¿ve junto a ella todas las globales del Maestro? (Suposición: sí, capa local sobre la global).
10. ¿El DJ puede **ocultar** ubicaciones globales en su campaña (sin borrarlas)?
11. Los **polígonos de terreno** propios del DJ: ¿son una capa que se superpone al terreno global, o sustituyen completamente?
12. ¿El DJ puede definir **overrides de clima** sólo para su campaña? ¿Y para regiones nuevas que él añada?
13. **Personajes huérfanos** (sin campaña): ¿se permiten para fichas de prueba/borrador, o todo personaje debe pertenecer a una campaña?

### Sincronización con la BD global
14. Si el Maestro **modifica una regla global** mientras hay campañas activas, ¿qué pasa?
    - a) Se propaga en vivo a todas las campañas.
    - b) Cada campaña queda "congelada" con un snapshot de las reglas en el momento de su creación.
    - c) El DJ recibe una notificación y decide si adopta los cambios.
15. ¿El Maestro puede **borrar** reglas globales que están en uso por una campaña activa? ¿Qué pasa con los datos huérfanos?

### Mapas / aventuras subidos
16. Formato de archivo del mapa de aventura subido por el DJ (imagen + JSON con coordenadas, PDF, etc.).
17. ¿Tamaño/cantidad máxima por campaña?
18. ¿Estos mapas se almacenan en GridFS, S3/object storage, o como base64 en MongoDB?

### Backup/Restore por campaña
19. El sistema actual de backup `/api/admin/backup` cubre toda la BD. ¿Necesitamos:
    - a) Backup global (sólo Maestro).
    - b) Backup por campaña (DJ exporta/importa SU campaña).
    - c) Ambos.

### UX
20. ¿Cómo se llama el "panel del DJ"? (Pantalla de juego, Mesa de juego, Sala del Director…)
21. ¿Hay una **pantalla de portal** al entrar en la app que liste las campañas a las que tienes acceso?
22. ¿El selector de campaña está siempre visible mientras estás dentro de una, o sólo al entrar?

### Sistema de viajes y eventos
23. Los **viajes activos** se ligan a una campaña; ¿se permite que un mismo grupo de personajes tenga varios viajes activos en paralelo dentro de la misma campaña?
24. **Provisiones, dinero, PX, inventario**: confirmado que se modifican sólo dentro de la BD de la campaña. ¿Se sincroniza algo de vuelta a la ficha global del personaje al terminar la campaña?

### Tesoros y objetos
25. Los **hoards generados** durante la campaña: ¿se guardan en la BD de la campaña como historial de loot?
26. Las **plantillas de tesoros** (rules) son globales — confirmado.

---

## Estado de implementación previa relacionada

- `EnhancedTravelSystem.jsx` ya está refactorizado en módulos.
- `AdminBackupPage.jsx` y `/api/admin/backup` ya existen para backup global (sólo Maestro de momento — se reusará).
- No existe todavía sistema de Auth — debe ser lo primero del próximo fork.
- `TerrainEditor.jsx` tiene Undo/Redo a medio implementar (pendiente de teclado y botones — se pospone).

## Orden recomendado tras el fork

1. **P0 Auth + Roles** (Maestro / DJ / Jugador) → bloqueante de todo lo demás.
2. **P0 Modelo Campaña**: schema, creación, listado, selector dentro del panel del DJ.
3. **P0 BD por campaña**: helper que enruta queries a la BD correcta según contexto.
4. **P0 Capa "global + overlay"** para ubicaciones, terreno y clima (lectura combinada).
5. **P1 Pantalla del Director de Juego** con panel de control de la campaña activa.
6. **P1 Subida de mapas/aventuras** dentro de la campaña.
7. **P2 Auditoría del Maestro** sobre campañas existentes.
