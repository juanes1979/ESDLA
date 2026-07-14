"""
Generador procedimental de nombres para criaturas sin raza (Orcos, Troles,
Huargos) mediante construcción silábica de 3 partes + epíteto opcional.

Los diccionarios son los VALORES POR DEFECTO. En la Fase B se podrán editar
desde la UI guardándolos en la colección `npc_creature_name_config`; el endpoint
lee de esa colección si existe y, si no, usa estos valores.
"""
from __future__ import annotations

import random
from typing import Optional

# ── Diccionarios por defecto ────────────────────────────────────────────────
CREATURE_NAME_DATA = {
    "orco": {
        "label": "Orco",
        "usa_sexo": True,
        "ataque": ["Gor", "Ugl", "Shag", "Muz", "Lug", "Snag", "Az", "Bol", "Grish", "Mau",
                   "Rad", "Lag", "Yag", "Gaz", "Kruk", "Dush", "Morg", "Gash", "Uf", "Zab",
                   "Nar", "Brog", "Ghaz", "Khaz", "Gorf"],
        "nucleo": ["ba", "rat", "luk", "gash", "bur", "nak", "rish", "thak", "gol", "luv",
                   "dush", "mak", "rub", "guz", "naz", "tar", "rak", "búrz", "hai", "dur"],
        "cierre_m": ["bag", "uk", "g", "kh", "z", "th", "l", "r", "k", "sh",
                     "nk", "rz", "gash", "rut", "tak", "nakh", "bol", "urz", "dur", "ug"],
        "cierre_f": ["sha", "zira", "mór", "nakh", "ri", "za", "ni", "rna", "gasha", "dusha",
                     "buri", "thari", "luna", "risha", "nara", "zari", "gula", "kura", "ruta", "shari"],
        "epitetos": ["el Cruel", "Rompecráneos", "el Sanguinario", "Cara-cicatriz", "el Mutilador",
                     "Ojomuerto", "el Hambriento", "el Despiadado", "Rajacuellos", "el Negro",
                     "Comecarne", "el Escurridizo", "Espalda-rota", "el Tuerto", "Muerdehuesos"],
    },
    "troll": {
        "label": "Trol",
        "usa_sexo": False,
        "ataque": ["Tom", "Bert", "Hug", "Olog", "Glog", "Búrz", "Murg", "Thro", "Lum", "Gork",
                   "Bru", "Thum", "Grob", "Blug", "Brog", "Dro", "Mug", "Grum", "Targ", "Karg"],
        "nucleo": ["ga", "lo", "bu", "ruz", "gha", "mo", "lu", "ro", "ba", "gu", "thu", "do", "bo", "ru", "ma"],
        "cierre_univ": ["b", "g", "k", "th", "d", "m", "lug", "rt", "gash", "rg", "nk", "rp", "mp", "nt", "gg"],
        "epitetos": ["el Aplastador", "Piespesados", "el Hambriento", "Piel-de-Piedra", "el Rompehuesos",
                     "el Lento", "Garrote-sangriento", "el Feroz", "Mascafierro", "el Gigante",
                     "el Tonto", "Rompeárboles", "el Glotón", "Tripas-sucias", "el Pescador"],
    },
    "huargo": {
        "label": "Huargo",
        "usa_sexo": False,
        "ataque": ["Garm", "Varg", "Snat", "Gnar", "Rul", "Zang", "Karchar", "Draug", "Mork", "Ri",
                   "Gaur", "Fen", "Bled", "Carchar", "Gaurhoth", "Rhak", "Khar", "Zar", "Ghar", "Vra"],
        "nucleo": ["ra", "ro", "ugh", "zi", "ar", "gha", "ri", "ru", "za", "gor", "gash", "rak", "nak", "ruk", "zar"],
        "cierre_univ": ["g", "th", "k", "z", "r", "sh", "f", "kh", "nk", "rg", "rz", " fang", "claw", "m", "ng"],
        "epitetos": ["Sangre-negra", "Diente-rojo", "el Desgarrador", "Corre-sombras", "Fauces-terribles",
                     "el Cazador", "Muerte-rápida", "Ojo-de-fuego", "el Aullador", "Pelo-hirsuto",
                     "Acecha-hombres", "el Rabioso", "Mata-caballos", "el Feroz", "Sombra-gris"],
    },
}


def _merge(left: str, right: str) -> str:
    """Fusiona dos sílabas evitando dobles consonantes: si la última letra de la
    izquierda coincide con la primera de la derecha, se elimina la duplicada."""
    if left and right and right[0] != " " and left[-1].lower() == right[0].lower():
        return left + right[1:]
    return left + right


def generate_creature_name(tipo: str, sexo: Optional[str] = None, data: Optional[dict] = None) -> dict:
    """Genera un nombre según el algoritmo silábico de 3 partes + epíteto (25%)."""
    catalog = data or CREATURE_NAME_DATA
    tipo = (tipo or "").strip().lower()
    d = catalog.get(tipo)
    if not d:
        raise ValueError(f"Tipo de criatura no válido: {tipo}")

    # 1) Ataque
    name = random.choice(d["ataque"])
    # 2) Núcleo (70%)
    if random.random() < 0.70 and d.get("nucleo"):
        name = _merge(name, random.choice(d["nucleo"]))
    # 3) Cierre (por sexo en orcos; universal en el resto)
    if d.get("usa_sexo"):
        es_masc = (sexo or "M").upper().startswith("M")
        cierres = d["cierre_m"] if es_masc else d["cierre_f"]
    else:
        cierres = d.get("cierre_univ", [])
    if cierres:
        name = _merge(name, random.choice(cierres))

    # 4) Capitalización: primera en mayúscula, resto en minúsculas
    base = name.strip().capitalize()

    # 5) Epíteto (25%), conservando su propia capitalización
    epiteto = None
    full = base
    if random.random() < 0.25 and d.get("epitetos"):
        epiteto = random.choice(d["epitetos"])
        full = f"{base} {epiteto}"

    return {"name": full, "base": base, "epiteto": epiteto, "tipo": tipo}


def list_creature_types(data: Optional[dict] = None) -> list:
    catalog = data or CREATURE_NAME_DATA
    return [{"id": k, "label": v.get("label", k.capitalize()), "usa_sexo": v.get("usa_sexo", False)}
            for k, v in catalog.items()]
