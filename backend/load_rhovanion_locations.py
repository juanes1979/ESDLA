#!/usr/bin/env python3
"""
Script to load locations from the Rhovanion map (Wilderlands of the East)
Each hex = 4 miles = 6.4 km
This is the eastern region - connects to the east of the Eriador map and north of Gondor/Rohan

Coordinate system: Rhovanion is to the east, so higher X values
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

RHOVANION_LOCATIONS = [
    # === EREBOR AND DALE ===
    {
        "nombre": "Erebor",
        "nombre_sindarin": "Montaña Solitaria",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "reino_enano",
        "x": 70, "y": 72,
        "descripcion": "El Reino bajo la Montaña, hogar de los Enanos de Durin. Tesoro de Smaug.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Valle",
        "nombre_sindarin": "Dale",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "ciudad",
        "x": 71, "y": 70,
        "descripcion": "Ciudad de los Hombres del Norte, reconstruida tras la muerte de Smaug.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Esgaroth",
        "nombre_sindarin": "Ciudad del Lago",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "ciudad",
        "x": 72, "y": 66,
        "descripcion": "Ciudad de los Hombres del Lago, construida sobre pilotes en el Lago Largo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Lago Largo",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "lago",
        "x": 72, "y": 64,
        "descripcion": "Gran lago donde desemboca el Río del Bosque.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "La Desolación de Smaug",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "paramo",
        "x": 68, "y": 70,
        "descripcion": "Tierra calcinada alrededor de Erebor, devastada por el dragón.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === BOSQUE NEGRO ===
    {
        "nombre": "Bosque Negro",
        "nombre_sindarin": "Mirkwood",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "bosque_oscuro",
        "x": 62, "y": 58,
        "descripcion": "El gran bosque oscurecido por la Sombra de Dol Guldur.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Bosque Negro Septentrional",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "bosque",
        "x": 64, "y": 66,
        "descripcion": "Parte norte del Bosque Negro, menos corrupta.",
        "terreno": "dificil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Bosque Negro Meridional",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "bosque",
        "x": 60, "y": 52,
        "descripcion": "Parte sur del Bosque Negro, donde habita la Sombra.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Reino del Bosque",
        "nombre_sindarin": "Eryn Lasgalen",
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "reino_elfico",
        "x": 66, "y": 68,
        "descripcion": "Reino del rey Thranduil, padre de Legolas. Palacio subterráneo.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Dol Guldur",
        "nombre_sindarin": "Colina de la Hechicería",
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "fortaleza_enemiga",
        "x": 56, "y": 52,
        "descripcion": "Antigua fortaleza del Nigromante (Sauron). Ahora abandonada pero maldita.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Camino del Bosque",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "camino",
        "x": 62, "y": 62,
        "descripcion": "El viejo camino de los Elfos que cruza el Bosque Negro.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Puente Encantado",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "puente",
        "x": 64, "y": 64,
        "descripcion": "Puente sobre el río Encantado, donde el agua causa sueño mágico.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Aldea de los Hombres del Bosque",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "pueblo",
        "x": 68, "y": 60,
        "descripcion": "Asentamientos de los Hombres del Bosque en los bordes de Mirkwood.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === LOTHLÓRIEN ===
    {
        "nombre": "Lothlórien",
        "nombre_sindarin": "Laurelindórenan",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "bosque_elfico",
        "x": 48, "y": 52,
        "descripcion": "El Bosque Dorado, hogar de Galadriel y Celeborn. Protegido por Nenya.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Caras Galadhon",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Lothlórien",
        "tipo": "ciudad_elfica",
        "x": 48, "y": 50,
        "descripcion": "Ciudad de los árboles, capital de Lothlórien. Hogar de Galadriel.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Cerin Amroth",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Lothlórien",
        "tipo": "lugar_especial",
        "x": 48, "y": 54,
        "descripcion": "Colina sagrada donde Aragorn y Arwen se desposaron.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === VALLE DEL ANDUIN ===
    {
        "nombre": "Casa de Beorn",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Valle del Anduin",
        "tipo": "refugio",
        "x": 50, "y": 66,
        "descripcion": "Hogar de Beorn el cambiapieles, protector del Paso Alto.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "El Carrock",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Valle del Anduin",
        "tipo": "monumento",
        "x": 48, "y": 64,
        "descripcion": "Gran roca con escalones tallados en el río Anduin.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Vado de Carrock",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Valle del Anduin",
        "tipo": "vado",
        "x": 48, "y": 62,
        "descripcion": "Vado del Anduin cerca del Carrock.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Valles del Anduin",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "region",
        "x": 50, "y": 60,
        "descripcion": "Tierras fértiles a lo largo del río Anduin.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Campo de Celebrant",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Valle del Anduin",
        "tipo": "llanura",
        "x": 52, "y": 54,
        "descripcion": "Llanura donde Eorl el Joven salvó a Gondor.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MONTAÑAS GRISES ===
    {
        "nombre": "Montañas Grises",
        "nombre_sindarin": "Ered Mithrin",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "cordillera",
        "x": 60, "y": 80,
        "descripcion": "Cordillera al norte del Bosque Negro, antiguo hogar de dragones.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Colinas de Hierro",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "reino_enano",
        "x": 82, "y": 74,
        "descripcion": "Reino enano al este, hogar de Dáin Pie de Hierro.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Tierras Ásperas",
        "nombre_sindarin": "Wilderland",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "region",
        "x": 58, "y": 70,
        "descripcion": "Las Tierras Salvajes, vasta región entre las Montañas Nubladas y el Bosque Negro.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === RÍOS DE RHOVANION ===
    {
        "nombre": "Río del Bosque",
        "nombre_sindarin": "Forest River",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "rio",
        "x": 68, "y": 66,
        "descripcion": "Río que fluye desde el Reino del Bosque hasta el Lago Largo.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Rápido",
        "nombre_sindarin": "Celduin",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "rio",
        "x": 74, "y": 62,
        "descripcion": "Río que nace en Erebor y fluye hacia el sur.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Encantado",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Bosque Negro",
        "tipo": "rio",
        "x": 64, "y": 62,
        "descripcion": "Río mágico cuyas aguas causan sueño y olvido.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Río Celebrant",
        "nombre_sindarin": "Silverlode",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "rio",
        "x": 48, "y": 48,
        "descripcion": "Río plateado que fluye desde Lothlórien.",
        "terreno": "facil",
        "tipo_tierra": "tierras_libres",
        "peligro": "bajo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === TIERRAS DEL ESTE ===
    {
        "nombre": "Dorwinion",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "region",
        "x": 88, "y": 58,
        "descripcion": "Tierra de viñedos famosos, al este del Bosque Negro.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Mar de Rhûn",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "lago",
        "x": 92, "y": 54,
        "descripcion": "Gran mar interior al este de Rhovanion.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === NIDO DE LAS ÁGUILAS ===
    {
        "nombre": "Nido de las Águilas",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Montañas Nubladas",
        "tipo": "refugio",
        "x": 44, "y": 68,
        "descripcion": "Hogar de las Grandes Águilas en las Montañas Nubladas.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    
    # === FANGORN (conexión con Rohan) ===
    {
        "nombre": "Fangorn Norte",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Fangorn",
        "tipo": "bosque_antiguo",
        "x": 44, "y": 48,
        "descripcion": "Límite norte del Bosque de Fangorn, donde habitan los Ents más ancianos.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === TIERRAS PARDAS ===
    {
        "nombre": "Tierras Pardas",
        "nombre_sindarin": "Brown Lands",
        "region": "Rhovanion",
        "subregion": None,
        "tipo": "paramo",
        "x": 56, "y": 46,
        "descripcion": "Tierras devastadas donde vivían las Ent-mujeres. Ahora yermas.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === OTROS LUGARES ===
    {
        "nombre": "Puerta Este de Moria",
        "nombre_sindarin": None,
        "region": "Rhovanion",
        "subregion": "Montañas Nubladas",
        "tipo": "puerta",
        "x": 44, "y": 52,
        "descripcion": "Salida este de Moria, junto al Lago Espejo.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lago Espejo",
        "nombre_sindarin": "Kheled-zâram",
        "region": "Rhovanion",
        "subregion": "Montañas Nubladas",
        "tipo": "lago",
        "x": 44, "y": 50,
        "descripcion": "Lago sagrado de los Enanos donde se reflejan las estrellas.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Valle del Arroyo Sombrío",
        "nombre_sindarin": "Dimrill Dale",
        "region": "Rhovanion",
        "subregion": "Montañas Nubladas",
        "tipo": "valle",
        "x": 46, "y": 52,
        "descripcion": "Valle a la salida este de Moria.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
]


async def load_rhovanion_locations():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get current max location ID
    last_loc = await db.locations.find_one(sort=[("_id", -1)])
    start_id = 1
    if last_loc:
        try:
            start_id = int(last_loc["_id"].replace("loc_", "")) + 1
        except:
            start_id = 400
    
    # Check for duplicates and skip them
    new_locations = []
    for loc in RHOVANION_LOCATIONS:
        existing = await db.locations.find_one({"nombre": loc["nombre"]})
        if not existing:
            loc["_id"] = f"loc_{start_id + len(new_locations):03d}"
            loc["created_at"] = datetime.now(timezone.utc).isoformat()
            loc["mapa_origen"] = "Rhovanion-MMS"
            new_locations.append(loc)
        else:
            print(f"  Skipping duplicate: {loc['nombre']}")
    
    if new_locations:
        result = await db.locations.insert_many(new_locations)
        print(f"Inserted {len(result.inserted_ids)} Rhovanion locations")
    else:
        print("No new locations to insert")
    
    # Print summary
    print("\n=== FINAL LOCATIONS SUMMARY ===")
    
    # Count by region
    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    regions = await db.locations.aggregate(pipeline).to_list(50)
    print("\nBy Region:")
    for r in regions:
        print(f"  {r['_id']}: {r['count']}")
    
    # Count by terrain
    pipeline = [
        {"$match": {"terreno": {"$exists": True}}},
        {"$group": {"_id": "$terreno", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    terrains = await db.locations.aggregate(pipeline).to_list(20)
    print("\nBy Terrain:")
    for t in terrains:
        print(f"  {t['_id']}: {t['count']}")
    
    # Count by land type
    pipeline = [
        {"$match": {"tipo_tierra": {"$exists": True}}},
        {"$group": {"_id": "$tipo_tierra", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    lands = await db.locations.aggregate(pipeline).to_list(20)
    print("\nBy Land Type:")
    for l in lands:
        print(f"  {l['_id']}: {l['count']}")
    
    total = await db.locations.count_documents({})
    print(f"\n🗺️ TOTAL LOCATIONS IN DATABASE: {total}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(load_rhovanion_locations())
