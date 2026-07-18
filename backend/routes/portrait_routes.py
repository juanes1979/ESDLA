"""
Character Portrait Generator
Generates AI-powered character portraits using OpenAI GPT Image 1
"""
import os
import logging

logger = logging.getLogger(__name__)
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

router = APIRouter(prefix="/portraits", tags=["portraits"])

_mongo_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
_db = _mongo_client[os.environ.get("DB_NAME")]


async def _resolve_culture_prompt(cultura: Optional[str]) -> Optional[str]:
    """Devuelve el `prompt_imagen_ia` configurado por el DJ para esa cultura
    (matcheo case-insensitive sobre `cultura.nombre`). None si no hay nada
    útil configurado.
    """
    if not cultura:
        return None
    try:
        doc = await _db.cultures.find_one({
            "nombre": {"$regex": f"^{cultura.strip()}$", "$options": "i"}
        })
        if not doc:
            return None
        text = (doc.get("prompt_imagen_ia") or "").strip()
        return text or None
    except Exception:
        return None


class PortraitRequest(BaseModel):
    """Request model for portrait generation"""
    nombre: str
    cultura: Optional[str] = None
    raza: Optional[str] = None
    vocacion: Optional[str] = None
    trasfondo: Optional[str] = None
    edad: Optional[int] = None
    altura_cm: Optional[float] = None
    peso_kg: Optional[float] = None
    color_ojos: Optional[str] = None
    color_pelo: Optional[str] = None
    rasgos_fisicos: Optional[str] = None
    rasgos_faciales: Optional[str] = None
    genero: Optional[str] = None
    armas: Optional[List[str]] = []


def build_portrait_prompt(data: PortraitRequest, custom_culture_prompt: Optional[str] = None) -> str:
    """Build a detailed prompt for character portrait generation.

    Si `custom_culture_prompt` viene informado (texto guardado por el DJ en
    `culture.prompt_imagen_ia`), se usa **en lugar** del bloque hardcoded
    de `race_descriptions`.
    """
    
    # Base description based on race/culture
    race_descriptions = {
        "hobbit": "a Hobbit with curly hair, round face, large hairy feet, small stature around 3-4 feet tall",
        "enano": "a Dwarf with a long braided beard, sturdy muscular build, broad shoulders, around 4-5 feet tall",
        "elfo": "an Elf with elegant pointed ears, ethereal beauty, tall slender build, ageless features",
        "humano": "a Human with weathered features from a life of adventure",
        "dunadan": "a Dúnedain Ranger, tall and noble, with grey eyes and dark hair, weathered from years in the wild",
        "beornida": "a Beorning, tall and powerful, with wild hair and bear-like strength in their features",
        "leñador": "a Woodman of the forest, rugged and natural, with knowledge of the wild in their eyes",
        "bardida": "a Bardings descendant, proud and noble, with the bearing of Dale's warriors",
    }
    
    # Occupation descriptions
    occupation_styles = {
        "guerrero": "wearing battle-worn armor, with a warrior's stern gaze",
        "explorador": "in traveling clothes with a ranger's cloak, alert and watchful",
        "erudito": "with scholarly robes and wise, knowing eyes",
        "tesoro": "wearing fine clothes with a trader's shrewd look",
        "cazador": "in hunting leathers, with a hunter's keen eyes",
        "guardian": "in protective gear, with a defender's vigilant stance",
        "capitán": "with a leader's commanding presence, noble bearing",
        "sabio": "with ancient wisdom in their eyes, surrounded by an aura of knowledge",
    }
    
    # Build the prompt
    parts = []
    
    # Start with the style directive
    parts.append("Photorealistic black and white pencil drawing, highly detailed portrait")
    parts.append("medieval fantasy style inspired by Lord of the Rings and Tolkien's Middle-earth")
    
    # Character basics — usa el prompt custom si el DJ lo configuró,
    # si no recurre al diccionario hardcoded por raza.
    if custom_culture_prompt:
        parts.append(custom_culture_prompt)
    elif data.cultura:
        cultura_lower = data.cultura.lower()
        for key, desc in race_descriptions.items():
            if key in cultura_lower:
                parts.append(desc)
                break
        else:
            parts.append(f"a {data.cultura} character from Middle-earth")
    
    # Physical details
    physical = []
    if data.genero:
        physical.append(f"{data.genero}")

    # Apparent-age mapping: la edad CRONOLÓGICA no equivale a la edad
    # APARENTE en la Tierra Media. Cada raza tiene su propia escala de
    # longevidad: elfos inmortales conservan apariencia juvenil, los
    # dúnedain triplican su esperanza de vida, los enanos viven ~250
    # años con madurez tardía, los hobbits alcanzan la mayoría de edad
    # a los 33, y los hombres comunes siguen la escala humana estándar.
    # Esta función prioriza la RAZA sobre el número de años.
    raza_lower = ((data.cultura or "") + " " + (data.raza or "")).lower()

    def _appearance_for_race(years: int) -> str:
        # Elfos: inmortales, siempre 20-30 años humanos.
        if "alto elfo" in raza_lower or "altos elfos" in raza_lower or "elfo" in raza_lower or "elfos" in raza_lower:
            return "ageless youthful appearance, smooth unblemished skin, vibrant eyes betraying ancient wisdom but no wrinkles or grey hair"
        # Dúnedain: triple longevidad. <80 = joven adulto humano; 80-150
        # = maduro 45-50; >150 = anciano.
        if "dúnedain" in raza_lower or "dunedain" in raza_lower or "númenor" in raza_lower or "numenor" in raza_lower:
            if years < 80:
                return "young adult appearance equivalent to a 30-year-old human, strong frame, no grey hair"
            if years < 150:
                return "mature appearance equivalent to a 45-50-year-old human, weathered but vigorous, occasional grey at temples"
            return "venerable but not frail, equivalent to an aged human elder, long white hair and lined face"
        # Enanos: 250 años. <40 niño, 40-180 plenitud, >180 anciano.
        if "enano" in raza_lower or "enanos" in raza_lower or "dwarf" in raza_lower:
            if years < 40:
                return "youthful dwarven features, short beard, bright eyes"
            if years < 180:
                return "mature dwarf in full prime, thick dark beard with hints of grey, sturdy build"
            return "elder dwarf with long white braided beard, wise weathered face"
        # Hobbits: mayoría de edad 33. <33 adolescente, 33-90 adulto, >90 anciano.
        if "hobbit" in raza_lower or "hobbits" in raza_lower or "comarca" in raza_lower:
            if years < 33:
                return "youthful adolescent hobbit appearance, smooth round cheeks"
            if years < 90:
                return "robust adult hobbit, ruddy complexion, curly hair without grey"
            return "elderly hobbit, white hair, kind weathered face"
        # Hombres comunes (Bree, Lago, Este, Rohan, Gondor común): escala humana.
        if years < 25:
            return "youthful appearance"
        if years < 50:
            return "in their prime years, vigorous"
        if years < 70:
            return "mature, experienced features, some grey hair, fine wrinkles"
        return "aged but wise appearance, white hair, deeply lined face"

    if data.edad is not None:
        physical.append(_appearance_for_race(int(data.edad)))
    
    if data.color_ojos:
        physical.append(f"{data.color_ojos} eyes")
    if data.color_pelo:
        physical.append(f"{data.color_pelo} hair")
    if data.rasgos_fisicos:
        physical.append(data.rasgos_fisicos)
    if data.rasgos_faciales:
        # Rasgos faciales distintivos (uno por zona) para que los retratos no se parezcan.
        physical.append(f"distinctive facial features: {data.rasgos_faciales}")
    
    if physical:
        parts.append(", ".join(physical))
    
    # Occupation style
    if data.vocacion:
        vocacion_lower = data.vocacion.lower()
        for key, style in occupation_styles.items():
            if key in vocacion_lower:
                parts.append(style)
                break
    
    # Background flavor
    if data.trasfondo:
        parts.append(f"background story: {data.trasfondo[:100]}")
    
    # Technical directives for the image
    parts.append("portrait view, head and shoulders, dramatic lighting")
    parts.append("high contrast black and white, detailed pencil strokes")
    parts.append("no color, grayscale only, artistic sketch style")
    
    return ". ".join(parts)


@router.post("/generate")
async def generate_portrait(request: PortraitRequest):
    """Generate a character portrait using AI"""
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        # Resuelve el prompt custom de la cultura (si el DJ lo definió)
        custom_culture_prompt = await _resolve_culture_prompt(request.cultura)

        # Build the prompt
        prompt = build_portrait_prompt(request, custom_culture_prompt=custom_culture_prompt)
        logger.info(f"Generating portrait for {request.nombre} with prompt: {prompt[:200]}...")
        
        # Initialize the image generator
        image_gen = OpenAIImageGeneration(api_key=api_key)
        
        # Generate the image
        images = await image_gen.generate_images(
            prompt=prompt,
            model="gpt-image-1",
            number_of_images=1
        )
        
        if images and len(images) > 0:
            # Convert to base64
            image_base64 = base64.b64encode(images[0]).decode('utf-8')
            return {
                "success": True,
                "image_base64": image_base64,
                "prompt_used": prompt[:500]
            }
        else:
            raise HTTPException(status_code=500, detail="No image was generated")
            
    except ImportError as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=500, detail="Image generation library not available")
    except Exception as e:
        logger.error(f"Error generating portrait: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def build_portrait_prompt_es(data: PortraitRequest, custom_culture_prompt: Optional[str] = None) -> str:
    """Construye un prompt DETALLADO en ESPAÑOL para que el usuario lo copie y
    genere el retrato en la IA/herramienta que prefiera (sin gastar créditos).

    Reúne todo lo que corresponde al personaje: descripción genérica de la
    raza/subcultura (definida por el DJ en `culture.prompt_imagen_ia`),
    apariencia según raza y edad, ojos, pelo, rasgos físicos y faciales,
    vestimenta acorde a la ocupación y trasfondo.
    """
    raza_descripciones = {
        "hobbit": "un Hobbit de pelo rizado, rostro redondeado, pies grandes y peludos, baja estatura (poco más de 1 metro)",
        "enano": "un Enano de larga barba trenzada, complexión robusta y musculosa, hombros anchos, estatura media-baja",
        "elfo": "un Elfo de elegantes orejas puntiagudas, belleza etérea, cuerpo alto y esbelto, rasgos atemporales",
        "humano": "un Humano de rasgos curtidos por una vida de aventuras",
        "dúnedain": "un Montaraz Dúnedain, alto y noble, de ojos grises y cabello oscuro, curtido por años en tierras salvajes",
        "dunadan": "un Montaraz Dúnedain, alto y noble, de ojos grises y cabello oscuro, curtido por años en tierras salvajes",
        "beornida": "un Beórnida, alto y poderoso, de cabello indómito y fuerza casi de oso en sus facciones",
        "leñador": "un Leñador del bosque, rústico y natural, con el conocimiento de lo salvaje en la mirada",
        "bardida": "un descendiente de los Bardos, orgulloso y noble, con el porte de los guerreros de Valle",
    }
    ocupacion_estilos = {
        "guerrero": "vistiendo una armadura desgastada por la batalla, con la mirada severa de un guerrero",
        "explorador": "con ropas de viaje y capa de montaraz, alerta y vigilante",
        "erudito": "con túnicas propias de un erudito y ojos sabios y perspicaces",
        "tesoro": "con ropas finas y la mirada astuta de un comerciante",
        "comerciante": "con ropas finas y la mirada astuta de un comerciante",
        "cazador": "con cueros de caza y los ojos agudos de un cazador",
        "guardian": "con equipo de protección y la postura vigilante de un defensor",
        "guardián": "con equipo de protección y la postura vigilante de un defensor",
        "capitán": "con la presencia imponente de un líder y porte noble",
        "sabio": "con antigua sabiduría en la mirada, rodeado de un aura de conocimiento",
    }

    raza_lower = ((data.cultura or "") + " " + (data.raza or "")).lower()

    def _apariencia_por_raza(anios: int) -> str:
        if "elfo" in raza_lower or "elfos" in raza_lower or "noldor" in raza_lower or "sindar" in raza_lower:
            return "apariencia joven y atemporal, piel tersa y sin arrugas, ojos vivos que delatan una sabiduría antigua pero sin canas ni signos de vejez"
        if "dúnedain" in raza_lower or "dunedain" in raza_lower or "númenor" in raza_lower or "numenor" in raza_lower:
            if anios < 80:
                return "aspecto de adulto joven (equivalente a un humano de unos 30 años), complexión fuerte, sin canas"
            if anios < 150:
                return "aspecto maduro (equivalente a un humano de 45-50 años), curtido pero vigoroso, alguna cana en las sienes"
            return "aspecto venerable pero no frágil, como un anciano humano, largo cabello blanco y rostro surcado"
        if "enano" in raza_lower or "enanos" in raza_lower:
            if anios < 40:
                return "rasgos enanos juveniles, barba corta, ojos brillantes"
            if anios < 180:
                return "enano maduro en plenitud, barba espesa y oscura con toques de gris, complexión recia"
            return "enano anciano de larga barba blanca trenzada y rostro sabio y curtido"
        if "hobbit" in raza_lower or "hobbits" in raza_lower or "comarca" in raza_lower:
            if anios < 33:
                return "aspecto de hobbit adolescente, mejillas redondas y tersas"
            if anios < 90:
                return "hobbit adulto robusto, tez rubicunda, pelo rizado sin canas"
            return "hobbit anciano, cabello blanco, rostro amable y curtido"
        if anios < 25:
            return "aspecto juvenil"
        if anios < 50:
            return "en la plenitud de la vida, vigoroso"
        if anios < 70:
            return "rasgos maduros y experimentados, algunas canas, arrugas finas"
        return "aspecto anciano pero sabio, cabello blanco, rostro profundamente surcado"

    partes = []
    partes.append("Dibujo fotorrealista a lápiz de grafito, obra maestra, muy detallado, arte a lápiz crudo dibujado a mano")
    partes.append("estilo fantasía medieval inspirado en El Señor de los Anillos y la Tierra Media de Tolkien")
    partes.append("plano de CUERPO ENTERO, figura completa de la cabeza a los pies, nada recortado")

    if custom_culture_prompt:
        partes.append(custom_culture_prompt)
    elif data.cultura:
        cultura_lower = data.cultura.lower()
        for key, desc in raza_descripciones.items():
            if key in cultura_lower:
                partes.append(desc)
                break
        else:
            partes.append(f"un personaje de la cultura {data.cultura} de la Tierra Media")

    fisico = []
    if data.genero:
        fisico.append(f"{data.genero}")
    if data.edad is not None:
        fisico.append(_apariencia_por_raza(int(data.edad)))
    if data.color_ojos:
        fisico.append(f"ojos de color {data.color_ojos}")
    if data.color_pelo:
        fisico.append(f"cabello {data.color_pelo}")
    if data.rasgos_fisicos:
        fisico.append(data.rasgos_fisicos)
    if data.rasgos_faciales:
        fisico.append(f"rasgos faciales distintivos: {data.rasgos_faciales}")
    if fisico:
        partes.append(", ".join(fisico))

    if data.vocacion:
        vocacion_lower = data.vocacion.lower()
        for key, estilo in ocupacion_estilos.items():
            if key in vocacion_lower:
                partes.append(estilo)
                break
        else:
            partes.append(f"vestimenta y utillaje acordes a su oficio de {data.vocacion}")

    # Armas y equipo del personaje (se muestran sujetas/portadas de forma natural).
    armas = [a for a in (data.armas or []) if a and str(a).strip()]
    if armas:
        partes.append(
            f"equipado con {', '.join(armas)}; las armas y el equipo deben verse claramente, "
            "sujetos o portados de forma natural en su sitio (no flotando, no sobredimensionados)"
        )

    # El trasfondo solo se añade si es una descripción con contenido útil para el
    # dibujo (no un simple nombre como «El Cruce del Norte»).
    trasfondo = (data.trasfondo or "").strip()
    if len(trasfondo) >= 60:
        partes.append(f"contexto de su historia: {trasfondo[:300]}")

    partes.append("cuerpo entero de pies a cabeza, postura natural, iluminación dramática")
    partes.append("trazos de lápiz de grafito detallados y sombreado, aspecto de dibujo a mano sobre papel")

    return ". ".join(partes)


@router.post("/prompt")
async def get_portrait_prompt(request: PortraitRequest):
    """Devuelve el PROMPT en español (sin generar imagen ni gastar créditos)
    para que el DJ/jugador lo copie, cree el retrato externamente y lo suba."""
    custom_culture_prompt = await _resolve_culture_prompt(request.cultura)
    prompt = build_portrait_prompt_es(request, custom_culture_prompt=custom_culture_prompt)
    return {"prompt": prompt}


@router.get("/test")
async def test_portrait():
    """Test endpoint to verify portrait generation is working"""
    return {"status": "Portrait generation endpoint ready"}
