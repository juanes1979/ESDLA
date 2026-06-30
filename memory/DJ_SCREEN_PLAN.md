# Pantalla del DJ Master — Plan definitivo (bloqueado)

Estética: manuscritos antiguos, piedra tallada, cobre pulido, filigranas doradas
sobre fondo oscuro; evoca crónicas y mapas de guerra en una cámara de Minas Tirith.
Mockup de referencia: subido por el usuario (cámara de Minas Tirith con mapa táctico,
combat tracker, resumen de aventureros, rastreador de viaje, Ojo de Mordor, chat, d20).

## Decisiones bloqueadas
- ❌ Esperanza/Hope: NO se implementa (no está en las reglas 5e del usuario). Las cartas
  de héroe muestran: STR · DEX · SHADOW POINTS · HP · AC (fila HOPE eliminada).
- Condiciones = toggles manuales del DJ (un ataque básico solo aplica DAÑO automático).
- Ficha del jugador se sincroniza EN VIVO por WebSocket (además de su vista en la pantalla).
- Referencia de Reglas (23 apartados) = SOLO CONSULTA (la edición sigue en /reglas).
- Mapa táctico = NIVEL A: imagen de mapa + fichas/tokens arrastrables (rejilla decorativa),
  marcadores de emboscada/trampa colocados a mano, fichas en vivo por WS. (Nivel B / VTT
  completo = futuro, fuera de alcance.)
- "Puntos de Director privados": QUITADO de momento.
- Módulos nuevos del mockup → entran en la Fase 6.

## FASE 1 — Infraestructura de tiempo real + mecánicas base
- WebSockets: validar primero que el proxy de Kubernetes deja pasar `wss://…/api/ws/campaign/{run_id}`.

### ✅ FASE 1 COMPLETADA (Jun 2026)
- WebSocket VALIDADO a través del proxy (Cloudflare/k8s) → no hace falta SSE.
- `backend/realtime.py`: `ConnectionManager` en memoria (salas por campaign_run_id),
  endpoint `WS /api/ws/campaign/{run_id}?token=<jwt>`, auth por token + chequeo de membresía,
  `broadcast()` (full a DJ / saneado a jugador) y `broadcast_chat()` (respeta canal privado).
  Registrado en server.py (`app.include_router(ws_router)`).
- `dj_screen_routes.py`: PUT dj-screen, sync-players y post_chat emiten broadcast por WS.
- Ojo de Mordor por campaña: se usa el mecanismo `state_id` existente de eye_routes con
  `state_id = campaign_run_id` (DRY, sin duplicar colección). Nuevo endpoint
  `GET /api/campaign-runs/{run_id}/eye` (DJ: completo; jugador: banda runica saneada).
- Frontend `DjScreenPage.jsx`: se conecta al WS (sustituye el sondeo; poll solo de respaldo
  15s/12s si WS cae), aplica `dj_screen_state` (jugador) y `chat` en vivo; indicador "● En vivo".
- Verificado: WS hello/pong por proxy, broadcast en PUT (round live), endpoint eye saneado,
  navegador muestra "En vivo".

## FASE 2 — Motor de ataque d20 automatizado

### ✅ FASE 2 COMPLETADA (Jun 2026)
- Combatiente gana `atk_bonus` y `dmg`. Al sincronizar héroes se derivan de la ficha
  (mejor mod FUE/DES + bono competencia; daño = dados del arma equipada + mod). Bestiario:
  atk = bonificador_competencia, dmg "1d8". El DJ puede sobreescribir ATK/DAÑO en la tarjeta.
- Endpoint `POST /api/campaign-runs/{run_id}/dj-screen/attack` {attacker_id, defender_id, mode}:
  tirada d20 (normal/ventaja/desventaja, devuelve los dados), +atk vs CA, nat20 crítico (salta
  CA, duplica DADOS de daño), nat1 pifia; aplica daño al combatiente (y a la ficha si es héroe),
  persiste, narra en el chat de grupo y difunde por WS (estado + chat).
- Frontend: barra de ataque (selección por botones Atac./Def. en cada tarjeta, resaltado
  ámbar/azul, tri-estado N/Vent./Desv., botón ¡Atacar!). Verificado por curl (impacto/crítico/
  fallo, daño persistente) y captura (UI completa + narración en chat).

## FASE 3 — Condiciones mecánicas cerradas (toggles del DJ)
- Selección atacante/defensor por clic (selectedAttackerId / selectedDefenderId) usando el
  id de dj_screens.combatants.
- Precarga de atk_bonus y dmg desde el arma equipada (mod FUE/DES + bonif. competencia;
  daño = `dano` del catálogo + modificador). El DJ puede sobre-escribir a mano.
- Botón "⚔️ Atacar" + tri-estado normal/ventaja/desventaja (reutiliza roll_with_advantage/
  disadvantage). Secuencia:
  1. d20 (normal/ventaja/desventaja)
  2. resultado = d20 + atk_bonus; nat20 = crítico (salta CA); nat1 = fallo
  3. impacto si resultado ≥ CA defensor
  4. daño = dados arma + dmg_bonus; crítico duplica DADOS (no el modificador)
  5. aplica daño (PATCH /characters/{id}/hp para héroes; dj_screens.combatants para enemigos)
  6. broadcast WS del nuevo PG (saneado para jugadores)
  7. el chat de grupo narra el desglose completo

## FASE 3 — Condiciones mecánicas cerradas (toggles del DJ)
Lista: Cansado (enlazado al contador de fatiga existente → desventaja en pruebas) ·
Inspirado (ventaja siguiente tirada, se consume) · Aturdido (no actúa; ataques con ventaja) ·
Tumbado (desventaja al atacar; melé con ventaja) · Apresado (velocidad 0) · Asustado
(desventaja viendo la fuente) · Envenenado (desventaja en ataques y pruebas) · Inconsciente
(tumbado + no actúa + impactos cercanos críticos). El motor aplica ventaja/desventaja auto.

## FASE 4 — Rastreador de Viaje integrado
Exponer en la pantalla la lógica de viajes ya existente (roles guía/explorador/cazador/
vigía, tiradas automatizadas, acampada/centinela). Botón "Generar acontecimiento de viaje"
vinculado a Prueba de Sombra/Cansancio directa.

## FASE 5 — Sombra y Ojo de Mordor activos + vista saneada
- Botones "Disparar Prueba de Sombra" e "Incrementar Ojo" (reutilizan PATCH /shadow y eye).
- Vista saneada de jugadores (bandas, sin números):
  - PG enemigos: Ileso · Herido leve · Herido · Malherido · Caído
  - Sombra: Sombra latente · creciendo · acechante · abrumadora
  - Ojo de Mordor: Ojo dormido · entreabierto · vigilante · parpadeando · La Mirada
    (runa/iris que se abre por fases)

## FASE 6 — Consolidación + módulos del mockup
- Paneles maestros: Notas privadas DJ, Resumen privado de aventureros, Rastreador de viaje,
  Módulos de comunidad, Mapa táctico (Nivel A), Combat tracker (pestañas Initiative/Trolls/
  Heroes), Ojo de Mordor, Cartas de héroe, Chat.
- Referencia rápida de Reglas (23 apartados, solo consulta).
- Gestor de tiradas de dados con runas (d4,d6,d8,d10,d12,d20,d100) + d20 de tirada rápida
  (esquina inferior derecha); selector privado/compartido.
- Botones de encuentro: Invocar enemigos (hecho), Disparar trampa, Evento de Sombra
  aleatorio, Terminar encuentro. Contador "Acciones restantes". Gestionar botín privado.
  Crear PNJ rápido. Cartas de habilidad de enemigo (Multiataque, Regeneración…).
- Sesiones: colección `campaign_sessions` {id, campaign_run_id, numero, titulo, start_time,
  end_time, status}. DJ "Iniciar/Cerrar sesión". chat y notas ganan session_id; notas →
  `dj_session_notes`. El estado de combate vivo sigue por campaña.
