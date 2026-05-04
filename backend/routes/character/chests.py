"""Character chests/storage by location.

Implementa los baúles que un personaje puede dejar en una ubicación marcada
como `refugio` (refugio seguro). Reglas de juego:

- El personaje sólo puede **guardar** o **retirar** objetos de un baúl si su
  `ubicacion_actual.id` coincide con `chest.location_id`.
- Sólo se pueden crear baúles en ubicaciones con `refugio == True`.
- Cuando el personaje no está en la ubicación del baúl, los objetos del baúl
  son visibles pero no accesibles (la UI los muestra bloqueados).
- Cada `(personaje, ubicación)` tiene un único baúl que crece añadiendo
  ítems. No hay capacidad máxima — el baúl representa cualquier almacén
  (cofre, montón apilado, alacena, etc.).

El estado vive embebido en `character.chests = [{location_id, ..., items: []}]`.
"""
from typing import Optional
from fastapi import HTTPException, Body
from pydantic import BaseModel

from ._common import router, db, now_utc, serialize_doc, convert_to_base, convert_from_base


# Coste fijo (en monedas base = 1 céntimo de cobre) por crear un baúl en una ubicación nueva.
# Equivale a 1 mp (1 pieza de plata = 100 unidades base).
CHEST_CREATION_COST_BASE = 100


def _charge_chest_creation(character: dict) -> dict:
    """Comprueba que haya fondos y devuelve el nuevo dict `dinero`.

    Si el personaje no tiene al menos 1 mp, lanza HTTP 400 con detalle.
    """
    dinero = character.get("dinero") or {"mo": 0, "mp": 0, "me": 0, "mc": 0}
    base = convert_to_base(dinero)
    if base < CHEST_CREATION_COST_BASE:
        raise HTTPException(
            status_code=400,
            detail=(
                "Fondos insuficientes para crear el baúl. "
                f"Necesitas 1 pieza de plata (mp). Dinero actual: {dinero}."
            ),
        )
    return convert_from_base(base - CHEST_CREATION_COST_BASE)


class ChestStoreRequest(BaseModel):
    location_id: str
    item_index: int
    source: str = "inventario"  # inventario | equipo | equipo_ocupacion | armas | armadura | armadura_piezas | mount
    mount_id: Optional[str] = None  # if source == "mount"
    cantidad: Optional[int] = None  # only matters for stackable items


class ChestRetrieveRequest(BaseModel):
    location_id: str
    item_name: str
    target_carrier: str = "personaje"  # personaje | montura
    target_mount_id: Optional[str] = None  # required if target_carrier == "montura"


async def _resolve_location(location_id: str) -> dict:
    loc = await db.locations.find_one({"id": location_id}) or \
          await db.locations.find_one({"_id": location_id})
    if not loc:
        raise HTTPException(status_code=404, detail="Ubicación no encontrada")
    return loc


def _ensure_at_location(character: dict, location_id: str) -> None:
    ua = character.get("ubicacion_actual") or {}
    current = ua.get("id") or ua.get("location_id")
    if current != location_id:
        raise HTTPException(
            status_code=403,
            detail="El personaje no está en la ubicación del baúl",
        )


def _ensure_safe_haven(loc: dict) -> None:
    if not (loc.get("refugio") or loc.get("refugio_seguro")):
        raise HTTPException(
            status_code=400,
            detail="Sólo se pueden crear baúles en ubicaciones marcadas como refugio seguro",
        )


def _find_chest(character: dict, location_id: str) -> Optional[int]:
    chests = character.get("chests") or []
    for i, c in enumerate(chests):
        if c.get("location_id") == location_id:
            return i
    return None


def _pop_item_from_source(character: dict, source: str, item_index: int,
                          mount_id: Optional[str], cantidad: Optional[int]) -> tuple[dict, dict]:
    """Extrae un item de la fuente indicada y devuelve (update_dict, item_payload)."""
    update: dict = {}
    item: Optional[dict] = None

    if source == "armadura":
        arm = character.get("armadura") or {}
        if not arm.get("nombre"):
            raise HTTPException(404, "Sin armadura principal que guardar")
        item = arm
        update["armadura"] = {}
    elif source == "armadura_piezas":
        piezas = list(character.get("armadura_piezas") or [])
        if item_index < 0 or item_index >= len(piezas):
            raise HTTPException(400, "Índice inválido en armadura_piezas")
        item = piezas.pop(item_index)
        update["armadura_piezas"] = piezas
    elif source == "armas":
        armas = list(character.get("armas") or [])
        if item_index < 0 or item_index >= len(armas):
            raise HTTPException(400, "Índice inválido en armas")
        item = armas.pop(item_index)
        update["armas"] = armas
    elif source == "mount":
        if not mount_id:
            raise HTTPException(400, "mount_id requerido cuando source=mount")
        monturas = list(character.get("monturas") or [])
        target_idx = next((i for i, m in enumerate(monturas) if m.get("id") == mount_id), None)
        if target_idx is None:
            raise HTTPException(404, "Montura no encontrada")
        mount = dict(monturas[target_idx])
        equipo = list(mount.get("equipo") or [])
        if item_index < 0 or item_index >= len(equipo):
            raise HTTPException(400, "Índice inválido en montura.equipo")
        raw = equipo[item_index]
        if isinstance(raw, dict):
            item = dict(raw)
            available = int(item.get("cantidad") or 1)
            take = cantidad if cantidad is not None else available
            take = max(1, min(take, available))
            if take >= available:
                equipo.pop(item_index)
            else:
                item["cantidad"] = take
                equipo[item_index] = {**raw, "cantidad": available - take}
        else:
            item = {"nombre": str(raw), "cantidad": 1}
            equipo.pop(item_index)
        mount["equipo"] = equipo
        monturas[target_idx] = mount
        update["monturas"] = monturas
    else:
        # inventario | equipo | equipo_ocupacion | equipo_nivel_vida | equipo_trasfondo
        valid = {"inventario", "equipo", "equipo_ocupacion",
                 "equipo_nivel_vida", "equipo_trasfondo"}
        if source not in valid:
            raise HTTPException(400, f"source inválido: {source}")
        lst = list(character.get(source) or [])
        if item_index < 0 or item_index >= len(lst):
            raise HTTPException(400, f"Índice inválido en {source}")
        raw = lst[item_index]
        if isinstance(raw, dict):
            item = dict(raw)
            available = int(item.get("cantidad") or 1)
            take = cantidad if cantidad is not None else available
            take = max(1, min(take, available))
            if take >= available:
                lst.pop(item_index)
            else:
                item["cantidad"] = take
                lst[item_index] = {**raw, "cantidad": available - take}
        else:
            item = {"nombre": str(raw), "cantidad": 1}
            lst.pop(item_index)
        update[source] = lst

    # Limpia metadata de carrier (al guardar en baúl pierde sentido)
    if isinstance(item, dict):
        for k in ("portado_por", "mount_id", "activa"):
            item.pop(k, None)

    return update, item


def _push_item_into_chest(chests: list, location_id: str, location: dict, item: dict) -> list:
    """Inserta un ítem en el baúl correspondiente, fusionando con stackables."""
    chests = list(chests or [])
    idx = next((i for i, c in enumerate(chests) if c.get("location_id") == location_id), None)
    if idx is None:
        chests.append({
            "location_id": location_id,
            "location_nombre": location.get("nombre"),
            "location_region": location.get("region"),
            "items": [item],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        })
        return chests

    chest = dict(chests[idx])
    items = list(chest.get("items") or [])

    # Intento de fusión por nombre (sólo si ambos son stackables sin meta especial)
    name = (item.get("nombre") or "").lower().strip()
    merged = False
    for j, existing in enumerate(items):
        if (existing.get("nombre") or "").lower().strip() != name:
            continue
        # Sólo fusiona si ninguno tiene metadatos críticos distintos
        if existing.get("activa") or item.get("activa"):
            continue
        items[j] = {
            **existing,
            "cantidad": int(existing.get("cantidad") or 1) + int(item.get("cantidad") or 1),
        }
        merged = True
        break
    if not merged:
        items.append(item)

    chest["items"] = items
    chest["updated_at"] = now_utc()
    chests[idx] = chest
    return chests


@router.post("/{character_id}/chest/store")
async def chest_store(character_id: str, body: ChestStoreRequest):
    """Guarda un objeto del personaje en su baúl en la ubicación indicada.

    Requiere que el personaje esté **físicamente** en esa ubicación y que la
    ubicación sea un refugio seguro.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    location = await _resolve_location(body.location_id)
    _ensure_safe_haven(location)
    _ensure_at_location(character, body.location_id)

    update, item = _pop_item_from_source(
        character, body.source, body.item_index, body.mount_id, body.cantidad
    )

    existing_idx = _find_chest(character, body.location_id)
    is_new_chest = existing_idx is None
    if is_new_chest:
        nuevo_dinero = _charge_chest_creation(character)
        update["dinero"] = nuevo_dinero

    chests = _push_item_into_chest(
        character.get("chests") or [], body.location_id, location, item
    )
    update["chests"] = chests
    update["updated_at"] = now_utc()

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "success": True,
        "stored_item": item,
        "chest_created": is_new_chest,
        "creation_cost": "1 mp" if is_new_chest else None,
        "character": serialize_doc(updated),
    }


@router.post("/{character_id}/chest/retrieve")
async def chest_retrieve(character_id: str, body: ChestRetrieveRequest):
    """Retira un objeto del baúl de la ubicación indicada y lo coloca en el
    inventario personal o en una montura.

    Requiere que el personaje esté en esa ubicación.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    _ensure_at_location(character, body.location_id)

    chests = list(character.get("chests") or [])
    chest_idx = next((i for i, c in enumerate(chests) if c.get("location_id") == body.location_id), None)
    if chest_idx is None:
        raise HTTPException(404, "No hay baúl en esa ubicación")

    chest = dict(chests[chest_idx])
    items = list(chest.get("items") or [])
    target = body.item_name.lower().strip()
    item_idx = next(
        (i for i, it in enumerate(items)
         if (it.get("nombre") or "").lower().strip() == target),
        None,
    )
    if item_idx is None:
        raise HTTPException(404, f"Objeto '{body.item_name}' no encontrado en el baúl")

    retrieved = items.pop(item_idx)
    chest["items"] = items
    chest["updated_at"] = now_utc()
    if items:
        chests[chest_idx] = chest
    else:
        # Baúl vacío → eliminamos para no dejar entradas residuales
        chests.pop(chest_idx)

    update = {"chests": chests, "updated_at": now_utc()}

    if body.target_carrier == "montura":
        if not body.target_mount_id:
            raise HTTPException(400, "target_mount_id requerido")
        monturas = list(character.get("monturas") or [])
        m_idx = next((i for i, m in enumerate(monturas) if m.get("id") == body.target_mount_id), None)
        if m_idx is None:
            raise HTTPException(404, "Montura destino no encontrada")
        m = dict(monturas[m_idx])
        equipo = list(m.get("equipo") or [])
        equipo.append({**retrieved, "portado_por": "montura", "mount_id": body.target_mount_id})
        m["equipo"] = equipo
        monturas[m_idx] = m
        update["monturas"] = monturas
    else:
        # Vuelve al inventario personal
        inventario = list(character.get("inventario") or [])
        inventario.append(retrieved)
        update["inventario"] = inventario

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "success": True,
        "retrieved_item": retrieved,
        "character": serialize_doc(updated),
    }


@router.post("/{character_id}/chest/create")
async def chest_create(character_id: str, body: dict = Body(...)):
    """Crea un baúl vacío en una ubicación refugio. Cuesta 1 mp.

    Body: {"location_id": str}
    Falla con 400 si no hay fondos, 409 si ya existe un baúl en esa ubicación.
    """
    location_id = (body or {}).get("location_id")
    if not location_id:
        raise HTTPException(400, "location_id requerido")

    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    location = await _resolve_location(location_id)
    _ensure_safe_haven(location)
    _ensure_at_location(character, location_id)

    if _find_chest(character, location_id) is not None:
        raise HTTPException(409, "Ya existe un baúl en esta ubicación")

    nuevo_dinero = _charge_chest_creation(character)

    chests = list(character.get("chests") or [])
    chests.append({
        "location_id": location_id,
        "location_nombre": location.get("nombre"),
        "location_region": location.get("region"),
        "items": [],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    })

    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"chests": chests, "dinero": nuevo_dinero, "updated_at": now_utc()}},
    )
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "success": True,
        "chest_created": True,
        "creation_cost": "1 mp",
        "character": serialize_doc(updated),
    }


@router.get("/{character_id}/chests")
async def list_chests(character_id: str):
    """Lista los baúles del personaje con flag de accesibilidad."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    ua = character.get("ubicacion_actual") or {}
    current = ua.get("id") or ua.get("location_id")
    chests = character.get("chests") or []

    # Enriquecemos cada baúl con `accesible` (mismo lugar) para que el frontend
    # lo bloquee visualmente sin necesidad de recalcular.
    out = []
    for c in chests:
        out.append({
            **c,
            "accesible": c.get("location_id") == current,
        })
    return {"chests": out, "ubicacion_actual": ua}


@router.delete("/{character_id}/chest/{location_id}")
async def chest_delete(character_id: str, location_id: str):
    """Elimina el baúl entero de una ubicación (sólo si está vacío o si el
    personaje está allí). Pensado para limpiar entradas residuales."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(404, "Personaje no encontrado")

    chests = list(character.get("chests") or [])
    idx = next((i for i, c in enumerate(chests) if c.get("location_id") == location_id), None)
    if idx is None:
        raise HTTPException(404, "Baúl no encontrado")

    chest = chests[idx]
    if (chest.get("items") or []):
        # Si tiene contenido, requerimos estar allí
        _ensure_at_location(character, location_id)

    chests.pop(idx)
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"chests": chests, "updated_at": now_utc()}},
    )
    return {"success": True, "removed_location_id": location_id}
