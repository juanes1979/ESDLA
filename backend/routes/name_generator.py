"""
Middle-earth Name Generator
Generates settlement names based on prefix + root + suffix patterns
Adapted by region and predominant race type
"""
from fastapi import APIRouter
import random
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/names", tags=["names"])

# ============================================================================
# NAMING DATA BY REGION AND RACE
# ============================================================================

NAMING_DATA = {
    "eriador": {
        "humano": {
            "prefijos": ["Bram", "Dor", "Fen", "Thal", "Car", "Gal", "Ar", "Lin", "Harl", "Bree", "Stad", "Chet", "Arch"],
            "raices": ["win", "dor", "thal", "mar", "wen", "ric", "gan", "ald", "ford", "bur", "dal"],
            "sufijos": ["ford", "hill", "ton", "dale", "brook", "mere", "stead", "keep", "bury", "ham", "worth"]
        },
        "elfico": {
            "prefijos": ["Elen", "Lóm", "Sil", "Ar", "Fëa", "Cal", "Nár", "Ith", "Cel", "Gal", "Nim"],
            "raices": ["dir", "thil", "mir", "las", "wen", "nor", "loth", "dil", "bri", "gol", "ran"],
            "sufijos": ["ion", "iel", "eth", "ith", "or", "mir", "wen", "dor", "las", "rim"]
        }
    },
    "gondor": {
        "humano": {
            "prefijos": ["Min", "Anar", "Dor", "Bar", "Cal", "Harn", "Tel", "Cir", "Tar", "Pel", "Lam"],
            "raices": ["dor", "mir", "fal", "rion", "thal", "carn", "gorn", "oth", "gil", "and"],
            "sufijos": ["ion", "eth", "an", "il", "ar", "ond", "stad", "rim", "ien", "dur"]
        },
        "elfico": {
            "prefijos": ["Ar", "El", "Cal", "Sil", "Fin", "Lór", "Ith", "Aman", "Núm", "Tar"],
            "raices": ["ion", "thir", "mir", "dil", "wen", "las", "nor", "fin", "gol"],
            "sufijos": ["iel", "or", "ion", "mir", "eth", "wen", "dil", "rim"]
        }
    },
    "rohan": {
        "humano": {
            "prefijos": ["Ed", "Ald", "Helm", "Har", "Mar", "Fen", "Dun", "Eorl", "Théod", "Fréa", "Grim"],
            "raices": ["burg", "hol", "stad", "mar", "val", "dûn", "gar", "mund", "wine", "helm"],
            "sufijos": ["ton", "heim", "hold", "field", "holt", "burg", "ing", "mark", "wald", "dor"]
        }
    },
    "rhovanion": {
        "humano": {
            "prefijos": ["Thar", "Car", "Dor", "Fen", "Gal", "Har", "Lin", "Bar", "Est", "Beo"],
            "raices": ["mar", "win", "ric", "gan", "dor", "tal", "gar", "orn", "rod"],
            "sufijos": ["ford", "dale", "ton", "mere", "keep", "hall", "burg", "gard"]
        },
        "elfico": {
            "prefijos": ["Sil", "Elen", "Fëa", "Lóm", "Ar", "Cal", "Taur", "Cel", "Gal"],
            "raices": ["mir", "thil", "las", "wen", "nor", "dil", "gol", "ran"],
            "sufijos": ["ion", "iel", "mir", "eth", "wen", "dor", "rim", "ost"]
        },
        "orco": {
            "prefijos": ["Gor", "Ur", "Krag", "Zog", "Mur", "Rag", "Gash", "Bolg"],
            "raices": ["thak", "gûl", "mok", "dush", "rak", "zug", "shak", "grat"],
            "sufijos": ["gor", "dush", "thak", "zug", "ûrz", "hai", "gash"]
        }
    },
    "mordor": {
        "orco": {
            "prefijos": ["Gor", "Naz", "Ur", "Krag", "Mok", "Zog", "Lug", "Ash", "Bur"],
            "raices": ["thak", "gûl", "dush", "rak", "zug", "mûl", "shak", "grat", "burz"],
            "sufijos": ["ur", "gûl", "dush", "thak", "mog", "hai", "ûrz", "gash"]
        },
        "humano": {
            "prefijos": ["Dor", "Bar", "Carn", "Min", "Nurn", "Gor", "Lit"],
            "raices": ["thar", "mar", "gorn", "dûr", "gor", "nurn", "ith"],
            "sufijos": ["an", "ond", "eth", "ur", "ad", "ath", "ost"]
        }
    },
    "rhun": {
        "humano": {
            "prefijos": ["Ak", "Zar", "Mar", "Gul", "Tor", "Kar", "Hun", "Bal", "Kor", "Shar"],
            "raices": ["tan", "rok", "mar", "gash", "dur", "khan", "gar", "zar", "tol"],
            "sufijos": ["ul", "an", "ok", "ar", "esh", "im", "ak", "or"]
        }
    },
    "harad": {
        "humano": {
            "prefijos": ["Shar", "Bal", "Mar", "Zul", "Khar", "Tal", "Har", "Um", "Far", "Kas"],
            "raices": ["dak", "tar", "gash", "mar", "nash", "rash", "zan", "bar", "sul"],
            "sufijos": ["ur", "esh", "an", "ok", "im", "ad", "ar", "al"]
        }
    },
    "khand": {
        "humano": {
            "prefijos": ["Ur", "Khad", "Mar", "Tor", "Ban", "Zul", "Var", "Kor"],
            "raices": ["gar", "rak", "dur", "thak", "mor", "zan", "gul", "tar"],
            "sufijos": ["an", "ok", "esh", "ul", "ar", "ad", "im"]
        },
        "orco": {
            "prefijos": ["Gor", "Ur", "Krag", "Zog", "Mur", "Gash"],
            "raices": ["thak", "rak", "dush", "zug", "mok", "grat"],
            "sufijos": ["gûl", "thak", "mog", "dush", "ûrz", "hai"]
        }
    },
    "montanas_nubladas": {
        "enano": {
            "prefijos": ["Kha", "Bara", "Zira", "Dur", "Thor", "Gim", "Bom", "Glo", "Nori"],
            "raices": ["zad", "dum", "bur", "gund", "zar", "rik", "bel", "lin", "nar"],
            "sufijos": ["dum", "zar", "bel", "rik", "in", "ur", "ak", "rim"]
        },
        "orco": {
            "prefijos": ["Gor", "Ur", "Mok", "Gash", "Bol", "Az"],
            "raices": ["thak", "gûl", "dush", "zug", "rak", "nub"],
            "sufijos": ["gor", "dush", "zug", "hai", "gash", "ûrz"]
        }
    },
    "bosque_negro": {
        "elfico": {
            "prefijos": ["Taur", "Cel", "Gal", "Leg", "Thran", "Aran", "Sil", "Nim"],
            "raices": ["gol", "las", "mir", "dil", "wen", "nor", "ran", "bel"],
            "sufijos": ["ion", "iel", "ost", "rim", "dor", "wen", "las"]
        },
        "orco": {
            "prefijos": ["Dol", "Gul", "Mur", "Zog", "Gash", "Bol"],
            "raices": ["dur", "gûl", "mok", "thak", "rak", "nub"],
            "sufijos": ["gûl", "dush", "hai", "gor", "zug"]
        }
    },
    "lindon": {
        "elfico": {
            "prefijos": ["Círd", "Har", "For", "Mit", "Cel", "Gal", "Nim", "Elen"],
            "raices": ["lond", "lin", "las", "mir", "thil", "dil", "bri", "gol"],
            "sufijos": ["ion", "ond", "iel", "rim", "dor", "las", "eth"]
        }
    },
    "shire": {
        "hobbit": {
            "prefijos": ["Hob", "Bag", "Bree", "Buck", "Stock", "Took", "Brandy", "Long", "Over"],
            "raices": ["bit", "end", "ton", "hill", "bot", "bury", "dale", "ford", "bridge"],
            "sufijos": ["ton", "ham", "shire", "dale", "bridge", "hill", "bottom", "field", "bury"]
        }
    }
}

# Mapping of regions to display names
REGION_NAMES = {
    "eriador": "Eriador",
    "gondor": "Gondor",
    "rohan": "Rohan",
    "rhovanion": "Rhovanion",
    "mordor": "Mordor",
    "rhun": "Rhûn",
    "harad": "Harad",
    "khand": "Khand",
    "montanas_nubladas": "Montañas Nubladas",
    "bosque_negro": "Bosque Negro",
    "lindon": "Lindon",
    "shire": "La Comarca"
}

# Mapping of races to display names
RACE_NAMES = {
    "humano": "Humano",
    "elfico": "Élfico",
    "enano": "Enano",
    "orco": "Orco",
    "hobbit": "Hobbit"
}

class NameGeneratorRequest(BaseModel):
    region: str
    raza: str
    cantidad: int = 5

class GeneratedName(BaseModel):
    nombre: str
    prefijo: str
    raiz: str
    sufijo: str
    region: str
    raza: str

class NameGeneratorResponse(BaseModel):
    nombres: List[GeneratedName]
    region: str
    raza: str


def generate_name(region: str, raza: str) -> Optional[GeneratedName]:
    """Generate a single name for the given region and race."""
    if region not in NAMING_DATA:
        return None
    if raza not in NAMING_DATA[region]:
        return None
    
    data = NAMING_DATA[region][raza]
    prefijo = random.choice(data["prefijos"])
    raiz = random.choice(data["raices"])
    sufijo = random.choice(data["sufijos"])
    
    # Combine parts intelligently
    # Remove duplicate letters at boundaries
    nombre = prefijo
    
    # Add root - handle transitions
    if prefijo[-1].lower() == raiz[0].lower():
        nombre += raiz[1:]
    else:
        nombre += raiz
    
    # Add suffix - handle transitions
    if nombre[-1].lower() == sufijo[0].lower():
        nombre += sufijo[1:]
    else:
        nombre += sufijo
    
    # Capitalize properly
    nombre = nombre.capitalize()
    
    return GeneratedName(
        nombre=nombre,
        prefijo=prefijo,
        raiz=raiz,
        sufijo=sufijo,
        region=region,
        raza=raza
    )


@router.get("/regions")
async def get_regions():
    """Get all available regions with their races."""
    result = {}
    for region, races in NAMING_DATA.items():
        result[region] = {
            "nombre": REGION_NAMES.get(region, region),
            "razas": {
                raza: RACE_NAMES.get(raza, raza) 
                for raza in races.keys()
            }
        }
    return result


@router.post("/generate")
async def generate_names(request: NameGeneratorRequest):
    """Generate multiple names for a region and race."""
    if request.region not in NAMING_DATA:
        return {"error": f"Región '{request.region}' no encontrada"}
    if request.raza not in NAMING_DATA[request.region]:
        return {"error": f"Raza '{request.raza}' no disponible en {request.region}"}
    
    nombres = []
    generated_set = set()  # Avoid duplicates
    max_attempts = request.cantidad * 10
    attempts = 0
    
    while len(nombres) < request.cantidad and attempts < max_attempts:
        name = generate_name(request.region, request.raza)
        if name and name.nombre not in generated_set:
            nombres.append(name)
            generated_set.add(name.nombre)
        attempts += 1
    
    return NameGeneratorResponse(
        nombres=nombres,
        region=REGION_NAMES.get(request.region, request.region),
        raza=RACE_NAMES.get(request.raza, request.raza)
    )


@router.get("/generate/{region}/{raza}")
async def generate_names_get(region: str, raza: str, cantidad: int = 5):
    """Generate names via GET request."""
    request = NameGeneratorRequest(region=region, raza=raza, cantidad=cantidad)
    return await generate_names(request)


@router.get("/random")
async def generate_random_name():
    """Generate a single random name from any region/race."""
    region = random.choice(list(NAMING_DATA.keys()))
    raza = random.choice(list(NAMING_DATA[region].keys()))
    name = generate_name(region, raza)
    return {
        "nombre": name.nombre if name else None,
        "region": REGION_NAMES.get(region, region),
        "raza": RACE_NAMES.get(raza, raza),
        "detalles": name.dict() if name else None
    }
