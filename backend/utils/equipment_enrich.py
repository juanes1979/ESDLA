"""Helpers para enriquecer el equipo de un personaje desde el catálogo y
auto-equipar la ropa al crearlo.

El equipo inicial (nivel de vida / trasfondo / ocupación) llega a menudo como
nombres "pelados" sin `categoria`, `peso_kg` ni `posicion`. Esto impedía:
  - auto-equipar la ropa (se identificaba por categoria == 'ropa'), y
  - calcular el peso (peso_kg = None).
Aquí resolvemos ambos por coincidencia de nombre con el catálogo.
"""
import unicodedata
import re

# Sufijo de empaquetado: "<nombre> (paquete de N)" → el inventario suele llevar
# el nombre SIN el sufijo (p. ej. "Raciones (1 día)") y una cantidad de N días,
# mientras que el catálogo guarda el paquete completo con su peso total.
_PACK_RE = re.compile(r"^(.*?)\s*\(paquete de (\d+)\)\s*$")


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def build_catalog_index(catalog: dict) -> dict:
    """name(normalizado) -> {categoria, peso_kg, posicion, ropa_complementaria}."""
    index = {}
    if not isinstance(catalog, dict):
        return index
    for categoria, items in catalog.items():
        if not isinstance(items, list) or str(categoria).startswith("_"):
            continue
        for it in items:
            if not isinstance(it, dict):
                continue
            key = _norm(it.get("nombre"))
            if not key or key in index:
                continue
            index[key] = {
                "categoria": categoria,
                "peso_kg": it.get("peso_kg"),
                "posicion": it.get("posicion"),
                "ropa_complementaria": it.get("ropa_complementaria"),
            }
    return index


def _find_pack(index: dict, name_norm: str):
    """Busca en el catálogo un item '<name_norm> (paquete de N)'.
    Devuelve (info, N) para calcular el peso por unidad, o (None, None)."""
    for key, info in index.items():
        m = _PACK_RE.match(key)
        if not m:
            continue
        if m.group(1).strip() == name_norm:
            try:
                n = int(m.group(2))
            except (TypeError, ValueError):
                n = 0
            if n > 0:
                return info, n
    return None, None


def enrich_items(lista, index: dict) -> bool:
    """Rellena categoria/peso_kg/posicion/ropa_complementaria que falten.
    Coincide por nombre exacto y, si no, por nombre de paquete
    ('<nombre> (paquete de N)') calculando el peso por unidad.
    Devuelve True si modificó algo."""
    if not isinstance(lista, list):
        return False
    changed = False
    for it in lista:
        if not isinstance(it, dict):
            continue
        nm = _norm(it.get("nombre"))
        info = index.get(nm)
        divisor = 1
        if not info:
            info, n = _find_pack(index, nm)
            divisor = n or 1
        if not info:
            continue
        if not it.get("categoria") and info.get("categoria"):
            it["categoria"] = info["categoria"]; changed = True
        if it.get("peso_kg") is None and info.get("peso_kg") is not None:
            peso = info["peso_kg"]
            it["peso_kg"] = round(peso / divisor, 4) if divisor > 1 else peso
            changed = True
        if not it.get("posicion") and info.get("posicion"):
            it["posicion"] = info["posicion"]; changed = True
        if it.get("ropa_complementaria") is None and info.get("ropa_complementaria") is not None:
            it["ropa_complementaria"] = info["ropa_complementaria"]; changed = True
    return changed


def auto_equip_ropa(lista) -> None:
    """Auto-equipa la ropa: TODA la ropa complementaria (capas) + una prenda
    base por cada posición corporal distinta (las prendas sin posición: solo la
    primera). Así el personaje no aparece "desnudo" y se permiten capas."""
    if not isinstance(lista, list):
        return
    base_pos = set()
    base_sin_pos = False
    for it in lista:
        if not isinstance(it, dict):
            continue
        if (it.get("categoria") or "").lower() != "ropa":
            continue
        if it.get("ropa_complementaria"):
            it["activa"] = True
            continue
        pos = (it.get("posicion") or "").lower()
        if pos:
            if pos in base_pos:
                continue
            base_pos.add(pos)
        else:
            if base_sin_pos:
                continue
            base_sin_pos = True
        it["activa"] = True
