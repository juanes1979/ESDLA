"""
Moderation Routes — Validación inteligente de texto introducido por usuarios.

Usado por el creador de personajes (nombres del personaje, jugador), creación de
ubicaciones por DJs, etc., para evitar que el usuario introduzca términos sexuales,
políticos, juegos de palabras inapropiados, palabrotas, insultos u ofensas.

Endpoints:
  POST /api/moderation/check-name   → IA valida y devuelve {appropriate, category, reason}
  GET  /api/moderation/alerts       → (Maestro) lista los intentos bloqueados, con stats
  POST /api/moderation/clear-alerts → (Maestro) borra el log de intentos

Hasta que llegue el sistema de Auth + Roles, las rutas administrativas se protegen
con el header `X-Admin-Token` (mismo token que `ADMIN_BACKUP_TOKEN`).
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
import os
import re
import uuid
import json
import logging

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger("moderation")

router = APIRouter(prefix="/moderation", tags=["Moderation"])

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
ALERTS = db['moderation_alerts']


# ────────────────────────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────────────────────────
ContextLiteral = Literal[
    'character_name',
    'character_surname',
    'player_name',
    'location_name',
    'campaign_name',
    'other',
]


class CheckNameRequest(BaseModel):
    text: str = Field(..., max_length=200)
    context: ContextLiteral = 'other'
    user_label: Optional[str] = None  # nombre del jugador (cuando ya se sepa). Hasta auth.
    draft_id: Optional[str] = None


class CheckNameResponse(BaseModel):
    appropriate: bool
    category: str  # 'ok' | 'profanity' | 'sexual' | 'political' | 'insult' | 'nonsense' | 'other'
    reason: str
    flagged_term: Optional[str] = None


# ────────────────────────────────────────────────────────────────────
# Token check (admin endpoints only)
# ────────────────────────────────────────────────────────────────────
def _check_admin_token(token: Optional[str]) -> None:
    expected = os.environ.get('ADMIN_BACKUP_TOKEN')
    if not expected:
        raise HTTPException(status_code=500, detail="ADMIN_BACKUP_TOKEN no configurado.")
    if not token or token != expected:
        raise HTTPException(status_code=401, detail="Token de admin inválido.")


# ────────────────────────────────────────────────────────────────────
# Pre-filter (heurístico, sin coste de IA)
# ────────────────────────────────────────────────────────────────────
# Para textos triviales (vacíos, demasiado cortos, sólo letras y de longitud razonable)
# devolvemos "ok" sin invocar al LLM. Para textos sospechosos por estructura
# (números mezclados, símbolos, repeticiones extrañas) sí pedimos IA.

# Lista mínima de términos manifiestamente bloqueados — corta el flujo sin IA.
HARD_BANLIST = {
    # palabrotas castellanas habituales
    'puta', 'puto', 'putas', 'putos', 'gilipollas', 'mierda', 'cabron', 'cabrón',
    'cabrones', 'joder', 'coño', 'cono', 'polla', 'pollas', 'pene', 'penes',
    'verga', 'vergas', 'culo', 'culos', 'tetas', 'pija', 'pijo',
    'follar', 'follame', 'follate',
    # insultos / ofensivo
    'maricon', 'maricón', 'maricones', 'sudaca', 'puta madre',
    # nazi / ofensa étnica
    'nazi', 'hitler',
}

CONTEXT_LABEL_ES = {
    'character_name': 'el nombre del personaje',
    'character_surname': 'el apellido del personaje',
    'player_name': 'el nombre del jugador',
    'location_name': 'el nombre de la ubicación',
    'campaign_name': 'el nombre de la campaña',
    'other': 'el texto',
}


def _hard_check(text: str) -> Optional[CheckNameResponse]:
    raw = (text or '').strip()
    if not raw:
        return CheckNameResponse(
            appropriate=False, category='nonsense',
            reason='El campo está vacío.', flagged_term=None,
        )
    if len(raw) > 80:
        return CheckNameResponse(
            appropriate=False, category='nonsense',
            reason='Demasiado largo (máximo 80 caracteres).', flagged_term=None,
        )

    lower = raw.lower()
    # Detectar palabras enteras del banlist
    tokens = re.findall(r"[\w']+", lower)
    for t in tokens:
        if t in HARD_BANLIST:
            return CheckNameResponse(
                appropriate=False, category='profanity',
                reason='Contiene una palabra inapropiada.', flagged_term=t,
            )
    # Heurística: spam de caracteres (aaaaaaa, qwerty, asdf)
    if re.search(r"(.)\1{4,}", lower):
        return CheckNameResponse(
            appropriate=False, category='nonsense',
            reason='Texto con repetición evidente (no parece un nombre real).',
            flagged_term=None,
        )
    # Si pasa el pre-filtro, devolver None y dejar que decida la IA
    return None


# ────────────────────────────────────────────────────────────────────
# IA check
# ────────────────────────────────────────────────────────────────────
async def _llm_check(text: str, context: ContextLiteral) -> CheckNameResponse:
    """
    Pregunta a la IA si el texto es apropiado para el contexto.
    Si la IA falla por cualquier razón → fail-open (devuelve appropriate=true)
    pero registra el incidente para que el Maestro lo revise.
    """
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY ausente — fail-open en moderación")
        return CheckNameResponse(
            appropriate=True, category='ok',
            reason='IA no disponible: aceptado provisionalmente.',
        )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        ctx_label = CONTEXT_LABEL_ES.get(context, 'el texto')
        is_character = context in ('character_name', 'character_surname')
        tolkien_clause = (
            "- ACEPTA libremente nombres tolkienianos o que recuerden a personajes de El Señor de "
            "los Anillos / El Hobbit / El Silmarillion (Aragorn, Frodo, Boromir, Galadriel, etc.). "
            "Es un juego ambientado en la Tierra Media — los jugadores PUEDEN homenajear personajes.\n"
            if is_character else
            "- RECHAZA nombres de personajes icónicos de Tolkien usados como nombre real del jugador "
            "(Aragorn, Gandalf, Frodo, Sauron…). Para el nombre del jugador esperamos un nombre real.\n"
        )

        system_msg = (
            "Eres un moderador de contenido para un videojuego de rol ambientado en la Tierra Media "
            "de Tolkien. Tu tarea es decidir si un texto introducido por un usuario es APROPIADO "
            "para usarse en el juego.\n\n"
            "RECHAZA contenido que sea:\n"
            "- Sexual o vulgar (genitales, actos sexuales, insinuaciones obscenas).\n"
            "- Político / ideológico contemporáneo (líderes actuales, partidos, ideologías polémicas, "
            "  figuras políticas reales de los siglos XX-XXI).\n"
            "- Palabrotas, insultos u ofensas (en cualquier idioma).\n"
            "- Juegos de palabras claramente humorísticos fuera de tono (ej. 'Pepito Pistolas', 'Don Pene').\n"
            "- Referencias a marcas o productos comerciales reales.\n"
            "- Texto sin sentido (mashing de teclado, números aleatorios, símbolos repetidos).\n"
            "- Nombres de figuras históricas reales mediáticas de los siglos XIX-XXI (Hitler, Stalin, etc.).\n\n"
            "ACEPTA:\n"
            "- Nombres ficticios coherentes con la Tierra Media o con culturas reales antiguas/medievales.\n"
            "- Nombres comunes en castellano o cualquier idioma (Juan, Carlos, María, Olga, John, Pedro, Ana).\n"
            "- Nombres extraños pero plausibles para el género de fantasía.\n"
            "- Apodos sobrios.\n"
            f"{tolkien_clause}\n"
            "IMPORTANTE: en caso de duda razonable, ACEPTA. Sólo rechaza si está claramente "
            "fuera de tono.\n\n"
            "Responde SIEMPRE en formato JSON estricto, sin texto adicional ni markdown:\n"
            '{"appropriate": true|false, "category": "ok|profanity|sexual|political|insult|nonsense|other", '
            '"reason": "explicación breve en español (max 80 caracteres)"}'
        )

        prompt = (
            f"Contexto: {ctx_label}.\n"
            f"Texto a validar: \"{text}\"\n\n"
            "Decide si es apropiado. Responde sólo el JSON."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"mod_{uuid.uuid4().hex[:8]}",
            system_message=system_msg,
        ).with_model("openai", "gpt-4o-mini")

        response = await chat.send_message(UserMessage(text=prompt))
        raw = (response or '').strip()
        # Sacar JSON aunque venga con markdown alrededor
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            logger.warning(f"LLM moderation: respuesta sin JSON: {raw!r}")
            return CheckNameResponse(
                appropriate=True, category='ok',
                reason='IA respondió sin JSON: aceptado provisionalmente.',
            )
        data = json.loads(m.group(0))
        return CheckNameResponse(
            appropriate=bool(data.get('appropriate', True)),
            category=str(data.get('category', 'other'))[:32],
            reason=str(data.get('reason', '')).strip()[:200],
        )
    except Exception as exc:
        logger.exception(f"LLM moderation error: {exc}")
        return CheckNameResponse(
            appropriate=True, category='ok',
            reason='Error consultando IA: aceptado provisionalmente.',
        )


# ────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────
@router.post("/check-name", response_model=CheckNameResponse)
async def check_name(req: CheckNameRequest):
    text = (req.text or '').strip()
    # 1) Filtro duro local (corta sin coste IA)
    hard = _hard_check(text)
    if hard is not None:
        result = hard
    else:
        # 2) IA
        result = await _llm_check(text, req.context)

    # Registrar incidentes inapropiados para auditoría del Maestro
    if not result.appropriate:
        try:
            await ALERTS.insert_one({
                "_id": uuid.uuid4().hex,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "context": req.context,
                "text": text[:200],
                "category": result.category,
                "reason": result.reason,
                "flagged_term": result.flagged_term,
                "user_label": (req.user_label or '').strip()[:80] or None,
                "draft_id": req.draft_id,
            })
        except Exception as exc:
            logger.warning(f"No se pudo registrar moderation alert: {exc}")

    return result


@router.get("/alerts")
async def list_alerts(
    x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token"),
    limit: int = Query(default=200, ge=1, le=1000),
    skip: int = Query(default=0, ge=0),
):
    """Lista los incidentes de moderación. Sólo Maestro (token admin)."""
    _check_admin_token(x_admin_token)
    cursor = ALERTS.find({}, {'_id': 0}).sort('timestamp', -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)

    # Stats agregados por categoría y contexto
    pipeline = [
        {"$group": {
            "_id": {"category": "$category", "context": "$context"},
            "count": {"$sum": 1},
        }},
    ]
    stats_raw = await ALERTS.aggregate(pipeline).to_list(length=200)
    by_category: dict = {}
    by_context: dict = {}
    for r in stats_raw:
        cat = r['_id'].get('category') or 'other'
        ctx = r['_id'].get('context') or 'other'
        by_category[cat] = by_category.get(cat, 0) + r['count']
        by_context[ctx] = by_context.get(ctx, 0) + r['count']

    total = await ALERTS.count_documents({})
    return {
        "total": total,
        "stats_by_category": by_category,
        "stats_by_context": by_context,
        "items": items,
    }


@router.delete("/alerts")
async def clear_alerts(
    x_admin_token: Optional[str] = Header(default=None, alias="X-Admin-Token"),
):
    """Borra todo el log de incidentes. Sólo Maestro (token admin)."""
    _check_admin_token(x_admin_token)
    res = await ALERTS.delete_many({})
    return {"deleted": res.deleted_count}
