#!/usr/bin/env python3
"""
Script to load locations from the Mordor map
Each hex = 4 miles = 6.4 km
This map connects to the east of the Gondor/Rohan map

Coordinate system adjusted so Mordor is to the east (higher X values)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']

MORDOR_LOCATIONS = [
    # === MORDOR - MAJOR FORTRESSES ===
    {
        "nombre": "Barad-dûr",
        "nombre_sindarin": "Torre Oscura",
        "region": "Mordor",
        "subregion": "Gorgoroth",
        "tipo": "fortaleza_enemiga",
        "x": 72, "y": 35,
        "descripcion": "La Torre Oscura de Sauron, centro de su poder.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Minas Morgul",
        "nombre_sindarin": "Minas Ithil",
        "region": "Mordor",
        "subregion": "Ephel Dúath",
        "tipo": "fortaleza_enemiga",
        "x": 62, "y": 32,
        "descripcion": "Torre de la Hechicería, guarida del Rey Brujo de Angmar.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Cirith Ungol",
        "nombre_sindarin": "Paso de la Araña",
        "region": "Mordor",
        "subregion": "Ephel Dúath",
        "tipo": "fortaleza_enemiga",
        "x": 64, "y": 30,
        "descripcion": "Torre que vigila el paso secreto. Guarida de Ella-Laraña.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Durthang",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Udûn",
        "tipo": "fortaleza_enemiga",
        "x": 66, "y": 42,
        "descripcion": "Fortaleza en las laderas del Ephel Dúath.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Morannon",
        "nombre_sindarin": "Puerta Negra",
        "region": "Mordor",
        "subregion": "Udûn",
        "tipo": "fortaleza_enemiga",
        "x": 62, "y": 44,
        "descripcion": "La Puerta Negra, entrada principal a Mordor entre los Dientes de Mordor.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Las Mandíbulas de Hierro",
        "nombre_sindarin": "Carach Angren",
        "region": "Mordor",
        "subregion": "Udûn",
        "tipo": "fortaleza_enemiga",
        "x": 68, "y": 40,
        "descripcion": "Paso fortificado entre Udûn y la meseta de Gorgoroth.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MORDOR - REGIONS ===
    {
        "nombre": "Gorgoroth",
        "nombre_sindarin": "Llanura del Terror",
        "region": "Mordor",
        "subregion": None,
        "tipo": "region",
        "x": 70, "y": 34,
        "descripcion": "Meseta volcánica desolada en el corazón de Mordor.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Udûn",
        "nombre_sindarin": "Valle del Infierno",
        "region": "Mordor",
        "subregion": None,
        "tipo": "region",
        "x": 64, "y": 42,
        "descripcion": "Valle cerrado tras la Puerta Negra, lleno de forjas y cuarteles.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Nurn Septentrional",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Nurn",
        "tipo": "region",
        "x": 74, "y": 28,
        "descripcion": "Tierras de cultivo del norte de Nurn, trabajadas por esclavos.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Nurn Meridional",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Nurn",
        "tipo": "region",
        "x": 74, "y": 22,
        "descripcion": "Tierras de cultivo del sur de Nurn.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Nurn Oriental",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Nurn",
        "tipo": "region",
        "x": 80, "y": 24,
        "descripcion": "Tierras de cultivo del este de Nurn.",
        "terreno": "moderado",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lithlad",
        "nombre_sindarin": "Llanura de Ceniza",
        "region": "Mordor",
        "subregion": None,
        "tipo": "region",
        "x": 76, "y": 38,
        "descripcion": "Desolada llanura de ceniza al este de Gorgoroth.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MORDOR - MOUNTAINS ===
    {
        "nombre": "Ephel Dúath",
        "nombre_sindarin": "Montañas de la Sombra",
        "region": "Mordor",
        "subregion": None,
        "tipo": "cordillera",
        "x": 60, "y": 32,
        "descripcion": "Cadena montañosa occidental de Mordor.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ered Lithui",
        "nombre_sindarin": "Montañas de Ceniza",
        "region": "Mordor",
        "subregion": None,
        "tipo": "cordillera",
        "x": 68, "y": 46,
        "descripcion": "Cadena montañosa norte de Mordor.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Orodruin",
        "nombre_sindarin": "Monte del Destino",
        "region": "Mordor",
        "subregion": "Gorgoroth",
        "tipo": "volcan",
        "x": 68, "y": 34,
        "descripcion": "Volcán donde Sauron forjó el Anillo Único. Las Grietas del Destino.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MORDOR BORDERS - NORTH ===
    {
        "nombre": "Dagorlad",
        "nombre_sindarin": "Llanura de Batalla",
        "region": "Mordor",
        "subregion": None,
        "tipo": "llanura",
        "x": 60, "y": 48,
        "descripcion": "Vasta llanura donde se libraron grandes batallas contra Sauron.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Ciénaga de los Muertos",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "pantano",
        "x": 58, "y": 50,
        "descripcion": "Pantano encantado donde yacen los caídos de la Batalla de Dagorlad.",
        "terreno": "infranqueable",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Tierra de Nadie",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "paramo",
        "x": 56, "y": 46,
        "descripcion": "Páramo desolado entre Ithilien y las puertas de Mordor.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === MORDOR - LAKES ===
    {
        "nombre": "Mar de Núrnen",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Nurn",
        "tipo": "lago",
        "x": 76, "y": 24,
        "descripcion": "Gran lago salado en el sur de Mordor, sus aguas irrigan Nurn.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === HARAD (South) ===
    {
        "nombre": "Cercano Harad",
        "nombre_sindarin": None,
        "region": "Harad",
        "subregion": None,
        "tipo": "region",
        "x": 58, "y": 12,
        "descripcion": "Tierras del Sur cercanas a Gondor, aliadas de Mordor.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Lejano Harad",
        "nombre_sindarin": None,
        "region": "Harad",
        "subregion": None,
        "tipo": "region",
        "x": 65, "y": 6,
        "descripcion": "Tierras lejanas del Sur, de donde vienen los Múmakil.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_salvajes",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Umbar",
        "nombre_sindarin": None,
        "region": "Harad",
        "subregion": None,
        "tipo": "ciudad_puerto",
        "x": 48, "y": 8,
        "descripcion": "Gran puerto de los Corsarios, enemigos de Gondor.",
        "terreno": "facil",
        "tipo_tierra": "tierras_sombra",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Cruce del Poros",
        "nombre_sindarin": None,
        "region": "Gondor/Harad",
        "subregion": None,
        "tipo": "vado",
        "x": 54, "y": 18,
        "descripcion": "Vado del río Poros, frontera sur de Gondor.",
        "terreno": "facil",
        "tipo_tierra": "fronterizas",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === RHÛN (East) ===
    {
        "nombre": "Yermo Oriental",
        "nombre_sindarin": None,
        "region": "Rhûn",
        "subregion": None,
        "tipo": "region",
        "x": 85, "y": 40,
        "descripcion": "Vastas tierras del Este, hogar de los Orientales.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Khand",
        "nombre_sindarin": None,
        "region": "Rhûn",
        "subregion": None,
        "tipo": "region",
        "x": 82, "y": 20,
        "descripcion": "Reino del Este, aliado de Mordor.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ROADS/PATHS ===
    {
        "nombre": "Camino de Morgul",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "camino",
        "x": 60, "y": 30,
        "descripcion": "Camino que asciende desde el valle hacia Minas Morgul.",
        "terreno": "dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Camino de Rhûn",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": None,
        "tipo": "camino",
        "x": 75, "y": 42,
        "descripcion": "Gran camino que conecta Mordor con las tierras del Este.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Camino de Harad",
        "nombre_sindarin": None,
        "region": "Mordor/Harad",
        "subregion": None,
        "tipo": "camino",
        "x": 68, "y": 16,
        "descripcion": "Camino que conecta Mordor con las tierras de Harad.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ADDITIONAL MORDOR LOCATIONS ===
    {
        "nombre": "Dientes de Mordor",
        "nombre_sindarin": "Carchost y Narchost",
        "region": "Mordor",
        "subregion": "Udûn",
        "tipo": "torres",
        "x": 61, "y": 45,
        "descripcion": "Las dos torres gemelas que flanquean la Puerta Negra.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "extremo",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Sauron's Road",
        "nombre_sindarin": "Camino de Sauron",
        "region": "Mordor",
        "subregion": "Gorgoroth",
        "tipo": "camino",
        "x": 70, "y": 36,
        "descripcion": "Camino que cruza Gorgoroth desde Barad-dûr hasta Orodruin.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Morgai",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Ephel Dúath",
        "tipo": "cresta",
        "x": 66, "y": 32,
        "descripcion": "Cresta interior paralela a Ephel Dúath, cubierta de espinas.",
        "terreno": "muy_dificil",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
    {
        "nombre": "Plateau of Gorgoroth",
        "nombre_sindarin": None,
        "region": "Mordor",
        "subregion": "Gorgoroth",
        "tipo": "meseta",
        "x": 69, "y": 36,
        "descripcion": "Vasta meseta volcánica cubierta de ceniza y escoria.",
        "terreno": "desalentador",
        "tipo_tierra": "tierras_oscuras",
        "peligro": "muy_alto",
        "refugio": False,
        "millas_hex": 4
    },
    
    # === ITHILIEN (already partially in Gondor map, adding detail) ===
    {
        "nombre": "Henneth Annûn",
        "nombre_sindarin": "Ventana del Ocaso",
        "region": "Gondor",
        "subregion": "Ithilien",
        "tipo": "refugio",
        "x": 58, "y": 34,
        "descripcion": "Refugio secreto de los Montaraces de Ithilien tras una cascada.",
        "terreno": "dificil",
        "tipo_tierra": "fronterizas",
        "peligro": "medio",
        "refugio": True,
        "millas_hex": 4
    },
    {
        "nombre": "Encrucijada de los Reyes Caídos",
        "nombre_sindarin": None,
        "region": "Gondor",
        "subregion": "Ithilien",
        "tipo": "monumento",
        "x": 59, "y": 30,
        "descripcion": "Cruce de caminos con estatua del rey decapitada.",
        "terreno": "moderado",
        "tipo_tierra": "tierras_sombra",
        "peligro": "alto",
        "refugio": False,
        "millas_hex": 4
    },
]


async def load_mordor_locations():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Get current max location ID
    last_loc = await db.locations.find_one(sort=[("_id", -1)])
    start_id = 1
    if last_loc:
        try:
            start_id = int(last_loc["_id"].replace("loc_", "")) + 1
        except:
            start_id = 200
    
    # Check for duplicates and skip them
    new_locations = []
    for loc in MORDOR_LOCATIONS:
        existing = await db.locations.find_one({"nombre": loc["nombre"]})
        if not existing:
            loc["_id"] = f"loc_{start_id + len(new_locations):03d}"
            loc["created_at"] = datetime.now(timezone.utc).isoformat()
            loc["mapa_origen"] = "Mordor-MMS"
            new_locations.append(loc)
        else:
            print(f"  Skipping duplicate: {loc['nombre']}")
    
    if new_locations:
        result = await db.locations.insert_many(new_locations)
        print(f"Inserted {len(result.inserted_ids)} Mordor locations")
    else:
        print("No new locations to insert")
    
    # Print summary
    print("\n=== LOCATIONS SUMMARY ===")
    
    # Count by region
    pipeline = [
        {"$group": {"_id": "$region", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    regions = await db.locations.aggregate(pipeline).to_list(50)
    print("\nBy Region:")
    for r in regions:
        print(f"  {r['_id']}: {r['count']}")
    
    total = await db.locations.count_documents({})
    print(f"\nTotal locations in database: {total}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(load_mordor_locations())
