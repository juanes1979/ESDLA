"""
Character Portrait Generator
Generates AI-powered character portraits using OpenAI GPT Image 1
"""
import os
import base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
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
    genero: Optional[str] = None


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
    if data.edad:
        if data.edad < 25:
            physical.append("youthful appearance")
        elif data.edad < 50:
            physical.append("in their prime years")
        elif data.edad < 80:
            physical.append("mature, experienced features")
        else:
            physical.append("aged but wise appearance")
    
    if data.color_ojos:
        physical.append(f"{data.color_ojos} eyes")
    if data.color_pelo:
        physical.append(f"{data.color_pelo} hair")
    if data.rasgos_fisicos:
        physical.append(data.rasgos_fisicos)
    
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
        print(f"Generating portrait for {request.nombre} with prompt: {prompt[:200]}...")
        
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
        print(f"Import error: {e}")
        raise HTTPException(status_code=500, detail="Image generation library not available")
    except Exception as e:
        print(f"Error generating portrait: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test")
async def test_portrait():
    """Test endpoint to verify portrait generation is working"""
    return {"status": "Portrait generation endpoint ready"}
