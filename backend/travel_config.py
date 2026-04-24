"""
Sistema de Viaje para El Señor de los Anillos 5e RPG
=====================================================

Este módulo contiene todas las reglas de cálculo de viajes según el reglamento.
Todas las distancias están en sistema métrico (kilómetros).

Reglas principales:
- Distancia base por día (8 horas de viaje)
- Modificadores de terreno
- Modificadores de camino
- Modificadores de región
- Modificadores de montura
- Reglas de marcha forzada y cansancio
"""

from typing import Optional, Dict, List, Any
from enum import Enum

# =============================================================================
# ENUMS Y CONSTANTES
# =============================================================================

class Ritmo(str, Enum):
    LENTO = "lento"
    NORMAL = "normal"
    RAPIDO = "rapido"

class TipoTerreno(str, Enum):
    FACIL = "facil"
    MODERADO = "moderado"
    DIFICIL = "dificil"
    MUY_DIFICIL = "muy_dificil"
    DESALENTADOR = "desalentador"
    INFRANQUEABLE = "infranqueable"

class TipoCamino(str, Enum):
    NINGUNO = "ninguno"
    SENDERO = "sendero"
    SECUNDARIO = "secundario"
    REAL = "real"

class ClaseRegion(str, Enum):
    TIERRAS_LIBRES = "tierras_libres"
    TIERRAS_FRONTERIZAS = "tierras_fronterizas"
    TIERRAS_SALVAJES = "tierras_salvajes"
    TIERRAS_SOMBRA = "tierras_sombra"
    TIERRAS_OSCURAS = "tierras_oscuras"

# =============================================================================
# 1. DISTANCIA BASE (km por día, 8 horas de viaje)
# =============================================================================

DISTANCIA_BASE_KM = {
    Ritmo.LENTO: 17.5,    # 15-20 km/día → midpoint (a pie)
    Ritmo.NORMAL: 22.5,   # 20-25 km/día → midpoint
    Ritmo.RAPIDO: 27.5,   # 25-30 km/día → midpoint (forzado)
}

# Bonus a caballo sobre la velocidad a pie. Se aplica sólo en terrenos
# donde se permite montar (ver `MONTURA_PERMITIDA` más abajo). En terrenos
# como montañas, pantanos o ciénagas se desmonta y se usa la velocidad a pie.
BONUS_MONTURA_PORCENTAJE = 0.40  # +40%

# Modo especial "Mensajero a caballo" — 50-80 km/día, máximo 3 días sostenido.
VELOCIDAD_MENSAJERO_KM = 65  # midpoint
MENSAJERO_DIAS_MAX_SOSTENIDO = 3

# Nombres para mostrar
RITMO_NOMBRES = {
    Ritmo.LENTO: "Lento",
    Ritmo.NORMAL: "Normal",
    Ritmo.RAPIDO: "Forzado",
}

RITMO_DESCRIPCIONES = {
    Ritmo.LENTO: "Ritmo cauteloso. 15-20 km/día a pie (24-28 a caballo).",
    Ritmo.NORMAL: "Ritmo estándar. 20-25 km/día a pie (28-35 a caballo).",
    Ritmo.RAPIDO: "Marcha forzada. 25-30 km/día a pie (35-42 a caballo). Requiere TS CON extra.",
}

# Qué terrenos permiten ir a caballo (los demás obligan a desmontar)
MONTURA_PERMITIDA = {
    TipoTerreno.FACIL: True,
    TipoTerreno.MODERADO: True,
    TipoTerreno.DIFICIL: False,        # bosques densos, páramos → desmontar
    TipoTerreno.MUY_DIFICIL: False,    # montañas, pantanos → desmontar
    TipoTerreno.DESALENTADOR: False,
    TipoTerreno.INFRANQUEABLE: False,
}

# =============================================================================
# 2. MODIFICADOR DE TERRENO
# =============================================================================

MODIFICADOR_TERRENO = {
    TipoTerreno.FACIL: 1.0,           # Caminos, llanuras
    TipoTerreno.MODERADO: 0.75,       # Colinas, bosques claros
    TipoTerreno.DIFICIL: 0.5,         # Bosques densos, páramos
    TipoTerreno.MUY_DIFICIL: 0.33,    # Montañas, pantanos
    TipoTerreno.DESALENTADOR: 0.25,   # Volcánico, maldito
    TipoTerreno.INFRANQUEABLE: 0,     # No se puede atravesar
}

TERRENO_NOMBRES = {
    TipoTerreno.FACIL: "Fácil",
    TipoTerreno.MODERADO: "Moderado",
    TipoTerreno.DIFICIL: "Difícil",
    TipoTerreno.MUY_DIFICIL: "Muy Difícil",
    TipoTerreno.DESALENTADOR: "Desalentador",
    TipoTerreno.INFRANQUEABLE: "Infranqueable",
}

TERRENO_DESCRIPCIONES = {
    TipoTerreno.FACIL: "Caminos bien mantenidos, llanuras abiertas, praderas.",
    TipoTerreno.MODERADO: "Colinas suaves, bosques claros, senderos secundarios.",
    TipoTerreno.DIFICIL: "Bosques densos, terreno accidentado, páramos. No permite montura.",
    TipoTerreno.MUY_DIFICIL: "Montañas, pantanos, ciénagas profundas. No permite montura.",
    TipoTerreno.DESALENTADOR: "Tierras volcánicas, regiones malditas. No permite montura.",
    TipoTerreno.INFRANQUEABLE: "Picos montañosos, acantilados. Solo atravesable por pasos específicos.",
}

# Colores del terreno (del mapa)
TERRENO_COLORES = {
    TipoTerreno.FACIL: "#d3ba84",
    TipoTerreno.MODERADO: "#948c4d",
    TipoTerreno.DIFICIL: "#c38d4f",
    TipoTerreno.MUY_DIFICIL: "#a57044",
    TipoTerreno.DESALENTADOR: "#af4b27",
    TipoTerreno.INFRANQUEABLE: "#664540",
}

# =============================================================================
# 3. MODIFICADOR DE CAMINO
# =============================================================================

MODIFICADOR_CAMINO = {
    TipoCamino.NINGUNO: 1.0,      # Sin camino
    TipoCamino.SENDERO: 1.0,      # Caso especial (ver función)
    TipoCamino.SECUNDARIO: 1.10,  # Camino secundario +10%
    TipoCamino.REAL: 1.25,        # Camino real +25%
}

CAMINO_NOMBRES = {
    TipoCamino.NINGUNO: "Sin camino",
    TipoCamino.SENDERO: "Sendero",
    TipoCamino.SECUNDARIO: "Camino secundario",
    TipoCamino.REAL: "Camino real",
}

CAMINO_DESCRIPCIONES = {
    TipoCamino.NINGUNO: "Campo a través, sin ruta establecida.",
    TipoCamino.SENDERO: "Sendero natural. En terreno moderado, anula la penalización.",
    TipoCamino.SECUNDARIO: "Camino secundario mantenido. +10% velocidad.",
    TipoCamino.REAL: "Camino real bien mantenido. +25% velocidad.",
}

CAMINO_COLORES = {
    TipoCamino.NINGUNO: "#666666",
    TipoCamino.SENDERO: "#8B7355",
    TipoCamino.SECUNDARIO: "#C4A574",
    TipoCamino.REAL: "#FFD700",
}

# =============================================================================
# 4. CLASE DE REGIÓN (PELIGRO)
# =============================================================================

REGION_NOMBRES = {
    ClaseRegion.TIERRAS_LIBRES: "Tierras Libres",
    ClaseRegion.TIERRAS_FRONTERIZAS: "Tierras Fronterizas",
    ClaseRegion.TIERRAS_SALVAJES: "Tierras Salvajes",
    ClaseRegion.TIERRAS_SOMBRA: "Tierras de la Sombra",
    ClaseRegion.TIERRAS_OSCURAS: "Tierras Oscuras",
}

REGION_DESCRIPCIONES = {
    ClaseRegion.TIERRAS_LIBRES: "Regiones civilizadas bajo protección de los Pueblos Libres.",
    ClaseRegion.TIERRAS_FRONTERIZAS: "Zonas en los límites de la civilización.",
    ClaseRegion.TIERRAS_SALVAJES: "Tierras sin ley donde bestias y bandidos campan.",
    ClaseRegion.TIERRAS_SOMBRA: "Regiones bajo la influencia de Sauron o antiguos males.",
    ClaseRegion.TIERRAS_OSCURAS: "Dominios del enemigo donde la oscuridad reina.",
}

REGION_COLORES = {
    ClaseRegion.TIERRAS_LIBRES: "#4ade80",
    ClaseRegion.TIERRAS_FRONTERIZAS: "#facc15",
    ClaseRegion.TIERRAS_SALVAJES: "#fb923c",
    ClaseRegion.TIERRAS_SOMBRA: "#f87171",
    ClaseRegion.TIERRAS_OSCURAS: "#991b1b",
}

# Probabilidad base de encuentros (% por día)
PROBABILIDAD_ENCUENTRO = {
    ClaseRegion.TIERRAS_LIBRES: 5,
    ClaseRegion.TIERRAS_FRONTERIZAS: 15,
    ClaseRegion.TIERRAS_SALVAJES: 25,
    ClaseRegion.TIERRAS_SOMBRA: 40,
    ClaseRegion.TIERRAS_OSCURAS: 60,
}

# Modificador CD de marcha forzada por región
MODIFICADOR_CD_MARCHA_FORZADA = {
    ClaseRegion.TIERRAS_LIBRES: 0,
    ClaseRegion.TIERRAS_FRONTERIZAS: 1,
    ClaseRegion.TIERRAS_SALVAJES: 0,
    ClaseRegion.TIERRAS_SOMBRA: 2,
    ClaseRegion.TIERRAS_OSCURAS: 3,
}

# =============================================================================
# FUNCIONES DE CÁLCULO
# =============================================================================

def validar_ritmo_region(ritmo: str, region: str) -> Dict[str, Any]:
    """
    Valida si el ritmo es permitido en la región.
    
    Reglas:
    - Ritmo rápido NO permitido en: salvajes, sombra, oscuras
    - En tierras oscuras: solo lento o normal
    """
    ritmo_enum = Ritmo(ritmo) if isinstance(ritmo, str) else ritmo
    region_enum = ClaseRegion(region) if isinstance(region, str) else region
    
    if ritmo_enum == Ritmo.RAPIDO:
        if region_enum in [ClaseRegion.TIERRAS_SALVAJES, ClaseRegion.TIERRAS_SOMBRA, ClaseRegion.TIERRAS_OSCURAS]:
            return {
                "permitido": False,
                "mensaje": f"El ritmo rápido no está permitido en {REGION_NOMBRES[region_enum]}.",
                "sugerencia": "Usa ritmo normal o lento."
            }
    
    return {"permitido": True, "mensaje": None, "sugerencia": None}


def calcular_modificador_camino(camino: str, terreno: str, region: str) -> float:
    """
    Calcula el modificador de camino considerando casos especiales.
    
    Reglas:
    - Sendero en terreno moderado: usa multiplicador 1 (anula penalización de terreno)
    - En tierras de la sombra: bonificador de camino dividido entre 2
    - En tierras oscuras: bonificador de camino = 1 (no hay bonus)
    """
    camino_enum = TipoCamino(camino) if isinstance(camino, str) else camino
    terreno_enum = TipoTerreno(terreno) if isinstance(terreno, str) else terreno
    region_enum = ClaseRegion(region) if isinstance(region, str) else region
    
    # Caso especial: sendero
    if camino_enum == TipoCamino.SENDERO:
        # En terreno moderado, el sendero anula la penalización
        # Esto se maneja retornando un valor especial que indica "usar 1 para terreno"
        return 1.0  # El sendero no da bonus, pero puede anular penalización
    
    modificador = MODIFICADOR_CAMINO.get(camino_enum, 1.0)
    
    # Aplicar modificadores por región
    if region_enum == ClaseRegion.TIERRAS_SOMBRA:
        # Bonus de camino reducido a la mitad
        if modificador > 1.0:
            bonus = modificador - 1.0
            modificador = 1.0 + (bonus / 2)
    elif region_enum == ClaseRegion.TIERRAS_OSCURAS:
        # Sin bonus de camino
        modificador = 1.0
    
    return modificador


def calcular_modificador_terreno(terreno: str, camino: str) -> float:
    """
    Calcula el modificador de terreno considerando el caso especial del sendero.
    
    Regla especial:
    - Sendero en terreno moderado: usar multiplicador 1 en vez de 0.75
    """
    terreno_enum = TipoTerreno(terreno) if isinstance(terreno, str) else terreno
    camino_enum = TipoCamino(camino) if isinstance(camino, str) else camino
    
    # Caso especial: sendero en terreno moderado
    if camino_enum == TipoCamino.SENDERO and terreno_enum == TipoTerreno.MODERADO:
        return 1.0  # El sendero anula la penalización del terreno moderado
    
    return MODIFICADOR_TERRENO.get(terreno_enum, 1.0)


def puede_usar_montura(terreno: str) -> bool:
    """
    Determina si se puede usar montura en el terreno.
    
    Regla: No se puede usar montura en terreno muy_difícil, desalentador o infranqueable.
    """
    terreno_enum = TipoTerreno(terreno) if isinstance(terreno, str) else terreno
    
    return terreno_enum not in [
        TipoTerreno.MUY_DIFICIL,
        TipoTerreno.DESALENTADOR,
        TipoTerreno.INFRANQUEABLE
    ]


def calcular_distancia_diaria(
    ritmo: str,
    terreno: str,
    camino: str = "ninguno",
    region: str = "tierras_salvajes",
    montura: bool = False
) -> Dict[str, Any]:
    """
    Calcula la distancia recorrida en un día (8 horas de viaje).
    
    Fórmula:
    distancia = base_ritmo × mod_terreno × mod_camino × mod_montura
    
    Returns:
        Dict con:
        - distancia_km: Kilómetros recorridos
        - detalles: Desglose del cálculo
        - advertencias: Lista de advertencias/restricciones
    """
    # Validar ritmo en la región
    validacion = validar_ritmo_region(ritmo, region)
    if not validacion["permitido"]:
        return {
            "distancia_km": 0,
            "error": validacion["mensaje"],
            "sugerencia": validacion["sugerencia"]
        }
    
    ritmo_enum = Ritmo(ritmo)
    terreno_enum = TipoTerreno(terreno)
    camino_enum = TipoCamino(camino)
    region_enum = ClaseRegion(region)
    
    advertencias = []
    
    # 1. Distancia base
    distancia = DISTANCIA_BASE_KM[ritmo_enum]
    base = distancia
    
    # 2. Modificador de terreno
    mod_terreno = calcular_modificador_terreno(terreno, camino)
    
    # Terreno infranqueable
    if mod_terreno == 0:
        return {
            "distancia_km": 0,
            "error": "Terreno infranqueable. Busca un paso de montaña o ruta alternativa.",
            "detalles": {
                "terreno": TERRENO_NOMBRES[terreno_enum],
                "es_infranqueable": True
            }
        }
    
    distancia *= mod_terreno
    
    # 3. Modificador de camino
    mod_camino = calcular_modificador_camino(camino, terreno, region)
    distancia *= mod_camino
    
    # 4. Modificador de montura
    mod_montura = 1.0
    montura_usada = False
    if montura:
        if puede_usar_montura(terreno):
            mod_montura = 1.5
            montura_usada = True
        else:
            advertencias.append(f"No se puede usar montura en terreno {TERRENO_NOMBRES[terreno_enum]}.")
    
    distancia *= mod_montura
    
    # Redondear a 1 decimal
    distancia = round(distancia, 1)
    
    return {
        "distancia_km": distancia,
        "detalles": {
            "ritmo": RITMO_NOMBRES[ritmo_enum],
            "base_km": base,
            "terreno": TERRENO_NOMBRES[terreno_enum],
            "mod_terreno": mod_terreno,
            "camino": CAMINO_NOMBRES[camino_enum],
            "mod_camino": mod_camino,
            "region": REGION_NOMBRES[region_enum],
            "montura_usada": montura_usada,
            "mod_montura": mod_montura,
        },
        "advertencias": advertencias,
        "formula": f"{base} × {mod_terreno} × {mod_camino} × {mod_montura} = {distancia} km"
    }


def calcular_marcha_forzada(
    distancia_base: float,
    horas_extra: int,
    region: str = "tierras_salvajes"
) -> Dict[str, Any]:
    """
    Calcula la distancia adicional y CD de marcha forzada.
    
    Reglas:
    - Por cada hora extra: distancia_extra = distancia_diaria / 8
    - CD de Constitución = 10 + horas_extra + modificador_region
    - Cada fallo = 1 nivel de cansancio
    """
    if horas_extra <= 0:
        return {
            "distancia_extra_km": 0,
            "cd_constitucion": None,
            "mensaje": "Sin marcha forzada"
        }
    
    region_enum = ClaseRegion(region) if isinstance(region, str) else region
    
    # Calcular distancia extra
    km_por_hora = distancia_base / 8
    distancia_extra = km_por_hora * horas_extra
    
    # Calcular CD
    cd_base = 10 + horas_extra
    mod_region = MODIFICADOR_CD_MARCHA_FORZADA.get(region_enum, 0)
    cd_final = cd_base + mod_region
    
    return {
        "distancia_extra_km": round(distancia_extra, 1),
        "km_por_hora_extra": round(km_por_hora, 1),
        "horas_extra": horas_extra,
        "cd_constitucion": cd_final,
        "cd_base": cd_base,
        "mod_region": mod_region,
        "region": REGION_NOMBRES[region_enum],
        "consecuencia_fallo": "1 nivel de cansancio por fallo",
        "formula": f"CD = 10 + {horas_extra} + {mod_region} = {cd_final}"
    }


def calcular_viaje_completo(
    ritmo: str,
    terreno: str,
    camino: str = "ninguno",
    region: str = "tierras_salvajes",
    montura: bool = False,
    horas_extra: int = 0
) -> Dict[str, Any]:
    """
    Calcula un día completo de viaje incluyendo marcha forzada opcional.
    
    Returns:
        Dict completo con todos los detalles del viaje.
    """
    # Calcular distancia base del día
    resultado_base = calcular_distancia_diaria(ritmo, terreno, camino, region, montura)
    
    if "error" in resultado_base:
        return resultado_base
    
    distancia_base = resultado_base["distancia_km"]
    
    # Calcular marcha forzada si aplica
    resultado_marcha = calcular_marcha_forzada(distancia_base, horas_extra, region)
    
    distancia_total = distancia_base + resultado_marcha["distancia_extra_km"]
    
    # Calcular probabilidad de encuentro
    region_enum = ClaseRegion(region) if isinstance(region, str) else region
    prob_encuentro = PROBABILIDAD_ENCUENTRO.get(region_enum, 10)
    
    return {
        "distancia_total_km": round(distancia_total, 1),
        "distancia_base_km": distancia_base,
        "distancia_marcha_forzada_km": resultado_marcha["distancia_extra_km"],
        "detalles_base": resultado_base["detalles"],
        "detalles_marcha_forzada": resultado_marcha if horas_extra > 0 else None,
        "advertencias": resultado_base.get("advertencias", []),
        "probabilidad_encuentro": prob_encuentro,
        "resumen": f"Recorres {round(distancia_total, 1)} km en el día" + 
                   (f" (incluyendo {horas_extra}h de marcha forzada, CD {resultado_marcha['cd_constitucion']})" if horas_extra > 0 else "")
    }


def calcular_dias_viaje(
    distancia_total_km: float,
    ritmo: str,
    terreno: str,
    camino: str = "ninguno",
    region: str = "tierras_salvajes",
    montura: bool = False
) -> Dict[str, Any]:
    """
    Calcula cuántos días tarda un viaje de X kilómetros.
    """
    resultado_dia = calcular_distancia_diaria(ritmo, terreno, camino, region, montura)
    
    if "error" in resultado_dia:
        return resultado_dia
    
    km_por_dia = resultado_dia["distancia_km"]
    
    if km_por_dia <= 0:
        return {"error": "No se puede calcular: distancia por día es 0"}
    
    dias = distancia_total_km / km_por_dia
    dias_completos = int(dias)
    horas_parciales = (dias - dias_completos) * 8
    
    return {
        "dias_totales": round(dias, 1),
        "dias_completos": dias_completos,
        "horas_ultimo_dia": round(horas_parciales, 1),
        "km_por_dia": km_por_dia,
        "distancia_total_km": distancia_total_km,
        "detalles": resultado_dia["detalles"],
        "resumen": f"El viaje de {distancia_total_km} km toma {dias_completos} días" +
                   (f" y {round(horas_parciales, 1)} horas" if horas_parciales > 0 else "")
    }


# =============================================================================
# FUNCIONES AUXILIARES PARA EL FRONTEND
# =============================================================================

def obtener_opciones_viaje() -> Dict[str, Any]:
    """
    Retorna todas las opciones disponibles para configurar un viaje.
    Útil para poblar selectores en el frontend.
    """
    return {
        "ritmos": [
            {"value": r.value, "label": RITMO_NOMBRES[r], "descripcion": RITMO_DESCRIPCIONES[r], "km_dia": DISTANCIA_BASE_KM[r]}
            for r in Ritmo
        ],
        "terrenos": [
            {"value": t.value, "label": TERRENO_NOMBRES[t], "descripcion": TERRENO_DESCRIPCIONES[t], 
             "modificador": MODIFICADOR_TERRENO[t], "color": TERRENO_COLORES[t]}
            for t in TipoTerreno
        ],
        "caminos": [
            {"value": c.value, "label": CAMINO_NOMBRES[c], "descripcion": CAMINO_DESCRIPCIONES[c],
             "modificador": MODIFICADOR_CAMINO[c], "color": CAMINO_COLORES[c]}
            for c in TipoCamino
        ],
        "regiones": [
            {"value": r.value, "label": REGION_NOMBRES[r], "descripcion": REGION_DESCRIPCIONES[r],
             "prob_encuentro": PROBABILIDAD_ENCUENTRO[r], "color": REGION_COLORES[r]}
            for r in ClaseRegion
        ]
    }
