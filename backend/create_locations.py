#!/usr/bin/env python3
"""
Script to create initial locations collection for Middle-earth map
These are approximate coordinates based on the canonical Tolkien maps
Coordinates use a simplified system where x=0-100 (west to east) and y=0-100 (south to north)
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_url = os.environ['MONGO_URL']
db_name = os.environ['DB_NAME']


# Initial locations data - organized by region
LOCATIONS = [
    # === ERIADOR (Northwest) ===
    {"nombre": "La Comarca", "nombre_sindarin": "Sûzat", "region": "Eriador", "tipo": "region", "x": 25, "y": 55, "descripcion": "Hogar de los Hobbits", "peligro": "bajo", "refugio": True},
    {"nombre": "Hobbiton", "nombre_sindarin": None, "region": "La Comarca", "tipo": "pueblo", "x": 24, "y": 56, "descripcion": "Pueblo hobbit donde vive Bolsón Cerrado", "peligro": "bajo", "refugio": True},
    {"nombre": "Bree", "nombre_sindarin": "Beri", "region": "Eriador", "tipo": "pueblo", "x": 30, "y": 55, "descripcion": "Encrucijada de caminos con El Poney Pisador", "peligro": "bajo", "refugio": True},
    {"nombre": "Rivendel", "nombre_sindarin": "Imladris", "region": "Eriador", "tipo": "refugio_elfico", "x": 38, "y": 52, "descripcion": "La Última Casa Amiga al este del Mar", "peligro": "bajo", "refugio": True},
    {"nombre": "Weathertop", "nombre_sindarin": "Amon Sûl", "region": "Eriador", "tipo": "ruinas", "x": 33, "y": 54, "descripcion": "Antigua torre de vigilancia, ahora en ruinas", "peligro": "medio", "refugio": False},
    {"nombre": "Puertos Grises", "nombre_sindarin": "Mithlond", "region": "Eriador", "tipo": "puerto", "x": 12, "y": 52, "descripcion": "Puerto élfico desde donde parten hacia Valinor", "peligro": "bajo", "refugio": True},
    {"nombre": "Fornost", "nombre_sindarin": "Fornost Erain", "region": "Eriador", "tipo": "ruinas", "x": 28, "y": 62, "descripcion": "Antigua capital del reino de Arthedain", "peligro": "medio", "refugio": False},
    {"nombre": "Annúminas", "nombre_sindarin": None, "region": "Eriador", "tipo": "ruinas", "x": 22, "y": 60, "descripcion": "Antigua capital de Arnor junto al lago Nenuial", "peligro": "medio", "refugio": False},
    {"nombre": "Tharbad", "nombre_sindarin": None, "region": "Eriador", "tipo": "ruinas", "x": 28, "y": 42, "descripcion": "Ciudad abandonada junto al río Grisáurea", "peligro": "medio", "refugio": False},
    
    # === MONTAÑAS NUBLADAS ===
    {"nombre": "Paso de Caradhras", "nombre_sindarin": "Caradhras", "region": "Montañas Nubladas", "tipo": "paso_montaña", "x": 40, "y": 48, "descripcion": "Paso de montaña peligroso, conocido como el Cuerno Rojo", "peligro": "alto", "refugio": False},
    {"nombre": "Moria", "nombre_sindarin": "Khazad-dûm", "region": "Montañas Nubladas", "tipo": "mina_abandonada", "x": 41, "y": 46, "descripcion": "Antiguo reino enano, ahora infestado de orcos y peores cosas", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Lothlórien", "nombre_sindarin": "Laurelindórenan", "region": "Este de las Montañas", "tipo": "bosque_elfico", "x": 45, "y": 44, "descripcion": "Bosque de los Galadhrim, hogar de Galadriel y Celeborn", "peligro": "bajo", "refugio": True},
    {"nombre": "Isengard", "nombre_sindarin": "Angrenost", "region": "Nan Curunír", "tipo": "fortaleza", "x": 37, "y": 38, "descripcion": "Torre de Orthanc, fortaleza de Saruman", "peligro": "muy_alto", "refugio": False},
    
    # === ROHAN ===
    {"nombre": "Edoras", "nombre_sindarin": None, "region": "Rohan", "tipo": "ciudad", "x": 42, "y": 35, "descripcion": "Capital de Rohan, donde se alza Meduseld", "peligro": "bajo", "refugio": True},
    {"nombre": "Abismo de Helm", "nombre_sindarin": "Hornburg", "region": "Rohan", "tipo": "fortaleza", "x": 38, "y": 34, "descripcion": "Fortaleza defensiva en el Folde Oeste", "peligro": "medio", "refugio": True},
    {"nombre": "Fangorn", "nombre_sindarin": "Fangorn", "region": "Rohan", "tipo": "bosque_antiguo", "x": 42, "y": 40, "descripcion": "Bosque de los Ents, peligroso para los incautos", "peligro": "medio", "refugio": False},
    
    # === GONDOR ===
    {"nombre": "Minas Tirith", "nombre_sindarin": "Minas Anor", "region": "Gondor", "tipo": "ciudad_capital", "x": 50, "y": 28, "descripcion": "Ciudad de los Reyes, capital de Gondor", "peligro": "bajo", "refugio": True},
    {"nombre": "Osgiliath", "nombre_sindarin": None, "region": "Gondor", "tipo": "ruinas", "x": 52, "y": 28, "descripcion": "Antigua capital de Gondor, ahora en ruinas", "peligro": "alto", "refugio": False},
    {"nombre": "Minas Morgul", "nombre_sindarin": "Minas Ithil", "region": "Gondor", "tipo": "fortaleza_enemiga", "x": 55, "y": 28, "descripcion": "Torre de la Luna, ahora en manos del Enemigo", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Dol Amroth", "nombre_sindarin": None, "region": "Gondor", "tipo": "ciudad_puerto", "x": 42, "y": 22, "descripcion": "Puerto y ciudad de los Príncipes de Belfalas", "peligro": "bajo", "refugio": True},
    {"nombre": "Pelargir", "nombre_sindarin": None, "region": "Gondor", "tipo": "puerto", "x": 48, "y": 20, "descripcion": "Gran puerto en el río Anduin", "peligro": "medio", "refugio": True},
    {"nombre": "Cirith Ungol", "nombre_sindarin": None, "region": "Gondor/Mordor", "tipo": "paso_montaña", "x": 57, "y": 26, "descripcion": "Paso secreto hacia Mordor, guarida de Ella-Laraña", "peligro": "muy_alto", "refugio": False},
    
    # === MORDOR ===
    {"nombre": "Barad-dûr", "nombre_sindarin": None, "region": "Mordor", "tipo": "fortaleza_enemiga", "x": 62, "y": 26, "descripcion": "La Torre Oscura de Sauron", "peligro": "extremo", "refugio": False},
    {"nombre": "Monte del Destino", "nombre_sindarin": "Orodruin", "region": "Mordor", "tipo": "volcan", "x": 60, "y": 25, "descripcion": "Donde se forjó el Anillo Único", "peligro": "extremo", "refugio": False},
    {"nombre": "Morannon", "nombre_sindarin": "Puerta Negra", "region": "Mordor", "tipo": "fortaleza_enemiga", "x": 56, "y": 32, "descripcion": "La Puerta Negra de Mordor", "peligro": "extremo", "refugio": False},
    
    # === RHOVANION (Este) ===
    {"nombre": "Bosque Negro", "nombre_sindarin": "Mirkwood", "region": "Rhovanion", "tipo": "bosque_peligroso", "x": 55, "y": 55, "descripcion": "Bosque oscurecido por la Sombra", "peligro": "alto", "refugio": False},
    {"nombre": "Reino del Bosque", "nombre_sindarin": "Eryn Lasgalen", "region": "Bosque Negro", "tipo": "reino_elfico", "x": 58, "y": 60, "descripcion": "Reino del rey Thranduil", "peligro": "bajo", "refugio": True},
    {"nombre": "Dol Guldur", "nombre_sindarin": None, "region": "Bosque Negro", "tipo": "fortaleza_enemiga", "x": 52, "y": 50, "descripcion": "Antigua fortaleza del Nigromante", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Erebor", "nombre_sindarin": "La Montaña Solitaria", "region": "Rhovanion", "tipo": "reino_enano", "x": 62, "y": 65, "descripcion": "Reino bajo la Montaña de los Enanos", "peligro": "bajo", "refugio": True},
    {"nombre": "Valle", "nombre_sindarin": "Dale", "region": "Rhovanion", "tipo": "ciudad", "x": 61, "y": 64, "descripcion": "Ciudad de los Hombres junto a Erebor", "peligro": "bajo", "refugio": True},
    {"nombre": "Esgaroth", "nombre_sindarin": "Ciudad del Lago", "region": "Rhovanion", "tipo": "ciudad_lago", "x": 60, "y": 62, "descripcion": "Ciudad sobre el Lago Largo", "peligro": "bajo", "refugio": True},
    {"nombre": "Carrock", "nombre_sindarin": None, "region": "Rhovanion", "tipo": "paso", "x": 48, "y": 55, "descripcion": "Roca en el río Anduin, hogar de Beorn", "peligro": "medio", "refugio": True},
    
    # === HARAD Y SUR ===
    {"nombre": "Umbar", "nombre_sindarin": None, "region": "Harad", "tipo": "puerto_enemigo", "x": 48, "y": 8, "descripcion": "Refugio de los Corsarios", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Harad", "nombre_sindarin": None, "region": "Sur", "tipo": "region", "x": 55, "y": 10, "descripcion": "Tierras del Sur, aliadas de Mordor", "peligro": "alto", "refugio": False},
    
    # === NORTE ===
    {"nombre": "Angmar", "nombre_sindarin": None, "region": "Norte", "tipo": "region_maldita", "x": 35, "y": 75, "descripcion": "Antiguo reino del Rey Brujo", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Carn Dûm", "nombre_sindarin": None, "region": "Angmar", "tipo": "fortaleza_abandonada", "x": 38, "y": 78, "descripcion": "Capital de Angmar, ahora en ruinas", "peligro": "muy_alto", "refugio": False},
    {"nombre": "Montañas Grises", "nombre_sindarin": "Ered Mithrin", "region": "Norte", "tipo": "cordillera", "x": 55, "y": 75, "descripcion": "Montañas del norte, hogar de dragones", "peligro": "alto", "refugio": False},
]


async def create_locations():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Clear existing locations
    await db.locations.delete_many({})
    
    # Insert all locations with generated IDs
    for i, loc in enumerate(LOCATIONS):
        loc["_id"] = f"loc_{i+1:03d}"
        loc["created_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.locations.insert_many(LOCATIONS)
    print(f"Inserted {len(result.inserted_ids)} locations")
    
    # Create index on region and tipo
    await db.locations.create_index("region")
    await db.locations.create_index("tipo")
    await db.locations.create_index("nombre")
    
    # Print summary by region
    regions = {}
    for loc in LOCATIONS:
        r = loc["region"]
        if r not in regions:
            regions[r] = 0
        regions[r] += 1
    
    print("\nLocations by region:")
    for r, count in sorted(regions.items()):
        print(f"  {r}: {count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_locations())
