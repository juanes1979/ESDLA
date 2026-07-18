"""
Character drafts & creation wizard endpoints (steps 1-9, finalize, portrait).
Extracted from character_routes.py during the iter95 refactor.
"""
from fastapi import HTTPException, Body, Depends
import logging

logger = logging.getLogger(__name__)
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone
import random
import uuid
from ._common import (
    router, db, generate_id, now_utc, serialize_doc, serialize_docs,
    generate_codigo_publico,
    CharacterAttributes, CharacterSkill, EquipmentItem,
    CharacterCreateStep1, CharacterCreateStep2, CharacterCreateStep3,
    CharacterCreateStep4, CharacterCreateStep5, CharacterCreateStep6,
    CharacterCreateStep7, CharacterCreateStep8, CharacterCreateStep9,
    CharacterDraft,
    _owner_filter, _ensure_owner,
)
from auth import get_current_user


# === CHARACTER CREATION ENDPOINTS ===

@router.get("/drafts")
async def list_character_drafts(user: dict = Depends(get_current_user)):
    """List character drafts owned by the current user (Maestro sees all)."""
    query = {"estado": "borrador"}
    query.update(_owner_filter(user))
    drafts = await db.character_drafts.find(query).to_list(100)
    return {"drafts": serialize_docs(drafts)}


@router.post("/draft")
async def create_character_draft(user: dict = Depends(get_current_user)):
    """Create a new character draft for the wizard"""
    draft = {
        "_id": generate_id(),
        "paso_actual": 1,
        "estado": "borrador",
        "owner_id": user.get("id"),
        "owner_email": user.get("email"),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.character_drafts.insert_one(draft)
    return serialize_doc(draft)


@router.delete("/draft/{draft_id}")
async def delete_character_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Delete a character draft"""
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    _ensure_owner(draft, user, "borrador")
    result = await db.character_drafts.delete_one({"_id": draft_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"message": "Draft deleted"}


@router.get("/draft/{draft_id}")
async def get_character_draft(draft_id: str, user: dict = Depends(get_current_user)):
    """Get current state of a character draft"""
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    _ensure_owner(draft, user, "borrador")
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step1")
async def update_draft_step1(draft_id: str, data: CharacterCreateStep1):
    """Update draft with Step 1 complete culture data (30 fields from plan)"""
    # Verify culture exists
    culture = await db.cultures.find_one({"_id": data.cultura_id})
    if not culture:
        raise HTTPException(status_code=404, detail="Culture not found")
    
    # Build update with all data from frontend
    update = {
        # Basic info
        "nombre": data.nombre,
        "jugador": data.jugador,
        "cultura_id": data.cultura_id,
        "cultura_nombre": culture['nombre'],
        
        # Physical data (from frontend)
        "genero": data.genero,
        "raza": data.raza or culture.get('raza'),
        "edad": data.edad,
        "altura_cm": data.altura_cm,
        "peso_kg": data.peso_kg,
        "ojos": data.ojos,
        "piel": data.piel,
        "pelo": data.pelo,
        
        # Culture stats
        "velocidad": data.velocidad or culture.get('velocidad', 9),
        "descanso": data.descanso or culture.get('descanso', 8),
        "tamanio": data.tamanio or culture.get('tamanio', 'Mediano'),
        "nivel_vida": data.nivel_vida or culture.get('nivel_vida'),
        "descripcion_nivel_vida": culture.get('descripcion_nivel_vida'),
        
        # Characteristics (base 8 + culture bonuses + Noldor if applicable)
        "caracteristicas": data.caracteristicas,
        "mejora_noldor_seleccion": data.mejora_noldor,  # Which characteristic got +1
        "bonificadores_cultura": culture.get('bonificadores_caracteristicas', {}),
        
        # Skills and competencies
        "habilidades_puntuaciones": data.habilidades_puntuaciones or culture.get('habilidades_puntuaciones', {}),
        "competencias_habilidades_cultura": data.competencias_habilidades or culture.get('competencias_habilidades', []),
        "rasgos_culturales": data.rasgos_culturales or culture.get('rasgos_culturales', []),
        "idiomas": data.idiomas or culture.get('idiomas', []),
        
        # Culture selections made by user
        "competencia_habilidad_cultura": data.competencia_habilidad_cultura,
        "competencia_herramienta_1": data.competencia_herramienta_1,
        "competencias_herramientas_2": data.competencias_herramientas_2 or [],
        "competencia_adicional": data.competencia_adicional or culture.get('competencia_adicional'),
        
        # Special features
        "pg_extra_nivel": data.pg_extra_nivel or culture.get('pg_extra_nivel'),
        "capacidad_carga_x2": data.capacidad_carga_x2 or culture.get('capacidad_carga_x2'),
        "tiene_virtud_inicial": data.tiene_virtud_inicial if data.tiene_virtud_inicial is not None else culture.get('tiene_virtud_inicial', False),
        
        # Wizard state
        "paso_actual": 2,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step2")
async def update_draft_step2(draft_id: str, data: CharacterCreateStep2):
    """Update draft with Step 2 data (background with skills and tools selections)"""
    background = await db.backgrounds.find_one({"_id": data.trasfondo_id})
    if not background:
        raise HTTPException(status_code=404, detail="Background not found")
    
    # Use data from frontend if provided, otherwise fall back to background defaults
    habilidades_trasfondo = data.competencias_habilidades_trasfondo if data.competencias_habilidades_trasfondo else (
        background.get('competencias_habilidades_auto', [])
    )
    herramientas_trasfondo = data.competencias_herramientas_trasfondo if data.competencias_herramientas_trasfondo else (
        background.get('competencias_herramientas_1', []) + background.get('competencias_herramientas_2', [])
    )
    
    # Equipment from background: use frontend-provided if available, otherwise from background data
    equipo_trasfondo = data.equipo_trasfondo if hasattr(data, 'equipo_trasfondo') and data.equipo_trasfondo else background.get('equipo_inicial', [])
    
    update = {
        "trasfondo_id": data.trasfondo_id,
        "trasfondo_nombre": data.trasfondo_nombre or background['nombre'],
        "competencias_trasfondo": {
            "habilidades": habilidades_trasfondo,
            "herramientas": herramientas_trasfondo,
            "idiomas": background.get('idiomas', []),
        },
        # Also store at top level for easier access during filtering
        "competencias_habilidades_trasfondo": habilidades_trasfondo,
        "equipo_trasfondo": equipo_trasfondo,  # Use frontend data or background defaults
        "rasgos_trasfondo": data.rasgos_trasfondo if data.rasgos_trasfondo else background.get('rasgos_descripciones', []),
        "descripcion_trasfondo": background.get('descripcion'),  # NEW: From row 5 of Trasfondo sheet
        "paso_actual": 3,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step3")
async def update_draft_step3(draft_id: str, data: CharacterCreateStep3):
    """Update draft with Step 3 data (occupation with skills, armor, weapons, expertise, tools)"""
    occupation = await db.occupations.find_one({"_id": data.ocupacion_id})
    if not occupation:
        raise HTTPException(status_code=404, detail="Occupation not found")
    
    # Calculate initial HP
    dado_golpe = occupation.get('dado_golpe', '1d8')
    hp_inicial = int(occupation.get('puntos_golpe_nivel1', 8) or 8)
    
    # Get current draft to consolidate all skill competencies
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Consolidate all skill competencies from culture + background + occupation
    all_skill_competencies = []
    # From culture - automatic
    all_skill_competencies.extend(draft.get('competencias_habilidades_cultura', []))
    # From culture - single choice
    if draft.get('competencia_habilidad_cultura'):
        all_skill_competencies.append(draft['competencia_habilidad_cultura'])
    # From culture - "herramientas_2" which actually contains SKILLS for some cultures like Dunedain
    all_skill_competencies.extend(draft.get('competencias_herramientas_2', []))
    # From background
    all_skill_competencies.extend(draft.get('competencias_trasfondo', {}).get('habilidades', []))
    all_skill_competencies.extend(draft.get('competencias_habilidades_trasfondo', []))
    # From occupation (just selected)
    all_skill_competencies.extend(data.habilidades_elegidas)
    
    # Dedupe while preserving order
    seen = set()
    unique_skills = []
    for skill in all_skill_competencies:
        clean = skill.split(' (')[0].strip() if skill else ''
        if clean and clean.lower() not in seen:
            seen.add(clean.lower())
            unique_skills.append(skill)
    
    update = {
        "ocupacion_id": data.ocupacion_id,
        "vocacion_nombre": occupation['vocacion'],
        "ocupacion_nombre": occupation['vocacion'],  # Alias for easier access
        "dado_golpe": dado_golpe,
        "puntos_golpe_base": hp_inicial,
        "caracteristicas_principales": occupation.get('caracteristicas_principales', []),
        "competencias_ocupacion": {
            "tiradas_salvacion": occupation.get('tiradas_salvacion', []),
            "armas": occupation.get('competencia_armas', []),
            "armaduras": occupation.get('competencia_armaduras', []),
        },
        # Favored skills from occupation
        "habilidades_favorecidas": occupation.get('habilidades_favorecidas', []),
        # Shadow path (maldición de la ocupación)
        "maldicion_nombre": occupation.get('maldicion_nombre'),
        "maldicion_descripcion": occupation.get('maldicion_descripcion'),
        # Occupation descriptions and special abilities
        "descripcion_corta": occupation.get('descripcion_corta', ''),  # Short description from row 16
        "descripcion_ocupacion": occupation.get('descripcion_ocupacion', ''),
        "descripcion_ocupacion_larga": occupation.get('descripcion_ocupacion_larga', ''),
        "especiales_ocupacion1": occupation.get('especiales_ocupacion1', ''),
        "especiales_ocupacion1_descripcion": occupation.get('especiales_ocupacion1_descripcion', ''),
        "especiales_ocupacion2": occupation.get('especiales_ocupacion2', ''),
        "especiales_ocupacion2_descripcion": occupation.get('especiales_ocupacion2_descripcion', ''),
        "especiales_ocupacion3": occupation.get('especiales_ocupacion3', ''),
        "especiales_ocupacion3_descripcion": occupation.get('especiales_ocupacion3_descripcion', ''),
        "especiales_ocupacion4": occupation.get('especiales_ocupacion4', ''),
        "especiales_ocupacion4_descripcion": occupation.get('especiales_ocupacion4_descripcion', ''),
        "especiales_ocupacion5": occupation.get('especiales_ocupacion5', ''),
        "especiales_ocupacion5_descripcion": occupation.get('especiales_ocupacion5_descripcion', ''),
        "especiales_ocupacion6": occupation.get('especiales_ocupacion6', ''),
        "especiales_ocupacion6_descripcion": occupation.get('especiales_ocupacion6_descripcion', ''),
        # Virtue/Art text for level-up system
        "ocupacion_virtudes_texto": occupation.get('virtudes_texto', []),
        "ocupacion_virtudes_ocupacion": occupation.get('virtudes_ocupacion', ''),
        # Caminos de profesión
        "caminos_profesion": occupation.get('caminos_profesion', ''),
        "caminos_profesion1": occupation.get('caminos_profesion1', ''),
        "caminos_profesion2": occupation.get('caminos_profesion2', ''),
        # Skills, tools, armor, weapons, expertise from user selection
        "habilidades_elegidas_ocupacion": data.habilidades_elegidas,
        "herramientas_elegidas_ocupacion": data.herramientas_elegidas,
        "pericia_elegida": data.pericia_elegida,
        "equipo_ocupacion": data.equipo_ocupacion,
        "armadura_elegida": data.armadura_elegida,
        # Consolidated field with ALL skill competencies for easy access
        "habilidades_competencia": unique_skills,
        "paso_actual": 4,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step4")
async def update_draft_step4(draft_id: str, data: CharacterCreateStep4):
    """Update draft with Step 4 data (attributes)"""
    # Get draft to apply culture modifiers
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    mod_cultura = draft.get('mod_cultura', {})
    
    # Apply culture modifiers to base attributes
    atributos_finales = {
        "fuerza": data.atributos.fuerza + mod_cultura.get('fuerza', 0),
        "destreza": data.atributos.destreza + mod_cultura.get('destreza', 0),
        "constitucion": data.atributos.constitucion + mod_cultura.get('constitucion', 0),
        "inteligencia": data.atributos.inteligencia + mod_cultura.get('inteligencia', 0),
        "sabiduria": data.atributos.sabiduria + mod_cultura.get('sabiduria', 0),
        "carisma": data.atributos.carisma + mod_cultura.get('carisma', 0),
    }
    
    # Calculate HP with constitution modifier
    con_mod = (atributos_finales['constitucion'] - 10) // 2
    hp_base = draft.get('puntos_golpe_base', 8)
    hp_final = hp_base + con_mod
    
    update = {
        "atributos_base": data.atributos.model_dump(),
        "atributos_finales": atributos_finales,
        "metodo_asignacion": data.metodo_asignacion,
        "puntos_golpe_max": hp_final,
        "puntos_golpe_actual": hp_final,
        "paso_actual": 5,
        "updated_at": now_utc(),
    }
    
    await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step5")
async def update_draft_step5(draft_id: str, data: CharacterCreateStep5):
    """Update draft with Step 5 data (virtue) - All virtue data with bonuses"""
    virtue = await db.virtues.find_one({"_id": data.virtud_id})
    if not virtue:
        raise HTTPException(status_code=404, detail="Virtue not found")
    
    # Get current draft to apply virtue bonuses
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    # Base attributes for applying virtue bonuses.
    # IMPORTANT: este asistente asigna los atributos DENTRO del paso de Cultura
    # (Step1) y los guarda en `caracteristicas` (base + bonos de cultura + Noldor
    # + mejora libre). El endpoint step4 (`atributos_finales`) NO se ejecuta en
    # el flujo real, por lo que `atributos_finales` suele estar vacío. Partimos
    # SIEMPRE de `caracteristicas` (recalculando en fresco para no acumular +1 si
    # el jugador vuelve a este paso) y solo caemos a `atributos_finales` si aquél
    # no existiera.
    atributos = dict(draft.get('caracteristicas') or draft.get('atributos_finales') or {})
    caracteristicas_fijas = data.virtud_caracteristicas_fijas or virtue.get('caracteristicas_fijas', {})
    
    for attr, bonus in caracteristicas_fijas.items():
        if attr in atributos and bonus:
            atributos[attr] += bonus

    # Apply the CHOSEN characteristic (+1) selected by the player among the options.
    _CHAR_MAP = {
        'FUERZA': 'fuerza', 'DESTREZA': 'destreza',
        'CONSTITUCIÓN': 'constitucion', 'CONSTITUCION': 'constitucion',
        'INTELIGENCIA': 'inteligencia',
        'SABIDURÍA': 'sabiduria', 'SABIDURIA': 'sabiduria',
        'CARISMA': 'carisma',
    }
    for ch in (data.virtud_caracteristicas_elegir or []):
        key = _CHAR_MAP.get(str(ch).strip().upper())
        if key and key in atributos:
            atributos[key] += 1

    # PERFECCIONAMIENTO: +2 a una característica o +1 a dos (tope 20 por atributo).
    for attr, bonus in (data.virtud_perfeccionamiento or {}).items():
        key = _CHAR_MAP.get(str(attr).strip().upper()) or (attr if attr in atributos else None)
        if key and key in atributos and bonus:
            atributos[key] = min(20, atributos[key] + int(bonus))

    # Tope de seguridad: ninguna característica supera 20 por bonos de virtud.
    for k in list(atributos.keys()):
        try:
            if atributos[k] > 20:
                atributos[k] = 20
        except (TypeError, ValueError):
            pass
    
    # Build the update with all virtue data
    update = {
        "virtud_id": data.virtud_id,
        "virtud_nombre": data.virtud_nombre or virtue.get('nombre'),
        "virtud_descripcion": data.virtud_descripcion or virtue.get('descripcion'),
        "virtud_rasgos": data.virtud_rasgos or virtue.get('rasgos_virtud') or virtue.get('competencias_texto'),
        # Characteristic bonuses
        "virtud_caracteristicas_fijas": caracteristicas_fijas,
        "virtud_caracteristicas_elegir": data.virtud_caracteristicas_elegir or virtue.get('caracteristicas_elegir', []),
        # Saving throw proficiencies to choose
        "virtud_salvaciones_elegir": data.virtud_salvaciones_elegir or virtue.get('salvaciones_elegir', []),
        # Extra stats
        "virtud_pg_extra": data.virtud_pg_extra or virtue.get('puntos_golpe_extra', 0),
        "virtud_comunidad_extra": data.virtud_comunidad_extra or virtue.get('puntos_comunidad_extra', 0),
        "virtud_ca_extra": data.virtud_ca_extra or virtue.get('clase_armadura_extra', 0),
        # Skill/tool proficiencies to choose
        "virtud_habilidades_elegir": data.virtud_habilidades_elegir or virtue.get('competencias_habilidades_elegir', []),
        "virtud_herramientas_elegir": data.virtud_herramientas_elegir or virtue.get('competencias_herramientas_elegir', []),
        # MAESTRÍA: pericia elegida (doble competencia) y PERFECCIONAMIENTO
        "virtud_pericia_elegida": data.virtud_pericia_elegida,
        "virtud_perfeccionamiento": data.virtud_perfeccionamiento or {},
        # Update attributes with fixed bonuses
        "atributos_finales": atributos,
        "paso_actual": 6,  # Continue to skills step
        "updated_at": now_utc(),
    }

    # Virtudes especiales que añaden una montura al personaje
    # ("Poni de Bree" para los Hombres de Bree).
    nombre_virtud = (data.virtud_nombre or virtue.get('nombre') or '').strip().lower()
    if nombre_virtud == 'poni de bree':
        # Stats canónicos del Poni de Bree.
        montura_data = {
            "nombre": "Poni de Bree",
            "tipo": "poni",
            "carga_kg": 101,
            "capacidad_carga": 101,
            "constitucion": 13,
            "constitucion_mod": 1,
            "velocidad": 12,
            "tamano": "Mediano",  # también puede actuar como pequeño
            "tamano_alt": "Pequeño",
            "transporta_equipo": True,
            "origen": "Virtud cultural de los Hombres de Bree",
            "rasgos": [
                "Usa el bonificador por competencia del personaje",
                "Mejora sus estadísticas con la experiencia del jinete",
                "Puede actuar en combate bajo las órdenes de su dueño",
            ],
            "ganado_via_virtud": True,
            "equipo": [],  # equipo cargado en la montura
        }
        update["montura"] = montura_data

        # También añade el poni al inventario para que aparezca en "Equipo
        # completo" y se pueda gestionar (cargar equipo en él) desde la
        # ficha. Sólo se añade si todavía no está.
        existing_inv = draft.get('inventario', []) or []
        already_has = any(
            (it.get('nombre') if isinstance(it, dict) else str(it)).strip().lower() == 'poni de bree'
            for it in existing_inv
        )
        if not already_has:
            existing_inv = existing_inv + [{
                "nombre": "Poni de Bree",
                "categoria": "monturas",
                "cantidad": 1,
                "peso_kg": 0,  # el peso de la montura no afecta al estorbo del jinete
                "portado_por": "personaje",  # se monta, no se carga
                "es_montura": True,
                "ganado_via_virtud": True,
                "capacidad_carga_kg": 101,
            }]
            update["inventario"] = existing_inv
    
    await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step6")
async def update_draft_step6(draft_id: str, data: CharacterCreateStep6):
    """Update draft with Step 6 data (skills)"""
    update = {
        "habilidades_elegidas": data.habilidades,
        "paso_actual": 7,
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step7")
async def update_draft_step7(draft_id: str, data: CharacterCreateStep7):
    """Update draft with Step 7 data (equipment - automático según nivel de vida)"""
    update = {
        "inventario": [item.model_dump() for item in data.inventario],
        "dinero": data.dinero,
        "paso_actual": 8,  # Ahora hay 8 pasos, no 9
        "updated_at": now_utc(),
    }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step8")
async def update_draft_step8(draft_id: str, data: CharacterCreateStep8):
    """Update draft with Step 8 data (patron)"""
    update = {
        "paso_actual": 9,
        "updated_at": now_utc(),
    }
    
    if data.patron_id:
        patron = await db.patrons.find_one({"_id": data.patron_id})
        if not patron:
            raise HTTPException(status_code=404, detail="Patron not found")
        update["patron_id"] = data.patron_id
        update["patron_nombre"] = patron['nombre']
        update["puntos_comunidad"] = patron.get('puntos_comunidad', 0)
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/step9")
async def update_draft_step9(draft_id: str, data: CharacterCreateStep9):
    """Update draft with Step 9/8 data (final details - rasgos del trasfondo + historia)"""
    update = {
        "rasgo_distintivo": data.rasgo_distintivo,
        "rasgo_distintivo_2": data.rasgo_distintivo_2,  # Second distinctive trait
        "motivacion": data.motivacion,
        "historia": data.historia,
        "paso_actual": 9,  # Complete (8 pasos + 1 = finalizado)
        "updated_at": now_utc(),
    }
    if data.ubicacion_id:
        # Resolve and store full ubicacion_actual snapshot
        loc = await db.locations.find_one({"id": data.ubicacion_id}) or \
              await db.locations.find_one({"_id": data.ubicacion_id})
        if not loc:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")
        update["ubicacion_actual"] = {
            "id": loc.get("id") or loc.get("_id"),
            "nombre": loc.get("nombre"),
            "region": loc.get("region"),
            "tipo": loc.get("tipo"),
            "x": loc.get("x"),
            "y": loc.get("y"),
            "tipo_tierra": loc.get("tipo_tierra") or loc.get("clase_region"),
            "terreno": loc.get("terreno"),
        }
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": update}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    draft = await db.character_drafts.find_one({"_id": draft_id})
    return serialize_doc(draft)


@router.patch("/draft/{draft_id}/portrait")
async def update_draft_portrait(draft_id: str, data: dict):
    """Update draft with AI-generated portrait image"""
    portrait_image = data.get('portrait_image')
    
    if not portrait_image:
        raise HTTPException(status_code=400, detail="portrait_image is required")
    
    result = await db.character_drafts.update_one(
        {"_id": draft_id},
        {"$set": {
            "portrait_image": portrait_image,
            "updated_at": now_utc(),
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Draft not found")
    
    return {"success": True, "message": "Portrait updated"}


@router.post("/draft/{draft_id}/finalize")
async def finalize_character(draft_id: str, user: dict = Depends(get_current_user)):
    """Convert a completed draft into a final character"""
    draft = await db.character_drafts.find_one({"_id": draft_id})
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    _ensure_owner(draft, user, "borrador")
    
    # Validate draft is complete enough - virtud es opcional (solo 3 culturas la obtienen)
    required_fields = ['nombre', 'cultura_id', 'trasfondo_id', 'ocupacion_id']
    # Check for characteristics (might be in 'caracteristicas' or 'atributos_finales')
    has_attributes = draft.get('caracteristicas') or draft.get('atributos_finales')
    
    missing = [f for f in required_fields if not draft.get(f)]
    if not has_attributes:
        missing.append('caracteristicas')
    
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Draft incomplete. Missing: {', '.join(missing)}"
        )
    
    # Create final character document
    # Usa 'atributos_finales' (base + modificadores de cultura + mejora Noldor +
    # bonos de virtud acumulados) y solo cae a 'caracteristicas' (base) si faltara.
    final_attributes = draft.get('atributos_finales') or draft.get('caracteristicas', {})
    
    character = {
        "_id": generate_id(),
        # Propietario heredado del draft (sólo el dueño y el Maestro pueden ver/editar).
        "owner_id": draft.get('owner_id') or user.get('id'),
        "owner_email": draft.get('owner_email') or user.get('email'),
        "nombre": draft['nombre'],
        "jugador": draft.get('jugador'),
        # Culture
        "cultura_id": draft['cultura_id'],
        "cultura_nombre": draft['cultura_nombre'],
        "categoria_cultura": draft.get('categoria_cultura'),
        "genero": draft.get('genero'),
        "edad": draft.get('edad'),
        "altura_cm": draft.get('altura_cm'),
        "peso_kg": draft.get('peso_kg'),
        "ojos": draft.get('ojos'),
        "piel": draft.get('piel'),
        "pelo": draft.get('pelo'),
        "tamano": draft.get('tamanio'),
        "velocidad": draft.get('velocidad'),
        "nivel_vida": draft.get('nivel_vida'),
        # Background
        "trasfondo_id": draft['trasfondo_id'],
        "trasfondo_nombre": draft.get('trasfondo_nombre'),
        "descripcion_trasfondo": draft.get('descripcion_trasfondo'),
        # Occupation
        "ocupacion_id": draft['ocupacion_id'],
        "ocupacion_tipo": draft.get('ocupacion_tipo'),
        "vocacion_nombre": draft.get('vocacion_nombre'),
        "dado_golpe": draft.get('dado_golpe'),
        # Attributes
        "atributos": final_attributes,
        # Virtue (optional - only cultures with tiene_virtud_inicial get virtue at level 1)
        "virtud_id": draft.get('virtud_id'),
        "virtud_nombre": draft.get('virtud_nombre'),
        "virtud_descripcion": draft.get('virtud_descripcion'),
        "virtud_rasgos": draft.get('virtud_rasgos'),
        "virtud_caracteristicas_fijas": draft.get('virtud_caracteristicas_fijas', {}),
        "virtud_caracteristicas_elegir": draft.get('virtud_caracteristicas_elegir', []),
        "virtud_salvaciones_elegir": draft.get('virtud_salvaciones_elegir', []),
        "virtud_pg_extra": draft.get('virtud_pg_extra', 0),
        "virtud_comunidad_extra": draft.get('virtud_comunidad_extra', 0),
        "virtud_ca_extra": draft.get('virtud_ca_extra', 0),
        "virtud_habilidades_elegir": draft.get('virtud_habilidades_elegir', []),
        "virtud_herramientas_elegir": draft.get('virtud_herramientas_elegir', []),
        # MAESTRÍA: pericia (doble competencia) y PERFECCIONAMIENTO elegido
        "virtud_pericia_elegida": draft.get('virtud_pericia_elegida'),
        "virtud_perfeccionamiento": draft.get('virtud_perfeccionamiento', {}),
        # Legacy field for backwards compatibility
        "rasgos_virtud": draft.get('virtud_rasgos') or draft.get('rasgos_virtud'),
        # Cultural traits (rasgos culturales from culture)
        "rasgos_culturales": draft.get('rasgos_culturales', []),
        # ALL Skills and competencies consolidated
        "habilidades_competencia": draft.get('habilidades_competencia', []),
        "habilidades_elegidas_ocupacion": draft.get('habilidades_elegidas_ocupacion', []),
        "pericia_elegida": draft.get('pericia_elegida', []),
        "competencias": {
            "tiradas_salvacion": draft.get('competencias_ocupacion', {}).get('tiradas_salvacion', []),
            "armaduras": draft.get('competencias_ocupacion', {}).get('armaduras', []),
            "armas": draft.get('competencias_ocupacion', {}).get('armas', []),
            "habilidades_cultura": draft.get('competencias_habilidades_cultura', []),
            "habilidades_trasfondo": draft.get('competencias_trasfondo', {}).get('habilidades', []),
            "herramientas": draft.get('competencias_trasfondo', {}).get('herramientas', []),
            "idiomas": draft.get('idiomas', []),
        },
        # Equipment from all sources
        "inventario": draft.get('inventario', []),
        "equipo_ocupacion": draft.get('equipo_ocupacion', []),
        "herramientas_elegidas_ocupacion": draft.get('herramientas_elegidas_ocupacion', []),
        "dinero": draft.get('dinero', {"mp": 0, "mo": 0, "me": 0, "mc": 0}),
        # Combat stats
        "puntos_golpe_max": draft.get('puntos_golpe_base', 8),
        "puntos_golpe_actual": draft.get('puntos_golpe_base', 8),
        "clase_armadura": 10 + ((final_attributes.get('destreza', 10) - 10) // 2),
        # Patron
        "patron_id": draft.get('patron_id'),
        "patron_nombre": draft.get('patron_nombre'),
        "puntos_comunidad": draft.get('puntos_comunidad', 0),
        # Personal details - TWO distinctive traits
        "rasgo_distintivo": draft.get('rasgo_distintivo'),
        "rasgo_distintivo_2": draft.get('rasgo_distintivo_2') or draft.get('defecto'),  # Fallback to defecto
        "motivacion": draft.get('motivacion'),
        "historia": draft.get('historia'),
        # Initial location chosen by player
        "ubicacion_actual": draft.get('ubicacion_actual'),
        # Progression
        "nivel": 1,
        "experiencia": 0,
        # Favored skills from occupation
        "habilidades_favorecidas": draft.get('habilidades_favorecidas', []),
        # Shadow path (maldición de la ocupación)
        "senda_sombra": draft.get('maldicion_nombre'),
        "senda_sombra_descripcion": draft.get('maldicion_descripcion'),
        # Shadow points
        "puntos_sombra": 0,
        "puntos_sombra_permanentes": 0,
        
        # NEW: Shadow/Estado fields (for rules, to be set later)
        "desanimado": False,
        "angustiado": False,
        "descripcion_sombra": None,
        
        # NEW: Recompensas (rewards, to be filled later by game master)
        "recompensa1": None,
        "recompensa2": None,
        "recompensa3": None,
        "recompensa4": None,
        "recompensa5": None,
        "recompensa6": None,
        
        # NEW: Additional resources
        "heredero": None,
        "inversion": None,
        
        # NEW: Descriptions from data (populated from culture/occupation/etc)
        "descripcion_cultura": draft.get('descripcion_cultura'),
        "descripcion_riqueza": draft.get('descripcion_riqueza'),
        "riqueza": draft.get('riqueza'),
        "descripcion_corta": draft.get('descripcion_corta'),  # Short description from row 16
        "descripcion_ocupacion": draft.get('descripcion_ocupacion'),
        "descripcion_ocupacion_larga": draft.get('descripcion_ocupacion_larga'),
        
        # NEW: Mecenas fields
        "mecenas": draft.get('mecenas'),
        "descripcion_mecenas": draft.get('descripcion_mecenas'),
        "ventaja_mecenas": draft.get('ventaja_mecenas'),
        
        # NEW: Especiales de ocupación
        "especiales_ocupacion1": draft.get('especiales_ocupacion1'),
        "especiales_ocupacion1_descripcion": draft.get('especiales_ocupacion1_descripcion'),
        "especiales_ocupacion2": draft.get('especiales_ocupacion2'),
        "especiales_ocupacion2_descripcion": draft.get('especiales_ocupacion2_descripcion'),
        "especiales_ocupacion3": draft.get('especiales_ocupacion3'),
        "especiales_ocupacion3_descripcion": draft.get('especiales_ocupacion3_descripcion'),
        "especiales_ocupacion4": draft.get('especiales_ocupacion4'),
        "especiales_ocupacion4_descripcion": draft.get('especiales_ocupacion4_descripcion'),
        "especiales_ocupacion5": draft.get('especiales_ocupacion5'),
        "especiales_ocupacion5_descripcion": draft.get('especiales_ocupacion5_descripcion'),
        "especiales_ocupacion6": draft.get('especiales_ocupacion6'),
        "especiales_ocupacion6_descripcion": draft.get('especiales_ocupacion6_descripcion'),
        
        # NEW: Caminos de profesión
        "caminos_profesion": draft.get('caminos_profesion'),
        "caminos_profesion1": draft.get('caminos_profesion1'),
        "caminos_profesion2": draft.get('caminos_profesion2'),
        
        # NEW: Virtudes de ocupación y virtudes seleccionadas (texto para level-up)
        "ocupacion_virtudes_texto": draft.get('ocupacion_virtudes_texto', []),
        "virtudes_ocupacion": draft.get('virtudes_ocupacion') or draft.get('ocupacion_virtudes_ocupacion'),
        # Virtues and arts obtained through level-up
        "virtudes_obtenidas": draft.get('virtudes_obtenidas', []),
        "artes_obtenidas": draft.get('artes_obtenidas', []),
        "espacios_arte": draft.get('espacios_arte', 0),
        "virtud1": draft.get('virtud1'),
        "virtud1_descripcion": draft.get('virtud1_descripcion'),
        "virtud1_rasgos": draft.get('virtud1_rasgos'),
        "virtud2": draft.get('virtud2'),
        "virtud2_descripcion": draft.get('virtud2_descripcion'),
        "virtud2_rasgos": draft.get('virtud2_rasgos'),
        "virtud3": draft.get('virtud3'),
        "virtud3_descripcion": draft.get('virtud3_descripcion'),
        "virtud3_rasgos": draft.get('virtud3_rasgos'),
        "virtud4": draft.get('virtud4'),
        "virtud4_descripcion": draft.get('virtud4_descripcion'),
        "virtud4_rasgos": draft.get('virtud4_rasgos'),
        # Mount obtained via virtue (e.g. "Poni de Bree" for Bree Men)
        "montura": draft.get('montura') or {},
        
        # Meta
        "estado": "activo",
        "portrait_image": draft.get('portrait_image'),  # AI-generated portrait
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    
    # Insert character and delete draft
    # --- Promote any mounts sitting in the draft inventory into monturas[] ---
    # (Fix for bug where Step7 shop purchases of mounts got stuck in inventory.)
    import uuid as _uuid
    catalog_doc = await db.equipment_catalog.find_one({"_id": "main"}) or {}
    mounts_catalog = catalog_doc.get("monturas", []) or []

    def _lookup_mount(name: str):
        if not name:
            return None
        n = name.lower().strip()
        for m in mounts_catalog:
            if (m.get("nombre") or "").lower().strip() == n:
                return m
        return None

    mount_keywords = ("caballo", "poni", "pony", "mula", "burro", "corcel", "yegua", "potro", "asno")
    promoted_mounts = []
    remaining_inventory = []
    for item in character.get("inventario", []) or []:
        if not isinstance(item, dict):
            remaining_inventory.append(item)
            continue
        cat = (item.get("categoria") or "").lower()
        name = item.get("nombre") or ""
        is_mount = cat == "monturas" or any(kw in name.lower() for kw in mount_keywords)
        if not is_mount:
            remaining_inventory.append(item)
            continue
        cat_item = _lookup_mount(name) or {}
        qty = max(1, int(item.get("cantidad") or 1))
        for _ in range(qty):
            promoted_mounts.append({
                "id": str(_uuid.uuid4()),
                "nombre_original": name,
                "nombre_personalizado": name,
                "especie": name,
                "capacidad_carga": item.get("capacidad_carga") or cat_item.get("capacidad_carga") or 150,
                "velocidad": item.get("velocidad") or cat_item.get("velocidad") or 12,
                "constitucion": item.get("constitucion") or cat_item.get("constitucion") or "",
                "equipo": [],
                "es_jinete_activo": False,
            })

    # If the draft had a legacy `montura` object AND we didn't promote any mounts,
    # seed monturas[] from it so the virtue-based mount (Poni de Bree) also lands in the list.
    legacy_mount = draft.get("montura") or {}
    if promoted_mounts:
        character["inventario"] = remaining_inventory
        character["monturas"] = promoted_mounts
        # Mirror primary to legacy field (back-compat with panels that still read it)
        primary = promoted_mounts[0]
        character["montura"] = {
            "nombre": primary.get("nombre_original"),
            "nombre_personalizado": primary.get("nombre_personalizado"),
            "capacidad_carga": primary.get("capacidad_carga"),
            "velocidad": primary.get("velocidad"),
            "constitucion": primary.get("constitucion"),
            "equipo": primary.get("equipo", []),
        }
    elif legacy_mount.get("nombre"):
        # Virtue-granted mount (Poni de Bree). Build monturas[] entry.
        character["monturas"] = [{
            "id": str(_uuid.uuid4()),
            "nombre_original": legacy_mount.get("nombre"),
            "nombre_personalizado": legacy_mount.get("nombre"),
            "especie": legacy_mount.get("nombre"),
            "capacidad_carga": legacy_mount.get("capacidad_carga") or legacy_mount.get("carga_kg") or 101,
            "velocidad": legacy_mount.get("velocidad") or 12,
            "constitucion": legacy_mount.get("constitucion") or "",
            "equipo": legacy_mount.get("equipo", []) or [],
            "es_jinete_activo": False,
        }]
    else:
        character.setdefault("monturas", [])

    # Enriquecer el equipo desde el catálogo (categoria / peso_kg / posicion /
    # ropa_complementaria) y auto-equipar la ropa para que el personaje no
    # aparezca "desnudo" ni con pesos a 0.
    from utils.equipment_enrich import build_catalog_index, enrich_items, auto_equip_ropa
    try:
        catalogo = await db.equipment_catalog.find_one({"_id": "main"}) or await db.equipment_catalog.find_one({})
        cat_index = build_catalog_index(catalogo or {})
        for _k in ("inventario", "equipo_trasfondo", "equipo_ocupacion", "equipo"):
            enrich_items(character.get(_k), cat_index)
        auto_equip_ropa(character.get("inventario"))
        auto_equip_ropa(character.get("equipo_trasfondo"))
    except Exception as exc:
        logger.warning(f"[finalize_character] aviso: no se pudo enriquecer/auto-equipar el equipo: {exc}")

    # --- Aplicar bonos numéricos y competencias de la VIRTUD al personaje ---
    try:
        pg_extra = int(draft.get('virtud_pg_extra') or 0)
        ca_extra = int(draft.get('virtud_ca_extra') or 0)
        com_extra = int(draft.get('virtud_comunidad_extra') or 0)
        if pg_extra:
            character['puntos_golpe_max'] = (character.get('puntos_golpe_max') or 0) + pg_extra
            character['puntos_golpe_actual'] = (character.get('puntos_golpe_actual') or 0) + pg_extra
        if ca_extra:
            character['clase_armadura'] = (character.get('clase_armadura') or 10) + ca_extra
        if com_extra:
            character['puntos_comunidad'] = (character.get('puntos_comunidad') or 0) + com_extra

        comp = character.get('competencias', {}) or {}
        hab_virtud = [h for h in (draft.get('virtud_habilidades_elegir') or []) if h]
        sal_virtud = [s for s in (draft.get('virtud_salvaciones_elegir') or []) if s]
        herr_virtud = [t for t in (draft.get('virtud_herramientas_elegir') or []) if t]
        if hab_virtud:
            comp['habilidades_virtud'] = hab_virtud
        if sal_virtud:
            ts = list(comp.get('tiradas_salvacion') or [])
            for s in sal_virtud:
                if s not in ts:
                    ts.append(s)
            comp['tiradas_salvacion'] = ts
        if herr_virtud:
            hr = list(comp.get('herramientas') or [])
            for t in herr_virtud:
                if t not in hr:
                    hr.append(t)
            comp['herramientas'] = hr
        character['competencias'] = comp
        # Característica elegida (ya aplicada a atributos en step5), guardada aparte
        # para mostrarla claramente en la ficha (campo DescripciónVirtud).
        character['virtud_caracteristica_elegida'] = (draft.get('virtud_caracteristicas_elegir') or [None])[0]

        # MAESTRÍA: la pericia elegida se añade a `pericia_elegida` para que la
        # ficha la marque con "P" y duplique el bonificador por competencia.
        pericia_virtud = draft.get('virtud_pericia_elegida')
        if pericia_virtud:
            per = list(character.get('pericia_elegida') or [])
            if pericia_virtud not in per:
                per.append(pericia_virtud)
            character['pericia_elegida'] = per
    except Exception as exc:
        logger.warning(f"[finalize_character] aviso: no se pudieron aplicar los bonos de la virtud: {exc}")

    await db.characters.insert_one(character)
    await db.character_drafts.delete_one({"_id": draft_id})
    
    # Genera el código público único una vez creado y persistido el personaje
    # (`finalize_character` ya dejaba el documento en BD pero no asignaba este
    # identificador, por lo que las fichas más recientes aparecían sin él).
    try:
        codigo = await generate_codigo_publico(character)
        await db.characters.update_one(
            {"_id": character["_id"]},
            {"$set": {"codigo_publico": codigo, "updated_at": now_utc()}},
        )
        character["codigo_publico"] = codigo
    except Exception as exc:
        # No bloquear la finalización si el cálculo del código falla; se
        # podrá rellenar después con /character/{id}/codigo o la migración.
        logger.warning(f"[finalize_character] aviso: no se pudo asignar código público: {exc}")
    
    return serialize_doc(character)


