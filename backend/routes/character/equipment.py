"""
Character equipment management endpoints: rewards/upgrades, add/remove,
carry/toggle-active, weight summary, mounted toggle, edit-item, mounts CRUD.
Extracted from character_routes.py during the iter95 refactor.
"""
from fastapi import HTTPException, Body, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone
import random
import uuid
from ._common import (
    router, db, generate_id, now_utc, serialize_doc, serialize_docs,
    ApplyEquipmentReward, AddEquipmentRequest, UpdateEquipmentCarryRequest,
    ToggleActiveRequest, EditItemRequest,
    MountCreateRequest, MountUpdateRequest,
    COIN_VALUES, convert_to_base, convert_from_base, price_to_base,
)


# === EQUIPMENT REWARDS ENDPOINT ===

@router.post("/{character_id}/equipment/apply-reward")
async def apply_equipment_reward(character_id: str, data: ApplyEquipmentReward):
    """Apply a reward/upgrade to a character's equipment item"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    equipment_type = data.equipment_type.lower()
    source = data.equipment_source or "armas"
    
    if equipment_type == 'arma':
        # Apply to weapon at specified index
        if data.equipment_index is None:
            raise HTTPException(status_code=400, detail="equipment_index required for weapons")
        
        # Determine which array to use based on source
        source_map = {
            'armas': 'armas',
            'elegidas': 'armas_elegidas',
            'inv': 'inventario',
            'ocupacion': 'equipo_ocupacion',
            'trasfondo': 'equipo_trasfondo',
        }
        array_key = source_map.get(source, 'armas')
        
        armas = character.get(array_key, [])
        if data.equipment_index < 0 or data.equipment_index >= len(armas):
            raise HTTPException(status_code=400, detail=f"Invalid weapon index for {array_key}")
        
        # Get the weapon and add the mejora
        arma = armas[data.equipment_index]
        if isinstance(arma, dict):
            mejoras = arma.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                arma['mejoras'] = mejoras
                armas[data.equipment_index] = arma
                update[array_key] = armas
        else:
            # If weapon is just a string, convert to dict
            armas[data.equipment_index] = {
                'nombre': arma,
                'mejoras': [data.mejora_nombre]
            }
            update[array_key] = armas
            
    elif equipment_type == 'armadura':
        # Apply to armor
        armadura = character.get('armadura', {})
        if isinstance(armadura, dict):
            mejoras = armadura.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                armadura['mejoras'] = mejoras
                update['armadura'] = armadura
        elif isinstance(armadura, str):
            # Convert string to dict
            update['armadura'] = {
                'nombre': armadura,
                'mejoras': [data.mejora_nombre]
            }
        else:
            raise HTTPException(status_code=400, detail="El personaje no tiene armadura")
            
    elif equipment_type == 'escudo':
        # Apply to shield in equipo array
        if data.equipment_index is None:
            raise HTTPException(status_code=400, detail="equipment_index required for shields")
        
        equipo = character.get('equipo', [])
        if data.equipment_index < 0 or data.equipment_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        
        item = equipo[data.equipment_index]
        if isinstance(item, dict):
            mejoras = item.get('mejoras', [])
            if data.mejora_nombre not in mejoras:
                mejoras.append(data.mejora_nombre)
                item['mejoras'] = mejoras
                equipo[data.equipment_index] = item
                update['equipo'] = equipo
        else:
            equipo[data.equipment_index] = {
                'nombre': item,
                'mejoras': [data.mejora_nombre]
            }
            update['equipo'] = equipo
    else:
        raise HTTPException(status_code=400, detail=f"Unknown equipment type: {equipment_type}")
    
    # Update character
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated_character = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated_character)


@router.delete("/{character_id}/equipment/{equipment_type}/{equipment_index}/reward/{mejora_nombre}")
async def remove_equipment_reward(
    character_id: str, 
    equipment_type: str, 
    equipment_index: int,
    mejora_nombre: str
):
    """Remove a reward/upgrade from a character's equipment item"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    equipment_type = equipment_type.lower()
    
    if equipment_type == 'arma':
        armas = character.get('armas', [])
        if equipment_index < 0 or equipment_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice de arma inválido")
        
        arma = armas[equipment_index]
        if isinstance(arma, dict):
            mejoras = arma.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                arma['mejoras'] = mejoras
                armas[equipment_index] = arma
                update['armas'] = armas
                
    elif equipment_type == 'armadura':
        armadura = character.get('armadura', {})
        if isinstance(armadura, dict):
            mejoras = armadura.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                armadura['mejoras'] = mejoras
                update['armadura'] = armadura
                
    elif equipment_type == 'escudo':
        equipo = character.get('equipo', [])
        if equipment_index < 0 or equipment_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        
        item = equipo[equipment_index]
        if isinstance(item, dict):
            mejoras = item.get('mejoras', [])
            if mejora_nombre in mejoras:
                mejoras.remove(mejora_nombre)
                item['mejoras'] = mejoras
                equipo[equipment_index] = item
                update['equipo'] = equipo
    else:
        raise HTTPException(status_code=400, detail=f"Unknown equipment type: {equipment_type}")
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated_character = await db.characters.find_one({"_id": character_id})
    return serialize_doc(updated_character)



# === EQUIPMENT MANAGEMENT ENDPOINTS ===
# Currency helpers + request models live in `_common` (imported above).


@router.post("/{character_id}/equipment/add")
async def add_equipment_to_character(character_id: str, data: AddEquipmentRequest):
    """
    Add equipment to a character.
    - If is_purchase=True, deduct money from character (must have enough)
    - If is_purchase=False, add without cost (gift/treasure/reward)
    - For mounts: add to character.montura and update carrying capacity
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Get equipment catalog to find item details
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    if not catalog:
        raise HTTPException(status_code=500, detail="Equipment catalog not found")
    
    # Find item in catalog
    catalog_item = None
    category_items = catalog.get(data.item_category, [])
    for item in category_items:
        if item.get("nombre", "").lower() == data.item_name.lower():
            catalog_item = item
            break
    
    # Build item object
    new_item = {
        "nombre": data.item_name,
        "cantidad": data.cantidad,
        "categoria": data.item_category,
        "peso_kg": data.peso_kg or (catalog_item.get("peso_kg") if catalog_item else 0),
        "portado_por": "personaje",  # Default: carried by character
        "es_regalo": not data.is_purchase,
    }
    
    # Add category-specific fields
    if "armas" in data.item_category:
        new_item["dano"] = data.dano or (catalog_item.get("dano") if catalog_item else "")
        new_item["herida"] = data.herida or (catalog_item.get("herida") if catalog_item else 0)
        new_item["alcance"] = data.alcance or (catalog_item.get("alcance") if catalog_item else "")
        new_item["tipo"] = catalog_item.get("modificador") if catalog_item else ""
        new_item["activa"] = True  # arma lista para blandir
    elif "armaduras" in data.item_category or data.item_category == "escudos":
        new_item["ca"] = data.ca or (catalog_item.get("ca") if catalog_item else 0)
        new_item["ca_bonus"] = data.ca_bonus if data.ca_bonus is not None else (catalog_item.get("ca_bonus") if catalog_item else 0)
        # Posicion for armor (not shields)
        if "armaduras" in data.item_category:
            new_item["posicion"] = data.posicion or (catalog_item.get("posicion") if catalog_item else "cuerpo")
        new_item["activa"] = True
    elif data.item_category == "ropa":
        new_item["posicion"] = data.posicion or (catalog_item.get("posicion") if catalog_item else "cuerpo")
        new_item["activa"] = True
    
    # Handle purchase
    if data.is_purchase:
        precio = data.precio if data.precio is not None else (catalog_item.get("precio", 0) if catalog_item else 0)
        moneda = data.moneda or (catalog_item.get("moneda", "mp") if catalog_item else "mp")
        
        if precio > 0:
            precio_total = precio * data.cantidad
            precio_base = price_to_base(precio_total, moneda)
            
            dinero_actual = character.get("dinero", {"mo": 0, "mp": 0, "me": 0, "mc": 0})
            dinero_base = convert_to_base(dinero_actual)
            
            if dinero_base < precio_base:
                # Calculate what they can afford
                can_afford = dinero_base // price_to_base(precio, moneda)
                raise HTTPException(
                    status_code=400, 
                    detail=f"Dinero insuficiente. Necesitas {precio_total} {moneda}. Tienes {dinero_actual}. Puedes comprar máximo {can_afford} unidades."
                )
            
            # Deduct money
            nuevo_dinero_base = dinero_base - precio_base
            nuevo_dinero = convert_from_base(nuevo_dinero_base)
            new_item["precio_pagado"] = precio_total
            new_item["moneda_pagada"] = moneda
    else:
        new_item["precio_pagado"] = 0
    
    update = {"updated_at": now_utc()}

    # Handle mounts specially
    if data.item_category == "monturas":
        import uuid as _uuid
        # Add mount to BOTH legacy `montura` (mirror) AND new `monturas[]` array
        capacidad = data.capacidad_carga or (catalog_item.get("capacidad_carga") if catalog_item else 0)
        velocidad = catalog_item.get("velocidad") if catalog_item else 0
        constitucion = catalog_item.get("constitucion") if catalog_item else ""

        new_mount = {
            "id": str(_uuid.uuid4()),
            "nombre_original": data.item_name,
            "nombre_personalizado": data.item_name,
            "especie": data.item_name,
            "capacidad_carga": capacidad or 150,
            "velocidad": velocidad or 12,
            "constitucion": constitucion,
            "equipo": [],
            "es_jinete_activo": False,
        }
        monturas_arr = character.get("monturas", []) or []
        monturas_arr.append(new_mount)
        update["monturas"] = monturas_arr

        # Mirror primary in character.montura for backward compat
        primary = monturas_arr[0]
        update["montura"] = {
            "nombre": primary.get("nombre_original"),
            "nombre_personalizado": primary.get("nombre_personalizado"),
            "capacidad_carga": primary.get("capacidad_carga"),
            "velocidad": primary.get("velocidad"),
            "constitucion": primary.get("constitucion"),
            "equipo": primary.get("equipo", []),
        }
    elif "armas" in data.item_category:
        # Add to armas array
        armas = character.get("armas", [])
        armas.append(new_item)
        update["armas"] = armas
    elif "armaduras" in data.item_category:
        # Si la pieza tiene posicion != cuerpo O viene como ca_bonus > 0,
        # la tratamos como pieza secundaria (brazalete, grebas, hombreras).
        pos = (new_item.get("posicion") or "").lower()
        is_secondary = (pos and pos != "cuerpo") or ((new_item.get("ca_bonus") or 0) > 0 and not new_item.get("ca"))
        if is_secondary:
            piezas = character.get("armadura_piezas", []) or []
            piezas.append(new_item)
            update["armadura_piezas"] = piezas
        else:
            # Reemplaza la armadura principal del cuerpo
            update["armadura"] = new_item
    elif data.item_category == "escudos":
        # Add to equipo
        equipo = character.get("equipo", [])
        equipo.append(new_item)
        update["equipo"] = equipo
    else:
        # Add to inventario
        inventario = character.get("inventario", [])
        # Check if item already exists
        found = False
        for i, item in enumerate(inventario):
            if isinstance(item, dict) and item.get("nombre", "").lower() == data.item_name.lower():
                inventario[i]["cantidad"] = inventario[i].get("cantidad", 1) + data.cantidad
                found = True
                break
        if not found:
            inventario.append(new_item)
        update["inventario"] = inventario
    
    # Update money if purchase
    if data.is_purchase and precio > 0:
        update["dinero"] = nuevo_dinero
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "message": f"{'Comprado' if data.is_purchase else 'Añadido'}: {data.item_name} x{data.cantidad}",
        "character": serialize_doc(updated)
    }


@router.delete("/{character_id}/equipment/remove")
async def remove_equipment_from_character(
    character_id: str,
    item_name: str = Query(...),
    item_category: str = Query(...),
    cantidad: int = Query(default=1)
):
    """Remove equipment from a character's inventory"""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    update = {"updated_at": now_utc()}
    removed = False
    
    if item_category == "monturas":
        # Remove mount
        if character.get("montura", {}).get("nombre", "").lower() == item_name.lower():
            update["montura"] = {}
            removed = True
    elif "armas" in item_category:
        armas = character.get("armas", [])
        for i, arma in enumerate(armas):
            nombre = arma.get("nombre") if isinstance(arma, dict) else arma
            if nombre and nombre.lower() == item_name.lower():
                armas.pop(i)
                removed = True
                break
        update["armas"] = armas
    elif "armaduras" in item_category:
        armadura = character.get("armadura", {})
        if isinstance(armadura, dict) and armadura.get("nombre", "").lower() == item_name.lower():
            update["armadura"] = {}
            removed = True
    elif item_category == "escudos":
        equipo = character.get("equipo", [])
        for i, item in enumerate(equipo):
            nombre = item.get("nombre") if isinstance(item, dict) else item
            if nombre and nombre.lower() == item_name.lower():
                equipo.pop(i)
                removed = True
                break
        update["equipo"] = equipo
    else:
        inventario = character.get("inventario", [])
        for i, item in enumerate(inventario):
            nombre = item.get("nombre") if isinstance(item, dict) else item
            if nombre and nombre.lower() == item_name.lower():
                current_qty = item.get("cantidad", 1) if isinstance(item, dict) else 1
                if current_qty <= cantidad:
                    inventario.pop(i)
                else:
                    inventario[i]["cantidad"] = current_qty - cantidad
                removed = True
                break
        update["inventario"] = inventario
    
    if not removed:
        raise HTTPException(status_code=404, detail=f"Item '{item_name}' not found")
    
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": update}
    )
    
    updated = await db.characters.find_one({"_id": character_id})
    return {
        "message": f"Eliminado: {item_name}",
        "character": serialize_doc(updated)
    }


@router.patch("/{character_id}/equipment/carry")
async def update_equipment_carrier(character_id: str, data: UpdateEquipmentCarryRequest):
    """
    Update who carries an item.

    Supports moving items between the character and the mount across different
    sources: inventario, equipo, armas, armadura principal, armadura_piezas.

    When a ropa/armadura/arma "activa" is moved to the mount it is automatically
    deactivated (no la llevas puesta/lista). The caller is responsible for
    showing the warning toasts in the UI.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    update = {"updated_at": now_utc()}

    # Helper: read the list from update if already mutated (e.g. by
    # auto-promotion below), otherwise from the character document.
    def _current_list(src_key):
        return update.get(src_key, character.get(src_key) or [])

    # Detect mount (primary list, legacy field, OR any equipment source)
    monturas_list = character.get("monturas", []) or []
    has_mount = bool(monturas_list) or bool(character.get("montura", {}).get("nombre"))

    # Fallback: scan all equipment sources (equipo_ocupacion, inventario, ...)
    # to detect a mount that hasn't been promoted to monturas[] yet.
    if not has_mount:
        mount_keywords = ['caballo', 'pony', 'poni', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
        for src_key in ("inventario", "equipo_ocupacion", "equipo_nivel_vida", "equipo_trasfondo"):
            for it in (character.get(src_key) or []):
                nombre = (it.get("nombre") if isinstance(it, dict) else str(it) or "").lower()
                if any(k in nombre for k in mount_keywords):
                    has_mount = True
                    break
            if has_mount:
                break

    if data.carried_by == "montura" and not has_mount:
        raise HTTPException(status_code=400, detail="El personaje no tiene montura")

    # Auto-promote a detected mount into monturas[] if needed so subsequent
    # operations (mount_id assignment, weight-summary per-mount) work.
    if data.carried_by == "montura" and not monturas_list:
        import uuid as _uuid
        # Pick the first mount-like item from any source
        promoted = None
        promoted_source = None
        promoted_index = None
        mount_keywords = ['caballo', 'pony', 'poni', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
        for src_key in ("inventario", "equipo_ocupacion", "equipo_nivel_vida", "equipo_trasfondo"):
            lst = character.get(src_key) or []
            for idx, it in enumerate(lst):
                nombre = (it.get("nombre") if isinstance(it, dict) else str(it) or "").lower()
                if any(k in nombre for k in mount_keywords):
                    promoted = it if isinstance(it, dict) else {"nombre": it}
                    promoted_source = src_key
                    promoted_index = idx
                    break
            if promoted:
                break
        if not promoted and character.get("montura", {}).get("nombre"):
            promoted = character["montura"]

        if promoted:
            # Look up catalog defaults for capacity/speed
            catalog_doc = await db.equipment_catalog.find_one({"_id": "main"}) or {}
            mounts_cat = catalog_doc.get("monturas", []) or []
            cat = next((m for m in mounts_cat if (m.get("nombre") or "").lower().strip() ==
                        (promoted.get("nombre") or "").lower().strip()), None)
            new_mount = {
                "id": str(_uuid.uuid4()),
                "nombre_original": promoted.get("nombre"),
                "nombre_personalizado": promoted.get("nombre_personalizado") or promoted.get("nombre"),
                "especie": promoted.get("nombre"),
                "capacidad_carga": promoted.get("capacidad_carga") or (cat.get("capacidad_carga") if cat else 150),
                "velocidad": promoted.get("velocidad") or (cat.get("velocidad") if cat else 12),
                "constitucion": (cat.get("constitucion") if cat else "") or "",
                "equipo": [],
                "es_jinete_activo": False,
            }
            monturas_list = [new_mount]
            update["monturas"] = monturas_list
            # Mirror primary
            update["montura"] = {
                "nombre": new_mount["nombre_original"],
                "nombre_personalizado": new_mount["nombre_personalizado"],
                "capacidad_carga": new_mount["capacidad_carga"],
                "velocidad": new_mount["velocidad"],
                "constitucion": new_mount["constitucion"],
                "equipo": [],
            }
            # If promoted from inventory-style list, remove the duplicate
            if promoted_source and promoted_index is not None:
                src_list = list(character.get(promoted_source) or [])
                src_list.pop(promoted_index)
                update[promoted_source] = src_list
                # If the user-supplied source is the SAME as the source we
                # just trimmed AND their index was AFTER the removed mount,
                # shift it down by 1 so it still points at the right item.
                if (data.source or "inventario").lower() == promoted_source and \
                   data.item_index > promoted_index:
                    data.item_index -= 1

    # Resolve target mount_id
    target_mount_id = data.mount_id
    if data.carried_by == "montura" and not target_mount_id:
        if monturas_list:
            target_mount_id = monturas_list[0].get("id")

    source = (data.source or "inventario").lower()
    deactivated = False
    item_name = None
    item_posicion = None

    def _apply_move(obj):
        """Apply move semantics to a single item dict. Returns the dict modified."""
        nonlocal deactivated, item_name, item_posicion
        if not isinstance(obj, dict):
            return obj
        obj["portado_por"] = data.carried_by
        if data.carried_by == "montura":
            if target_mount_id:
                obj["mount_id"] = target_mount_id
        else:
            obj.pop("mount_id", None)
        item_name = obj.get("nombre")
        item_posicion = obj.get("posicion")
        if data.carried_by == "montura" and obj.get("activa"):
            obj["activa"] = False
            deactivated = True
        return obj

    if source == "armas":
        armas = _current_list("armas")
        if data.item_index < 0 or data.item_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice de arma inválido")
        item = armas[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        armas = list(armas)
        armas[data.item_index] = _apply_move(item)
        update["armas"] = armas

    elif source == "armadura":
        arm = update.get("armadura", character.get("armadura", {}) or {})
        if not isinstance(arm, dict) or not arm.get("nombre"):
            raise HTTPException(status_code=404, detail="Armadura no encontrada")
        update["armadura"] = _apply_move(arm)

    elif source == "armadura_piezas":
        piezas = list(_current_list("armadura_piezas"))
        if data.item_index < 0 or data.item_index >= len(piezas):
            raise HTTPException(status_code=400, detail="Índice de pieza inválido")
        piezas[data.item_index] = _apply_move(piezas[data.item_index])
        update["armadura_piezas"] = piezas

    elif source == "equipo":
        equipo = list(_current_list("equipo"))
        if data.item_index < 0 or data.item_index >= len(equipo):
            raise HTTPException(status_code=400, detail="Índice de equipo inválido")
        item = equipo[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        equipo[data.item_index] = _apply_move(item)
        update["equipo"] = equipo

    elif source == "equipo_ocupacion":
        eqocup = list(_current_list("equipo_ocupacion"))
        if data.item_index < 0 or data.item_index >= len(eqocup):
            raise HTTPException(status_code=400, detail="Índice de equipo_ocupacion inválido")
        item = eqocup[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        eqocup[data.item_index] = _apply_move(item)
        update["equipo_ocupacion"] = eqocup

    else:  # inventario (default)
        inventario = list(_current_list("inventario"))
        if data.item_index < 0 or data.item_index >= len(inventario):
            raise HTTPException(status_code=400, detail="Índice de objeto inválido")
        item = inventario[data.item_index]
        if not isinstance(item, dict):
            item = {"nombre": item, "cantidad": 1}
        inventario[data.item_index] = _apply_move(item)
        update["inventario"] = inventario

    await db.characters.update_one({"_id": character_id}, {"$set": update})

    updated = await db.characters.find_one({"_id": character_id})
    return {
        "character": serialize_doc(updated),
        "deactivated": deactivated,
        "item_name": item_name,
        "item_posicion": item_posicion,
        "source": source,
    }


@router.patch("/{character_id}/equipment/toggle-active")
async def toggle_equipment_active(character_id: str, data: ToggleActiveRequest):
    """Activate / deactivate a clothing or armor piece.

    - source='inventario': toggle inventario[item_index].activa (ropa)
    - source='armadura': toggle character.armadura.activa (cuerpo)
    - source='armadura_piezas': toggle armadura_piezas[item_index].activa
    - source='armas': toggle armas[item_index].activa (blandida / guardada)
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    source = (data.source or "inventario").lower()
    update = {"updated_at": now_utc()}

    if source == "armadura":
        arm = character.get("armadura", {}) or {}
        if not isinstance(arm, dict) or not arm.get("nombre"):
            raise HTTPException(status_code=404, detail="Armadura no encontrada")
        arm["activa"] = bool(data.activa)
        update["armadura"] = arm
    elif source == "armadura_piezas":
        piezas = character.get("armadura_piezas", []) or []
        if data.item_index < 0 or data.item_index >= len(piezas):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(piezas[data.item_index], dict):
            piezas[data.item_index] = {"nombre": piezas[data.item_index]}
        piezas[data.item_index]["activa"] = bool(data.activa)
        update["armadura_piezas"] = piezas
    elif source == "armas":
        armas = character.get("armas", []) or []
        if data.item_index < 0 or data.item_index >= len(armas):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(armas[data.item_index], dict):
            armas[data.item_index] = {"nombre": armas[data.item_index]}
        armas[data.item_index]["activa"] = bool(data.activa)
        update["armas"] = armas
    elif source == "equipo_ocupacion":
        eqocup = character.get("equipo_ocupacion", []) or []
        if data.item_index < 0 or data.item_index >= len(eqocup):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(eqocup[data.item_index], dict):
            eqocup[data.item_index] = {"nombre": eqocup[data.item_index]}
        eqocup[data.item_index]["activa"] = bool(data.activa)
        update["equipo_ocupacion"] = eqocup
    else:
        inventario = character.get("inventario", []) or []
        if data.item_index < 0 or data.item_index >= len(inventario):
            raise HTTPException(status_code=400, detail="Índice inválido")
        if not isinstance(inventario[data.item_index], dict):
            inventario[data.item_index] = {"nombre": inventario[data.item_index]}
        inventario[data.item_index]["activa"] = bool(data.activa)
        update["inventario"] = inventario

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "activa": bool(data.activa), "source": source}


@router.get("/{character_id}/weight-summary")
async def get_character_weight_summary(character_id: str):
    """
    Calculate detailed weight summary for character including mount.
    Returns:
    - Total weight carried by character
    - Total weight on mount
    - Encumbrance status
    - Mount's remaining capacity
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    
    # Get equipment catalog for weights
    catalog = await db.equipment_catalog.find_one({"_id": "main"})
    
    def get_weight(item_name: str, item_data: dict = None) -> float:
        if item_data and item_data.get("peso_kg"):
            return float(item_data.get("peso_kg", 0))
        if not catalog:
            return 0
        # Search all categories
        for category_items in catalog.values():
            if isinstance(category_items, list):
                for item in category_items:
                    if item.get("nombre", "").lower() == item_name.lower():
                        return float(item.get("peso_kg", 0))
        return 0
    
    peso_personaje = 0
    peso_montura = 0  # total across all mounts
    peso_por_mount_id = {}  # mount_id -> kg

    def _add_mount_weight(peso: float, mount_id: str = None):
        nonlocal peso_montura
        peso_montura += peso
        if mount_id:
            peso_por_mount_id[mount_id] = peso_por_mount_id.get(mount_id, 0) + peso
        else:
            peso_por_mount_id["__unassigned__"] = peso_por_mount_id.get("__unassigned__", 0) + peso
    
    # Mount-related item detection
    mount_names = ['caballo', 'pony', 'poni', 'mula', 'burro', 'corcel', 'yegua', 'potro', 'asno']
    mount_accessory_names = ['silla de monta', 'alforjas', 'bocado', 'bridas', 'bocado y bridas', 
                             'arreos', 'barda', 'silla de montar', 'albarda', 'estribos', 'riendas', 
                             'herradura', 'manta de montar']
    
    def is_mount_related(nombre: str) -> bool:
        lower = nombre.lower()
        return any(m in lower for m in mount_names) or any(a in lower for a in mount_accessory_names)
    
    # Prefer new `monturas` list; fallback to legacy single `montura`
    monturas_list = character.get("monturas", []) or []
    if not monturas_list and character.get("montura", {}).get("nombre"):
        mlegacy = character["montura"]
        monturas_list = [{
            "id": "legacy",
            "nombre_original": mlegacy.get("nombre"),
            "nombre_personalizado": mlegacy.get("nombre_personalizado") or mlegacy.get("nombre"),
            "capacidad_carga": mlegacy.get("capacidad_carga", 0),
            "velocidad": mlegacy.get("velocidad", 0),
        }]

    has_mount = bool(monturas_list)
    default_mount_id = monturas_list[0]["id"] if monturas_list else None
    
    # Weapons - account for portado_por
    for arma in character.get("armas", []):
        if not isinstance(arma, dict):
            peso_personaje += get_weight(arma)
            continue
        nombre = arma.get("nombre")
        peso = get_weight(nombre, arma)
        if arma.get("portado_por") == "montura":
            _add_mount_weight(peso, arma.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Armor (principal) - account for portado_por
    armadura = character.get("armadura", {})
    if isinstance(armadura, dict) and armadura.get("nombre"):
        peso = get_weight(armadura.get("nombre"), armadura)
        if armadura.get("portado_por") == "montura":
            _add_mount_weight(peso, armadura.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Armor pieces (brazalete, grebas, etc.)
    for pieza in character.get("armadura_piezas", []) or []:
        if not isinstance(pieza, dict):
            continue
        peso = get_weight(pieza.get("nombre"), pieza)
        if pieza.get("portado_por") == "montura":
            _add_mount_weight(peso, pieza.get("mount_id") or default_mount_id)
        else:
            peso_personaje += peso

    # Equipo (shield, tools) - account for portado_por
    for item in character.get("equipo", []):
        if isinstance(item, dict):
            peso = get_weight(item.get("nombre"), item)
            if item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)

    # Equipo de ocupación (armas, armaduras, escudos y útiles del trasfondo)
    for item in character.get("equipo_ocupacion", []) or []:
        if isinstance(item, dict):
            peso = get_weight(item.get("nombre"), item)
            if item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)
    
    # Inventory items - check who carries them
    # Mount items ALWAYS go to mount if character has one
    for item in character.get("inventario", []):
        if isinstance(item, dict):
            nombre = item.get("nombre", "")
            cantidad = item.get("cantidad", 1)
            peso = get_weight(nombre, item) * cantidad
            
            # Mount-related items always on mount (if has mount)
            if is_mount_related(nombre) and has_mount:
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            elif item.get("portado_por") == "montura":
                _add_mount_weight(peso, item.get("mount_id") or default_mount_id)
            else:
                peso_personaje += peso
        else:
            peso_personaje += get_weight(item)
    
    # Add coin weight (1 coin ≈ 9g)
    dinero = character.get("dinero", {})
    total_coins = sum(dinero.values())
    peso_personaje += total_coins * 0.009
    
    # Calculate encumbrance
    attrs = character.get("atributos", character.get("caracteristicas", character.get("atributos_finales", {})))
    fuerza = attrs.get("fuerza", 10)
    
    # Base capacity = Strength * 6.8 kg (15 lb per point)
    # With x2 (dwarf trait): doubled
    capacidad_base = fuerza * 6.8
    if character.get("capacidad_carga_x2"):
        capacidad_base *= 2
    
    limite_cargado = fuerza * 2.5  # Encumbered threshold
    limite_muy_cargado = fuerza * 4  # Heavily encumbered threshold
    
    # Mount info — compute per-mount details
    montura = character.get("montura", {})
    # capacidad principal (legacy field, primer montura)
    capacidad_montura = 0
    if monturas_list:
        capacidad_montura = monturas_list[0].get("capacidad_carga", 0)
    elif montura:
        capacidad_montura = montura.get("capacidad_carga", 0)

    # Character's body weight (relevant only when riding)
    peso_corporal = character.get("peso_kg", 0) or 0

    # Whether the rider is mounted right now. Find the mount flagged with
    # es_jinete_activo (or default to monturas[0]).
    montado = bool(character.get("montado", False))
    jinete_mount_id = None
    if montado and monturas_list:
        for m in monturas_list:
            if m.get("es_jinete_activo"):
                jinete_mount_id = m.get("id")
                break
        if jinete_mount_id is None:
            jinete_mount_id = monturas_list[0].get("id")

    # Build per-mount detail
    monturas_detalle = []
    for m in monturas_list:
        mid = m.get("id")
        base_peso = peso_por_mount_id.get(mid, 0)
        # Unassigned items fall onto the primary mount only
        if mid == default_mount_id:
            base_peso += peso_por_mount_id.get("__unassigned__", 0)
        total = base_peso
        lleva_jinete = montado and mid == jinete_mount_id
        if lleva_jinete:
            total += peso_corporal + peso_personaje
        cap = m.get("capacidad_carga", 0) or 0
        monturas_detalle.append({
            "id": mid,
            "nombre": m.get("nombre_personalizado") or m.get("nombre_original"),
            "nombre_original": m.get("nombre_original"),
            "capacidad": cap,
            "velocidad": m.get("velocidad", 0) or 0,
            "peso_cargado": round(total, 2),
            "peso_sin_jinete": round(base_peso, 2),
            "capacidad_restante": round(cap - total, 2) if cap else 0,
            "sobrecargada": bool(cap and total > cap),
            "lleva_jinete": lleva_jinete,
            "es_jinete_activo": bool(m.get("es_jinete_activo")),
        })

    if montado and monturas_list:
        # Primary riding mount receives rider weight
        primary_base = peso_por_mount_id.get(jinete_mount_id, 0)
        if jinete_mount_id == default_mount_id:
            primary_base += peso_por_mount_id.get("__unassigned__", 0)
        peso_total_montura = primary_base + peso_corporal + peso_personaje
    else:
        peso_total_montura = peso_montura

    return {
        "peso_personaje": round(peso_personaje, 2),
        "peso_montura": round(peso_montura, 2),  # Just items (aggregated across all mounts)
        "peso_corporal": round(peso_corporal, 2),  # Character's body weight
        "peso_total_montura": round(peso_total_montura, 2),  # Primary mount-borne weight (depends on montado)
        "capacidad_personaje": round(capacidad_base, 2),
        "limite_cargado": round(limite_cargado, 2),
        "limite_muy_cargado": round(limite_muy_cargado, 2),
        "estado_carga": "muy_cargado" if peso_personaje > limite_muy_cargado else ("cargado" if peso_personaje > limite_cargado else "normal"),
        "tiene_montura": bool(monturas_list) or bool(montura.get("nombre")),
        "nombre_montura": (monturas_list[0].get("nombre_personalizado") or monturas_list[0].get("nombre_original")) if monturas_list else montura.get("nombre", ""),
        "capacidad_montura": capacidad_montura,
        "capacidad_montura_restante": round(capacidad_montura - peso_total_montura, 2) if capacidad_montura else 0,
        "montado": montado,
        "montura_sobrecargada": bool(capacidad_montura and peso_total_montura > capacidad_montura),
        "monturas_detalle": monturas_detalle,
        "jinete_mount_id": jinete_mount_id,
    }


@router.patch("/{character_id}/mounted")
async def toggle_mounted(
    character_id: str,
    montado: bool = Body(..., embed=True),
    mount_id: Optional[str] = Body(None, embed=True),
):
    """Toggle the rider's mounted state and (optionally) select which mount to ride.

    If `mount_id` is provided, sets `es_jinete_activo=True` on that mount and
    False on all others. Keeps `character.montura` as a mirror of the active
    mount for backward compatibility.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas_list = character.get("monturas", []) or []
    update = {"montado": bool(montado), "updated_at": now_utc()}

    if monturas_list:
        target_id = mount_id or next((m.get("id") for m in monturas_list if m.get("es_jinete_activo")), None)
        if not target_id:
            target_id = monturas_list[0].get("id")
        new_monturas = []
        target_mount = None
        for m in monturas_list:
            m2 = dict(m)
            m2["es_jinete_activo"] = (m2.get("id") == target_id and bool(montado))
            if m2["es_jinete_activo"]:
                target_mount = m2
            new_monturas.append(m2)
        update["monturas"] = new_monturas
        if montado and target_mount:
            update["montura"] = {
                "nombre": target_mount.get("nombre_original"),
                "nombre_personalizado": target_mount.get("nombre_personalizado"),
                "capacidad_carga": target_mount.get("capacidad_carga"),
                "velocidad": target_mount.get("velocidad"),
                "constitucion": target_mount.get("constitucion"),
                "equipo": target_mount.get("equipo", []),
            }

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    active_mount_id = None
    if montado and monturas_list:
        for m in update.get("monturas", []):
            if m.get("es_jinete_activo"):
                active_mount_id = m.get("id")
                break
    return {
        "montado": bool(montado),
        "mount_id": active_mount_id,
        "character": serialize_doc(updated),
    }


@router.patch("/{character_id}/equipment/edit-item")
async def edit_equipment_item(character_id: str, data: EditItemRequest):
    """Edit free-form fields (categoria, posicion, nombre) of an item that
    already lives in the character's inventario / equipo / equipo_ocupacion.

    Useful when the player wants to reclassify a misfiled item — e.g.,
    "Raciones (1 día) (Paquete de 10)" sitting under General that should
    really live under Consumibles.
    """
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Personaje no encontrado")

    src = (data.source or "inventario").lower()
    if src not in ("inventario", "equipo", "equipo_ocupacion"):
        raise HTTPException(status_code=400, detail="Source no soportado")

    lst = character.get(src, []) or []
    if data.item_index < 0 or data.item_index >= len(lst):
        raise HTTPException(status_code=400, detail="Índice fuera de rango")

    item = lst[data.item_index]
    if not isinstance(item, dict):
        item = {"nombre": str(item), "cantidad": 1}

    if data.nueva_categoria is not None:
        item["categoria"] = data.nueva_categoria
    if data.nueva_posicion is not None:
        item["posicion"] = data.nueva_posicion
    if data.nuevo_nombre is not None and data.nuevo_nombre.strip():
        item["nombre"] = data.nuevo_nombre.strip()

    lst[data.item_index] = item
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {src: lst, "updated_at": now_utc()}}
    )
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "item": item}




# ---------------------------------------------------------------------------
# Multi-mount CRUD endpoints
# ---------------------------------------------------------------------------

@router.post("/{character_id}/monturas")
async def add_mount(character_id: str, data: MountCreateRequest):
    """Add a new mount to character.monturas[]. Returns the new mount id."""
    import uuid as _uuid
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    new_mount = {
        "id": str(_uuid.uuid4()),
        "nombre_original": data.nombre_original,
        "nombre_personalizado": data.nombre_personalizado or data.nombre_original,
        "especie": data.especie or data.nombre_original,
        "capacidad_carga": data.capacidad_carga or 150,
        "velocidad": data.velocidad or 12,
        "constitucion": data.constitucion or "",
        "equipo": [],
        "es_jinete_activo": False,
    }

    monturas = character.get("monturas", []) or []
    monturas.append(new_mount)
    await db.characters.update_one(
        {"_id": character_id},
        {"$set": {"monturas": monturas, "updated_at": now_utc()}}
    )
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated), "mount": new_mount}


@router.patch("/{character_id}/monturas/{mount_id}")
async def update_mount(character_id: str, mount_id: str, data: MountUpdateRequest):
    """Rename or adjust a mount (capacity/speed)."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas = character.get("monturas", []) or []
    found = False
    for m in monturas:
        if m.get("id") == mount_id:
            if data.nombre_personalizado is not None:
                m["nombre_personalizado"] = data.nombre_personalizado
            if data.capacidad_carga is not None:
                m["capacidad_carga"] = data.capacidad_carga
            if data.velocidad is not None:
                m["velocidad"] = data.velocidad
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Montura no encontrada")

    # Mirror primary in character.montura
    update = {"monturas": monturas, "updated_at": now_utc()}
    primary = monturas[0]
    update["montura"] = {
        "nombre": primary.get("nombre_original"),
        "nombre_personalizado": primary.get("nombre_personalizado"),
        "capacidad_carga": primary.get("capacidad_carga"),
        "velocidad": primary.get("velocidad"),
        "constitucion": primary.get("constitucion"),
        "equipo": primary.get("equipo", []),
    }

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated)}


@router.delete("/{character_id}/monturas/{mount_id}")
async def delete_mount(character_id: str, mount_id: str):
    """Remove a mount. Items carried by it fall to the character."""
    character = await db.characters.find_one({"_id": character_id})
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    monturas = character.get("monturas", []) or []
    monturas = [m for m in monturas if m.get("id") != mount_id]

    # Reassign items that belonged to this mount
    def _reassign(lst):
        if not isinstance(lst, list):
            return lst
        out = []
        for it in lst:
            if isinstance(it, dict) and it.get("mount_id") == mount_id:
                it = dict(it)
                it["portado_por"] = "personaje"
                it.pop("mount_id", None)
            out.append(it)
        return out

    update = {
        "monturas": monturas,
        "inventario": _reassign(character.get("inventario", []) or []),
        "equipo": _reassign(character.get("equipo", []) or []),
        "equipo_ocupacion": _reassign(character.get("equipo_ocupacion", []) or []),
        "armas": _reassign(character.get("armas", []) or []),
        "armadura_piezas": _reassign(character.get("armadura_piezas", []) or []),
        "updated_at": now_utc(),
    }
    # Armadura is a single dict
    arm = character.get("armadura", {}) or {}
    if isinstance(arm, dict) and arm.get("mount_id") == mount_id:
        arm = dict(arm)
        arm["portado_por"] = "personaje"
        arm.pop("mount_id", None)
        update["armadura"] = arm

    # Mirror primary
    if monturas:
        p = monturas[0]
        update["montura"] = {
            "nombre": p.get("nombre_original"),
            "nombre_personalizado": p.get("nombre_personalizado"),
            "capacidad_carga": p.get("capacidad_carga"),
            "velocidad": p.get("velocidad"),
            "constitucion": p.get("constitucion"),
            "equipo": p.get("equipo", []),
        }
    else:
        update["montura"] = {}
        update["montado"] = False

    await db.characters.update_one({"_id": character_id}, {"$set": update})
    updated = await db.characters.find_one({"_id": character_id})
    return {"character": serialize_doc(updated)}



