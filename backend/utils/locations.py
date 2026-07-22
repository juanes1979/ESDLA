"""Utilidad compartida para localizar ubicaciones de forma robusta.

El endpoint /data/locations serializa `id` como str(_id), por lo que el
frontend envía ese valor. Sin embargo, en Mongo el `_id` suele ser un ObjectId
y muchas búsquedas usaban {"_id": <string>} (que nunca casa) o {"id": <string>}
(que solo casa con el campo `id` propio, p. ej. 'loc_002'). Esta función prueba
todas las variantes para evitar 404 falsos.
"""
try:
    from bson import ObjectId
except Exception:  # pragma: no cover
    ObjectId = None


async def find_location(db, loc_id):
    """Devuelve el documento de ubicación buscando por:
    - campo `id` propio (p. ej. 'loc_002'),
    - `_id` como cadena,
    - `_id` como ObjectId (caso normal, el frontend manda str(_id)).
    """
    if not loc_id:
        return None
    loc = await db.locations.find_one({"id": loc_id}) or \
          await db.locations.find_one({"_id": loc_id})
    if not loc and ObjectId is not None and ObjectId.is_valid(str(loc_id)):
        loc = await db.locations.find_one({"_id": ObjectId(loc_id)})
    return loc
