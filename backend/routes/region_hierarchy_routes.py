"""
REGION HIERARCHY — Sistema jerárquico de Regiones / Subregiones / Ubicaciones
=============================================================================

Permite anidar regiones (ej. Eriador → Angmar / Tierras de Bree → Bree).
Las propiedades de cada nodo (tipo_tierra, dificultad, clase_region) son
INDEPENDIENTES: no se heredan automáticamente. La cascada manual desde
un padre actualiza descendientes que NO tengan override propio.

Modelo:
- `region_nodes` collection:
    {
      id: uuid,
      name: str (único),                # "Eriador", "Angmar", "Tierras de Bree"
      parent_id: str | None,            # null = nodo raíz (región principal)
      tipo_tierra: str | None,          # "tierras_libres", "tierras_salvajes", etc.
      dificultad: str | None,           # "facil", "moderado", "dificil", ...
      clase_region: str | None,         # alias de tipo_tierra para compatibilidad
      tipo_tierra_override: bool,       # True = no se sobreescribe en cascada
      dificultad_override: bool,
      clase_region_override: bool,
      orden: int,                       # orden visual entre hermanos
    }

- Las ubicaciones existentes (`locations`) NO se modifican. Su campo
  `region` (string) se sigue usando como vínculo: una ubicación pertenece
  al nodo cuyo `name` coincide con `location.region`.

Cascada (POST /node/{id}/cascade):
- Recorre todos los descendientes del nodo (nodos hijos + sus
  ubicaciones por nombre de región) y aplica los valores del nodo padre
  excepto en aquellos que tengan el flag de override correspondiente.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/regions", tags=["region-hierarchy"])

_client = None
_db = None

def _get_db():
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ['MONGO_URL'])
        _db = _client[os.environ['DB_NAME']]
    return _db


# ============== MODELOS ==============
class RegionNode(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    parent_id: Optional[str] = None
    tipo_tierra: Optional[str] = None
    dificultad: Optional[str] = None
    clase_region: Optional[str] = None
    tipo_tierra_override: bool = False
    dificultad_override: bool = False
    clase_region_override: bool = False
    orden: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CreateNodeRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None
    tipo_tierra: Optional[str] = None
    dificultad: Optional[str] = None
    clase_region: Optional[str] = None


class UpdateNodeRequest(BaseModel):
    name: Optional[str] = None
    tipo_tierra: Optional[str] = None
    dificultad: Optional[str] = None
    clase_region: Optional[str] = None


class MoveNodeRequest(BaseModel):
    parent_id: Optional[str] = None  # null = mover a raíz
    orden: Optional[int] = None


class CascadeRequest(BaseModel):
    fields: List[str] = ["tipo_tierra", "dificultad"]  # campos a cascadear
    apply_to_locations: bool = True


# ============== HELPERS ==============
async def _load_all_nodes() -> List[Dict[str, Any]]:
    db = _get_db()
    docs = await db.region_nodes.find({}, {"_id": 0}).to_list(2000)
    return docs


async def _get_node(node_id: str) -> Dict[str, Any]:
    db = _get_db()
    n = await db.region_nodes.find_one({"id": node_id}, {"_id": 0})
    if not n:
        raise HTTPException(404, f"Nodo {node_id} no encontrado")
    return n


async def _save_node(node: Dict[str, Any]) -> Dict[str, Any]:
    db = _get_db()
    node["updated_at"] = datetime.now(timezone.utc).isoformat()
    node.pop("_id", None)
    await db.region_nodes.update_one({"id": node["id"]}, {"$set": node}, upsert=True)
    return node


def _build_tree(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Construye estructura jerárquica a partir de una lista plana."""
    by_id: Dict[str, Dict[str, Any]] = {n["id"]: {**n, "children": []} for n in nodes}
    roots: List[Dict[str, Any]] = []
    for n in by_id.values():
        pid = n.get("parent_id")
        if pid and pid in by_id:
            by_id[pid]["children"].append(n)
        else:
            roots.append(n)
    # Orden alfabético/orden por defecto
    def _sort(arr):
        arr.sort(key=lambda x: (x.get("orden", 0), x.get("name", "")))
        for n in arr:
            _sort(n["children"])
    _sort(roots)
    return roots


def _descendant_ids(node_id: str, all_nodes: List[Dict[str, Any]]) -> List[str]:
    """IDs de TODOS los descendientes (recursivo)."""
    children = [n["id"] for n in all_nodes if n.get("parent_id") == node_id]
    result = list(children)
    for cid in children:
        result.extend(_descendant_ids(cid, all_nodes))
    return result


def _ancestor_ids(node_id: str, all_nodes: List[Dict[str, Any]]) -> List[str]:
    by_id = {n["id"]: n for n in all_nodes}
    result = []
    cur = by_id.get(node_id)
    while cur and cur.get("parent_id"):
        result.append(cur["parent_id"])
        cur = by_id.get(cur["parent_id"])
    return result


# ============== ENDPOINTS ==============
@router.get("/tree")
async def get_tree():
    """Devuelve la jerarquía completa con nodos enriquecidos por counts
    de ubicaciones que pertenecen a cada nodo (location.region == node.name)."""
    db = _get_db()
    nodes = await _load_all_nodes()
    locs = await db.locations.find({}, {"_id": 0, "id": 1, "nombre": 1, "region": 1, "tipo_terreno": 1, "clase_region": 1}).to_list(5000)

    # Index locs por region name
    locs_by_region: Dict[str, List[Dict[str, Any]]] = {}
    for loc in locs:
        r = (loc.get("region") or "").strip()
        if r:
            locs_by_region.setdefault(r, []).append(loc)

    for n in nodes:
        n_locs = locs_by_region.get(n["name"], [])
        n["locations_count"] = len(n_locs)
        n["locations"] = n_locs[:50]  # cap para no enviar miles

    tree = _build_tree(nodes)

    # Ubicaciones huérfanas: tienen `region` no mapeado a ningún nodo
    node_names = {n["name"] for n in nodes}
    orphan_regions: Dict[str, List[Dict[str, Any]]] = {}
    for region_name, lst in locs_by_region.items():
        if region_name not in node_names:
            orphan_regions[region_name] = lst

    return {
        "tree": tree,
        "orphan_regions": [
            {"name": rn, "locations_count": len(ls), "locations": ls[:50]}
            for rn, ls in orphan_regions.items()
        ],
        "total_nodes": len(nodes),
    }


@router.post("/node")
async def create_node(req: CreateNodeRequest):
    db = _get_db()
    if not req.name.strip():
        raise HTTPException(400, "El nombre es obligatorio")
    # Unicidad
    existing = await db.region_nodes.find_one({"name": req.name.strip()}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(409, f"Ya existe un nodo llamado '{req.name}'")
    if req.parent_id:
        await _get_node(req.parent_id)  # valida existencia (404 si no)
    node = RegionNode(
        name=req.name.strip(),
        parent_id=req.parent_id,
        tipo_tierra=req.tipo_tierra,
        dificultad=req.dificultad,
        clase_region=req.clase_region,
    ).model_dump()
    await db.region_nodes.insert_one({**node})
    return node


@router.patch("/node/{node_id}")
async def update_node(node_id: str, req: UpdateNodeRequest):
    node = await _get_node(node_id)
    changes: Dict[str, Any] = {}
    if req.name is not None and req.name.strip():
        # Comprobar unicidad si cambia el nombre
        if req.name.strip() != node.get("name"):
            db = _get_db()
            existing = await db.region_nodes.find_one(
                {"name": req.name.strip(), "id": {"$ne": node_id}}, {"_id": 0, "id": 1}
            )
            if existing:
                raise HTTPException(409, f"Ya existe un nodo llamado '{req.name}'")
        changes["name"] = req.name.strip()
    if req.tipo_tierra is not None:
        changes["tipo_tierra"] = req.tipo_tierra
        changes["tipo_tierra_override"] = True  # cambio manual → bloqueamos cascada futura
    if req.dificultad is not None:
        changes["dificultad"] = req.dificultad
        changes["dificultad_override"] = True
    if req.clase_region is not None:
        changes["clase_region"] = req.clase_region
        changes["clase_region_override"] = True
    node.update(changes)
    return await _save_node(node)


@router.patch("/node/{node_id}/move")
async def move_node(node_id: str, req: MoveNodeRequest):
    """Cambia el parent del nodo. Valida que no se cree un ciclo."""
    node = await _get_node(node_id)
    if req.parent_id == node_id:
        raise HTTPException(400, "Un nodo no puede ser su propio padre")
    if req.parent_id:
        # Validar que no creamos ciclo: nuevo parent no puede ser
        # descendiente del nodo movido.
        all_nodes = await _load_all_nodes()
        descendants = _descendant_ids(node_id, all_nodes)
        if req.parent_id in descendants:
            raise HTTPException(400, "Movimiento crearía un ciclo (el nuevo padre es descendiente)")
        await _get_node(req.parent_id)  # 404 si no existe
    node["parent_id"] = req.parent_id
    if req.orden is not None:
        node["orden"] = int(req.orden)
    return await _save_node(node)


@router.delete("/node/{node_id}")
async def delete_node(node_id: str, reassign_children_to_parent: bool = True):
    db = _get_db()
    node = await _get_node(node_id)
    children = await db.region_nodes.find({"parent_id": node_id}, {"_id": 0, "id": 1}).to_list(1000)
    if children:
        if reassign_children_to_parent:
            # Reasignamos los hijos al abuelo (puede ser None = raíz)
            new_parent = node.get("parent_id")
            await db.region_nodes.update_many(
                {"parent_id": node_id},
                {"$set": {"parent_id": new_parent, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
        else:
            raise HTTPException(409, f"El nodo tiene {len(children)} hijos. Reasígnalos primero.")
    await db.region_nodes.delete_one({"id": node_id})
    return {"deleted": True, "id": node_id}


@router.post("/node/{node_id}/cascade")
async def cascade_node(node_id: str, req: CascadeRequest):
    """
    Propaga los valores `tipo_tierra` / `dificultad` / `clase_region`
    del nodo a todos sus descendientes (nodos + ubicaciones), saltando
    los que tengan override propio.

    Devuelve el conteo de cambios aplicados.
    """
    db = _get_db()
    node = await _get_node(node_id)
    all_nodes = await _load_all_nodes()
    descendant_ids = _descendant_ids(node_id, all_nodes)
    by_id = {n["id"]: n for n in all_nodes}

    # Filtramos los campos válidos
    valid_fields = {"tipo_tierra", "dificultad", "clase_region"}
    fields = [f for f in req.fields if f in valid_fields]
    if not fields:
        raise HTTPException(400, f"fields debe contener al menos uno de: {valid_fields}")

    # 1) Cascada a nodos descendientes
    nodes_updated = 0
    nodes_skipped: List[Dict[str, Any]] = []
    for did in descendant_ids:
        d = by_id[did]
        changes: Dict[str, Any] = {}
        skipped_for_node: List[str] = []
        for f in fields:
            override_flag = f"{f}_override"
            if d.get(override_flag):
                skipped_for_node.append(f)
                continue
            if node.get(f) is not None:
                changes[f] = node[f]
        if changes:
            changes["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.region_nodes.update_one({"id": did}, {"$set": changes})
            nodes_updated += 1
        if skipped_for_node:
            nodes_skipped.append({"id": did, "name": d.get("name"), "fields": skipped_for_node})

    # 2) Cascada a ubicaciones
    locations_updated = 0
    locations_skipped: List[Dict[str, Any]] = []
    if req.apply_to_locations:
        # Las ubicaciones afectadas son las que tienen `region` ==
        # nombre del nodo o de cualquier descendiente.
        target_names = [node["name"]] + [by_id[d]["name"] for d in descendant_ids]
        # Mapping de campo "node" → campo "location"
        FIELD_MAP_LOC = {
            "tipo_tierra": "clase_region",      # las ubicaciones usan "clase_region" como tipo_tierra
            "dificultad": "tipo_terreno",       # y "tipo_terreno" como nombre del campo de dificultad
            "clase_region": "clase_region",
        }
        # En el dataset actual, locations tienen `tipo_terreno` (dificultad) y `clase_region` (tipo de tierra).
        # No tenemos campo de "override" en locations. Aplicamos la cascada
        # para CADA ubicación afectada usando el valor del nodo MÁS
        # cercano en la jerarquía que tenga ese campo definido.
        locs = await db.locations.find({"region": {"$in": target_names}}, {"_id": 1, "id": 1, "region": 1, "tipo_terreno": 1, "clase_region": 1}).to_list(5000)
        # Mapa nombre→nodo
        name_to_node = {n["name"]: n for n in all_nodes}
        for loc in locs:
            loc_node = name_to_node.get((loc.get("region") or "").strip())
            if not loc_node:
                continue
            # El nodo de la ubicación es el más específico. Para cada
            # campo: si el nodo del loc tiene override → usa el valor
            # del nodo del loc; si no → usa el valor del nodo padre que
            # estamos cascadeando.
            updates = {}
            for f in fields:
                target_field = FIELD_MAP_LOC.get(f, f)
                # Si el nodo más específico tiene override en ese campo
                # → respetamos su valor (no propagamos desde el padre).
                if loc_node.get(f"{f}_override"):
                    continue
                if node.get(f) is None:
                    continue
                # Sólo actualizamos si el valor de la ubicación es distinto
                if loc.get(target_field) != node[f]:
                    updates[target_field] = node[f]
            if updates:
                await db.locations.update_one(
                    {"_id": loc["_id"]},
                    {"$set": updates},
                )
                locations_updated += 1
            else:
                locations_skipped.append({"id": loc.get("id") or str(loc["_id"]), "region": loc.get("region")})

    return {
        "node": {"id": node["id"], "name": node["name"]},
        "fields_cascaded": fields,
        "nodes_updated": nodes_updated,
        "nodes_skipped": nodes_skipped,
        "locations_updated": locations_updated,
        "locations_skipped_count": len(locations_skipped),
    }


@router.post("/seed-from-locations")
async def seed_from_locations():
    """
    Crea automáticamente un nodo por cada `region` única encontrada en
    locations, sin parent. Idempotente: no recrea nodos existentes.
    Útil como punto de partida para que el admin construya la jerarquía.
    """
    db = _get_db()
    locs = await db.locations.find({}, {"_id": 0, "region": 1, "clase_region": 1, "tipo_terreno": 1}).to_list(5000)
    region_aggregate: Dict[str, Dict[str, Any]] = {}
    for loc in locs:
        r = (loc.get("region") or "").strip()
        if not r:
            continue
        agg = region_aggregate.setdefault(r, {"clase_region": {}, "tipo_terreno": {}})
        cr = loc.get("clase_region")
        if cr:
            agg["clase_region"][cr] = agg["clase_region"].get(cr, 0) + 1
        tt = loc.get("tipo_terreno")
        if tt:
            agg["tipo_terreno"][tt] = agg["tipo_terreno"].get(tt, 0) + 1

    created: List[str] = []
    skipped: List[str] = []
    for region_name, agg in region_aggregate.items():
        existing = await db.region_nodes.find_one({"name": region_name}, {"_id": 0, "id": 1})
        if existing:
            skipped.append(region_name)
            continue
        # Toma el valor más frecuente como default del nodo
        cr = max(agg["clase_region"].items(), key=lambda kv: kv[1])[0] if agg["clase_region"] else None
        tt = max(agg["tipo_terreno"].items(), key=lambda kv: kv[1])[0] if agg["tipo_terreno"] else None
        node = RegionNode(name=region_name, tipo_tierra=cr, clase_region=cr, dificultad=tt).model_dump()
        await db.region_nodes.insert_one({**node})
        created.append(region_name)

    return {"created": created, "skipped_existing": skipped, "total": len(created)}
