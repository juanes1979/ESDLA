"""
EYE OF MORDOR — Phase 2: Generación de Episodios de Revelación con IA
======================================================================

Cuando la Atención supera el Umbral de Caza, el Ojo "encuentra" al
grupo y sucede algo malo. Esta capa usa GPT-4o (Emergent LLM Key) para
proponer un evento narrativo + efecto mecánico, con un prompt EDITABLE
por el DJ desde Reglas → Sombra.

Flujo:
1. Frontend pulsa "Disparar Episodio" cuando attention >= threshold.
2. Backend POST /eye/propose-episode → recibe contexto (location,
   currentThreat, partyState, recentActions, enemyInfluence) y devuelve
   {event_type, description, mechanical_effect, tone}.
3. DJ revisa/edita el output en un modal. Pulsa "Aplicar".
4. Frontend POST /eye/apply-episode → persiste el evento en
   eye_state.history y dispara reset (vuelta a initial_value).

8 plantillas mecánicas (event_type):
  - desventaja_global    : todas las tiradas → desventaja temporal
  - rechazo_social       : dificultad social ↑
  - tentacion            : +3 sombra al personaje más débil
  - traicion             : NPC aliado se vuelve hostil
  - fatiga_sobrenatural  : +1 nivel cansancio a todos
  - escape_imposible     : enemigo escapa o perseguidor alcanza
  - emboscada_inevitable : enemigos detectan automáticamente
  - buff_enemigo         : odio temerario / agresividad / fuerza horrible
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
import os
import json
import re
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/eye/ai", tags=["eye-of-mordor-ai"])

_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        _db = _client[os.environ['DB_NAME']]
    return _db


# ============== PLANTILLAS DE EPISODIOS ==============
EPISODE_TYPES: Dict[str, Dict[str, str]] = {
    "desventaja_global": {
        "label": "Desventaja Global",
        "default_effect": "Durante la próxima escena, TODAS las tiradas se hacen con desventaja por la opresiva sensación de ser observados.",
    },
    "rechazo_social": {
        "label": "Rechazo Social",
        "default_effect": "La actitud de los NPCs cae un grado (amistoso→neutral, neutral→hostil) durante el resto del día.",
    },
    "tentacion": {
        "label": "Tentación de la Sombra",
        "default_effect": "El personaje más vulnerable gana +3 puntos de Sombra al verse tentado por su debilidad personal.",
    },
    "traicion": {
        "label": "Traición",
        "default_effect": "Un NPC aliado o de confianza se vuelve problemático/hostil; siembra discordia o roba algo importante.",
    },
    "fatiga_sobrenatural": {
        "label": "Fatiga Sobrenatural",
        "default_effect": "TODOS los miembros del grupo ganan +1 nivel de cansancio sin causa física aparente.",
    },
    "escape_imposible": {
        "label": "Escape Imposible",
        "default_effect": "Un enemigo escapa con información clave, o un perseguidor cierra distancia inevitablemente.",
    },
    "emboscada_inevitable": {
        "label": "Emboscada Inevitable",
        "default_effect": "Los enemigos detectan al grupo automáticamente sin posibilidad de tirada de Percepción/Sigilo.",
    },
    "buff_enemigo": {
        "label": "Refuerzo del Enemigo",
        "default_effect": "El próximo combate: enemigos ganan rasgo Odio Temerario, Agresividad o Fuerza Horrible (a elección del DJ).",
    },
}


# ============== PROMPT POR DEFECTO (EDITABLE) ==============
DEFAULT_AI_PROMPT_ID = "default"

DEFAULT_SYSTEM_PROMPT = """Eres el Narrador del Mal de El Señor de los Anillos. Tu tarea es generar EPISODIOS DE REVELACIÓN cuando la Atención del Enemigo supera el Umbral de Caza. La Sombra ha encontrado al grupo y reacciona de forma creíble — NO con encuentros aleatorios sin sentido, sino con consecuencias DERIVADAS de la situación actual.

REGLAS NARRATIVAS:
1. NO uses orcos atacando en la Comarca sin motivo. Adapta al contexto.
2. La Sombra se manifiesta como: corrupción sutil, destino adverso, comportamiento extraño de NPCs/animales, magia oscura, decisiones que salen mal.
3. El tono debe ser oscuro, ominoso, sutil — como en los libros de Tolkien.
4. La descripción debe ser VÍVIDA pero CORTA (máx 3 frases).
5. El efecto mecánico debe ser CLARO y APLICABLE inmediatamente.

DEBES devolver EXCLUSIVAMENTE un JSON válido (sin markdown, sin prefijos):
{
  "event_type": "<uno de: desventaja_global|rechazo_social|tentacion|traicion|fatiga_sobrenatural|escape_imposible|emboscada_inevitable|buff_enemigo>",
  "description": "<3 frases narrativas evocadoras>",
  "mechanical_effect": "<efecto mecánico claro y aplicable>",
  "tone": "<dark|ominous|subtle>"
}"""


# ============== MODELOS ==============
class PartyState(BaseModel):
    fatigue: Optional[str] = None
    shadow: Optional[str] = None
    goal: Optional[str] = None


class EpisodeContext(BaseModel):
    location: Optional[str] = None
    currentThreat: Optional[str] = None
    partyState: Optional[PartyState] = None
    recentActions: List[str] = []
    enemyInfluence: str = "medium"  # low|medium|high


class ProposeEpisodeRequest(BaseModel):
    state_id: str = "default"
    context: EpisodeContext


class ApplyEpisodeRequest(BaseModel):
    state_id: str = "default"
    event_type: str
    description: str
    mechanical_effect: str
    tone: str = "ominous"


class PromptUpdateRequest(BaseModel):
    system_prompt: str


# ============== HELPERS DEL PROMPT EDITABLE ==============
async def _load_system_prompt(prompt_id: str = DEFAULT_AI_PROMPT_ID) -> str:
    db = _get_db()
    doc = await db.eye_ai_prompts.find_one({"id": prompt_id}, {"_id": 0})
    if not doc:
        # Lazy seed con el prompt por defecto.
        await db.eye_ai_prompts.insert_one({
            "id": prompt_id,
            "system_prompt": DEFAULT_SYSTEM_PROMPT,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        return DEFAULT_SYSTEM_PROMPT
    return doc.get("system_prompt") or DEFAULT_SYSTEM_PROMPT


@router.get("/prompt")
async def get_prompt():
    sp = await _load_system_prompt()
    return {"id": DEFAULT_AI_PROMPT_ID, "system_prompt": sp, "default_prompt": DEFAULT_SYSTEM_PROMPT}


@router.post("/prompt")
async def set_prompt(req: PromptUpdateRequest):
    if not req.system_prompt.strip():
        raise HTTPException(400, "system_prompt no puede estar vacío")
    db = _get_db()
    await db.eye_ai_prompts.update_one(
        {"id": DEFAULT_AI_PROMPT_ID},
        {"$set": {
            "system_prompt": req.system_prompt,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"id": DEFAULT_AI_PROMPT_ID, "system_prompt": req.system_prompt, "saved": True}


@router.post("/prompt/reset")
async def reset_prompt():
    db = _get_db()
    await db.eye_ai_prompts.update_one(
        {"id": DEFAULT_AI_PROMPT_ID},
        {"$set": {
            "system_prompt": DEFAULT_SYSTEM_PROMPT,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"system_prompt": DEFAULT_SYSTEM_PROMPT, "reset": True}


# ============== GENERACIÓN ==============
def _build_user_prompt(ctx: EpisodeContext) -> str:
    party = ctx.partyState or PartyState()
    parts = []
    parts.append(f"UBICACIÓN: {ctx.location or 'desconocida'}")
    if ctx.currentThreat:
        parts.append(f"AMENAZA ACTUAL: {ctx.currentThreat}")
    if party.goal:
        parts.append(f"OBJETIVO DEL GRUPO: {party.goal}")
    if party.fatigue:
        parts.append(f"FATIGA DEL GRUPO: {party.fatigue}")
    if party.shadow:
        parts.append(f"SOMBRA: {party.shadow}")
    if ctx.recentActions:
        parts.append("ACCIONES RECIENTES:\n- " + "\n- ".join(ctx.recentActions[:6]))
    parts.append(f"INFLUENCIA DEL ENEMIGO: {ctx.enemyInfluence}")
    parts.append("\nGenera un EPISODIO DE REVELACIÓN apropiado para esta situación. Devuelve SOLO el JSON.")
    return "\n".join(parts)


def _extract_json(raw: str) -> Dict[str, Any]:
    """Extrae el primer bloque JSON del texto del LLM (robusto ante markdown)."""
    # Quita ```json ... ```
    raw = re.sub(r'```(?:json)?\s*', '', raw, flags=re.IGNORECASE).replace('```', '')
    # Busca el primer { ... } balanceado
    start = raw.find('{')
    if start < 0:
        raise ValueError("No JSON found in LLM response")
    depth = 0
    for i in range(start, len(raw)):
        if raw[i] == '{':
            depth += 1
        elif raw[i] == '}':
            depth -= 1
            if depth == 0:
                return json.loads(raw[start:i + 1])
    raise ValueError("Unbalanced JSON in LLM response")


@router.post("/propose-episode")
async def propose_episode(req: ProposeEpisodeRequest):
    """
    Genera un episodio narrativo + efecto mecánico con GPT-4o.
    Devuelve {event_type, description, mechanical_effect, tone, raw}.
    No persiste nada — el DJ revisa y luego llama a /apply-episode.
    """
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY no configurada")

    system_prompt = await _load_system_prompt()
    user_prompt = _build_user_prompt(req.context)

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=api_key,
            session_id=f"eye-{req.state_id}-{uuid.uuid4().hex[:6]}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o")
        response = await chat.send_message(UserMessage(text=user_prompt))
    except Exception as e:
        raise HTTPException(502, f"Error llamando al LLM: {e}")

    try:
        data = _extract_json(response)
    except Exception as e:
        # Fallback graceful: devolvemos un episodio del template "desventaja_global"
        fallback = {
            "event_type": "desventaja_global",
            "description": "La Sombra os mira fijamente. Sentís una presencia que pesa sobre cada paso.",
            "mechanical_effect": EPISODE_TYPES["desventaja_global"]["default_effect"],
            "tone": "ominous",
        }
        return {
            **fallback,
            "raw": response,
            "parse_error": str(e),
            "fallback_used": True,
        }

    # Sanitiza campos requeridos
    et = data.get("event_type", "desventaja_global")
    if et not in EPISODE_TYPES:
        et = "desventaja_global"

    return {
        "event_type": et,
        "event_label": EPISODE_TYPES[et]["label"],
        "description": str(data.get("description", "")).strip()
                         or "La Sombra os ha encontrado.",
        "mechanical_effect": str(data.get("mechanical_effect", "")).strip()
                             or EPISODE_TYPES[et]["default_effect"],
        "tone": data.get("tone", "ominous"),
        "raw": response,
        "fallback_used": False,
    }


@router.post("/apply-episode")
async def apply_episode(req: ApplyEpisodeRequest):
    """
    Persiste el episodio confirmado por el DJ en eye_state.history y
    dispara el reset (attention_total → initial_value). Devuelve el
    state actualizado.
    """
    db = _get_db()
    state = await db.eye_state.find_one({"id": req.state_id}, {"_id": 0})
    if not state:
        raise HTTPException(404, f"Eye state {req.state_id} no encontrado. Inicializa primero.")

    pre_attention = int(state.get("attention_total", 0))
    initial_value = int(state.get("initial_value", 0))

    entry = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": "episode_applied",
        "delta": -(pre_attention - initial_value),
        "event_type": req.event_type,
        "event_label": EPISODE_TYPES.get(req.event_type, {}).get("label", req.event_type),
        "description": req.description,
        "mechanical_effect": req.mechanical_effect,
        "tone": req.tone,
        "descripcion": f"Episodio: {req.event_type}",
    }

    state["attention_total"] = initial_value
    state["last_episode_at"] = entry["ts"]
    state["history"] = (state.get("history", []) + [entry])[-200:]
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    state.pop("_id", None)
    await db.eye_state.update_one({"id": req.state_id}, {"$set": state}, upsert=True)

    return {
        "state": state,
        "applied_episode": entry,
        "previous_attention": pre_attention,
    }


@router.get("/episode-types")
async def list_episode_types():
    """Devuelve los 8 tipos de episodios y su descripción mecánica por defecto."""
    return {"types": [{"id": k, **v} for k, v in EPISODE_TYPES.items()]}
